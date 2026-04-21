import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export const notFoundHandler = (_request: Request, response: Response): void => {
  response.status(404).json({
    message: 'The requested endpoint was not found.',
  });
};

export const errorHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
): void => {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: 'Request validation failed.',
      issues: error.issues,
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      message: error.message,
    });
    return;
  }

  if (error instanceof Error) {
    response.status(500).json({
      message: error.message,
    });
    return;
  }

  response.status(500).json({
    message: 'Unknown server error.',
  });
};
