import { Router } from 'express';
import { fanoutAlert } from '../services/alerts.js';
import Reading from '../models/reading.js';
import ImuReading from '../models/imu.js';
import device from '../models/device.js';
import { parseRangeToMs } from '../utils/time.js';
import { pushIMUData } from '../services/buffer.js';

export default function buildReadingRoutes(io) {
  const router = Router();

  // Ingest from device
  router.post('/', async (req, res) => {
    console.log('POST /readings');
    const value = req.body;
    // if (error) return res.status(400).json({ error: error.message });
    // console.log('this is value', value);
    const flags = value?.flags || { hrLow: false, hrHigh: false, spo2Low: false };

    // --- Sanity bounds ---
    if (value.hr < 30 || value.hr > 220) value.hr = 0;
    if (value.spo2 < 70 || value.spo2 > 100) value.spo2 = 0;

    // --- Create HR/SpO2 Reading ---
    const doc = await Reading.create({
      deviceId: value.deviceId,
      ts: new Date(value.ts),
      hr: value.hr,
      spo2: value.spo2,
      flags,
    });

    // --- Push IMU data into buffer & DB ---
    if (value.imu && Array.isArray(value.imu) && value.imu.length > 0) {
      pushIMUData(value.deviceId, value.imu);
      // Bulk insert to Mongo for logging/history
      const imuDocs = value.imu.map((sample) => ({
        deviceId: value.deviceId,
        ax: sample.ax,
        ay: sample.ay,
        az: sample.az,
        gx: sample.gx,
        gy: sample.gy,
        gz: sample.gz,
      }));
      await ImuReading.insertMany(imuDocs);
    }

    if (io) {
      // --- Emit realtime data ---
      io.to(value.deviceId).emit('reading', {
        deviceId: value.deviceId,
        ts: doc.ts,
        hr: doc.hr,
        spo2: doc.spo2,
        flags: doc.flags,
      });
    }

    // --- Update device last seen ---
    await device.updateOne(
      { deviceId: value.deviceId },
      { $set: { lastSeen: Date.now() } },
      { upsert: false },
    );

    // --- Trigger alerts ---
    const rules = [
      { key: 'hrLow', cond: flags.hrLow },
      { key: 'hrHigh', cond: flags.hrHigh },
      { key: 'spo2Low', cond: flags.spo2Low },
    ];

    for (const r of rules) {
      if (r.cond) {
        await fanoutAlert({
          deviceId: value.deviceId,
          rule: r.key,
          value: value[r.key === 'spo2Low' ? 'spo2' : 'hr'],
          ts: value.ts,
          meta: { hr: value.hr, spo2: value.spo2 },
        });
      }
    }

    res.json({ ok: true });
  });

  router.get('/series', async (req, res) => {
    try {
      const deviceId = String(req.query.deviceId || 'all');
      const bucket = String(req.query.bucket || '1m'); // default every minute
      const range = String(req.query.range || '24h'); // default 24h
      const tz = String(req.query.tz || 'UTC');
      const fill = req.query.fill !== 'false'; // default: true

      // --- time calculations ---
      const until = new Date();
      let since = null;

      if (range !== 'all') {
        try {
          since = new Date(Date.now() - parseRangeToMs(range));
        } catch {
          since = new Date(Date.now() - 24 * 3600e3); // fallback 24h
        }
      }

      // --- bucket spec ---
      const bucketSpec =
        bucket === '1h'
          ? { unit: 'hour' }
          : bucket === '15m'
            ? { unit: 'minute', binSize: 15 }
            : bucket === '5m'
              ? { unit: 'minute', binSize: 5 }
              : { unit: 'minute' };

      const stepMs =
        bucket === '1h' ? 3600e3 : bucket === '15m' ? 900e3 : bucket === '5m' ? 300e3 : 60e3;

      // --- pipeline ---
      const pipeline = [
        { $addFields: { eventTime: { $ifNull: ['$ts', '$createdAt'] } } },
        {
          $match: {
            $and: [
              { $or: [{ hr: { $gt: 0 } }, { spo2: { $gt: 0 } }] },
              deviceId !== 'all' ? { deviceId } : {},
              since ? { eventTime: { $gte: since } } : {},
              until ? { eventTime: { $lte: until } } : {},
            ].filter(Boolean),
          },
        },
        {
          $project: {
            hr: 1,
            spo2: 1,
            bucket: {
              $dateTrunc: {
                date: '$eventTime',
                timezone: tz,
                ...bucketSpec,
              },
            },
          },
        },
        {
          $group: {
            _id: '$bucket',
            hrAvg: {
              $avg: { $cond: [{ $gt: ['$hr', 0] }, '$hr', null] },
            },
            spo2Avg: {
              $avg: { $cond: [{ $gt: ['$spo2', 0] }, '$spo2', null] },
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            t: '$_id',
            hrAvg: 1,
            spo2Avg: 1,
            count: 1,
          },
        },
        { $sort: { t: 1 } },
      ];

      let items = await Reading.aggregate(pipeline).allowDiskUse(true);

      // --- Fill gaps ---
      if (fill && items.length) {
        const startMs = Math.floor(new Date(items[0].t).getTime() / stepMs) * stepMs;
        const endMs = Math.floor(new Date(items[items.length - 1].t).getTime() / stepMs) * stepMs;
        const map = new Map(items.map((x) => [new Date(x.t).getTime(), x]));
        const filled = [];

        for (let t = startMs; t <= endMs; t += stepMs) {
          const got = map.get(t);
          if (got) filled.push(got);
          else
            filled.push({
              t: new Date(t).toISOString(),
              hrAvg: null,
              spo2Avg: null,
              count: 0,
            });
        }
        items = filled;
      } else if (!items.length && since) {
        // fill empty range (so chart shows axes)
        const startMs = since.getTime();
        const endMs = until.getTime();
        for (let t = startMs; t <= endMs; t += stepMs) {
          items.push({
            t: new Date(t).toISOString(),
            hrAvg: null,
            spo2Avg: null,
            count: 0,
          });
        }
      }

      res.json({
        ok: true,
        items,
        deviceId,
        bucket,
        range,
        since: since ? since.toISOString() : null,
        until: until ? until.toISOString() : null,
        tz,
        filled: !!fill,
        count: items.length,
      });
    } catch (e) {
      console.error('series error:', e);
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // Latest reading
  router.get('/latest', async (req, res) => {
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    const r = await Reading.findOne({ deviceId }).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, reading: r });
  });

  router.get('/recent', async (req, res) => {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 5));
    const q = {};
    if (req.query.deviceId) q.deviceId = req.query.deviceId;
    const items = await Reading.find({
      ...q,
      hr: { $gt: 0 },
      spo2: { $gt: 0 },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    // console.log(items);
    // const itemss = await Reading.find(q).sort({ ts: -1 }).limit(limit).lean();
    // console.log(itemss);
    res.json({ ok: true, items });
  });

  return router;
}
