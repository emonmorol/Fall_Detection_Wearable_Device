import crypto from 'node:crypto';
import Device from '../models/device.js';

export default async function verifySignature(req, res, next) {
  try {
    // console.log('verifySignature middleware', req.headers);
    const deviceId = req.header('X-Device-Id');
    const signature = req.header('X-Signature');
    if (!deviceId || !signature)
      return res.status(401).json({ error: 'missing signature headers' });

    const device = await Device.findOne({ deviceId });
    if (!device) return res.status(401).json({ error: 'unknown device' });

    const raw = req.rawBody || JSON.stringify(req.body);
    const h = crypto.createHmac('sha256', device.secret).update(raw).digest('hex');

    // Constant-time compare
    const ok = crypto.timingSafeEqual(Buffer.from(h, 'utf8'), Buffer.from(signature, 'utf8'));
    if (!ok) return res.status(401).json({ error: 'bad signature' });

    req.device = device;
    next();
  } catch {
    return res.status(400).json({ error: 'signature verification failed' });
  }
}
