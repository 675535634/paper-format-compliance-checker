import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { seedTemplates, SYSTEM_USER_ID } from '../constants/defaults.js';
import type {
  AuthTokenRecord,
  CheckTask,
  DatabaseState,
  RuleTemplate,
  StoredCheckResult,
  TemplateFavoriteRecord,
  UploadedFileRecord,
  UserRecord,
} from '../types/index.js';

const now = () => new Date().toISOString();

const createSystemUser = (): UserRecord => ({
  id: SYSTEM_USER_ID,
  username: 'system',
  email: 'system@local',
  passwordHash: '',
  passwordSalt: '',
  displayName: 'System',
  createdAt: now(),
  updatedAt: now(),
});

const computeHotScore = (template: Pick<RuleTemplate, 'favoriteCount' | 'viewCount' | 'useCount'>): number =>
  template.favoriteCount * 5 + template.useCount * 3 + template.viewCount;

const normalizeTemplate = (template: Partial<RuleTemplate>, index: number): RuleTemplate => {
  const updatedAt = template.updatedAt ?? now();
  const favoriteCount = template.favoriteCount ?? 0;
  const viewCount = template.viewCount ?? 0;
  const useCount = template.useCount ?? 0;

  return {
    id: template.id ?? `tpl_migrated_${index}`,
    ownerId: template.ownerId ?? SYSTEM_USER_ID,
    name: template.name ?? `Template ${index + 1}`,
    description: template.description ?? '',
    config: template.config ?? seedTemplates()[0].config,
    updatedAt,
    isDefault: template.isDefault ?? index === 0,
    visibility: template.visibility ?? 'public',
    publishedAt: template.visibility === 'private'
      ? template.publishedAt
      : template.publishedAt ?? updatedAt,
    favoriteCount,
    viewCount,
    useCount,
    hotScore: template.hotScore ?? computeHotScore({ favoriteCount, viewCount, useCount }),
  };
};

const normalizeUploadedFile = (file: Partial<UploadedFileRecord>, index: number): UploadedFileRecord => ({
  id: file.id ?? `file_migrated_${index}`,
  ownerId: file.ownerId ?? SYSTEM_USER_ID,
  filename: file.filename ?? 'Unknown file',
  size: file.size ?? 0,
  mimeType: file.mimeType ?? 'application/octet-stream',
  storagePath: file.storagePath ?? '',
  uploadStatus: file.uploadStatus ?? 'success',
  createdAt: file.createdAt ?? now(),
  url: file.url,
});

const normalizeCheck = (check: Partial<CheckTask>, index: number): CheckTask => ({
  id: check.id ?? `check_migrated_${index}`,
  userId: check.userId ?? SYSTEM_USER_ID,
  paperId: check.paperId ?? '',
  templateId: check.templateId ?? '',
  status: check.status ?? 'completed',
  totalIssues: check.totalIssues ?? 0,
  summaryErrorCount: check.summaryErrorCount ?? 0,
  summaryWarningCount: check.summaryWarningCount ?? 0,
  summaryInfoCount: check.summaryInfoCount ?? 0,
  createdAt: check.createdAt ?? now(),
  startedAt: check.startedAt,
  finishedAt: check.finishedAt,
  errorMessage: check.errorMessage,
});

const normalizeResult = (result: Partial<StoredCheckResult>, index: number): StoredCheckResult => ({
  id: result.id ?? `result_migrated_${index}`,
  checkId: result.checkId ?? '',
  userId: result.userId ?? SYSTEM_USER_ID,
  paperId: result.paperId ?? '',
  templateId: result.templateId ?? '',
  status: result.status ?? 'completed',
  totalIssues: result.totalIssues ?? result.issues?.length ?? 0,
  issues: result.issues ?? [],
  createdAt: result.createdAt ?? now(),
});

const createSeedState = (): DatabaseState => ({
  users: [createSystemUser()],
  authTokens: [],
  uploadedFiles: [],
  templates: seedTemplates(),
  templateFavorites: [],
  checks: [],
  results: [],
});

const normalizeDatabaseState = (input: unknown): DatabaseState => {
  const raw = typeof input === 'object' && input !== null ? input as Partial<DatabaseState> : {};
  const users = Array.isArray(raw.users) ? raw.users : [];
  const authTokens = Array.isArray(raw.authTokens) ? raw.authTokens : [];
  const templates = Array.isArray(raw.templates) ? raw.templates : [];
  const uploadedFiles = Array.isArray(raw.uploadedFiles) ? raw.uploadedFiles : [];
  const templateFavorites = Array.isArray(raw.templateFavorites) ? raw.templateFavorites : [];
  const checks = Array.isArray(raw.checks) ? raw.checks : [];
  const results = Array.isArray(raw.results) ? raw.results : [];

  const normalizedUsers = users.length > 0
    ? users.map((user, index) => ({
        id: user.id ?? `user_migrated_${index}`,
        username: user.username ?? `user${index + 1}`,
        email: user.email ?? `user${index + 1}@local`,
        passwordHash: user.passwordHash ?? '',
        passwordSalt: user.passwordSalt ?? '',
        displayName: user.displayName ?? user.username ?? `User ${index + 1}`,
        createdAt: user.createdAt ?? now(),
        updatedAt: user.updatedAt ?? user.createdAt ?? now(),
      }))
    : [createSystemUser()];

  if (!normalizedUsers.some((user) => user.id === SYSTEM_USER_ID)) {
    normalizedUsers.unshift(createSystemUser());
  }

  return {
    users: normalizedUsers,
    authTokens: authTokens.map((token, index) => ({
      id: token.id ?? `token_migrated_${index}`,
      userId: token.userId ?? SYSTEM_USER_ID,
      tokenHash: token.tokenHash ?? '',
      createdAt: token.createdAt ?? now(),
      expiresAt: token.expiresAt ?? now(),
    })) as AuthTokenRecord[],
    uploadedFiles: uploadedFiles.map(normalizeUploadedFile),
    templates: templates.length > 0 ? templates.map(normalizeTemplate) : seedTemplates(),
    templateFavorites: templateFavorites.map((favorite, index) => ({
      id: favorite.id ?? `favorite_migrated_${index}`,
      userId: favorite.userId ?? SYSTEM_USER_ID,
      templateId: favorite.templateId ?? '',
      createdAt: favorite.createdAt ?? now(),
    })) as TemplateFavoriteRecord[],
    checks: checks.map(normalizeCheck),
    results: results.map(normalizeResult),
  };
};

let writeChain = Promise.resolve();

export const ensureStorage = async (): Promise<void> => {
  await mkdir(env.dataDir, { recursive: true });
  await mkdir(env.uploadDir, { recursive: true });
  await mkdir(env.logDir, { recursive: true });
  await mkdir(path.dirname(env.databaseFile), { recursive: true });

  try {
    const content = await readFile(env.databaseFile, 'utf8');
    const normalized = normalizeDatabaseState(JSON.parse(content));
    await writeFile(env.databaseFile, JSON.stringify(normalized, null, 2), 'utf8');
  } catch {
    await writeFile(env.databaseFile, JSON.stringify(createSeedState(), null, 2), 'utf8');
  }
};

export const readDatabase = async (): Promise<DatabaseState> => {
  await ensureStorage();
  const content = await readFile(env.databaseFile, 'utf8');
  return normalizeDatabaseState(JSON.parse(content));
};

export const writeDatabase = async (state: DatabaseState): Promise<void> => {
  await ensureStorage();
  writeChain = writeChain.then(async () => {
    await writeFile(env.databaseFile, JSON.stringify(normalizeDatabaseState(state), null, 2), 'utf8');
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
