import mongoose from 'mongoose';

export default async function initMongo(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true });
  return mongoose;
}
