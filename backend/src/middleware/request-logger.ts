import type { NextFunction, Request, Response } from 'express';

export const requestLogger = (request: Request, response: Response, next: NextFunction): void => {
  const startedAt = Date.now();
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);

  response.on('finish', () => {
    const duration = Date.now() - startedAt;
    console.log(`[${requestId}] ${request.method} ${request.originalUrl} -> ${response.statusCode} (${duration}ms)`);
  });

  next();
};
