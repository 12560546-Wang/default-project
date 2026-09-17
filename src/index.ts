import { env } from './config/env.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.PORT, env.HOST, () => {
  console.log(`[server] API 已在 http://${env.HOST}:${env.PORT} 啟動 (${env.NODE_ENV})`);
});
