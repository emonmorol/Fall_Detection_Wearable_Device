import { Schema, model } from 'mongoose';

const ReadingSchema = new Schema(
  {
    deviceId: { type: String, index: true },
    ts: { type: Date, index: true },
    hr: Number,
    spo2: Number,
    flags: {
      hrLow: Boolean,
      hrHigh: Boolean,
      spo2Low: Boolean,
    },
  },
  { timestamps: true },
);

ReadingSchema.index({ deviceId: 1, ts: 1 });

export default model('Reading', ReadingSchema);
