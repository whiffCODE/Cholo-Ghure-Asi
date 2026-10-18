import mongoose, { Schema, Document } from "mongoose";

export interface IEmailVerification extends Document {
  email: string;
  otpHash: string;
  expiresAt: Date;
  resendAfter: Date;
  attempts: number;
  verifiedAt?: Date;
}

const EmailVerificationSchema = new Schema<IEmailVerification>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  resendAfter: { type: Date, required: true },
  attempts: { type: Number, default: 0, min: 0 },
  verifiedAt: { type: Date },
});

export default mongoose.model<IEmailVerification>(
  "EmailVerification",
  EmailVerificationSchema
);