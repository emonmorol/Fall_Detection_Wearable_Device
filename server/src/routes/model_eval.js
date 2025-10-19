// src/routes/model_eval.js
import { Router } from 'express';
import { fanoutAlert } from '../services/alerts.js';
import { getLatestWindow } from '../services/buffer.js';
import { extractFeatures, predictFall } from '../services/mltask.js';
import { fallDetection } from '../utils/fallDetection.js';
import fallProbabilities from '../models/probabilities.js';

const lastInferenceByDevice = new Map(); // deviceId -> { ts, result }
const inflightByDevice = new Map();

export default function modelEval(io) {
  const router = Router();

  // GET /api/model-eval/:deviceId – compute fall prob on latest 2s window
  router.get('/:deviceId', async (req, res) => {
    const { deviceId } = req.params;

    // 1) Serve cached result if younger than 800ms
    const cached = lastInferenceByDevice.get(deviceId);
    if (cached && Date.now() - cached.ts < 800) {
      return res.json(cached.result);
    }

    // 2) Coalesce concurrent calls
    if (inflightByDevice.has(deviceId)) {
      try {
        const result = await inflightByDevice.get(deviceId);
        return res.json(result);
      } catch (e) {
        console.log('========================================');
        console.log('Evaluation Error: ', e);
        console.log('========================================');
        return res.status(500).json({ ready: false, error: 'inference_failed' });
      }
    }

    const window = getLatestWindow(deviceId);
    if (!window || window.length < 100) {
      console.log('========================================');
      console.log('Evaluation Error: ', 'Not enough IMU data');
      console.log('========================================');
      const result = { ready: false, message: 'Not enough IMU data' };
      lastInferenceByDevice.set(deviceId, { ts: Date.now(), result });
      return res.json(result);
    }

    const feats = extractFeatures(window);

    // 3) Run (single) inference
    const p = (async () => {
      try {
        const { fallProb } = await predictFall(feats);
        const [[pNormal, pFall]] = fallProb;
        const prob = pFall;
        const isFall = prob > 0.7;

        const result = { ready: true, fallProb: prob, isFall, ts: Date.now() };
        console.log(result);
        if (io)
          io.to(deviceId).emit('inference', { deviceId, fallProb: prob, isFall, ts: Date.now() });

        // keep your secondary rule as a safety net
        if (isFall || fallDetection(deviceId, window)) {
          await fanoutAlert({
            deviceId,
            rule: 'fall',
            value: prob,
            ts: Date.now(),
            meta: { hr: null, spo2: null, note: null },
          });
        }

        await fallProbabilities
          .create({
            deviceId,
            fallProb: prob,
            isFall,
            ts: new Date(),
            meta: { modelVersion: 'v1' },
          })
          .catch((e) => console.error('Failed to save inference:', e));

        lastInferenceByDevice.set(deviceId, { ts: Date.now(), result });
        return result;
      } finally {
        inflightByDevice.delete(deviceId);
      }
    })();

    inflightByDevice.set(deviceId, p);

    try {
      const result = await p;
      console.log('========================================');
      console.log('Evaluation Result: ', result);
      console.log('========================================');
      return res.json(result);
    } catch (e) {
      console.log('========================================');
      console.log('Evaluation Error: ', e);
      console.log('========================================');
      return res.status(500).json({ ready: false, error: 'inference_failed' });
    }
  });

  return router;
}
