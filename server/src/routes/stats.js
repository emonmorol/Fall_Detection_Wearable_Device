import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Device from '../models/device.js';
import Reading from '../models/reading.js';
import Alert from '../models/alert.js';

const router = Router();

// helper: parse ranges like "1h", "24h", "7d"; default 24h
function parseRangeToMs(range) {
  if (typeof range !== 'string') return 24 * 60 * 60 * 1000;
  const m = range.trim().match(/^(\d+)\s*(h|d)$/i);
  if (!m) return 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  return unit === 'h' ? n * 60 * 60 * 1000 : n * 24 * 60 * 60 * 1000;
}

// GET /api/stats/overview?range=24h
router.get('/overview', async (req, res) => {
  try {
    const rangeStr = req.query.range || '24h';
    const rangeMs = parseRangeToMs(rangeStr);
    const now = Date.now();
    const sinceDate = new Date(now - rangeMs);

    // Only this user's devices
    const myDevices = await Device.find().select('deviceId').lean();

    const deviceIds = myDevices.map((d) => d.deviceId);

    // If no devices, return zeros immediately
    if (deviceIds.length === 0) {
      return res.json({
        ok: true,
        kpi: { activeDevices: 0, readings24h: 0, alerts24h: 0, minSpO2: null },
      });
    }

    // Helper windows
    const activeWindowMs = 30 * 1000;
    const activeSince = new Date(now - activeWindowMs);

    // Reusable OR clause: use ts if present, else createdAt
    const inRangeOrCreatedAt = (since) => ({
      $or: [{ ts: { $gte: since } }, { ts: { $exists: false }, createdAt: { $gte: since } }],
    });

    const [readingsCount, alertsCount, minSpO2Agg, activeDeviceIds] = await Promise.all([
      Reading.countDocuments({
        deviceId: { $in: deviceIds },
      }),

      Alert.countDocuments({
        deviceId: { $in: deviceIds },
        ...inRangeOrCreatedAt(sinceDate),
      }),

      // Min SpO2 within range; ignore invalids (<= 0 or -1)
      Reading.aggregate([
        {
          $match: {
            deviceId: { $in: deviceIds },
            spo2: { $gt: 0 }, // keep only valid
          },
        },
        { $group: { _id: null, minSpO2: { $min: '$spo2' } } },
      ]),

      // Active devices = had at least one reading in the last 30s (or createdAt if ts missing)
      Reading.distinct('deviceId', {
        deviceId: { $in: deviceIds },
      }),
    ]);

    const minSpO2 = minSpO2Agg[0]?.minSpO2 ?? null;
    const activeDevices = Array.isArray(activeDeviceIds) ? activeDeviceIds.length : 0;

    res.json({
      ok: true,
      kpi: {
        activeDevices,
        readings24h: readingsCount,
        alerts24h: alertsCount,
        minSpO2,
      },
    });
  } catch (err) {
    console.error('overview error:', err);
    console.log('overview error details:', err.stack);
    return res.status(500).json({
      ok: false,
      error: 'OVERVIEWFAILED',
      message: err?.message || 'Unexpected error',
    });
  }
});

export default router;
