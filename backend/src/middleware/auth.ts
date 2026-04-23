import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './error-handler.js';
import { getAuthUserFromToken } from '../services/auth-service.js';

const readBearerToken = (request: Request): string | undefined => {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }

  return authorization.slice('Bearer '.length).trim();
};

export const requireAuth = async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
  const token = readBearerToken(request);
  if (!token) {
    next(new HttpError(401, 'Authentication is required.'));
    return;
  }

  const user = await getAuthUserFromToken(token);
  if (!user) {
    next(new HttpError(401, 'Authentication is invalid or expired.'));
    return;
  }

  request.authToken = token;
  request.currentUser = user;
  next();
};

export const attachOptionalAuth = async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
  const token = readBearerToken(request);
  if (!token) {
    next();
    return;
  }

  const user = await getAuthUserFromToken(token);
  if (user) {
    request.authToken = token;
    request.currentUser = user;
  }

  next();
};
