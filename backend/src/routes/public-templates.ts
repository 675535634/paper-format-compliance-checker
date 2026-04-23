import { Router } from 'express';
import { HttpError } from '../middleware/error-handler.js';
import {
  favoritePublicTemplate,
  getPublicTemplateById,
  listPublicTemplates,
  unfavoritePublicTemplate,
} from '../services/template-service.js';
import { listPublicTemplatesSchema } from '../services/validation-service.js';

export const publicTemplatesRouter = Router();

publicTemplatesRouter.get('/', async (request, response) => {
  const query = listPublicTemplatesSchema.parse(request.query);
  response.json(await listPublicTemplates(query, request.currentUser?.id));
});

publicTemplatesRouter.get('/:id', async (request, response) => {
  const template = await getPublicTemplateById(request.params.id, request.currentUser?.id);
  if (!template) {
    throw new HttpError(404, `Public template ${request.params.id} was not found.`);
  }

  response.json(template);
});

publicTemplatesRouter.post('/:id/favorite', async (request, response) => {
  if (!request.currentUser) {
    throw new HttpError(401, 'Authentication is required.');
  }

  const template = await favoritePublicTemplate(request.params.id, request.currentUser.id);
  if (!template) {
    throw new HttpError(404, `Public template ${request.params.id} was not found.`);
  }

  response.json(template);
});

publicTemplatesRouter.delete('/:id/favorite', async (request, response) => {
  if (!request.currentUser) {
    throw new HttpError(401, 'Authentication is required.');
  }

  const template = await unfavoritePublicTemplate(request.params.id, request.currentUser.id);
  if (!template) {
    throw new HttpError(404, `Public template ${request.params.id} was not found.`);
  }

  response.json(template);
});
