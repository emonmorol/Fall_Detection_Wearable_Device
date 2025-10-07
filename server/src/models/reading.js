import { Schema, model } from 'mongoose';

const ReadingSchema = new Schema(
  {
    deviceId: { type: String, index: true },
    ts: { type: Date, index: true },
    hr: { type: Number, default: -1 }, // -1 if invalid
    spo2: { type: Number, default: -1 }, // -1 if invalid

    flags: {
      hrLow: { type: Boolean, default: false, optional: true },
      hrHigh: { type: Boolean, default: false, optional: true },
      spo2Low: { type: Boolean, default: false, optional: true },
    },
  },
  { timestamps: true },
);

ReadingSchema.index({ deviceId: 1, createdAt: 1 });
ReadingSchema.index({ createdAt: 1 });
ReadingSchema.index({ ts: 1 });

export default model('Reading', ReadingSchema);
