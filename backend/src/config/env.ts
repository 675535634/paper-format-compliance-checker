import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const dataDir = process.env.DATA_DIR ?? path.join(projectRoot, 'data');
const uploadDir = process.env.UPLOAD_DIR ?? path.join(projectRoot, 'uploads');

export const env = {
  host: process.env.HOST ?? '0.0.0.0',
  port: Number.parseInt(process.env.PORT ?? '16667', 10),
  dataDir,
  uploadDir,
  logDir: process.env.LOG_DIR ?? path.join(dataDir, 'logs'),
  databaseFile: process.env.DATABASE_FILE ?? path.join(dataDir, 'database.json'),
  maxUploadSizeBytes: Number.parseInt(process.env.MAX_UPLOAD_SIZE_BYTES ?? `${50 * 1024 * 1024}`, 10),
};
