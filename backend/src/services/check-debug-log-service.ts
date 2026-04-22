import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import type { CheckIssue, PaperRuleConfig, ParsedDocxModel, UploadedFileRecord } from '../types/index.js';

interface DebugLogInput {
  checkId: string;
  uploadedFile: UploadedFileRecord;
  ruleConfig: PaperRuleConfig;
  parsedDocument: ParsedDocxModel;
  issues: CheckIssue[];
}

const buildSectionSignals = (parsedDocument: ParsedDocxModel) => {
  const paragraphTexts = parsedDocument.paragraphs.map((paragraph) => paragraph.text);
  const includesAny = (patterns: RegExp[]): boolean => paragraphTexts.some((text) => patterns.some((pattern) => pattern.test(text)));

  return {
    abstractDetected: includesAny([/^(摘要|abstract)$/i]),
    keywordsDetected: includesAny([/(关键词|keywords?)/i]),
    referencesDetected: includesAny([/^(参考文献|references)$/i]),
    originalityDetected: includesAny([/(原创性声明|毕业论文原创性声明)/]),
    acknowledgementDetected: includesAny([/^(致谢|谢辞|acknowledg)/i]),
  };
};

const buildDebugLogPayload = ({ checkId, uploadedFile, ruleConfig, parsedDocument, issues }: DebugLogInput) => ({
  checkId,
  file: {
    id: uploadedFile.id,
    filename: uploadedFile.filename,
    size: uploadedFile.size,
    storagePath: uploadedFile.storagePath,
    uploadedAt: uploadedFile.createdAt,
  },
  generatedAt: new Date().toISOString(),
  readSummary: {
    paragraphCount: parsedDocument.paragraphCount,
    headerCount: parsedDocument.headerTexts.length,
    headerTexts: parsedDocument.headerTexts,
    pageSize: parsedDocument.pageSize ?? null,
    marginsCm: parsedDocument.marginsCm ?? null,
    defaultFontFamily: parsedDocument.defaultFontFamily ?? null,
    defaultFontSizePt: parsedDocument.defaultFontSizePt ?? null,
    hasPageNumberField: parsedDocument.hasPageNumberField,
    pageNumberAlignment: parsedDocument.pageNumberAlignment ?? null,
    sectionSignals: buildSectionSignals(parsedDocument),
  },
  paragraphPreview: parsedDocument.paragraphs.slice(0, 60).map((paragraph) => ({
    index: paragraph.index,
    text: paragraph.text,
    headingLevel: paragraph.headingLevel ?? null,
    styleId: paragraph.styleId ?? null,
    styleName: paragraph.styleName ?? null,
    fontFamily: paragraph.fontFamily ?? null,
    fontSizePt: paragraph.fontSizePt ?? null,
    lineHeight: paragraph.lineHeight ?? null,
    lineHeightMode: paragraph.lineHeightMode ?? null,
    firstLineChars: paragraph.firstLineChars ?? null,
    numbering: paragraph.numbering ?? null,
  })),
  ruleConfig,
  issueSummary: {
    total: issues.length,
    high: issues.filter((issue) => issue.severity === 'high').length,
    medium: issues.filter((issue) => issue.severity === 'medium').length,
    low: issues.filter((issue) => issue.severity === 'low').length,
  },
  issues,
});

const getDebugLogPath = (checkId: string): string => path.join(env.logDir, `${checkId}.json`);

export const writeCheckDebugLog = async (input: DebugLogInput): Promise<string> => {
  await mkdir(env.logDir, { recursive: true });
  const filePath = getDebugLogPath(input.checkId);
  const payload = buildDebugLogPayload(input);
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return filePath;
};

export const getCheckDebugLog = async (checkId: string): Promise<string | undefined> => {
  const filePath = getDebugLogPath(checkId);

  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
};
