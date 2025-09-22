import { Router } from 'express';
import { readingSchema } from '../utils/validation.js';
import verifySignature from '../middleware/verifySignature.js';
import { fanoutAlert } from '../services/alerts.js';
import Reading from '../models/reading.js';
import device from '../models/device.js';

export default function buildReadingRoutes(io) {
  const router = Router();

  // Ingest from device
  router.post('/', async (req, res) => {
    console.log('POST /readings', req.body);
    const { error, value } = readingSchema.validate(req.body);
    console.log(error, value);
    if (error) return res.status(400).json({ error: error.message });

    // sanity bounds
    if (value.hr < 30 || value.hr > 220) value.hr = 0;
    if (value.spo2 < 70 || value.spo2 > 100) value.spo2 = 0;

    const doc = await Reading.create({
      deviceId: value.deviceId,
      ts: new Date(value.ts),
      hr: value.hr,
      spo2: value.spo2,
      flags: value.flags,
    });

    // realtime
    io.to(value.deviceId).emit('reading', {
      deviceId: value.deviceId,
      ts: doc.ts,
      hr: doc.hr,
      spo2: doc.spo2,
      flags: doc.flags,
    });
    await device.updateOne(
      { deviceId: value.deviceId },
      { $set: { lastSeen: Date.now() } },
      { upsert: false },
    );
    // alerts (dedup handled inside)
    if (value.flags.hrLow)
      await fanoutAlert({ deviceId: value.deviceId, rule: 'hrLow', value: value.hr });
    if (value.flags.hrHigh)
      await fanoutAlert({ deviceId: value.deviceId, rule: 'hrHigh', value: value.hr });
    if (value.flags.spo2Low)
      await fanoutAlert({ deviceId: value.deviceId, rule: 'spo2Low', value: value.spo2 });

    res.json({ ok: true });
  });

  // Latest reading
  router.get('/latest', async (req, res) => {
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    const r = await Reading.findOne({ deviceId }).sort({ ts: -1 }).lean();
    res.json({ ok: true, reading: r });
  });

  router.get('/recent', async (req, res) => {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 5));
    const q = {};
    if (req.query.deviceId) q.deviceId = req.query.deviceId;
    const items = await Reading.find(q).sort({ ts: -1 }).limit(limit).lean();
    res.json({ ok: true, items });
  });

  return router;
}
