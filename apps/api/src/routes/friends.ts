import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth";
import User from "../models/User";
import FriendRequest from "../models/FriendRequest";
import Friendship from "../models/Friendship";

const router = Router();

router.use(requireAuth);

function userId(req: AuthenticatedRequest): string {
  if (!req.userId) {
    throw new Error("Authenticated user ID is missing.");
  }
  return req.userId;
}

function pairFor(a: string, b: string): string {
  return [a, b].sort().join(":");
}

function validId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}

function safeUser(user: { _id: unknown; fullName: string; email: string }) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
  };
}

// Search by exact email. Never expose a directory of registered users.
router.get("/search", async (req, res, next) => {
  try {
    const parsed = z.object({
      email: z.string().trim().email().max(254),
    }).safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: "Enter a valid email." });
    }

    const email = parsed.data.email.toLowerCase();
    const me = userId(req as AuthenticatedRequest);

    const user = await User.findOne({
      email,
      _id: { $ne: me },
    }).select("_id fullName email");

    if (!user) return res.json({ user: null });

    const existingFriendship = await Friendship.exists({
      pairKey: pairFor(me, String(user._id)),
    });

    const existingRequest = await FriendRequest.findOne({
      $or: [
        { requester: me, recipient: user._id, status: "pending" },
        { requester: user._id, recipient: me, status: "pending" },
      ],
    }).select("requester recipient status");

    return res.json({
      user: safeUser(user),
      isFriend: Boolean(existingFriendship),
      request: existingRequest
        ? {
            direction: String(existingRequest.requester) === me
              ? "outgoing"
              : "incoming",
            status: existingRequest.status,
          }
        : null,
    });
  } catch (error) {
    return next(error);
  }
});

// Send a friend request.
router.post("/requests", async (req, res, next) => {
  try {
    const parsed = z.object({
      recipientId: z.string().refine(validId),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid recipient." });
    }

    const me = userId(req as AuthenticatedRequest);
    const recipientId = parsed.data.recipientId;

    if (me === recipientId) {
      return res.status(400).json({
        error: "You cannot send a friend request to yourself.",
      });
    }

    if (!(await User.exists({ _id: recipientId }))) {
      return res.status(404).json({ error: "User not found." });
    }

    const key = pairFor(me, recipientId);
    if (await Friendship.exists({ pairKey: key })) {
      return res.status(409).json({ error: "You are already friends." });
    }

    const reverse = await FriendRequest.findOne({
      requester: recipientId,
      recipient: me,
      status: "pending",
    });

    if (reverse) {
      return res.status(409).json({
        error: "This user has already requested to be your friend.",
        incomingRequestId: String(reverse._id),
      });
    }

    const existing = await FriendRequest.findOne({
      requester: me,
      recipient: recipientId,
    });

    if (existing?.status === "pending") {
      return res.status(409).json({ error: "Request already sent." });
    }

    if (existing) {
      existing.status = "pending";
      await existing.save();
      return res.status(200).json({
        message: "Friend request sent.",
        requestId: String(existing._id),
      });
    }

    const request = await FriendRequest.create({
      requester: me,
      recipient: recipientId,
      status: "pending",
    });

    return res.status(201).json({
      message: "Friend request sent.",
      requestId: String(request._id),
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return res.status(409).json({ error: "Request already exists." });
    }
    return next(error);
  }
});

// View incoming and outgoing pending requests.
router.get("/requests", async (req, res, next) => {
  try {
    const me = userId(req as AuthenticatedRequest);

    const [incoming, outgoing] = await Promise.all([
      FriendRequest.find({ recipient: me, status: "pending" })
        .populate("requester", "fullName email")
        .sort({ createdAt: -1 }),
      FriendRequest.find({ requester: me, status: "pending" })
        .populate("recipient", "fullName email")
        .sort({ createdAt: -1 }),
    ]);

    return res.json({
      incoming: incoming.map((request: any) => ({
        id: String(request._id),
        user: request.requester ? safeUser(request.requester) : null,
        createdAt: request.createdAt,
      })),
      outgoing: outgoing.map((request: any) => ({
        id: String(request._id),
        user: request.recipient ? safeUser(request.recipient) : null,
        createdAt: request.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

// Accept or decline a request addressed to the current user.
router.patch("/requests/:requestId", async (req, res, next) => {
  try {
    const parsed = z.object({
      action: z.enum(["accept", "decline"]),
    }).safeParse(req.body);

    const requestId = req.params.requestId;
    if (!parsed.success || !validId(requestId)) {
      return res.status(400).json({ error: "Invalid request." });
    }

    const me = userId(req as AuthenticatedRequest);
    const request = await FriendRequest.findOne({
      _id: requestId,
      recipient: me,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({
        error: "Pending friend request not found.",
      });
    }

    if (parsed.data.action === "decline") {
      request.status = "declined";
      await request.save();
      return res.json({ message: "Request declined." });
    }

    const requesterId = String(request.requester);
    const key = pairFor(me, requesterId);
    const [userA, userB] = [me, requesterId].sort();

    await Friendship.updateOne(
      { pairKey: key },
      { $setOnInsert: { userA, userB, pairKey: key } },
      { upsert: true }
    );

    request.status = "accepted";
    await request.save();

    return res.json({ message: "Friend request accepted." });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return res.status(409).json({
        error: "A friendship or request already exists.",
      });
    }
    return next(error);
  }
});

// List the signed-in user's friends.
router.get("/", async (req, res, next) => {
  try {
    const me = userId(req as AuthenticatedRequest);
    const friendships = await Friendship.find({
      $or: [{ userA: me }, { userB: me }],
    }).lean();

    const ids = friendships.map((friendship: any) =>
      String(friendship.userA) === me ? friendship.userB : friendship.userA
    );

    const users = await User.find({ _id: { $in: ids } })
      .select("_id fullName email")
      .sort({ fullName: 1 });

    return res.json({ friends: users.map(safeUser) });
  } catch (error) {
    return next(error);
  }
});

// Remove a friendship. Either participant can remove it.
router.delete("/:friendId", async (req, res, next) => {
  try {
    const friendId = req.params.friendId;
    if (!validId(friendId)) {
      return res.status(400).json({ error: "Invalid friend ID." });
    }

    const me = userId(req as AuthenticatedRequest);
    if (me === friendId) {
      return res.status(400).json({
        error: "You cannot remove yourself as a friend.",
      });
    }

    const result = await Friendship.deleteOne({
      pairKey: pairFor(me, friendId),
    });

    if (!result.deletedCount) {
      return res.status(404).json({ error: "Friendship not found." });
    }

    return res.json({ message: "Friend removed." });
  } catch (error) {
    return next(error);
  }
});

export default router;
