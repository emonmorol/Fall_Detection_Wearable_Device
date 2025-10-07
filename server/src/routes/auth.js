import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, phone = '' } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ ok: false, error: 'Email & password required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ ok: false, error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, phone });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });
    return res.json({
      ok: true,
      token,
      user: { id: user._id, email: user.email, phone: user.phone },
    });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ ok: false, error: 'Email & password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });
    return res.json({
      ok: true,
      token,
      user: { id: user._id, email: user.email, phone: user.phone },
    });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/auth/me (protected)
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select('_id email phone');
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  return res.json({ ok: true, user: { id: user._id, email: user.email, phone: user.phone } });
});

export default router;
