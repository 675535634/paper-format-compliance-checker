import { Router } from 'express';
import { HttpError } from '../middleware/error-handler.js';
import { createCheck, getCheckById, getCheckResult, listChecks, retryCheck } from '../services/check-service.js';
import { createCheckSchema } from '../services/validation-service.js';

export const checksRouter = Router();

checksRouter.get('/', async (_request, response) => {
  response.json(await listChecks());
});

checksRouter.post('/', async (request, response) => {
  const payload = createCheckSchema.parse(request.body);
  const check = await createCheck(payload);
  response.status(201).json(check);
});

checksRouter.get('/:id', async (request, response) => {
  const check = await getCheckById(request.params.id);
  if (!check) {
    throw new HttpError(404, `Check ${request.params.id} was not found.`);
  }

  response.json(check);
});

checksRouter.get('/:id/result', async (request, response) => {
  const result = await getCheckResult(request.params.id);
  if (!result) {
    throw new HttpError(404, `Check result for ${request.params.id} was not found.`);
  }

  response.json(result);
});

checksRouter.post('/:id/retry', async (request, response) => {
  const check = await retryCheck(request.params.id);
  if (!check) {
    throw new HttpError(404, `Check ${request.params.id} was not found.`);
  }

  response.json(check);
});
