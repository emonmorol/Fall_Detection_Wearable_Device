import express from 'express';
import { sendFallEmail } from '../services/alert-email.js';

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

export default router;
