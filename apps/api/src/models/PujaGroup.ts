import { Schema, model, models } from "mongoose";
const schema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  description: { type: String, trim: true, maxlength: 240, default: "" },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  memberIds: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
  inviteCode: { type: String, required: true, unique: true, index: true },
}, { timestamps: true });
schema.index({ memberIds: 1 });
export default models.PujaGroup || model("PujaGroup", schema);
