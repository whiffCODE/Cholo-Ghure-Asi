import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { z } from "zod";
import LiveLocation from "../models/LiveLocation";
import PujaGroup from "../models/PujaGroup";
import User from "../models/User";

const router = Router();
const COOKIE = "cga_session";
const LOCATION_TTL_MS = 2 * 60 * 1000;
router.use(rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many location requests. Try again shortly." } }));

function currentUserId(req: Request, res: Response): string | null {
  const token = req.cookies?.[COOKIE];
  if (typeof token !== "string" || !process.env.JWT_SECRET) { res.status(401).json({ error: "Please sign in." }); return null; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: "cholo-ghure-asi" });
    if (typeof payload === "string" || typeof payload.sub !== "string" || !Types.ObjectId.isValid(payload.sub)) {
      res.status(401).json({ error: "Please sign in." }); return null;
    }
    return payload.sub;
  } catch { res.status(401).json({ error: "Please sign in." }); return null; }
}
const validId = (value: string) => Types.ObjectId.isValid(value);
const groupBody = z.object({ groupId: z.string().refine(validId) });
async function isGroupMember(groupId: string, userId: string) {
  return Boolean(await PujaGroup.exists({ _id: groupId, memberIds: new Types.ObjectId(userId) }));
}

router.get("/status", async (req, res, next) => {
  const me = currentUserId(req, res); if (!me) return;
  try {
    const row: any = await LiveLocation.findOne({ userId: me }).lean();
    return res.json({ sharingEnabled: row?.sharingEnabled === true, activeGroupIds: (row?.activeGroupIds ?? []).map((id: any) => String(id)), locationUpdatedAt: row?.locationUpdatedAt ?? null, expiresAt: row?.expiresAt ?? null });
  } catch (error) { return next(error); }
});

// Consent is explicit. Starting a group does not collect or return coordinates.
router.post("/start", async (req, res, next) => {
  const me = currentUserId(req, res); if (!me) return;
  try {
    const parsed = groupBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose a valid group." });
    const { groupId } = parsed.data;
    if (!(await isGroupMember(groupId, me))) return res.status(403).json({ error: "You must be a member of this group to share location." });
    await LiveLocation.findOneAndUpdate({ userId: me }, {
      $set: { sharingEnabled: true }, $addToSet: { activeGroupIds: new Types.ObjectId(groupId) },
      $setOnInsert: { userId: new Types.ObjectId(me), latitude: null, longitude: null, locationUpdatedAt: null, expiresAt: null },
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return res.json({ message: "Location sharing enabled for this group. Coordinates are not shared until you send a location update.", sharingEnabled: true, groupId });
  } catch (error) { return next(error); }
});

const locationBody = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) });
router.put("/location", async (req, res, next) => {
  const me = currentUserId(req, res); if (!me) return;
  try {
    const parsed = locationBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Provide valid latitude and longitude coordinates." });
    const row: any = await LiveLocation.findOne({ userId: me, sharingEnabled: true }).lean();
    if (!row || !(row.activeGroupIds ?? []).length) return res.status(409).json({ error: "Start location sharing with a group before sending coordinates." });

    // Prune group memberships that have since been revoked.
    const validGroups: Types.ObjectId[] = [];
    for (const id of row.activeGroupIds) if (await isGroupMember(String(id), me)) validGroups.push(new Types.ObjectId(String(id)));
    if (!validGroups.length) {
      await LiveLocation.updateOne({ userId: me }, { $set: { sharingEnabled: false, activeGroupIds: [], latitude: null, longitude: null, locationUpdatedAt: null, expiresAt: null } });
      return res.status(403).json({ error: "You are no longer a member of an active sharing group." });
    }
    const now = new Date();
    await LiveLocation.updateOne({ userId: me, sharingEnabled: true }, { $set: { activeGroupIds: validGroups, latitude: parsed.data.latitude, longitude: parsed.data.longitude, locationUpdatedAt: now, expiresAt: new Date(now.getTime() + LOCATION_TTL_MS) } });
    return res.json({ message: "Location updated.", locationUpdatedAt: now, expiresAt: new Date(now.getTime() + LOCATION_TTL_MS) });
  } catch (error) { return next(error); }
});

router.get("/groups/:groupId", async (req, res, next) => {
  const me = currentUserId(req, res); if (!me) return;
  try {
    const { groupId } = req.params;
    if (!validId(groupId)) return res.status(400).json({ error: "Invalid group." });
    const group: any = await PujaGroup.findById(groupId).select("memberIds").lean();
    if (!group || !(group.memberIds ?? []).some((id: any) => String(id) === me)) {
      return res.status(403).json({ error: "Only current group members can view shared locations." });
    }
    const currentMemberIds = new Set((group.memberIds ?? []).map((id: any) => String(id)));
    const now = new Date();
    const rows: any[] = await LiveLocation.find({ sharingEnabled: true, activeGroupIds: new Types.ObjectId(groupId), expiresAt: { $gt: now }, latitude: { $ne: null }, longitude: { $ne: null } })
      .populate({ path: "userId", model: User, select: "_id fullName" })
      .select("userId latitude longitude locationUpdatedAt expiresAt").lean();
    // A removed member's old activeGroupIds entry must not leak their location.
    const locations = rows.filter(row => row.userId && currentMemberIds.has(String(row.userId._id))).map(row => ({ userId: String(row.userId._id), fullName: row.userId.fullName ?? "Group member", latitude: row.latitude, longitude: row.longitude, updatedAt: row.locationUpdatedAt, expiresAt: row.expiresAt }));
    return res.json({ groupId, locations, asOf: now, freshnessWindowMs: LOCATION_TTL_MS });
  } catch (error) { return next(error); }
});

// Pass { groupId } to stop for one group, or {} to stop everywhere and clear coordinates.
router.post("/stop", async (req, res, next) => {
  const me = currentUserId(req, res); if (!me) return;
  try {
    const parsed = z.object({ groupId: z.string().refine(validId).optional() }).safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: "Invalid group." });
    if (parsed.data.groupId) {
      const groupId = parsed.data.groupId;
      const row: any = await LiveLocation.findOne({ userId: me }).lean();
      const active = (row?.activeGroupIds ?? []).filter((id: any) => String(id) !== groupId);
      if (row && active.length !== (row.activeGroupIds ?? []).length) {
        if (!active.length) await LiveLocation.updateOne({ userId: me }, { $set: { sharingEnabled: false, activeGroupIds: [], latitude: null, longitude: null, locationUpdatedAt: null, expiresAt: null } });
        else await LiveLocation.updateOne({ userId: me }, { $set: { activeGroupIds: active } });
      }
      return res.json({ message: "Location sharing stopped for this group." });
    }
    await LiveLocation.updateOne({ userId: me }, { $set: { sharingEnabled: false, activeGroupIds: [], latitude: null, longitude: null, locationUpdatedAt: null, expiresAt: null } }, { upsert: true, setDefaultsOnInsert: true });
    return res.json({ message: "Location sharing stopped. Stored coordinates were cleared.", sharingEnabled: false });
  } catch (error) { return next(error); }
});

export default router;
