import { Router } from 'express';

import { getHealthStatus } from '../services/healthService.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json(getHealthStatus());
});

healthRouter.get('/ping', (_req, res) => {
  res.json({ message: 'pong' });
});
