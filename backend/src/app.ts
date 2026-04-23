import express from 'express';
import cors from 'cors';
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
