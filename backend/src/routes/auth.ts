import { Router } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../middleware/error-handler.js';
import { loginUser, registerUser, revokeToken } from '../services/auth-service.js';
import { loginSchema, registerSchema } from '../services/validation-service.js';

export const authRouter = Router();

authRouter.post('/register', async (request, response) => {
  try {
    const payload = registerSchema.parse(request.body);
    const session = await registerUser(payload);
    response.status(201).json(session);
  } catch (error) {
    if (error instanceof Error) {
      throw new HttpError(400, error.message);
    }

    throw error;
  }
});

authRouter.post('/login', async (request, response) => {
  try {
    const payload = loginSchema.parse(request.body);
    const session = await loginUser(payload);
    response.json(session);
  } catch (error) {
    if (error instanceof ZodError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new HttpError(401, error.message);
    }

    throw error;
  }
});

authRouter.post('/logout', async (request, response) => {
  if (request.authToken) {
    await revokeToken(request.authToken);
  }

  response.status(204).send();
});

authRouter.get('/me', async (request, response) => {
  if (!request.currentUser) {
    throw new HttpError(401, 'Authentication is required.');
  }

  response.json(request.currentUser);
});
