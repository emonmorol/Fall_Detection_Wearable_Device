import mongoose from 'mongoose';

const DeliverySchema = new mongoose.Schema(
  {
    sent: { type: Boolean, default: false },
    sentAt: Date,
    error: String,
  },
  { _id: false },
);

const AlertSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    rule: {
      type: String,
      required: true,
      index: true,
      enum: ['fall', 'hrLow', 'hrHigh', 'spo2Low', 'spo2High', 'custom'],
    },
    value: { type: Number, default: null },
    severity: { type: String, default: 'high', enum: ['low', 'high', 'critical'] },
    message: { type: String },
    ts: { type: Date, default: () => new Date(), index: true },
    meta: { type: Object, default: {} },
    delivery: { email: { type: DeliverySchema, default: () => ({}) } },
    acknowledged: { type: Boolean, default: false },
    acknowledgedAt: Date,
  },
  { timestamps: true },
);

AlertSchema.index({ deviceId: 1, rule: 1, createdAt: -1 });

const Alert = mongoose.models.Alert || mongoose.model('Alert', AlertSchema);
export default Alert;
