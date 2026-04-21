import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

export const env = {
  port: Number.parseInt(process.env.PORT ?? '6667', 10),
  dataDir: path.join(projectRoot, 'data'),
  uploadDir: path.join(projectRoot, 'uploads'),
  databaseFile: path.join(projectRoot, 'data', 'database.json'),
  maxUploadSizeBytes: Number.parseInt(process.env.MAX_UPLOAD_SIZE_BYTES ?? `${50 * 1024 * 1024}`, 10),
};
