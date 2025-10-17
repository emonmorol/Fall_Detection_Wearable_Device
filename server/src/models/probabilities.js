// /server/models/fallProbabilities.js
import { Schema, model } from 'mongoose';

const fallProbabilitiesSchema = new Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    fallProb: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    isFall: {
      type: Boolean,
      default: false,
    },

    ts: {
      type: Date,
      required: true,
      index: true,
    },

    meta: {
      modelVersion: { type: String, default: null },
      source: { type: String, default: 'ml' }, // "rule" | "ml" | "sim"
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Fast pagination/range scans per device
fallProbabilitiesSchema.index({ deviceId: 1, ts: -1 });

// OPTIONAL: auto-expire data after N days (e.g., 30 days).
// Comment out if you want to retain indefinitely.
// NOTE: TTL uses seconds from the Date field.
// fallProbabilitiesSchema.index({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default model('FallProbabilities', fallProbabilitiesSchema);
