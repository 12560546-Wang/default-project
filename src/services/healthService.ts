import { env } from '../config/env.js';

export interface HealthStatus {
  status: 'ok';
  uptime: number;
  timestamp: string;
  version: string;
  nodeEnv: string;
}

export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    nodeEnv: env.NODE_ENV,
  };
}
