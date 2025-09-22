import 'dotenv/config';
import mongoose from 'mongoose';
import Reading from '../models/reading.js';

await mongoose.connect(process.env.MONGO_URI);

const since = new Date(Date.now() - 60 * 60 * 1000);
const res = await Reading.aggregate([
  { $match: { ts: { $gte: since } } },
  {
    $group: {
      _id: {
        deviceId: '$deviceId',
        minute: {
          $toDate: {
            $subtract: [{ $toLong: '$ts' }, { $mod: [{ $toLong: '$ts' }, 60000] }],
          },
        },
      },
      hrAvg: { $avg: '$hr' },
      spo2Avg: { $avg: '$spo2' },
    },
  },
  { $sort: { '_id.minute': 1 } },
]);

console.log(res);
await mongoose.disconnect();
