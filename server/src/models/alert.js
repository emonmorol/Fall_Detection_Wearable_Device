import { Schema, model } from 'mongoose';

const AlertSchema = new Schema(
  {
    deviceId: String,
    rule: String, // 'hrLow'|'hrHigh'|'spo2Low'|'manual'
    value: Number,
    ts: { type: Date, index: true },
    deliveredTo: [String],
  },
  { timestamps: true },
);

AlertSchema.index({ deviceId: 1, rule: 1, ts: 1 });

export default model('Alert', AlertSchema);
