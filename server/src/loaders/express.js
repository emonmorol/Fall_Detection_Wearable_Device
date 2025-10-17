import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import bodyParser from 'body-parser';

import authRoutes from '../routes/auth.js';
import deviceRoutes from '../routes/devices.js';
import buildReadingRoutes from '../routes/readings.js';
import alertRoutes from '../routes/alerts.js';
import stateRoutes from '../routes/stats.js';
import emergencyRoutes from '../routes/emergency.js';
import config from '../config.js';
import modelEval from '../routes/model_eval.js';

export default function buildExpress(io) {
  const app = express();
  app.set('trust proxy', 1);

  // Capture raw body (used by HMAC middleware for exact digest)
  app.use(
    express.json({
      limit: '50kb',
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );

  app.use(helmet());
  app.use(cookieParser());
  app.use(morgan('tiny'));

  app.use(
    cors({
      origin: config.dashboardOrigin,
      credentials: true,
    }),
  );
  app.use(bodyParser.json({ limit: '2mb' }));

  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

  app.use('/api/auth', authRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/readings', buildReadingRoutes(io));
  app.use('/api/alerts', alertRoutes);
  app.use('/api/stats', stateRoutes);
  app.use('/api/emergency', emergencyRoutes);
  app.use('/api/model-eval', modelEval(io));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/', (_req, res) =>
    res.json({ success: true, msg: 'Welcome to the Fall Detection Server' }),
  );
  app.use((_req, res) => res.status(404).json({ error: 'not found' }));
  return app;
}
