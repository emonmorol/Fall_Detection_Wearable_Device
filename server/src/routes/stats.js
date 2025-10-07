import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Device from '../models/device.js';
import Reading from '../models/reading.js';
import { parseRangeToMs } from '../utils/time.js';
import Alert from '../models/Alert.js';

const router = Router();

// GET /api/stats/overview?range=24h
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
        stats: {
          devices: {
            total: 0,
          },
          readings: {
            total: 0,
            avgPerDevice: 0,
          },
          spo2: {
            min: null,
            max: null,
            avg: null,
            count: 0,
          },
          heartRate: {
            min: null,
            max: null,
            avg: null,
            count: 0,
          },
          alerts: {
            total: 0,
            bySeverity: {},
          },
        },
      });
    }

    // Reusable OR clause: use ts if present, else createdAt
    const inRangeOrCreatedAt = (since) => ({
      $or: [{ ts: { $gte: since } }, { ts: { $exists: false }, createdAt: { $gte: since } }],
    });
    // console.log(deviceIds);
    // console.log(sinceDate);
    const [readingsCount, spo2Stats, heartRateStats, alertsData, alertsBySeverity] =
      await Promise.all([
        // Total readings count
        Reading.countDocuments({
          deviceId: { $in: deviceIds },
          // ...inRangeOrCreatedAt(sinceDate),
        }),

        // SpO2 statistics (min, max, avg)
        Reading.aggregate([
          {
            $match: {
              deviceId: { $in: deviceIds },
              // ...inRangeOrCreatedAt(sinceDate),
              spo2: { $gt: 0 }, // Only valid SpO2 values
            },
          },
          {
            $group: {
              _id: null,
              minSpO2: { $min: '$spo2' },
              maxSpO2: { $max: '$spo2' },
              avgSpO2: { $avg: '$spo2' },
              count: { $sum: 1 },
            },
          },
        ]),

        // Heart Rate statistics (min, max, avg)
        Reading.aggregate([
          {
            $match: {
              deviceId: { $in: deviceIds },
              // ...inRangeOrCreatedAt(sinceDate),
              hr: { $exists: true, $gt: 0 }, // Only valid heart rate values
            },
          },
          {
            $group: {
              _id: null,
              minHeartRate: { $min: '$hr' },
              maxHeartRate: { $max: '$hr' },
              avgHeartRate: { $avg: '$hr' },
              count: { $sum: 1 },
            },
          },
        ]),

        // Total alerts count
        Alert.countDocuments({
          deviceId: { $in: deviceIds },
          // ...inRangeOrCreatedAt(sinceDate),
        }),

        // Alerts grouped by severity (if severity field exists)
        Alert.aggregate([
          {
            $match: {
              deviceId: { $in: deviceIds },
              // ...inRangeOrCreatedAt(sinceDate),
            },
          },
          {
            $group: {
              _id: '$severity',
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    // console.log('Stats data:');
    // console.log(readingsCount, spo2Stats, heartRateStats, alertsData, alertsBySeverity);

    // Process SpO2 stats
    const spo2Result = spo2Stats[0] || {};
    const spo2Data = {
      min: spo2Result.minSpO2 ?? null,
      max: spo2Result.maxSpO2 ?? null,
      avg: spo2Result.avgSpO2 ? Math.round(spo2Result.avgSpO2 * 10) / 10 : null,
      count: spo2Result.count || 0,
    };

    // Process Heart Rate stats
    const hrResult = heartRateStats[0] || {};
    const heartRateData = {
      min: hrResult.minHeartRate ?? null,
      max: hrResult.maxHeartRate ?? null,
      avg: hrResult.avgHeartRate ? Math.round(hrResult.avgHeartRate * 10) / 10 : null,
      count: hrResult.count || 0,
    };

    // Process alerts by severity
    const severityMap = {};
    alertsBySeverity.forEach((item) => {
      const severity = item._id || 'unknown';
      severityMap[severity] = item.count;
    });

    // Total devices count
    const totalDevices = deviceIds.length;

    // Calculate average readings per device
    const avgPerDevice =
      totalDevices > 0 ? Math.round((readingsCount / totalDevices) * 10) / 10 : 0;

    res.json({
      ok: true,
      stats: {
        devices: {
          total: totalDevices,
        },
        readings: {
          total: readingsCount,
          avgPerDevice,
        },
        spo2: spo2Data,
        heartRate: heartRateData,
        alerts: {
          total: alertsData,
          bySeverity: severityMap,
        },
      },
      range: rangeStr,
      timestamp: now,
    });
  } catch (err) {
    console.error('overview error:', err);
    // console.log('overview error details:', err.stack);
    return res.status(500).json({
      ok: false,
      error: 'OVERVIEWFAILED',
      message: err?.message || 'Unexpected error',
    });
  }
});

export default router;
