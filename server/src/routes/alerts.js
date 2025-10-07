import express from 'express';
import { sendFallEmail } from '../services/alert-email.js';
import Alert from '../models/Alert.js';

const router = express.Router();

router.post('/fall', async (req, res) => {
  try {
    const { deviceId, ts, severity = 'high', hr, spo2, note } = req.body || {};
    if (!deviceId || !ts) {
      return res.status(400).json({ ok: false, error: 'deviceId & ts required' });
    }
    await sendFallEmail({ deviceId, ts, severity, hr, spo2, note });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message || 'failed' });
  }
});

router.post('/test', async (req, res) => {
  const { deviceId = 'TEST', rule = 'manual', value = 0 } = req.body || {};
  await fanoutAlert({ deviceId, rule, value });
  res.json({ ok: true });
});

router.get('/recent', async (req, res) => {
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 5));
  const q = {};
  if (req.query.deviceId) q.deviceId = req.query.deviceId;
  const items = await Alert.find(q).sort({ ts: -1 }).limit(limit).lean();
  res.json({ ok: true, items });
});

export default router;
