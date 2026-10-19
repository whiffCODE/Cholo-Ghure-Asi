import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import crypto from "node:crypto";
import { z } from "zod";
import User from "../models/User";
import FriendRequest from "../models/FriendRequest";
import Friendship from "../models/Friendship";
import PujaGroup from "../models/PujaGroup";

const router = Router();
const COOKIE = "cga_session";
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many requests. Try again shortly." } }));

function currentUserId(req: Request): string | null {
  const token = req.cookies?.[COOKIE];
  if (typeof token !== "string" || !process.env.JWT_SECRET) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: "cholo-ghure-asi" });
    if (typeof payload === "string" || !payload.sub) return null;
    const id = String(payload.sub);
    return Types.ObjectId.isValid(id) ? id : null;
  } catch { return null; }
}
function auth(req: Request, res: Response): string | null {
  const id = currentUserId(req);
  if (!id) res.status(401).json({ error: "Please sign in." });
  return id;
}
function validId(id: string) { return Types.ObjectId.isValid(id); }
function pair(a: string, b: string) {
  return a.toLowerCase() < b.toLowerCase()
    ? { userA: new Types.ObjectId(a), userB: new Types.ObjectId(b) }
    : { userA: new Types.ObjectId(b), userB: new Types.ObjectId(a) };
}
function person(u: any) { return { id: String(u._id), fullName: u.fullName, email: u.email, phone: u.phone }; }
function groupDto(g: any, viewerId: string) {
  const ownerId = String(g.ownerId?._id ?? g.ownerId);
  const members = (g.memberIds ?? []).filter((m: any) => m && m.fullName).map((m: any) => ({ id: String(m._id), fullName: m.fullName, email: m.email }));
  return { id: String(g._id), name: g.name, description: g.description ?? "", inviteCode: g.inviteCode, isOwner: ownerId === viewerId, memberCount: g.memberIds?.length ?? 0, members, owner: g.ownerId?.fullName ? { id: ownerId, fullName: g.ownerId.fullName } : null, createdAt: g.createdAt };
}
async function newCode(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = crypto.randomBytes(5).toString("hex").toUpperCase();
    if (!(await PujaGroup.exists({ inviteCode: code }))) return code;
  }
  throw new Error("Could not generate an invite code. Please retry.");
}
function errors(error: unknown, res: Response, next: NextFunction) {
  if (error && typeof error === "object" && "code" in error && (error as any).code === 11000) return res.status(409).json({ error: "That record already exists. Refresh and try again." });
  return next(error);
}

// Exact email or phone lookup only; this avoids broad user enumeration.
router.get("/users/search", async (req, res, next) => {
  const me = auth(req, res); if (!me) return;
  try {
    const q = z.string().trim().min(3).max(254).safeParse(req.query.q);
    if (!q.success) return res.status(400).json({ error: "Enter at least 3 characters." });
    const raw = q.data;
    const ors: Record<string, unknown>[] = [];
    if (raw.includes("@")) ors.push({ email: raw.toLowerCase() });
    if (/^[+\d\s()-]{3,20}$/.test(raw)) {
      const p = raw.replace(/[\s()-]/g, "");
      const phone = p.startsWith("+91") ? p : p.startsWith("91") && p.length === 12 ? `+${p}` : p.length === 10 ? `+91${p}` : "";
      if (phone) ors.push({ phone });
    }
    if (!ors.length) return res.json({ users: [] });
    const users = await User.find({ $or: ors, _id: { $ne: me } }).select("_id fullName email phone").limit(10).lean();
    const result = await Promise.all(users.map(async (u: any) => {
      const ids = pair(me, String(u._id));
      const [friend, sent, incoming] = await Promise.all([
        Friendship.exists(ids),
        FriendRequest.exists({ fromUserId: me, toUserId: u._id, status: "pending" }),
        FriendRequest.exists({ fromUserId: u._id, toUserId: me, status: "pending" }),
      ]);
      return { ...person(u), relationship: friend ? "friend" : sent ? "sent" : incoming ? "incoming" : "none" };
    }));
    return res.json({ users: result });
  } catch (e) { return next(e); }
});

router.get("/friends", async (req, res, next) => {
  const me = auth(req, res); if (!me) return;
  try {
    const rows: any[] = await Friendship.find({ $or: [{ userA: me }, { userB: me }] }).lean();
    const ids = rows.map(r => String(r.userA) === me ? r.userB : r.userA);
    const users = await User.find({ _id: { $in: ids } }).select("_id fullName email phone").sort({ fullName: 1 }).lean();
    return res.json({ friends: users.map(person) });
  } catch (e) { return next(e); }
});

// Remove a friend. Either person in the friendship can initiate this action.
router.delete("/friends/:friendId", async (req, res, next) => {
  const me = auth(req, res);
  if (!me) return;

  try {
    const friendId = req.params.friendId;

    if (!validId(friendId)) {
      return res.status(400).json({ error: "Invalid friend." });
    }

    if (friendId === me) {
      return res.status(400).json({
        error: "You cannot unfriend yourself.",
      });
    }

    const friendship = await Friendship.findOneAndDelete(
      pair(me, friendId)
    );

    if (!friendship) {
      return res.status(404).json({
        error: "Friendship not found. The person may already be removed.",
      });
    }

    return res.json({
      message: "Friend removed successfully.",
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/friends/requests", async (req, res, next) => {
  const me = auth(req, res); if (!me) return;
  try {
    const [incoming, outgoing] = await Promise.all([
      FriendRequest.find({ toUserId: me, status: "pending" }).populate("fromUserId", "_id fullName email phone").sort({ createdAt: -1 }).lean(),
      FriendRequest.find({ fromUserId: me, status: "pending" }).populate("toUserId", "_id fullName email phone").sort({ createdAt: -1 }).lean(),
    ]);
    return res.json({
      incoming: incoming.filter((r: any) => r.fromUserId).map((r: any) => ({ requestId: String(r._id), user: person(r.fromUserId) })),
      outgoing: outgoing.filter((r: any) => r.toUserId).map((r: any) => ({ requestId: String(r._id), user: person(r.toUserId) })),
    });
  } catch (e) { return next(e); }
});

router.post("/friends/requests", async (req, res, next) => {
  const me = auth(req, res); if (!me) return;
  try {
    const body = z.object({ userId: z.string().refine(validId) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Choose a valid user." });
    const target = body.data.userId;
    if (target === me) return res.status(400).json({ error: "You cannot add yourself." });
    if (!(await User.exists({ _id: target }))) return res.status(404).json({ error: "User not found." });
    if (await Friendship.exists(pair(me, target))) return res.status(409).json({ error: "You are already friends." });
    if (await FriendRequest.exists({ fromUserId: target, toUserId: me, status: "pending" })) return res.status(409).json({ error: "This person has already requested you. Accept their incoming request." });
    const existing = await FriendRequest.findOne({ fromUserId: me, toUserId: target });
    if (existing?.status === "pending") return res.status(409).json({ error: "Friend request already sent." });
    if (existing) { existing.status = "pending"; existing.respondedAt = null; await existing.save(); }
    else await FriendRequest.create({ fromUserId: me, toUserId: target, status: "pending" });
    return res.status(201).json({ message: "Friend request sent." });
  } catch (e) { return errors(e, res, next); }
});

router.post("/friends/requests/:requestId/respond", async (req, res, next) => {
  const me = auth(req, res); if (!me) return;
  try {
    if (!validId(req.params.requestId)) return res.status(400).json({ error: "Invalid request." });
    const body = z.object({ action: z.enum(["accept", "decline"]) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Choose accept or decline." });
    const request: any = await FriendRequest.findOne({ _id: req.params.requestId, toUserId: me, status: "pending" });
    if (!request) return res.status(404).json({ error: "Pending request not found." });
    if (body.data.action === "decline") {
      request.status = "declined"; request.respondedAt = new Date(); await request.save();
      return res.json({ message: "Friend request declined." });
    }
    const ids = pair(String(request.fromUserId), me);
    await Friendship.updateOne(ids, { $setOnInsert: { ...ids, createdByRequestId: request._id } }, { upsert: true });
    request.status = "accepted"; request.respondedAt = new Date(); await request.save();
    return res.json({ message: "Friend request accepted." });
  } catch (e) { return errors(e, res, next); }
});

router.get("/groups", async (req, res, next) => {
  const me = auth(req, res); if (!me) return;
  try {
    const groups = await PujaGroup.find({ memberIds: me }).populate("ownerId", "_id fullName").populate("memberIds", "_id fullName email").sort({ updatedAt: -1 }).lean();
    return res.json({ groups: groups.map((g: any) => groupDto(g, me)) });
  } catch (e) { return next(e); }
});

router.post("/groups", async (req, res, next) => {
  const me = auth(req, res); if (!me) return;
  try {
    const body = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(240).optional().default("") }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Enter a group name between 2 and 60 characters." });
    const group = await PujaGroup.create({ ...body.data, ownerId: me, memberIds: [me], inviteCode: await newCode() });
    const full: any = await PujaGroup.findById(group._id).populate("ownerId", "_id fullName").populate("memberIds", "_id fullName email").lean();
    return res.status(201).json({ message: "Group created successfully.", group: groupDto(full, me) });
  } catch (e) { return errors(e, res, next); }
});

router.post("/groups/join", async (req, res, next) => {
  const me = auth(req, res); if (!me) return;
  try {
    const body = z.object({ inviteCode: z.string().trim().toUpperCase().regex(/^[A-F0-9]{10}$/) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Enter a valid 10-character invite code." });
    const group: any = await PujaGroup.findOne({ inviteCode: body.data.inviteCode });
    if (!group) return res.status(404).json({ error: "Invite code not found or no longer active." });
    if (group.memberIds.some((id: any) => String(id) === me)) return res.status(409).json({ error: "You are already in this group." });
    if (group.memberIds.length >= 100) return res.status(409).json({ error: "This group has reached its 100-member limit." });
    const updated = await PujaGroup.findOneAndUpdate({ _id: group._id, inviteCode: body.data.inviteCode, memberIds: { $ne: new Types.ObjectId(me) }, $expr: { $lt: [{ $size: "$memberIds" }, 100] } }, { $addToSet: { memberIds: new Types.ObjectId(me) } }, { new: true });
    if (!updated) return res.status(409).json({ error: "Could not join this group. Refresh and try again." });
    return res.json({ message: `You joined “${updated.name}”.` });
  } catch (e) { return next(e); }
});

router.post("/groups/:groupId/leave", async (req, res, next) => {
  const me = auth(req, res); if (!me) return;
  try {
    if (!validId(req.params.groupId)) return res.status(400).json({ error: "Invalid group." });
    const group: any = await PujaGroup.findOne({ _id: req.params.groupId, memberIds: me });
    if (!group) return res.status(404).json({ error: "Group not found or you are not a member." });
    if (String(group.ownerId) === me) {
      await PujaGroup.deleteOne({ _id: group._id, ownerId: me });
      return res.json({ message: `“${group.name}” was deleted.` });
    }
    group.memberIds = group.memberIds.filter((id: any) => String(id) !== me);
    await group.save();
    return res.json({ message: `You left “${group.name}”.` });
  } catch (e) { return next(e); }
});

// Only the group owner can remove another member. Owners must use the existing
// /leave endpoint to delete the group for everyone; they cannot remove themselves here.
router.delete("/groups/:groupId/members/:memberId", async (req, res, next) => {
  const me = auth(req, res); if (!me) return;
  try {
    const { groupId, memberId } = req.params;
    if (!validId(groupId) || !validId(memberId)) return res.status(400).json({ error: "Invalid group or member." });
    if (memberId === me) return res.status(400).json({ error: "You cannot remove yourself with this action. Use Leave group instead." });
    const group: any = await PujaGroup.findOne({ _id: groupId, ownerId: me });
    if (!group) return res.status(404).json({ error: "Group not found or you are not the organiser." });
    const isMember = group.memberIds.some((id: any) => String(id) === memberId);
    if (!isMember) return res.status(404).json({ error: "That person is not a member of this group." });
    group.memberIds = group.memberIds.filter((id: any) => String(id) !== memberId);
    await group.save();
    return res.json({ message: "Member removed from the group." });
  } catch (e) { return next(e); }
});

router.post("/groups/:groupId/regenerate-invite", async (req, res, next) => {
  const me = auth(req, res); if (!me) return;
  try {
    if (!validId(req.params.groupId)) return res.status(400).json({ error: "Invalid group." });
    const group: any = await PujaGroup.findOne({ _id: req.params.groupId, ownerId: me });
    if (!group) return res.status(404).json({ error: "Group not found or you are not the organiser." });
    group.inviteCode = await newCode(); await group.save();
    return res.json({ message: "Invite code regenerated.", inviteCode: group.inviteCode });
  } catch (e) { return errors(e, res, next); }
});


router.delete(
  "/groups/:groupId/members/:memberId",
  async (req, res, next) => {
    const me = auth(req, res);
    if (!me) return;

    try {
      const { groupId, memberId } = req.params;

      if (!validId(groupId) || !validId(memberId)) {
        return res.status(400).json({
          error: "Invalid group or member.",
        });
      }

      if (memberId === me) {
        return res.status(400).json({
          error: "You cannot remove yourself with this action. Use Leave group instead.",
        });
      }

      const group = await PujaGroup.findOne({
        _id: groupId,
        ownerId: me,
      });

      if (!group) {
        return res.status(404).json({
          error: "Group not found or you are not the organiser.",
        });
      }

      const isMember = group.memberIds.some(
        (id) => String(id) === memberId
      );

      if (!isMember) {
        return res.status(404).json({
          error: "That person is not a member of this group.",
        });
      }

      group.memberIds = group.memberIds.filter(
        (id) => String(id) !== memberId
      );

      await group.save();

      return res.json({
        message: "Member removed from the group.",
      });
    } catch (error) {
      return next(error);
    }
  }
);
export default router;
