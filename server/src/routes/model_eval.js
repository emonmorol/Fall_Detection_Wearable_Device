// src/routes/model_eval.js
import { Router } from 'express';
import { fanoutAlert } from '../services/alerts.js';
import { getLatestWindow } from '../services/buffer.js';
import { extractFeatures, predictFall } from '../services/mltask.js';
import { fallDetection } from '../utils/fallDetection.js';
import fallProbabilities from '../models/probabilities.js';

export default function modelEval(io) {
  const router = Router();

  // GET /api/model-eval/:deviceId – compute fall prob on latest 2s window
  router.get('/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const window = getLatestWindow(deviceId);
    if (!window || window.length < 100) {
      return res.json({ ready: false, message: 'Not enough IMU data' });
    }
    const feats = extractFeatures(window);
    // console.log(
    //   'sample data ------------------------------------------------------------------------------',
    //   feats,
    // );
    const { fallProb } = await predictFall(feats);
    const [[prob, label]] = fallProb;
    console.log('====================================');
    console.log('Fall Prob:', prob, 'Label:', label);
    console.log('====================================');
    const isFall = prob > 0.7;
    
    if (io) {
      io.to(deviceId).emit('inference', { deviceId, fallProb: prob, isFall, ts: Date.now() });
    }

    // console.log(window);
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
        ts: new Date(Date.now()),
        meta: { modelVersion: 'v1' },
      })
      .catch((e) => console.error('Failed to save inference:', e));

    res.json({ ready: true, fallProb: prob, isFall });
  });

  return router;
}
