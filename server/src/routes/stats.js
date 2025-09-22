import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Device from '../models/device.js';
import Reading from '../models/reading.js';
import Alert from '../models/alert.js';

const router = Router();

// /api/stats/overview?range=24h
router.get('/overview', async (req, res) => {
  console.log('GET /stats/overview', req.user);
  console.log(req.query);
  const range = req.query.range || '24h';
  const now = Date.now();
  const since =
    range === '24h'
      ? now - 24 * 60 * 60 * 1000
      : range === '1h'
        ? now - 60 * 60 * 1000
        : now - 24 * 60 * 60 * 1000;

  // Only owner devices for tonight (simple)
  const myDevices = await Device.find().select('deviceId lastSeen').lean();
  const deviceIds = myDevices.map((d) => d.deviceId);

  const readings24h = await Reading.countDocuments({
    deviceId: { $in: deviceIds },
    ts: { $gte: since },
  });
  const alerts24h = await Alert.countDocuments({
    deviceId: { $in: deviceIds },
    ts: { $gte: since },
  });

  const minSpO2Doc = await Reading.findOne({
    deviceId: { $in: deviceIds },
    ts: { $gte: since },
    spo2: { $gt: 0 },
  })
    .sort({ spo2: 1 })
    .select('spo2')
    .lean();
  const minSpO2 = minSpO2Doc?.spo2 ?? null;

  const activeDevices = myDevices.filter((d) => (d.lastSeen || 0) >= now - 30_000).length;

  res.json({ ok: true, kpi: { activeDevices, readings24h, alerts24h, minSpO2 } });
});

export default router;
