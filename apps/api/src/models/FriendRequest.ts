import { Schema, model, models } from "mongoose";
const schema = new Schema({
  fromUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  toUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending", required: true, index: true },
  respondedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });
export default models.FriendRequest || model("FriendRequest", schema);
