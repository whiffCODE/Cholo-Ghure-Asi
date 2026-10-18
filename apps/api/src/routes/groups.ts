
import { Router } from "express";
import { Types } from "mongoose";
import crypto from "node:crypto";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import User from "../models/User";
import PujaGroup from "../models/PujaGroup";

const router = Router();

router.use(requireAuth);

function me(req: AuthenticatedRequest) {
  return req.userId!;
}

function validId(value: string) {
  return Types.ObjectId.isValid(value);
}

function hashInviteCode(code: string) {
  return crypto
    .createHash("sha256")
    .update(code.trim().toUpperCase())
    .digest("hex");
}

function generateInviteCode() {
  // A readable, case-insensitive code. Only its hash is stored.
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

function safeMember(user: any) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    avatarUrl: "/api/auth/avatar",
  };
}

function safeGroup(group: any) {
  return {
    id: String(group._id),
    name: group.name,
    createdBy: String(group.createdBy),
    memberCount: group.members.length,
    inviteCodeLast4: group.inviteCodeLast4,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

// Create a group. The raw invite code is returned only once.
router.post("/", async (req, res, next) => {
  try {
    const parsed = z.object({
      name: z.string().trim().min(2).max(60),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Group name must contain 2 to 60 characters.",
      });
    }

    const creatorId = me(req as AuthenticatedRequest);
    const code = generateInviteCode();

    const group = await PujaGroup.create({
      name: parsed.data.name,
      createdBy: creatorId,
      members: [creatorId],
      inviteCodeHash: hashInviteCode(code),
      inviteCodeLast4: code.slice(-4),
      inviteCodeVersion: 1,
    });

    return res.status(201).json({
      message: "Group created successfully.",
      group: safeGroup(group),
      inviteCode: code,
    });
  } catch (error) {
    next(error);
  }
});

// List groups that the current user belongs to.
router.get("/", async (req, res, next) => {
  try {
    const currentUserId = me(req as AuthenticatedRequest);

    const groups = await PujaGroup.find({
      members: currentUserId,
    }).sort({ updatedAt: -1 });

    return res.json({ groups: groups.map(safeGroup) });
  } catch (error) {
    next(error);
  }
});

// Join a group by invite code.
router.post("/join", async (req, res, next) => {
  try {
    const parsed = z.object({
      inviteCode: z.string().trim().min(6).max(32),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Enter a valid invite code." });
    }

    const currentUserId = me(req as AuthenticatedRequest);
    const code = parsed.data.inviteCode.toUpperCase();

    const group = await PujaGroup.findOne({
      inviteCodeHash: hashInviteCode(code),
    }).select("+inviteCodeHash");

    if (!group) {
      return res.status(404).json({
        error: "Invite code not found. Check the code and try again.",
      });
    }

    if (group.members.some((id: Types.ObjectId) =>
      String(id) === currentUserId
    )) {
      return res.status(409).json({
        error: "You are already a member of this group.",
      });
    }

    group.members.push(new Types.ObjectId(currentUserId));
    await group.save();

    return res.json({
      message: `You joined ${group.name}.`,
      group: safeGroup(group),
    });
  } catch (error) {
    next(error);
  }
});

// Get group details and member profiles.
// Membership is checked before member data is returned.
router.get("/:groupId", async (req, res, next) => {
  try {
    if (!validId(req.params.groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const currentUserId = me(req as AuthenticatedRequest);

    const group = await PujaGroup.findOne({
      _id: req.params.groupId,
      members: currentUserId,
    });

    if (!group) {
      return res.status(404).json({
        error: "Group not found or you are not a member.",
      });
    }

    const users = await User.find({
      _id: { $in: group.members },
    }).select("_id fullName email");

    return res.json({
      group: safeGroup(group),
      members: users.map(safeMember),
      isCreator: String(group.createdBy) === currentUserId,
    });
  } catch (error) {
    next(error);
  }
});

// Leave a group. The creator must delete the group first.
router.post("/:groupId/leave", async (req, res, next) => {
  try {
    if (!validId(req.params.groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const currentUserId = me(req as AuthenticatedRequest);
    const group = await PujaGroup.findOne({
      _id: req.params.groupId,
      members: currentUserId,
    });

    if (!group) {
      return res.status(404).json({
        error: "Group not found or you are not a member.",
      });
    }

    if (String(group.createdBy) === currentUserId) {
      return res.status(409).json({
        error: "The group creator must delete the group before leaving.",
      });
    }

    group.members = group.members.filter(
      (id: Types.ObjectId) => String(id) !== currentUserId
    );

    await group.save();

    return res.json({ message: "You left the group." });
  } catch (error) {
    next(error);
  }
});

// Regenerate the invite code. Only the creator can do this.
// Previous codes become invalid immediately.
router.post("/:groupId/regenerate-code", async (req, res, next) => {
  try {
    if (!validId(req.params.groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const currentUserId = me(req as AuthenticatedRequest);
    const group = await PujaGroup.findOne({
      _id: req.params.groupId,
      createdBy: currentUserId,
    }).select("+inviteCodeHash");

    if (!group) {
      return res.status(404).json({
        error: "Group not found or you are not its creator.",
      });
    }

    const code = generateInviteCode();

    group.inviteCodeHash = hashInviteCode(code);
    group.inviteCodeLast4 = code.slice(-4);
    group.inviteCodeVersion += 1;

    await group.save();

    return res.json({
      message: "Invite code regenerated. The previous code no longer works.",
      inviteCode: code,
      inviteCodeLast4: group.inviteCodeLast4,
    });
  } catch (error) {
    next(error);
  }
});

// Delete a group. Only the creator can delete it.
router.delete("/:groupId", async (req, res, next) => {
  try {
    if (!validId(req.params.groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const currentUserId = me(req as AuthenticatedRequest);

    const result = await PujaGroup.deleteOne({
      _id: req.params.groupId,
      createdBy: currentUserId,
    });

    if (!result.deletedCount) {
      return res.status(404).json({
        error: "Group not found or you are not its creator.",
      });
    }

    return res.json({ message: "Group deleted." });
  } catch (error) {
    next(error);
  }
});

export default router;
