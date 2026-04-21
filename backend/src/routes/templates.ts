import { Router } from 'express';
import { HttpError } from '../middleware/error-handler.js';
import {
  applyTemplateAsDefault,
  copyTemplate,
  createTemplate,
  deleteTemplate,
  getTemplateById,
  listTemplates,
  updateTemplate,
} from '../services/template-service.js';
import { createTemplateSchema, updateTemplateSchema } from '../services/validation-service.js';

export const templatesRouter = Router();

templatesRouter.get('/', async (_request, response) => {
  response.json(await listTemplates());
});

templatesRouter.get('/:id', async (request, response) => {
  const template = await getTemplateById(request.params.id);
  if (!template) {
    throw new HttpError(404, `Template ${request.params.id} was not found.`);
  }

  response.json(template);
});

templatesRouter.post('/', async (request, response) => {
  const payload = createTemplateSchema.parse(request.body);
  const template = await createTemplate(payload);
  response.status(201).json(template);
});

templatesRouter.put('/:id', async (request, response) => {
  const payload = updateTemplateSchema.parse(request.body);
  const template = await updateTemplate(request.params.id, payload);
  if (!template) {
    throw new HttpError(404, `Template ${request.params.id} was not found.`);
  }

  response.json(template);
});

templatesRouter.delete('/:id', async (request, response) => {
  const deleted = await deleteTemplate(request.params.id);
  if (!deleted) {
    throw new HttpError(404, `Template ${request.params.id} was not found.`);
  }

  response.status(204).send();
});

templatesRouter.post('/:id/copy', async (request, response) => {
  const template = await copyTemplate(request.params.id);
  if (!template) {
    throw new HttpError(404, `Template ${request.params.id} was not found.`);
  }

  response.status(201).json(template);
});

templatesRouter.post('/:id/apply', async (request, response) => {
  const template = await applyTemplateAsDefault(request.params.id);
  if (!template) {
    throw new HttpError(404, `Template ${request.params.id} was not found.`);
  }

  response.json(template);
});
