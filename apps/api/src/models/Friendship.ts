import { Schema, model, models } from "mongoose";
const schema = new Schema({
  userA: { type: Schema.Types.ObjectId, ref: "User", required: true },
  userB: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdByRequestId: { type: Schema.Types.ObjectId, ref: "FriendRequest", required: true },
}, { timestamps: true });
schema.index({ userA: 1, userB: 1 }, { unique: true });
export default models.Friendship || model("Friendship", schema);
