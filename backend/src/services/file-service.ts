import { copyFile, readFile, unlink } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import JSZip from 'jszip';
import { env } from '../config/env.js';
import { updateDatabase, readDatabase } from '../storage/database.js';
import type { UploadedFileRecord } from '../types/index.js';
import { createId } from './id-service.js';

const allowedMimeTypes = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
  'application/zip',
]);

const isTemporaryWordLockFile = (filename: string): boolean =>
  path.basename(filename).startsWith('~$');

const ensureDocxPackage = async (filePath: string): Promise<void> => {
  try {
    const buffer = await readFile(filePath);
    const zip = await JSZip.loadAsync(buffer);
    const documentEntry = Object.keys(zip.files).find((name) => name.replace(/\\/g, '/') === 'word/document.xml');

    if (!documentEntry) {
      throw new Error('The uploaded .docx file is missing the main document part.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DOCX validation error.';
    throw new Error(`The uploaded .docx file is invalid or corrupted. ${message}`);
  }
};

const ensureDocx = async (filename: string, mimeType: string, filePath: string): Promise<void> => {
  if (!filename.toLowerCase().endsWith('.docx')) {
    throw new Error('Only .docx files are supported.');
  }

  if (isTemporaryWordLockFile(filename)) {
    throw new Error('Word temporary lock files starting with "~$" cannot be checked. Please upload the real .docx document.');
  }

  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error(`Unsupported file MIME type: ${mimeType}`);
  }

  await ensureDocxPackage(filePath);
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
  try {
    await ensureDocx(normalizedOriginalName, file.mimetype, file.path);

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

    return updateDatabase((state) => ({
      state: { ...state, uploadedFiles: [...state.uploadedFiles, record] },
      result: record,
    }));
  } finally {
    await unlink(file.path).catch(() => undefined);
  }
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
