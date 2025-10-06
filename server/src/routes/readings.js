import { Router } from 'express';
import { readingSchema } from '../utils/validation.js';
import verifySignature from '../middleware/verifySignature.js';
import { fanoutAlert } from '../services/alerts.js';
import Reading from '../models/reading.js';
import device from '../models/device.js';
import { parseRangeToMs } from '../utils/time.js';

export default function buildReadingRoutes(io) {
  const router = Router();

  // Ingest from device
  router.post('/', async (req, res) => {
    console.log('POST /readings', req.body);
    const { error, value } = readingSchema.validate(req.body);
    // console.log(error, value);
    if (error) return res.status(400).json({ error: error.message });

    // sanity bounds
    if (value.hr < 30 || value.hr > 220) value.hr = 0;
    if (value.spo2 < 70 || value.spo2 > 100) value.spo2 = 0;

    const doc = await Reading.create({
      deviceId: value.deviceId,
      ts: new Date(value.ts),
      hr: value.hr,
      spo2: value.spo2,
      flags: value.flags,
    });

    // realtime
    io.to(value.deviceId).emit('reading', {
      deviceId: value.deviceId,
      ts: doc.ts,
      hr: doc.hr,
      spo2: doc.spo2,
      flags: doc.flags,
    });

    await device.updateOne(
      { deviceId: value.deviceId },
      { $set: { lastSeen: Date.now() } },
      { upsert: false },
    );
    // alerts (dedup handled inside)
    if (value.flags.hrLow)
      await fanoutAlert({ deviceId: value.deviceId, rule: 'hrLow', value: value.hr });
    if (value.flags.hrHigh)
      await fanoutAlert({ deviceId: value.deviceId, rule: 'hrHigh', value: value.hr });
    if (value.flags.spo2Low)
      await fanoutAlert({ deviceId: value.deviceId, rule: 'spo2Low', value: value.spo2 });

    res.json({ ok: true });
  });

  router.get('/series', async (req, res) => {
    const deviceId = String(req.query.deviceId || 'all');
    const bucket = String(req.query.bucket || '15m'); // sensible default for days
    const range = String(req.query.range || '10d'); // e.g., 10d, 30d, 24h, all
    const tz = String(req.query.tz || 'UTC'); // timezone for dateTrunc
    const fill = req.query.fill !== 'false'; // default: true

    // Explicit since/until overrides range
    const untilQ = new Date();
    const sinceQ = req.query.range ? new Date(Date.now() - parseRangeToMs(req.query.range)) : null;
    console.log(req.query);
    console.log(sinceQ, untilQ);
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

    const now = new Date();
    let since = null;
    let until = untilQ && !isNaN(untilQ) ? untilQ : now;

    if (sinceQ && !isNaN(sinceQ)) {
      since = sinceQ;
    } else if (range !== 'all') {
      const m = range.match(/(\d+)([mhdw])/i);
      const mult = { m: 60e3, h: 3600e3, d: 86400e3, w: 604800e3 };
      const dur = m ? Number(m[1]) * (mult[m[2]] || 86400e3) : 10 * 86400e3;
      since = new Date(until.getTime() - dur);
    }
    // if range=all and no since=… -> we won’t time-filter (match everything)

    const pipeline = [
      // unify time
      { $addFields: { eventTime: { $ifNull: ['$ts', '$createdAt'] } } },
    ];

    const match = {
      // ignore invalids
      $or: [{ hr: { $gt: 0 } }, { spo2: { $gt: 0 } }],
    };
    if (deviceId !== 'all') match.deviceId = deviceId;
    if (since) match.eventTime = { ...(match.eventTime || {}), $gte: since };
    if (until) match.eventTime = { ...(match.eventTime || {}), $lte: until };
    pipeline.push({ $match: match });

    pipeline.push({
      $project: {
        hr: 1,
        spo2: 1,
        bucket: { $dateTrunc: { date: '$eventTime', timezone: tz, ...bucketSpec } },
      },
    });

    pipeline.push({
      $group: {
        _id: '$bucket',
        hrAvg: { $avg: { $cond: [{ $gt: ['$hr', 0] }, '$hr', null] } },
        spo2Avg: { $avg: { $cond: [{ $gt: ['$spo2', 0] }, '$spo2', null] } },
        count: { $sum: 1 },
      },
    });

    pipeline.push(
      { $project: { _id: 0, t: '$_id', hrAvg: 1, spo2Avg: 1, count: 1 } },
      { $sort: { t: 1 } },
    );

    try {
      let items = await Reading.aggregate(pipeline).allowDiskUse(true).exec();

      // Optional gap filling
      if (fill) {
        // Determine start/end for filling
        let startMs;
        let endMs;

        if (since) {
          startMs = Math.floor(since.getTime() / stepMs) * stepMs;
        } else if (items.length) {
          startMs = Math.floor(new Date(items[0].t).getTime() / stepMs) * stepMs;
        } else {
          // no data at all; return empty if no since specified
          startMs = since
            ? Math.floor(since.getTime() / stepMs) * stepMs
            : Math.floor(now.getTime() / stepMs) * stepMs;
        }

        if (until) {
          endMs = Math.floor(until.getTime() / stepMs) * stepMs;
        } else if (items.length) {
          endMs = Math.floor(new Date(items[items.length - 1].t).getTime() / stepMs) * stepMs;
        } else {
          endMs = startMs;
        }

        const map = new Map(items.map((it) => [new Date(it.t).getTime(), it]));
        const filled = [];
        for (let createdAt = startMs; createdAt <= endMs; createdAt += stepMs) {
          const got = map.get(createdAt);
          if (got) {
            filled.push(got);
          } else {
            filled.push({
              t: new Date(createdAt).toISOString(),
              hrAvg: null,
              spo2Avg: null,
              count: 0,
            });
          }
        }
        items = filled;
      }
      // console.log(items);
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
    console.log(items);
    // const itemss = await Reading.find(q).sort({ ts: -1 }).limit(limit).lean();
    // console.log(itemss);
    res.json({ ok: true, items });
  });

  return router;
}
