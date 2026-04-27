import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

export type FixExportLogDetails = Record<string, unknown>;

export type FixExportLogger = (
  event: string,
  details?: FixExportLogDetails
) => void | Promise<void>;

export interface FixExportLogBase {
  checkId?: string;
  userId?: string;
  requestId?: string;
  paperId?: string;
  filename?: string;
}

const getFixExportLogPath = (): string => path.join(env.logDir, 'fix-export.log');

const safeStringify = (value: unknown): string => JSON.stringify(value, (_key, item) => {
  if (item instanceof Error) {
    return {
      name: item.name,
      message: item.message,
      stack: item.stack,
    };
  }

  return item;
});

export const createFixExportLogger = (base: FixExportLogBase): FixExportLogger => {
  return async (event, details = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      ...base,
      details,
    };
    const line = safeStringify(entry);

    console.log(`[fix-export] ${line}`);

    try {
      await mkdir(env.logDir, { recursive: true });
      await appendFile(getFixExportLogPath(), `${line}\n`, 'utf8');
    } catch (error) {
      console.error('[fix-export] failed to write log file', error);
    }
  };
};
