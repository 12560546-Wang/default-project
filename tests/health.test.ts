import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('Health API', () => {
  const app = createApp();

  it('GET /health 回傳 ok 狀態', async () => {
    const res = await request(app).get('/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body.nodeEnv).toBe('test');
  });

  it('GET /ping 回傳 pong', async () => {
    const res = await request(app).get('/ping').expect(200);

    expect(res.body.message).toBe('pong');
  });

  it('未知路由回傳 404', async () => {
    const res = await request(app).get('/does-not-exist').expect(404);

    expect(res.body.error).toBe('找不到此資源');
  });
});
