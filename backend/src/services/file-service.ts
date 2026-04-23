import { copyFile, unlink } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { env } from '../config/env.js';
import { updateDatabase, readDatabase } from '../storage/database.js';
import type { UploadedFileRecord } from '../types/index.js';
import { createId } from './id-service.js';

const allowedMimeTypes = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
  'application/zip',
]);

const ensureDocx = (filename: string, mimeType: string): void => {
  if (!filename.toLowerCase().endsWith('.docx')) {
    throw new Error('Only .docx files are supported.');
  }

  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error(`Unsupported file MIME type: ${mimeType}`);
  }
};

const countCjkChars = (value: string): number => (value.match(/[\u3400-\u9fff]/g) ?? []).length;

export const normalizeUploadedFilename = (value: string): string => {
  if (!value) {
    return value;
  }

  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  return countCjkChars(decoded) > countCjkChars(value) ? decoded : value;
};

export const saveUploadedFile = async (file: Express.Multer.File, ownerId: string): Promise<UploadedFileRecord> => {
  const normalizedOriginalName = normalizeUploadedFilename(file.originalname);
  ensureDocx(normalizedOriginalName, file.mimetype);

  const id = createId('file');
  const targetName = `${id}${path.extname(normalizedOriginalName) || '.docx'}`;
  const targetPath = path.join(env.uploadDir, targetName);
  await copyFile(file.path, targetPath);

  const record: UploadedFileRecord = {
    id,
    ownerId,
    filename: normalizedOriginalName,
    size: file.size,
    mimeType: file.mimetype,
    storagePath: targetPath,
    uploadStatus: 'success',
    createdAt: new Date().toISOString(),
    url: `/uploads/${targetName}`,
  };

  await unlink(file.path).catch(() => undefined);

  return updateDatabase((state) => ({
    state: { ...state, uploadedFiles: [...state.uploadedFiles, record] },
    result: record,
  }));
};

export const getUploadedFileById = async (id: string): Promise<UploadedFileRecord | undefined> => {
  const db = await readDatabase();
  return db.uploadedFiles.find((file) => file.id === id);
};

export const getUploadedFileByIdForUser = async (
  id: string,
  ownerId: string
): Promise<UploadedFileRecord | undefined> => {
  const db = await readDatabase();
  return db.uploadedFiles.find((file) => file.id === id && file.ownerId === ownerId);
};
