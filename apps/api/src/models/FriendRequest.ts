
import { Schema, model, models } from "mongoose";

const friendRequestSchema = new Schema(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Requester is required."],
    },

    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required."],
    },

    status: {
      type: String,
      enum: {
        values: ["pending", "accepted", "declined"],
        message: "Invalid friend request status.",
      },
      default: "pending",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Prevent a user from sending a friend request to themselves.
friendRequestSchema.pre("validate", function () {
  if (
    this.requester &&
    this.recipient &&
    this.requester.equals(this.recipient)
  ) {
    this.invalidate(
      "recipient",
      "You cannot send a friend request to yourself."
    );
  }
});

// Prevent duplicate requests in the same direction.
friendRequestSchema.index(
  { requester: 1, recipient: 1 },
  { unique: true }
);

// Optimise incoming pending-request queries.
friendRequestSchema.index({
  recipient: 1,
  status: 1,
  createdAt: -1,
});

// Optimise outgoing pending-request queries.
friendRequestSchema.index({
  requester: 1,
  status: 1,
  createdAt: -1,
});

const FriendRequest =
  models.FriendRequest ||
  model("FriendRequest", friendRequestSchema);

export default FriendRequest;
