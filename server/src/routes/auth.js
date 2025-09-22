import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = Router();

router.post('/register', async (req, res) => {
  console.log('hit');
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing fields' });
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: 'user exists' });
  const passwordHash = await bcrypt.hash(password, 10);
  const u = await User.create({ email, passwordHash });
  res.json({ ok: true, id: u._id });
}); 

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const u = await User.findOne({ email });
  if (!u) return res.status(400).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(400).json({ error: 'invalid credentials' });
  const access = jwt.sign({ uid: u._id, email }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const refresh = jwt.sign({ uid: u._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  res.cookie('access', access, { httpOnly: true, sameSite: 'lax', secure: false });
  res.cookie('refresh', refresh, { httpOnly: true, sameSite: 'lax', secure: false });
  res.json({ ok: true });
});

export default router;
