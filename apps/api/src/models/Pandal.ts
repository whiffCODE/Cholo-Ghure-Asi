import mongoose, { Schema, Document } from "mongoose";

export type PandalRegion = "North" | "Central" | "South";

export interface IPandal extends Document {
  name: string;
  address: string;
  landmark: string;
  nearestMetro: string;
  latitude: number;
  longitude: number;
  region: PandalRegion;
  slug: string;
}

const PandalSchema = new Schema<IPandal>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    landmark: { type: String, default: "", trim: true },
    nearestMetro: { type: String, default: "", trim: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    region: {
      type: String,
      enum: ["North", "Central", "South"],
      required: true,
    },
    slug: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

PandalSchema.index({ region: 1, name: 1 });
PandalSchema.index({ latitude: 1, longitude: 1 });

export default mongoose.model<IPandal>("Pandal", PandalSchema);