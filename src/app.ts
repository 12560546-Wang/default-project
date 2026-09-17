import cors from 'cors';
import express from 'express';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
