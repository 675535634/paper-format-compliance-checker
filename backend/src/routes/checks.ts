import { Router } from 'express';
import { HttpError } from '../middleware/error-handler.js';
import {
  createCheck,
  createFixedDocumentForCheck,
  getCheckById,
  getCheckDebugLog,
  getCheckResult,
  listChecks,
  retryCheck,
} from '../services/check-service.js';
import { createCheckSchema } from '../services/validation-service.js';

export const checksRouter = Router();

checksRouter.get('/', async (request, response) => {
  response.json(await listChecks(request.currentUser!.id));
});

checksRouter.post('/', async (request, response) => {
  const payload = createCheckSchema.parse(request.body);
  const check = await createCheck(request.currentUser!.id, payload);
  response.status(201).json(check);
});

checksRouter.get('/:id', async (request, response) => {
  const check = await getCheckById(request.params.id, request.currentUser!.id);
  if (!check) {
    throw new HttpError(404, `Check ${request.params.id} was not found.`);
  }

  response.json(check);
});

checksRouter.get('/:id/result', async (request, response) => {
  const result = await getCheckResult(request.params.id, request.currentUser!.id);
  if (!result) {
    throw new HttpError(404, `Check result for ${request.params.id} was not found.`);
  }

  response.json(result);
});

checksRouter.get('/:id/debug-log', async (request, response) => {
  const check = await getCheckById(request.params.id, request.currentUser!.id);
  if (!check) {
    throw new HttpError(404, `Check ${request.params.id} was not found.`);
  }

  const debugLog = await getCheckDebugLog(request.params.id);
  if (!debugLog) {
    throw new HttpError(404, `Debug log for ${request.params.id} was not found.`);
  }

  const filename = `${request.params.id}.debug.json`;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('content-disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  response.send(debugLog);
});

checksRouter.get('/:id/fix-download', async (request, response) => {
  try {
    const fixedDocument = await createFixedDocumentForCheck(request.currentUser!.id, request.params.id);
    response.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    response.setHeader('content-disposition', `attachment; filename="${fixedDocument.filename}"; filename*=UTF-8''${encodeURIComponent(fixedDocument.filename)}`);
    response.send(fixedDocument.buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : `Fix download for ${request.params.id} failed.`;
    throw new HttpError(404, message);
  }
});

checksRouter.post('/:id/retry', async (request, response) => {
  const check = await retryCheck(request.currentUser!.id, request.params.id);
  if (!check) {
    throw new HttpError(404, `Check ${request.params.id} was not found.`);
  }

  response.json(check);
});
