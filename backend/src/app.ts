import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { checksRouter } from './routes/checks.js';
import { dashboardRouter } from './routes/dashboard.js';
import { filesRouter } from './routes/files.js';
import { templatesRouter } from './routes/templates.js';

export const createApp = () => {
  const app = express();

  app.use(cors());
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

  app.use('/api/files', filesRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/checks', checksRouter);
  app.use('/api/dashboard', dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
