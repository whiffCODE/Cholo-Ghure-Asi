
import { Schema, model, models, Types } from "mongoose";

const friendshipSchema = new Schema(
  {
    userA: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userB: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pairKey: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent self-friendships and keep each friendship's IDs
// in a consistent order, regardless of who initiated it.
friendshipSchema.pre("validate", function () {
  if (!this.userA || !this.userB) {
    return;
  }

  const idA = String(this.userA);
  const idB = String(this.userB);

  if (idA === idB) {
    this.invalidate(
      "userB",
      "A user cannot be friends with themselves."
    );
    return;
  }

  const [firstId, secondId] = [idA, idB].sort();

  this.userA = new Types.ObjectId(firstId);
  this.userB = new Types.ObjectId(secondId);
  this.pairKey = `${firstId}:${secondId}`;
});

// Support efficient friend lookups.
friendshipSchema.index({ userA: 1 });
friendshipSchema.index({ userB: 1 });

// Prevent recompilation errors during development.
const Friendship =
  models.Friendship ||
  model("Friendship", friendshipSchema);

export default Friendship;
