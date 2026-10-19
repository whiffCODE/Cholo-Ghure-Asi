import { Schema, model, models } from "mongoose";

// One document per user. Expiry is enforced by reads, not a TTL index, so
// MongoDB cannot accidentally delete the user's consent state.
const LiveLocationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  sharingEnabled: { type: Boolean, default: false, required: true },
  activeGroupIds: { type: [{ type: Schema.Types.ObjectId, ref: "PujaGroup" }], default: [] },
  latitude: { type: Number, min: -90, max: 90, default: null },
  longitude: { type: Number, min: -180, max: 180, default: null },
  locationUpdatedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null, index: true },
}, { timestamps: true, versionKey: false });

LiveLocationSchema.index({ activeGroupIds: 1, sharingEnabled: 1, expiresAt: 1 });
export default models.LiveLocation || model("LiveLocation", LiveLocationSchema);
