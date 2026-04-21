import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/error-handler.js';
import { getUploadedFileById, saveUploadedFile } from '../services/file-service.js';

const upload = multer({
  dest: env.uploadDir,
  limits: {
    fileSize: env.maxUploadSizeBytes,
  },
});

export const filesRouter = Router();

filesRouter.post('/upload-docx', upload.single('file'), async (request, response) => {
  if (!request.file) {
    throw new HttpError(400, 'A .docx file must be provided in the "file" field.');
  }

  const uploaded = await saveUploadedFile(request.file);
  response.status(201).json(uploaded);
});

filesRouter.get('/:id', async (request, response) => {
  const uploadedFile = await getUploadedFileById(request.params.id);
  if (!uploadedFile) {
    throw new HttpError(404, `Uploaded file ${request.params.id} was not found.`);
  }

  response.json(uploadedFile);
});
