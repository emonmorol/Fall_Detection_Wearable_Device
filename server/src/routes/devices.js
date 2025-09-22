import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { registerDeviceSchema } from '../utils/validation.js';
import Device from '../models/device.js';

const router = Router();

router.post('/register', requireAuth, async (req, res) => {
  const { error, value } = registerDeviceSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const d = await Device.findOneAndUpdate(
    { deviceId: value.deviceId },
    {
      deviceId: value.deviceId,
      name: value.name || value.deviceId,
      ownerUserId: req.user.uid,
      secret: value.secret,
    },
    { upsert: true, new: true },
  );

  res.json({ ok: true, device: { deviceId: d.deviceId, name: d.name } });
});

router.post('/', async (req, res) => {
  const payload = req.body;
  console.log(object)
  if (error) return res.status(400).json({ error: error.message });
  const exists = await Device.findOne({ deviceId: value.deviceId });
  if (exists) return res.status(400).json({ error: 'deviceId already registered' });
  const d = await Device.create(value);
  res.json({ ok: true, device: { deviceId: d.deviceId, name: d.name } });
});

export default router;
