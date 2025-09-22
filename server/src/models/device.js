import { Schema, model } from 'mongoose';

const DeviceSchema = new Schema(
  {
    deviceId: { type: String, unique: true, required: true, index: true },
    name: { type: String, default: '' },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    secret: { type: String, required: true }, // HMAC shared secret
  },
  { timestamps: true },
);

export default model('Device', DeviceSchema);
