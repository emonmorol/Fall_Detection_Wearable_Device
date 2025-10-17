import { Schema, model } from 'mongoose';

const ImuReadingSchema = new Schema(
  {
    deviceId: { type: String, index: true },
    ax: { type: Number, default: -1 },
    ay: { type: Number, default: -1 },
    az: { type: Number, default: -1 },
    gx: { type: Number, default: -1 },
    gy: { type: Number, default: -1 },
    gz: { type: Number, default: -1 },
  },
  { timestamps: true },
);

export default model('ImuReading', ImuReadingSchema);
