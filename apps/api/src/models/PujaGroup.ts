
import { Schema, model, models } from "mongoose";

const pujaGroupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [{
      type: Schema.Types.ObjectId,
      ref: "User",
    }],
    inviteCodeHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    inviteCodeLast4: {
      type: String,
      required: true,
    },
    inviteCodeVersion: {
      type: Number,
      default: 1,
      required: true,
    },
  },
  { timestamps: true }
);

pujaGroupSchema.index({ members: 1 });

export default
  models.PujaGroup ||
  model("PujaGroup", pujaGroupSchema);
