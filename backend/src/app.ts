import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { attachOptionalAuth, requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { authRouter } from './routes/auth.js';
import { checksRouter } from './routes/checks.js';
import { dashboardRouter } from './routes/dashboard.js';
import { filesRouter } from './routes/files.js';
import { publicTemplatesRouter } from './routes/public-templates.js';
import { templatesRouter } from './routes/templates.js';

const backendRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const frontendDistPath = process.env.FRONTEND_DIST_DIR ?? path.resolve(backendRoot, '../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

export const createApp = () => {
  const app = express();

  app.use(cors({ exposedHeaders: ['content-disposition'] }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use('/uploads', express.static(env.uploadDir));

  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', attachOptionalAuth, authRouter);
  app.use('/api/public-templates', attachOptionalAuth, publicTemplatesRouter);
  app.use('/api/files', requireAuth, filesRouter);
  app.use('/api/templates', requireAuth, templatesRouter);
  app.use('/api/checks', requireAuth, checksRouter);
  app.use('/api/dashboard', requireAuth, dashboardRouter);

  if (fs.existsSync(frontendIndexPath)) {
    app.use(express.static(frontendDistPath));
    app.use((request, response, next) => {
      const shouldServeFrontend =
        (request.method === 'GET' || request.method === 'HEAD')
        && request.accepts('html')
        && !request.path.startsWith('/api')
        && !request.path.startsWith('/uploads');

      if (!shouldServeFrontend) {
        next();
        return;
      }

      response.sendFile(frontendIndexPath);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
