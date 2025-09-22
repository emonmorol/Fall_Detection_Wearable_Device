import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    email: { type: String, unique: true, required: true, index: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: '' },
  },
  { timestamps: true },
);

export default model('User', UserSchema);
