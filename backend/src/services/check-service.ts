import { readDatabase, updateDatabase } from '../storage/database.js';
import type { CheckResult, CheckTask, StoredCheckResult } from '../types/index.js';
import { createId } from './id-service.js';
import { parseDocxFile } from './docx-parser-service.js';
import { getUploadedFileById } from './file-service.js';
import { evaluateDocumentAgainstRules } from './rule-engine-service.js';
import { resolveRuleConfig } from './template-service.js';
import type { CreateCheckInput } from './validation-service.js';

const now = () => new Date().toISOString();

const summarizeIssues = (result: StoredCheckResult) => ({
  totalIssues: result.issues.length,
  summaryErrorCount: result.issues.filter((issue) => issue.severity === 'high').length,
  summaryWarningCount: result.issues.filter((issue) => issue.severity === 'medium').length,
  summaryInfoCount: result.issues.filter((issue) => issue.severity === 'low').length,
});

const toApiResult = (stored: StoredCheckResult): CheckResult => ({
  id: stored.checkId,
  paperId: stored.paperId,
  templateId: stored.templateId,
  status: stored.status,
  totalIssues: stored.totalIssues,
  issues: stored.issues,
  createdAt: stored.createdAt,
});

export const listChecks = async (): Promise<CheckTask[]> => {
  const db = await readDatabase();
  return [...db.checks].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const getCheckById = async (id: string): Promise<CheckTask | undefined> => {
  const db = await readDatabase();
  return db.checks.find((check) => check.id === id);
};

export const getCheckResult = async (checkId: string): Promise<CheckResult | undefined> => {
  const db = await readDatabase();
  const result = db.results.find((item) => item.checkId === checkId);
  return result ? toApiResult(result) : undefined;
};

const persistPendingCheck = async (input: { paperId: string; templateId: string }): Promise<CheckTask> =>
  updateDatabase((state) => {
    const check: CheckTask = {
      id: createId('check'),
      paperId: input.paperId,
      templateId: input.templateId,
      status: 'pending',
      totalIssues: 0,
      summaryErrorCount: 0,
      summaryWarningCount: 0,
      summaryInfoCount: 0,
      createdAt: now(),
    };

    return {
      state: { ...state, checks: [...state.checks, check] },
      result: check,
    };
  });

const markCheckRunning = async (checkId: string): Promise<void> => {
  await updateDatabase((state) => ({
    state: {
      ...state,
      checks: state.checks.map((check) => check.id === checkId
        ? { ...check, status: 'checking', startedAt: now() }
        : check),
    },
    result: undefined,
  }));
};

const markCheckFailed = async (checkId: string, message: string): Promise<void> => {
  await updateDatabase((state) => ({
    state: {
      ...state,
      checks: state.checks.map((check) => check.id === checkId
        ? { ...check, status: 'failed', errorMessage: message, finishedAt: now() }
        : check),
    },
    result: undefined,
  }));
};

const completeCheck = async (checkId: string, result: StoredCheckResult): Promise<void> => {
  const summary = summarizeIssues(result);

  await updateDatabase((state) => ({
    state: {
      ...state,
      checks: state.checks.map((check) => check.id === checkId
        ? {
            ...check,
            status: 'completed',
            finishedAt: now(),
            ...summary,
          }
        : check),
      results: [
        ...state.results.filter((item) => item.checkId !== checkId),
        result,
      ],
    },
    result: undefined,
  }));
};

const executeCheck = async (checkId: string, paperId: string, templateId?: string, inlineRuleConfig?: CreateCheckInput['inlineRuleConfig']): Promise<void> => {
  await markCheckRunning(checkId);

  try {
    const uploadedFile = await getUploadedFileById(paperId);
    if (!uploadedFile) {
      throw new Error(`Uploaded file ${paperId} was not found.`);
    }

    const resolvedRuleSet = await resolveRuleConfig(templateId, inlineRuleConfig);
    const parsedDocument = await parseDocxFile(uploadedFile.storagePath);
    const issues = evaluateDocumentAgainstRules(parsedDocument, resolvedRuleSet.config);

    const storedResult: StoredCheckResult = {
      id: createId('result'),
      checkId,
      paperId,
      templateId: resolvedRuleSet.templateId,
      status: 'completed',
      totalIssues: issues.length,
      issues,
      createdAt: now(),
    };

    await completeCheck(checkId, storedResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown check failure';
    await markCheckFailed(checkId, message);
    throw error;
  }
};

export const createCheck = async (input: CreateCheckInput): Promise<CheckTask> => {
  const resolvedRuleSet = await resolveRuleConfig(input.templateId, input.inlineRuleConfig);
  const check = await persistPendingCheck({
    paperId: input.fileId,
    templateId: resolvedRuleSet.templateId,
  });

  await executeCheck(check.id, input.fileId, input.templateId, input.inlineRuleConfig);
  const finalCheck = await getCheckById(check.id);

  if (!finalCheck) {
    throw new Error(`Check ${check.id} was not found after execution.`);
  }

  return finalCheck;
};

export const retryCheck = async (checkId: string): Promise<CheckTask | undefined> => {
  const existing = await getCheckById(checkId);
  if (!existing) {
    return undefined;
  }

  await executeCheck(checkId, existing.paperId, existing.templateId);
  return getCheckById(checkId);
};
