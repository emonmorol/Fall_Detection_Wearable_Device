import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { fanoutAlert } from '../services/alerts.js';
import alert from '../models/alert.js';

const router = Router();

router.post('/test', async (req, res) => {
  const { deviceId = 'TEST', rule = 'manual', value = 0 } = req.body || {};
  await fanoutAlert({ deviceId, rule, value });
  res.json({ ok: true });
});

router.get('/recent', async (req, res) => {
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 5));
  const q = {};
  if (req.query.deviceId) q.deviceId = req.query.deviceId;
  const items = await alert.find(q).sort({ ts: -1 }).limit(limit).lean();
  res.json({ ok: true, items });
});

export default router;
