import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { fanoutAlert } from '../services/alerts.js';

const router = Router();

router.post('/test', requireAuth, async (req, res) => {
  const { deviceId = 'TEST', rule = 'manual', value = 0 } = req.body || {};
  await fanoutAlert({ deviceId, rule, value });
  res.json({ ok: true });
});

export default router;
