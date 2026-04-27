import { readDatabase, updateDatabase } from '../storage/database.js';
import type {
  CheckResult,
  CheckTask,
  FixOption,
  ParsedDocxModel,
  ParsedParagraph,
  RecognizedContentItem,
  RecognizedContentSection,
  StoredCheckResult,
} from '../types/index.js';
import { createId } from './id-service.js';
import { writeCheckDebugLog, getCheckDebugLog as readCheckDebugLog } from './check-debug-log-service.js';
import { parseDocxFile } from './docx-parser-service.js';
import { createFixedDocumentDownload } from './docx-fix-service.js';
import { createFixExportLogger } from './fix-export-log-service.js';
import { getUploadedFileByIdForUser } from './file-service.js';
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
  userId: stored.userId,
  paperId: stored.paperId,
  templateId: stored.templateId,
  status: stored.status,
  totalIssues: stored.totalIssues,
  issues: stored.issues,
  recognizedContents: stored.recognizedContents ?? [],
  createdAt: stored.createdAt,
});

const toRecognizedContentItems = (
  section: RecognizedContentSection,
  paragraphs: ParsedParagraph[] | undefined
): RecognizedContentItem[] =>
  (paragraphs ?? []).map((paragraph) => ({
    ...paragraph,
    id: `${section}-${paragraph.index}`,
    section,
  }));

const hasTocStyle = (paragraph: ParsedParagraph): boolean => {
  const styleId = paragraph.styleId ?? '';
  const styleName = paragraph.styleName ?? '';
  const source = `${styleId} ${styleName}`.toLowerCase();
  return /^toc\d*$/i.test(styleId)
    || /^toc\b/.test(styleName.toLowerCase())
    || source.includes('toc ');
};

const trimSectionText = (text: string): string => text.trim().replace(/\s+/g, ' ');

const isTocTitleText = (text: string): boolean => /^目\s*录$/i.test(text.trim());

const sectionTitlePatterns: Array<{
  section: RecognizedContentSection;
  patterns: RegExp[];
}> = [
  { section: 'abstract', patterns: [/^摘\s*要$/i, /^abstract$/i] },
  { section: 'keywords', patterns: [/^关\s*键\s*词(?:\s*[:：].*)?$/i, /^keywords?(?:\s*[:：].*)?$/i] },
  {
    section: 'references',
    patterns: [/^参\s*考\s*文\s*献$/i, /^references$/i, /^bibliography$/i],
  },
  { section: 'acknowledgement', patterns: [/^致\s*谢$/i, /^谢\s*辞$/i, /^acknowledgements?$/i] },
  {
    section: 'originality_statement',
    patterns: [/^(?:毕业论文)?\s*原\s*创\s*性\s*声\s*明$/i, /^原创声明$/i],
  },
  { section: 'appendix', patterns: [/^附\s*录(?:\s*[A-ZＡ-Ｚ一二三四五六七八九十0-9])?(?:\s|$)/i, /^appendix(?:\s+[A-Z0-9])?(?:\s|$)/i] },
];

const matchLogicalSectionTitle = (text: string): RecognizedContentSection | undefined => {
  const resolved = trimSectionText(text);
  if (
    !resolved
    || /[.·•…]{3,}\s*\d+\s*$/.test(resolved)
    || /\t+\s*\d+\s*$/.test(resolved)
    || /^(?:摘\s*要|致\s*谢|参\s*考\s*文\s*献|附\s*录\S*|references|appendix)(?:\s+\S+)*\s+\d+\s*$/i.test(resolved)
  ) {
    return undefined;
  }

  return sectionTitlePatterns.find(({ patterns }) => patterns.some((pattern) => pattern.test(resolved)))?.section;
};

const looksLikeTocEntryText = (text: string): boolean => {
  const resolved = text.trim();
  return /^第[一二三四五六七八九十百千万0-9]+章(?:\s|$)/.test(resolved)
    || /^\d+(?:\.\d+){0,2}\s+\S+/.test(resolved)
    || /[.·•…]{3,}\s*\d+\s*$/.test(resolved)
    || /\t+\s*\d+\s*$/.test(resolved)
    || /^(?:摘\s*要|致\s*谢|参\s*考\s*文\s*献|附\s*录\S*|references|appendix)\s+\d+\s*$/i.test(resolved);
};

const inferDisplayHeadingLevel = (paragraph: ParsedParagraph): number | undefined => {
  if (paragraph.headingLevel) {
    return paragraph.headingLevel;
  }

  const styleSource = `${paragraph.styleId ?? ''} ${paragraph.styleName ?? ''}`;
  const tocLevel = styleSource.match(/toc\s*([1-9])/i);
  if (tocLevel) {
    return Number.parseInt(tocLevel[1], 10);
  }

  const text = paragraph.text.trim();
  if (isTocTitleText(text) || /^第[一二三四五六七八九十百千万0-9]+章(?:\s|$)/.test(text)) {
    return 1;
  }

  if (/^\d+\.\d+\.\d+\s+\S+/.test(text)) {
    return 3;
  }

  if (/^\d+\.\d+\s+\S+/.test(text)) {
    return 2;
  }

  return undefined;
};

const isHeadingLikeBoundary = (paragraph: ParsedParagraph): boolean => {
  const text = paragraph.text.trim();
  if (!text) {
    return false;
  }

  return Boolean(inferDisplayHeadingLevel(paragraph))
    || Boolean(matchLogicalSectionTitle(text))
    || isTocTitleText(text);
};

const buildBodyRecognizedContents = (paragraphs: ParsedParagraph[]): RecognizedContentItem[] => {
  const items: RecognizedContentItem[] = [];
  let inTocBlock = false;
  let sawTocEntry = false;
  let tocStartPage: number | undefined;
  let currentLogicalSection: RecognizedContentSection | undefined;

  for (const paragraph of paragraphs) {
    const text = paragraph.text.trim();
    const isTocTitle = isTocTitleText(text);
    const hasTocEntryStyle = hasTocStyle(paragraph);
    const isTocEntry = hasTocEntryStyle || (inTocBlock && looksLikeTocEntryText(text));

    if (isTocTitle) {
      inTocBlock = true;
      sawTocEntry = false;
      tocStartPage = paragraph.pageNumber;
    } else if (
      inTocBlock
      && sawTocEntry
      && !hasTocEntryStyle
      && (
        Boolean(paragraph.headingLevel)
        || (
          paragraph.pageNumber !== undefined
          && tocStartPage !== undefined
          && paragraph.pageNumber > tocStartPage
        )
      )
    ) {
      inTocBlock = false;
      tocStartPage = undefined;
    } else if (inTocBlock && text && !isTocEntry && sawTocEntry) {
      inTocBlock = false;
      tocStartPage = undefined;
    }

    const isTocSection = inTocBlock || hasTocEntryStyle;
    const matchedLogicalSection = isTocSection ? undefined : matchLogicalSectionTitle(text);
    if (!isTocSection && matchedLogicalSection) {
      currentLogicalSection = matchedLogicalSection;
    } else if (
      !isTocSection
      && currentLogicalSection
      && text
      && isHeadingLikeBoundary(paragraph)
    ) {
      currentLogicalSection = undefined;
    }

    const displayHeadingLevel = inferDisplayHeadingLevel(paragraph);
    const section: RecognizedContentSection = isTocSection
      ? 'toc'
      : currentLogicalSection ?? (displayHeadingLevel ? 'heading' : 'body');
    if (section === 'toc' && isTocEntry) {
      sawTocEntry = true;
    }

    items.push({
      ...paragraph,
      id: `${section}-${paragraph.index}`,
      section,
      displayHeadingLevel,
    });

    if (!isTocSection && paragraph.hasPageBreakAfter) {
      currentLogicalSection = undefined;
    }

    if (isTocSection && paragraph.hasPageBreakAfter) {
      inTocBlock = false;
      sawTocEntry = false;
      tocStartPage = undefined;
    }
  }

  return items;
};

const buildRecognizedContents = (parsedDocument: ParsedDocxModel): RecognizedContentItem[] => [
  ...toRecognizedContentItems('header', parsedDocument.headerParagraphs),
  ...buildBodyRecognizedContents(parsedDocument.paragraphs),
  ...toRecognizedContentItems('footer', parsedDocument.footerParagraphs),
];

export const listChecks = async (userId: string): Promise<CheckTask[]> => {
  const db = await readDatabase();
  return [...db.checks]
    .filter((check) => check.userId === userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const getCheckById = async (id: string, userId: string): Promise<CheckTask | undefined> => {
  const db = await readDatabase();
  return db.checks.find((check) => check.id === id && check.userId === userId);
};

export const getCheckResult = async (checkId: string, userId: string): Promise<CheckResult | undefined> => {
  const db = await readDatabase();
  const result = db.results.find((item) => item.checkId === checkId && item.userId === userId);
  return result ? toApiResult(result) : undefined;
};

export const getCheckDebugLog = async (checkId: string): Promise<string | undefined> =>
  readCheckDebugLog(checkId);

const persistPendingCheck = async (input: { userId: string; paperId: string; templateId: string }): Promise<CheckTask> =>
  updateDatabase((state) => {
    const check: CheckTask = {
      id: createId('check'),
      userId: input.userId,
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

const executeCheck = async (
  userId: string,
  checkId: string,
  paperId: string,
  templateId?: string,
  inlineRuleConfig?: CreateCheckInput['inlineRuleConfig']
): Promise<void> => {
  await markCheckRunning(checkId);

  try {
    const uploadedFile = await getUploadedFileByIdForUser(paperId, userId);
    if (!uploadedFile) {
      throw new Error(`Uploaded file ${paperId} was not found.`);
    }

    const resolvedRuleSet = await resolveRuleConfig(userId, templateId, inlineRuleConfig);
    const parsedDocument = await parseDocxFile(uploadedFile.storagePath);
    const issues = evaluateDocumentAgainstRules(parsedDocument, resolvedRuleSet.config);

    await writeCheckDebugLog({
      checkId,
      uploadedFile,
      ruleConfig: resolvedRuleSet.config,
      parsedDocument,
      issues,
    });

    const storedResult: StoredCheckResult = {
      id: createId('result'),
      checkId,
      userId,
      paperId,
      templateId: resolvedRuleSet.templateId,
      status: 'completed',
      totalIssues: issues.length,
      issues,
      recognizedContents: buildRecognizedContents(parsedDocument),
      createdAt: now(),
    };

    await completeCheck(checkId, storedResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown check failure';
    await markCheckFailed(checkId, message);
    throw error;
  }
};

export const createCheck = async (userId: string, input: CreateCheckInput): Promise<CheckTask> => {
  const resolvedRuleSet = await resolveRuleConfig(userId, input.templateId, input.inlineRuleConfig);
  const check = await persistPendingCheck({
    userId,
    paperId: input.fileId,
    templateId: resolvedRuleSet.templateId,
  });

  try {
    await executeCheck(userId, check.id, input.fileId, input.templateId, input.inlineRuleConfig);
  } catch {
    // The task state has already been persisted as failed with a detailed error message.
  }

  const finalCheck = await getCheckById(check.id, userId);

  if (!finalCheck) {
    throw new Error(`Check ${check.id} was not found after execution.`);
  }

  return finalCheck;
};

export const retryCheck = async (userId: string, checkId: string): Promise<CheckTask | undefined> => {
  const existing = await getCheckById(checkId, userId);
  if (!existing) {
    return undefined;
  }

  await executeCheck(userId, checkId, existing.paperId, existing.templateId);
  return getCheckById(checkId, userId);
};

export const createFixedDocumentForCheck = async (userId: string, checkId: string, context: FixExportRequestContext = {}): Promise<{
  buffer: Buffer;
  filename: string;
}> => {
  return createFixedDocumentForCheckWithOptions(userId, checkId, undefined, context);
};

interface FixExportRequestContext {
  requestId?: string;
  routeMethod?: string;
}

export const createFixedDocumentForCheckWithOptions = async (
  userId: string,
  checkId: string,
  fixOptions?: FixOption[],
  context: FixExportRequestContext = {}
): Promise<{
  buffer: Buffer;
  filename: string;
}> => {
  const logger = createFixExportLogger({
    userId,
    checkId,
    requestId: context.requestId,
  });

  await logger('check_service.start', {
    routeMethod: context.routeMethod,
    requestedFixOptions: fixOptions ?? null,
  });

  const check = await getCheckById(checkId, userId);
  if (!check) {
    await logger('check_service.check_missing');
    throw new Error(`Check ${checkId} was not found.`);
  }

  await logger('check_service.check_loaded', {
    paperId: check.paperId,
    templateId: check.templateId,
    status: check.status,
    totalIssues: check.totalIssues,
  });

  const uploadedFile = await getUploadedFileByIdForUser(check.paperId, userId);
  if (!uploadedFile) {
    await logger('check_service.upload_missing', { paperId: check.paperId });
    throw new Error(`Uploaded file ${check.paperId} was not found.`);
  }

  await logger('check_service.upload_loaded', {
    paperId: uploadedFile.id,
    filename: uploadedFile.filename,
    size: uploadedFile.size,
    storagePath: uploadedFile.storagePath,
  });

  const resolvedRuleSet = await resolveRuleConfig(userId, check.templateId);
  await logger('check_service.rules_loaded', {
    templateId: resolvedRuleSet.templateId,
  });

  const parsedDocument = await parseDocxFile(uploadedFile.storagePath);
  await logger('check_service.parsed_original', {
    paragraphCount: parsedDocument.paragraphs.length,
    headerCount: parsedDocument.headerTexts.length,
    pageSize: parsedDocument.pageSize ?? null,
    marginsCm: parsedDocument.marginsCm ?? null,
    hasPageNumberField: parsedDocument.hasPageNumberField,
  });

  const fixedDocument = await createFixedDocumentDownload({
    filePath: uploadedFile.storagePath,
    originalFilename: uploadedFile.filename,
    parsedDocument,
    ruleConfig: resolvedRuleSet.config,
    fixOptions,
    logger,
  });

  await logger('check_service.done', {
    outputFilename: fixedDocument.filename,
    outputBytes: fixedDocument.buffer.length,
  });

  return fixedDocument;
};
