import express from 'express';
import { sendFallEmail } from '../services/alert-email.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { deviceId, ts, severity = 'high' } = req.body || {};
    if (!deviceId || !ts) {
      return res.status(400).json({ ok: false, error: 'deviceId & ts required' });
    }
    await sendFallEmail({
      deviceId,
      ts,
      severity,
      hr: -1,
      spo2: -1,
      note: 'EMERGENCY Button Pressed',
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message || 'failed' });
  }
});

export default router;
