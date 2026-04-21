import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { env } from '../config/env.js';
import { seedTemplates } from '../constants/defaults.js';
import type { DatabaseState } from '../types/index.js';

const createSeedState = (): DatabaseState => ({
  uploadedFiles: [],
  templates: seedTemplates(),
  checks: [],
  results: [],
});

let writeChain = Promise.resolve();

export const ensureStorage = async (): Promise<void> => {
  await mkdir(env.dataDir, { recursive: true });
  await mkdir(env.uploadDir, { recursive: true });

  try {
    await readFile(env.databaseFile, 'utf8');
  } catch {
    await writeFile(env.databaseFile, JSON.stringify(createSeedState(), null, 2), 'utf8');
  }
};

export const readDatabase = async (): Promise<DatabaseState> => {
  await ensureStorage();
  const content = await readFile(env.databaseFile, 'utf8');
  return JSON.parse(content) as DatabaseState;
};

export const writeDatabase = async (state: DatabaseState): Promise<void> => {
  await ensureStorage();
  writeChain = writeChain.then(async () => {
    await writeFile(env.databaseFile, JSON.stringify(state, null, 2), 'utf8');
  });
  await writeChain;
};

export const updateDatabase = async <T>(
  updater: (state: DatabaseState) => { state: DatabaseState; result: T }
): Promise<T> => {
  const current = await readDatabase();
  const { state, result } = updater(current);
  await writeDatabase(state);
  return result;
};
