import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureStorage } from './storage/database.js';

const bootstrap = async (): Promise<void> => {
  await ensureStorage();

  const app = createApp();
  app.listen(env.port, env.host, () => {
    const displayHost = env.host === '0.0.0.0' ? 'localhost' : env.host;
    console.log(`Paper format checker backend is running on http://${displayHost}:${env.port}`);
    if (env.host === '0.0.0.0') {
      console.log(`LAN access enabled on port ${env.port}.`);
    }
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start backend service.', error);
  process.exitCode = 1;
});
