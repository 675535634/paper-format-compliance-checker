import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureStorage } from './storage/database.js';

const bootstrap = async (): Promise<void> => {
  await ensureStorage();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Paper format checker backend is running on http://localhost:${env.port}`);
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start backend service.', error);
  process.exitCode = 1;
});
