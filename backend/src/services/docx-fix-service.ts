import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { fixOptionValues } from '../types/index.js';
import type { FixExportLogger } from './fix-export-log-service.js';
import type { FixOption, PaperRuleConfig, ParsedDocxModel, ParsedParagraph } from '../types/index.js';

type XmlNode = Record<string, unknown>;
interface DocumentRebuildStats {
  preservedOriginalParagraphs: number;
  rebuiltOriginalParagraphs: number;
  insertedParagraphs: number;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: false,
  processEntities: false,
});
const orderedXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: false,
  processEntities: false,
  preserveOrder: true,
});

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  suppressEmptyNode: true,
  format: true,
});
const orderedXmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  suppressEmptyNode: true,
  preserveOrder: true,
  format: false,
});

const wordMlNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const relNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const pkgRelNs = 'http://schemas.openxmlformats.org/package/2006/relationships';

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const toXmlObject = (value: unknown): XmlNode | undefined =>
  value && typeof value === 'object' ? value as XmlNode : undefined;
const noRequirementToken = '无要求';
const hasNoRequirement = (value: string | undefined | null): boolean =>
  !value || value.trim() === '' || value.trim() === noRequirementToken;
const includesNoRequirement = (value: string | undefined | null): boolean =>
  !value || value.includes(noRequirementToken);

const getWordAttr = (node: XmlNode | undefined, name: string): string | undefined => {
  if (!node) {
    return undefined;
  }

  const direct = node[`w:${name}`];
  return typeof direct === 'string' ? direct : undefined;
};

const setPropertyFirst = (node: XmlNode, key: string, value: unknown): void => {
  const entries = Object.entries(node).filter(([entryKey]) => entryKey !== key);
  for (const entryKey of Object.keys(node)) {
    delete node[entryKey];
  }

  node[key] = value;
  for (const [entryKey, entryValue] of entries) {
    node[entryKey] = entryValue;
  }
};

const parseNumericSpec = (value: string): number | undefined => {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return undefined;
  }

  const numeric = Number.parseFloat(match[1]);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const fontSizeMap: Record<string, number> = {
  初号: 42,
  小初: 36,
  一号: 26,
  小一: 24,
  二号: 22,
  小二: 18,
  三号: 16,
  小三: 15,
  四号: 14,
  小四: 12,
  五号: 10.5,
  小五: 9,
};

const parseFontSizePt = (value: string): number | undefined => {
  if (includesNoRequirement(value)) {
    return undefined;
  }

  const trimmed = value.trim();

  if (fontSizeMap[trimmed]) {
    return fontSizeMap[trimmed];
  }

  const matchedToken = Object.keys(fontSizeMap).find((token) => trimmed.includes(token));
  if (matchedToken) {
    return fontSizeMap[matchedToken];
  }

  const unitMatch = trimmed.match(/(?:字号\s*=?\s*)?(\d+(?:\.\d+)?)\s*(pt|磅)\b/i);
  if (unitMatch) {
    return Number.parseFloat(unitMatch[1]);
  }

  return /^\d+(?:\.\d+)?$/.test(trimmed) ? Number.parseFloat(trimmed) : undefined;
};

const parseMarginRule = (value: string): { top?: number; bottom?: number; left?: number; right?: number } => {
  if (hasNoRequirement(value)) {
    return {};
  }

  const normalized = value.replace(/[，；]/g, ',');
  const convertMarginValue = (numericText: string, unitText?: string): number => {
    const numeric = Number.parseFloat(numericText);
    if (!Number.isFinite(numeric)) {
      return numeric;
    }

    return /mm|毫米/i.test(unitText ?? '') ? numeric / 10 : numeric;
  };

  const numbers = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*(cm|mm|厘米|毫米)/gi)].map((match) =>
    convertMarginValue(match[1], match[2])
  );
  const result: { top?: number; bottom?: number; left?: number; right?: number } = {};

  const labelPatterns: Array<[keyof typeof result, RegExp]> = [
    ['top', /(top|上)\s*(\d+(?:\.\d+)?)\s*(cm|mm|厘米|毫米)/i],
    ['bottom', /(bottom|下)\s*(\d+(?:\.\d+)?)\s*(cm|mm|厘米|毫米)/i],
    ['left', /(left|左)\s*(\d+(?:\.\d+)?)\s*(cm|mm|厘米|毫米)/i],
    ['right', /(right|右)\s*(\d+(?:\.\d+)?)\s*(cm|mm|厘米|毫米)/i],
  ];

  for (const [key, pattern] of labelPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      result[key] = convertMarginValue(match[2], match[3]);
    }
  }

  if (numbers.length >= 4 && Object.keys(result).length === 0) {
    [result.top, result.bottom, result.left, result.right] = numbers;
  }

  return result;
};

const parseLineHeightRule = (value: string | number): { mode: 'multiple' | 'points'; value: number } | undefined => {
  if (typeof value === 'number') {
    return value <= 10
      ? { mode: 'multiple', value }
      : { mode: 'points', value };
  }

  if (hasNoRequirement(value)) {
    return undefined;
  }

  const numeric = parseNumericSpec(value);
  if (!numeric) {
    return undefined;
  }

  return /pt|磅/i.test(value)
    ? { mode: 'points', value: numeric }
    : { mode: 'multiple', value: numeric };
};

const parseSpacingRule = (value: string): { before?: number; after?: number } => {
  if (includesNoRequirement(value)) {
    return {};
  }

  const normalized = value.replace(/[，；]/g, ',');
  const result: { before?: number; after?: number } = {};

  const beforeMatch = normalized.match(/(before|段前)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(pt|磅)?/i);
  const afterMatch = normalized.match(/(after|段后)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(pt|磅)?/i);

  if (beforeMatch) {
    result.before = Number.parseFloat(beforeMatch[2]);
  }

  if (afterMatch) {
    result.after = Number.parseFloat(afterMatch[2]);
  }

  return result;
};

const parseFirstLineIndentRule = (value: string): number | undefined => {
  if (includesNoRequirement(value)) {
    return undefined;
  }

  const match = value.match(/(\d+(?:\.\d+)?)\s*(chars?|字符)/i);
  if (match) {
    return Number.parseFloat(match[1]);
  }

  return parseNumericSpec(value);
};

type ParagraphStyleRule = {
  font?: string;
  fontSizePt?: number;
  bold?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'both' | 'justify' | 'distribute';
  lineHeight?: { mode: 'multiple' | 'points'; value: number };
  spacing?: { before?: number; after?: number };
  firstLineIndent?: number;
};

type ParagraphAlignment = NonNullable<ParagraphStyleRule['alignment']>;

const parseParagraphStyleRule = (value: string, preferredKeywords: string[] = []): ParagraphStyleRule => {
  const segment = preferredKeywords.length > 0 ? selectRuleSegment(value, preferredKeywords) : value;
  const detailSegments = segment.split('|').map((item) => item.trim());
  const fontSegment = detailSegments.find((item) => /字体/i.test(item)) ?? segment;
  const sizeSegment = detailSegments.find((item) => /字号/i.test(item)) ?? segment;
  const boldSegment = detailSegments.find((item) => /字形|加粗|bold|常规|normal/i.test(item)) ?? segment;
  const alignmentSegment = detailSegments.find((item) => /对齐|居中|居左|居右|left|center|right|justify|both/i.test(item)) ?? segment;
  const lineHeightSegment = detailSegments.find((item) => /行距|line/i.test(item)) ?? segment;
  const spacingSegment = detailSegments.find((item) => /段前|段后|before|after/i.test(item)) ?? segment;
  const indentSegment = detailSegments.find((item) => /首行缩进|字符|indent/i.test(item)) ?? segment;

  return {
    font: ['宋体', '黑体', '楷体', '仿宋', 'Times New Roman']
      .find((alias) => fontSegment.toLowerCase().includes(alias.toLowerCase())),
    fontSizePt: parseFontSizePt(sizeSegment),
    bold: /加粗|bold/i.test(boldSegment) ? true : /常规|normal/i.test(boldSegment) ? false : undefined,
    alignment: parseAlignment(alignmentSegment),
    lineHeight: parseLineHeightRule(lineHeightSegment),
    spacing: parseSpacingRule(spacingSegment),
    firstLineIndent: parseFirstLineIndentRule(indentSegment),
  };
};

const parseHeadingRules = (
  value: string
): Array<ParagraphStyleRule & { level: number }> =>
  value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const levelMatch = item.match(/(?:level|heading|标题|级)\s*([1-9])/i) ?? item.match(/^([1-9])/);
      const level = levelMatch ? Number.parseInt(levelMatch[1], 10) : undefined;
      if (!level) {
        return undefined;
      }

      return {
        level,
        ...parseParagraphStyleRule(item),
      };
    })
    .filter(Boolean) as Array<ParagraphStyleRule & { level: number }>;

const parseConfiguredTokens = (value: string | undefined): string[] =>
  (hasNoRequirement(value) ? '' : value ?? '')
    .split(/[;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const selectRuleSegment = (value: string, preferredKeywords: string[]): string => {
  const segments = parseConfiguredTokens(value);
  if (segments.length === 0) {
    return value;
  }

  return segments.find((segment) => preferredKeywords.some((keyword) => segment.includes(keyword))) ?? segments[0];
};

const normalizeText = (value: string): string =>
  value
    .replace(/\s+/g, '')
    .replace(/[：:;；,，。、“”"'`]/g, '')
    .trim()
    .toLowerCase();

const matchesToken = (text: string, token: string): boolean =>
  normalizeText(text).includes(normalizeText(token));

const twipsFromCm = (value: number): string => `${Math.round(value * 567)}`;
const twipsFromPt = (value: number): string => `${Math.round(value * 20)}`;
const halfPointsFromPt = (value: number): string => `${Math.round(value * 2)}`;
const firstLineCharsValue = (value: number): string => `${Math.round(value * 100)}`;
const lineValueFromRule = (rule: { mode: 'multiple' | 'points'; value: number }): string =>
  rule.mode === 'points' ? twipsFromPt(rule.value) : `${Math.round(rule.value * 240)}`;

const parseAlignment = (value: string): ParagraphAlignment | undefined => {
  const normalized = value.toLowerCase();
  if (normalized.includes('justify') || normalized.includes('both') || normalized.includes('两端对齐')) {
    return 'both';
  }

  if (normalized.includes('center') || normalized.includes('居中')) {
    return 'center';
  }

  if (normalized.includes('right') || normalized.includes('居右') || normalized.includes('右对齐')) {
    return 'right';
  }

  if (normalized.includes('left') || normalized.includes('居左') || normalized.includes('左对齐')) {
    return 'left';
  }

  return undefined;
};

const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const xmlDeclarationPattern = /^(?:\s*<\?xml[^?]*\?>\s*)+/i;
const defaultFixOptions = [...fixOptionValues];

const emitFixLog = async (
  logger: FixExportLogger | undefined,
  event: string,
  details?: Record<string, unknown>
): Promise<void> => {
  if (!logger) {
    return;
  }

  await logger(event, details);
};

const getDocumentBodyTagSummary = (documentXml: string): Record<string, number> => {
  const summary: Record<string, number> = {};

  try {
    const orderedRoot = orderedXmlParser.parse(documentXml) as XmlNode[];
    const orderedDocumentEntry = getOrderedDocumentEntry(orderedRoot);
    const orderedBodyEntry = getOrderedBodyEntry(orderedDocumentEntry);
    const bodyChildren = Array.isArray(orderedBodyEntry?.['w:body'])
      ? orderedBodyEntry['w:body'] as XmlNode[]
      : [];

    for (const child of bodyChildren) {
      const tagName = Object.keys(child).find((key) => key !== ':@') ?? 'unknown';
      summary[tagName] = (summary[tagName] ?? 0) + 1;
    }
  } catch (error) {
    summary.parseError = 1;
  }

  return summary;
};

const inspectDocumentXml = (documentXml: string): Record<string, unknown> => {
  const wordTextAttributeCount = documentXml.match(/\sw:t=/g)?.length ?? 0;
  const invalidEmptyAttributeSamples = documentXml
    .match(/\s(?:w|a|pic|m):[A-Za-z0-9]+=""/g)
    ?.slice(0, 20) ?? [];

  return {
    bytes: Buffer.byteLength(documentXml, 'utf8'),
    wordTextAttributeCount,
    invalidEmptyAttributeCount: documentXml.match(/\s(?:w|a|pic|m):[A-Za-z0-9]+=""/g)?.length ?? 0,
    invalidEmptyAttributeSamples,
    bodyTagSummary: getDocumentBodyTagSummary(documentXml),
  };
};

const inspectParagraphNodes = (paragraphNodes: XmlNode[]): Record<string, unknown> => ({
  topLevelParagraphCount: paragraphNodes.length,
  nonEmptyParagraphCount: paragraphNodes.filter((paragraphNode) => getParagraphText(paragraphNode).length > 0).length,
  firstParagraphs: paragraphNodes.slice(0, 8).map((paragraphNode, index) => ({
    index: index + 1,
    text: getParagraphText(paragraphNode).slice(0, 80),
  })),
  lastParagraphs: paragraphNodes.slice(-8).map((paragraphNode, offset) => ({
    index: paragraphNodes.length - Math.min(8, paragraphNodes.length) + offset + 1,
    text: getParagraphText(paragraphNode).slice(0, 80),
  })),
});

const buildXml = (root: XmlNode): string => {
  normalizeTextElementNodes(root);
  const built = xmlBuilder.build(root).replace(xmlDeclarationPattern, '');
  return `${xmlHeader}${built}`;
};

const normalizeXmlPart = (content: string): string =>
  `${xmlHeader}${content.replace(xmlDeclarationPattern, '')}`;

const normalizeZipXmlDeclarations = async (zip: JSZip): Promise<void> => {
  const xmlEntryNames = Object.keys(zip.files).filter((name) => /\.(xml|rels)$/i.test(name));

  for (const entryName of xmlEntryNames) {
    const content = await zip.file(entryName)?.async('string');
    if (!content) {
      continue;
    }

    zip.file(entryName, normalizeXmlPart(content));
  }
};

const formatTimestampForFilename = (date: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
};

const wordTextElementNames = new Set(['w:t', 'w:instrText', 'w:delText']);
const wordEmptyElementNames = new Set([
  'w:adjustRightInd',
  'w:autoSpaceDE',
  'w:autoSpaceDN',
  'w:allowSpaceOfSameStyleInTable',
  'w:autofitToFirstFixedWidthCell',
  'w:autoHyphenation',
  'w:b',
  'w:bCs',
  'w:bidi',
  'w:bordersDoNotSurroundFooter',
  'w:bordersDoNotSurroundHeader',
  'w:br',
  'w:cachedColBalance',
  'w:caps',
  'w:cr',
  'w:displayHangulFixedWidth',
  'w:doNotAutofitConstrainedTables',
  'w:doNotBreakConstrainedForcedTable',
  'w:doNotIncludeSubdocsInStats',
  'w:doNotSuppressIndentation',
  'w:doNotTrackMoves',
  'w:doNotUseIndentAsNumberingTabStop',
  'w:doNotVertAlignCellWithSp',
  'w:doNotVertAlignInTxbx',
  'w:dstrike',
  'w:evenAndOddHeaders',
  'w:i',
  'w:iCs',
  'w:keepLines',
  'w:keepNext',
  'w:kinsoku',
  'w:lastRenderedPageBreak',
  'w:noBreakHyphen',
  'w:noProof',
  'w:outline',
  'w:overflowPunct',
  'w:pageBreakBefore',
  'w:shadow',
  'w:smallCaps',
  'w:snapToGrid',
  'w:softHyphen',
  'w:splitPgBreakAndParaMark',
  'w:strike',
  'w:suppressAutoHyphens',
  'w:suppressLineNumbers',
  'w:tab',
  'w:titlePg',
  'w:topLinePunct',
  'w:useAltKinsokuLineBreakRules',
  'w:useAnsiKerningPairs',
  'w:useFELayout',
  'w:useNormalStyleForList',
  'w:vanish',
  'w:webHidden',
  'w:widowControl',
  'w:wordWrap',
  'a:avLst',
  'a:fillRect',
  'a:noFill',
  'a:srcRect',
  'm:dispDef',
  'pic:cNvPicPr',
]);
const isTextElementPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const paragraphPropertiesOrder = [
  'w:pStyle',
  'w:keepNext',
  'w:keepLines',
  'w:pageBreakBefore',
  'w:framePr',
  'w:widowControl',
  'w:numPr',
  'w:suppressLineNumbers',
  'w:pBdr',
  'w:shd',
  'w:tabs',
  'w:suppressAutoHyphens',
  'w:kinsoku',
  'w:wordWrap',
  'w:overflowPunct',
  'w:topLinePunct',
  'w:autoSpaceDE',
  'w:autoSpaceDN',
  'w:bidi',
  'w:adjustRightInd',
  'w:snapToGrid',
  'w:spacing',
  'w:ind',
  'w:contextualSpacing',
  'w:mirrorIndents',
  'w:suppressOverlap',
  'w:jc',
  'w:textDirection',
  'w:textAlignment',
  'w:textboxTightWrap',
  'w:outlineLvl',
  'w:divId',
  'w:cnfStyle',
  'w:rPr',
  'w:sectPr',
  'w:pPrChange',
];

const runPropertiesOrder = [
  'w:rStyle',
  'w:rFonts',
  'w:b',
  'w:bCs',
  'w:i',
  'w:iCs',
  'w:caps',
  'w:smallCaps',
  'w:strike',
  'w:dstrike',
  'w:outline',
  'w:shadow',
  'w:emboss',
  'w:imprint',
  'w:noProof',
  'w:snapToGrid',
  'w:vanish',
  'w:webHidden',
  'w:color',
  'w:spacing',
  'w:w',
  'w:kern',
  'w:position',
  'w:sz',
  'w:szCs',
  'w:highlight',
  'w:u',
  'w:effect',
  'w:bdr',
  'w:shd',
  'w:fitText',
  'w:vertAlign',
  'w:rtl',
  'w:cs',
  'w:em',
  'w:lang',
  'w:eastAsianLayout',
  'w:specVanish',
  'w:oMath',
  'w:rPrChange',
];

const reorderNodeProperties = (node: XmlNode, preferredOrder: string[]): void => {
  const entries = Object.entries(node);
  const orderedKeys = new Set(preferredOrder);
  const orderedEntries = preferredOrder
    .filter((key) => Object.prototype.hasOwnProperty.call(node, key))
    .map((key) => [key, node[key]] as [string, unknown]);
  const remainingEntries = entries.filter(([key]) => !orderedKeys.has(key));

  for (const key of Object.keys(node)) {
    delete node[key];
  }

  for (const [key, child] of [...orderedEntries, ...remainingEntries]) {
    node[key] = child;
  }
};

const normalizeTextElementNodes = (value: unknown, nodeName?: string): void => {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((child) => normalizeTextElementNodes(child, nodeName));
    return;
  }

  const node = value as XmlNode;
  for (const [key, child] of Object.entries(node)) {
    if (wordTextElementNames.has(key) && isTextElementPrimitive(child)) {
      node[key] = { '#text': String(child) };
      continue;
    }

    if (wordEmptyElementNames.has(key) && child === '') {
      node[key] = {};
      continue;
    }

    normalizeTextElementNodes(child, key);
  }

  if (nodeName === 'w:pPr') {
    reorderNodeProperties(node, paragraphPropertiesOrder);
  } else if (nodeName === 'w:rPr') {
    reorderNodeProperties(node, runPropertiesOrder);
  } else if (nodeName === 'w:p') {
    reorderNodeProperties(node, ['w:pPr']);
  } else if (nodeName === 'w:r') {
    reorderNodeProperties(node, ['w:rPr']);
  }
};

const createParagraphNode = (text: string, options?: {
  fontFamily?: string;
  fontSizePt?: number;
  styleId?: string;
  alignment?: ParagraphAlignment;
  lineHeight?: { mode: 'multiple' | 'points'; value: number };
  spacing?: { before?: number; after?: number };
  firstLineChars?: number;
}): XmlNode => {
  const paragraphProperties: XmlNode = {};
  if (options?.styleId) {
    paragraphProperties['w:pStyle'] = { 'w:val': options.styleId };
  }

  if (options?.alignment) {
    paragraphProperties['w:jc'] = { 'w:val': options.alignment };
  }

  if (options?.lineHeight || options?.spacing) {
    const spacingNode: XmlNode = {};
    if (options.lineHeight) {
      spacingNode['w:line'] = lineValueFromRule(options.lineHeight);
      spacingNode['w:lineRule'] = options.lineHeight.mode === 'points' ? 'exact' : 'auto';
    }

    if (options.spacing?.before !== undefined) {
      spacingNode['w:before'] = twipsFromPt(options.spacing.before);
    }

    if (options.spacing?.after !== undefined) {
      spacingNode['w:after'] = twipsFromPt(options.spacing.after);
    }

    paragraphProperties['w:spacing'] = spacingNode;
  }

  if (options?.firstLineChars !== undefined) {
    paragraphProperties['w:ind'] = {
      'w:firstLineChars': firstLineCharsValue(options.firstLineChars),
    };
  }

  const runProperties: XmlNode = {};
  if (options?.fontFamily) {
    runProperties['w:rFonts'] = {
      'w:ascii': options.fontFamily,
      'w:hAnsi': options.fontFamily,
      'w:eastAsia': options.fontFamily,
    };
  }

  if (options?.fontSizePt) {
    runProperties['w:sz'] = { 'w:val': halfPointsFromPt(options.fontSizePt) };
    runProperties['w:szCs'] = { 'w:val': halfPointsFromPt(options.fontSizePt) };
  }

  return {
    'w:p': {
      ...(Object.keys(paragraphProperties).length > 0 ? { 'w:pPr': paragraphProperties } : {}),
      'w:r': {
        ...(Object.keys(runProperties).length > 0 ? { 'w:rPr': runProperties } : {}),
        'w:t': { '#text': text },
      },
    },
  }['w:p'] as XmlNode;
};

const getBodyParagraphNodes = (documentRoot: XmlNode): XmlNode[] => {
  const body = toXmlObject(toXmlObject(documentRoot['w:document'])?.['w:body']);
  const paragraphs = asArray(toXmlObject(body)?.['w:p']).map((item) => toXmlObject(item)).filter(Boolean) as XmlNode[];
  return paragraphs;
};

const setBodyParagraphNodes = (documentRoot: XmlNode, paragraphs: XmlNode[]): void => {
  const body = toXmlObject(toXmlObject(documentRoot['w:document'])?.['w:body']);
  if (body) {
    body['w:p'] = paragraphs;
  }
};

const getDocumentBodyNode = (documentRoot: XmlNode): XmlNode | undefined =>
  toXmlObject(toXmlObject(documentRoot['w:document'])?.['w:body']);

const getOrderedDocumentEntry = (orderedRoot: XmlNode[]): XmlNode | undefined =>
  orderedRoot.find((node) => Object.prototype.hasOwnProperty.call(node, 'w:document'));

const getOrderedBodyEntry = (orderedDocumentEntry: XmlNode | undefined): XmlNode | undefined =>
  (Array.isArray(orderedDocumentEntry?.['w:document']) ? orderedDocumentEntry?.['w:document'] : [])
    .map((node) => toXmlObject(node))
    .find((node) => Object.prototype.hasOwnProperty.call(node, 'w:body'));

const ensureOrderedDocumentNamespace = (orderedDocumentEntry: XmlNode | undefined): void => {
  if (!orderedDocumentEntry) {
    return;
  }

  const attributes = toXmlObject(orderedDocumentEntry[':@']) ?? {};
  attributes['xmlns:r'] = relNs;
  orderedDocumentEntry[':@'] = attributes;
};

const objectNodeToOrderedEntry = (tagName: string, node: XmlNode): XmlNode => {
  const root = { [tagName]: node };
  normalizeTextElementNodes(root);
  const built = xmlBuilder.build(root);
  const parsed = orderedXmlParser.parse(built) as XmlNode[];
  const entry = parsed.find((item) => Object.prototype.hasOwnProperty.call(item, tagName));
  if (!entry) {
    throw new Error(`Failed to rebuild ${tagName} as ordered XML.`);
  }

  return entry;
};

const buildOrderedDocumentXml = (
  originalDocumentXml: string,
  documentRoot: XmlNode,
  originalParagraphNodes: XmlNode[],
  repairedParagraphNodes: XmlNode[],
  originalParagraphSnapshots: WeakMap<XmlNode, string>,
  rebuildStats?: DocumentRebuildStats
): string => {
  const orderedRoot = orderedXmlParser.parse(originalDocumentXml) as XmlNode[];
  const orderedDocumentEntry = getOrderedDocumentEntry(orderedRoot);
  const orderedBodyEntry = getOrderedBodyEntry(orderedDocumentEntry);
  const bodyChildren = Array.isArray(orderedBodyEntry?.['w:body'])
    ? orderedBodyEntry?.['w:body'] as XmlNode[]
    : undefined;

  if (!orderedBodyEntry || !bodyChildren) {
    return buildXml(documentRoot);
  }

  ensureOrderedDocumentNamespace(orderedDocumentEntry);

  const originalParagraphIndex = new WeakMap<XmlNode, number>();
  originalParagraphNodes.forEach((paragraphNode, index) => {
    originalParagraphIndex.set(paragraphNode, index);
  });

  const paragraphChildIndexes: number[] = [];
  bodyChildren.forEach((child, index) => {
    if (Object.prototype.hasOwnProperty.call(child, 'w:p')) {
      paragraphChildIndexes.push(index);
    }
  });

  const repairedBodyChildren: XmlNode[] = [];
  let nextOriginalChildIndex = 0;

  const appendOriginalChildrenUntil = (targetChildIndex: number): void => {
    while (nextOriginalChildIndex < targetChildIndex) {
      const child = bodyChildren[nextOriginalChildIndex];
      if (!Object.prototype.hasOwnProperty.call(child, 'w:sectPr')) {
        repairedBodyChildren.push(child);
      }
      nextOriginalChildIndex += 1;
    }
  };

  for (const paragraphNode of repairedParagraphNodes) {
    const originalIndex = originalParagraphIndex.get(paragraphNode);
    if (originalIndex !== undefined) {
      const childIndex = paragraphChildIndexes[originalIndex];
      if (childIndex !== undefined) {
        appendOriginalChildrenUntil(childIndex);
        nextOriginalChildIndex = Math.max(nextOriginalChildIndex, childIndex + 1);
        if (originalParagraphSnapshots.get(paragraphNode) === JSON.stringify(paragraphNode)) {
          repairedBodyChildren.push(bodyChildren[childIndex]);
          if (rebuildStats) {
            rebuildStats.preservedOriginalParagraphs += 1;
          }
          continue;
        }
      }
    }

    if (rebuildStats) {
      if (originalIndex === undefined) {
        rebuildStats.insertedParagraphs += 1;
      } else {
        rebuildStats.rebuiltOriginalParagraphs += 1;
      }
    }
    repairedBodyChildren.push(objectNodeToOrderedEntry('w:p', paragraphNode));
  }

  appendOriginalChildrenUntil(bodyChildren.length);

  const sectionProperties = toXmlObject(getDocumentBodyNode(documentRoot)?.['w:sectPr']);
  if (sectionProperties) {
    repairedBodyChildren.push(objectNodeToOrderedEntry('w:sectPr', sectionProperties));
  }

  orderedBodyEntry['w:body'] = repairedBodyChildren;
  const built = orderedXmlBuilder.build(orderedRoot).replace(xmlDeclarationPattern, '');
  return `${xmlHeader}${built}`;
};

const ensureParagraphProperties = (paragraphNode: XmlNode): XmlNode => {
  const existing = toXmlObject(paragraphNode['w:pPr']);
  if (existing) {
    return existing;
  }

  const created: XmlNode = {};
  setPropertyFirst(paragraphNode, 'w:pPr', created);
  return created;
};

const getDirectRunNodes = (paragraphNode: XmlNode): XmlNode[] =>
  asArray(toXmlObject(paragraphNode['w:r'])).map((item) => toXmlObject(item)).filter(Boolean) as XmlNode[];

const getOrCreateDirectRuns = (paragraphNode: XmlNode): XmlNode[] => {
  const runs = getDirectRunNodes(paragraphNode);
  if (runs.length > 0) {
    return runs;
  }

  const created: XmlNode = { 'w:t': { '#text': '' } };
  paragraphNode['w:r'] = [created];
  return [created];
};

const ensureRunProperties = (runNode: XmlNode): XmlNode => {
  const existing = toXmlObject(runNode['w:rPr']);
  if (existing) {
    return existing;
  }

  const created: XmlNode = {};
  setPropertyFirst(runNode, 'w:rPr', created);
  return created;
};

const replaceParagraphText = (paragraphNode: XmlNode, text: string, options?: {
  fontFamily?: string;
  fontSizePt?: number;
  bold?: boolean;
  alignment?: ParagraphAlignment;
  lineHeight?: { mode: 'multiple' | 'points'; value: number };
  spacing?: { before?: number; after?: number };
  firstLineChars?: number;
}): void => {
  const newParagraph = createParagraphNode(text, options);
  paragraphNode['w:r'] = newParagraph['w:r'];
  if (newParagraph['w:pPr']) {
    setPropertyFirst(paragraphNode, 'w:pPr', {
      ...(toXmlObject(paragraphNode['w:pPr']) ?? {}),
      ...(toXmlObject(newParagraph['w:pPr']) ?? {}),
    });
  }
};

const applyRunFont = (runNode: XmlNode, fontFamily?: string, fontSizePt?: number, bold?: boolean): void => {
  const runProperties = ensureRunProperties(runNode);
  if (fontFamily) {
    runProperties['w:rFonts'] = {
      'w:ascii': fontFamily,
      'w:hAnsi': fontFamily,
      'w:eastAsia': fontFamily,
    };
  }

  if (fontSizePt) {
    const value = halfPointsFromPt(fontSizePt);
    runProperties['w:sz'] = { 'w:val': value };
    runProperties['w:szCs'] = { 'w:val': value };
  }

  if (bold !== undefined) {
    runProperties['w:b'] = bold ? {} : { 'w:val': '0' };
    runProperties['w:bCs'] = bold ? {} : { 'w:val': '0' };
  }
};

const applyParagraphFormatting = (
  paragraphNode: XmlNode,
  options: {
    fontFamily?: string;
    fontSizePt?: number;
    bold?: boolean;
    lineHeight?: { mode: 'multiple' | 'points'; value: number };
    spacing?: { before?: number; after?: number };
    firstLineChars?: number;
    alignment?: ParagraphAlignment;
  }
): void => {
  const runs = getOrCreateDirectRuns(paragraphNode);
  for (const run of runs) {
    applyRunFont(run, options.fontFamily, options.fontSizePt, options.bold);
  }

  const paragraphProperties = ensureParagraphProperties(paragraphNode);

  if (options.lineHeight || options.spacing) {
    const spacingNode = toXmlObject(paragraphProperties['w:spacing']) ?? {};
    if (options.lineHeight) {
      spacingNode['w:line'] = lineValueFromRule(options.lineHeight);
      spacingNode['w:lineRule'] = options.lineHeight.mode === 'points' ? 'exact' : 'auto';
    }

    if (options.spacing?.before !== undefined) {
      spacingNode['w:before'] = twipsFromPt(options.spacing.before);
    }

    if (options.spacing?.after !== undefined) {
      spacingNode['w:after'] = twipsFromPt(options.spacing.after);
    }

    paragraphProperties['w:spacing'] = spacingNode;
  }

  if (options.firstLineChars !== undefined) {
    const indentNode = toXmlObject(paragraphProperties['w:ind']) ?? {};
    indentNode['w:firstLineChars'] = firstLineCharsValue(options.firstLineChars);
    paragraphProperties['w:ind'] = indentNode;
  }

  if (options.alignment) {
    paragraphProperties['w:jc'] = { 'w:val': options.alignment };
  }
};

const getParagraphText = (paragraphNode: XmlNode): string => {
  const runs = getDirectRunNodes(paragraphNode);
  return runs
    .map((runNode) => {
      const textNode = runNode['w:t'];
      if (typeof textNode === 'string') {
        return textNode;
      }

      const objectValue = toXmlObject(textNode);
      return typeof objectValue?.['#text'] === 'string' ? objectValue['#text'] : '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
};

const ensureDocumentNamespace = (documentRoot: XmlNode): void => {
  const documentNode = toXmlObject(documentRoot['w:document']);
  if (documentNode) {
    documentNode['xmlns:r'] = relNs;
  }
};

const getSectionProperties = (documentRoot: XmlNode): XmlNode => {
  const body = toXmlObject(toXmlObject(documentRoot['w:document'])?.['w:body']);
  if (!body) {
    throw new Error('word/document.xml does not contain w:body.');
  }

  const existing = toXmlObject(body['w:sectPr']);
  if (existing) {
    return existing;
  }

  const created: XmlNode = {};
  body['w:sectPr'] = created;
  return created;
};

const ensureDocumentRelationships = async (zip: JSZip): Promise<XmlNode> => {
  const relsPath = 'word/_rels/document.xml.rels';
  const relsXml = await zip.file(relsPath)?.async('string');
  if (relsXml) {
    return xmlParser.parse(relsXml) as XmlNode;
  }

  const root: XmlNode = {
    Relationships: {
      xmlns: pkgRelNs,
      Relationship: [],
    },
  };
  zip.file(relsPath, buildXml(root));
  return root;
};

const ensureContentTypes = async (zip: JSZip): Promise<XmlNode> => {
  const contentTypesXml = await zip.file('[Content_Types].xml')?.async('string');
  if (!contentTypesXml) {
    throw new Error('The uploaded .docx file does not contain [Content_Types].xml.');
  }

  return xmlParser.parse(contentTypesXml) as XmlNode;
};

const ensureRelationship = (relsRoot: XmlNode, target: string, type: string): string => {
  const relationshipsNode = toXmlObject(relsRoot.Relationships);
  if (!relationshipsNode) {
    throw new Error('Invalid document relationships XML.');
  }

  const relationships = asArray(relationshipsNode.Relationship).map((item) => toXmlObject(item)).filter(Boolean) as XmlNode[];
  const existing = relationships.find((relationship) => relationship.Target === target && relationship.Type === type);
  if (existing && typeof existing.Id === 'string') {
    relationshipsNode.Relationship = relationships;
    return existing.Id;
  }

  const numericIds = relationships
    .map((relationship) => Number.parseInt(String(relationship.Id).replace(/^rId/, ''), 10))
    .filter((value) => Number.isFinite(value));
  const nextId = `rId${(numericIds.length > 0 ? Math.max(...numericIds) : 0) + 1}`;

  relationships.push({
    Id: nextId,
    Type: type,
    Target: target,
  });

  relationshipsNode.Relationship = relationships;
  return nextId;
};

const ensureOverride = (contentTypesRoot: XmlNode, partName: string, contentType: string): void => {
  const typesNode = toXmlObject(contentTypesRoot.Types);
  if (!typesNode) {
    throw new Error('Invalid [Content_Types].xml.');
  }

  const overrides = asArray(typesNode.Override).map((item) => toXmlObject(item)).filter(Boolean) as XmlNode[];
  if (!overrides.some((override) => override.PartName === partName)) {
    overrides.push({
      PartName: partName,
      ContentType: contentType,
    });
  }

  typesNode.Override = overrides;
};

const upsertReference = (sectPr: XmlNode, key: 'w:headerReference' | 'w:footerReference', type: string, relId: string): void => {
  const references = asArray(toXmlObject(sectPr[key])).map((item) => toXmlObject(item)).filter(Boolean) as XmlNode[];
  const existing = references.find((reference) => reference['w:type'] === type);
  if (existing) {
    existing['r:id'] = relId;
  } else {
    references.push({
      'w:type': type,
      'r:id': relId,
    });
  }

  sectPr[key] = references;
};

const ensureHeaderPart = async (
  zip: JSZip,
  relsRoot: XmlNode,
  contentTypesRoot: XmlNode,
  index: number,
  text: string
): Promise<string> => {
  const target = `header${index}.xml`;
  const relId = ensureRelationship(relsRoot, target, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header');
  ensureOverride(contentTypesRoot, `/word/${target}`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml');

  const headerRoot: XmlNode = {
    'w:hdr': {
      'xmlns:w': wordMlNs,
      'w:p': {
        'w:pPr': {
          'w:jc': { 'w:val': 'center' },
        },
        'w:r': {
          'w:t': { '#text': text },
        },
      },
    },
  };

  zip.file(`word/${target}`, buildXml(headerRoot));
  return relId;
};

const ensureFooterPart = async (
  zip: JSZip,
  relsRoot: XmlNode,
  contentTypesRoot: XmlNode,
  index: number,
  alignment: ParagraphAlignment
): Promise<string> => {
  const target = `footer${index}.xml`;
  const relId = ensureRelationship(relsRoot, target, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer');
  ensureOverride(contentTypesRoot, `/word/${target}`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml');

  const footerRoot: XmlNode = {
    'w:ftr': {
      'xmlns:w': wordMlNs,
      'w:p': {
        'w:pPr': {
          'w:jc': { 'w:val': alignment },
        },
        'w:r': [
          { 'w:fldChar': { 'w:fldCharType': 'begin' } },
          { 'w:instrText': { '#text': ' PAGE ' } },
          { 'w:fldChar': { 'w:fldCharType': 'end' } },
        ],
      },
    },
  };

  zip.file(`word/${target}`, buildXml(footerRoot));
  return relId;
};

const ensureSettingsPart = async (zip: JSZip, relsRoot: XmlNode, contentTypesRoot: XmlNode): Promise<void> => {
  const target = 'settings.xml';
  ensureRelationship(relsRoot, target, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings');
  ensureOverride(contentTypesRoot, '/word/settings.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml');

  const settingsXml = await zip.file('word/settings.xml')?.async('string');
  const settingsRoot = settingsXml
    ? xmlParser.parse(settingsXml) as XmlNode
    : {
        'w:settings': {
          'xmlns:w': wordMlNs,
        },
      };

  const settingsNode = toXmlObject(settingsRoot['w:settings']);
  if (settingsNode && !settingsNode['w:evenAndOddHeaders']) {
    settingsNode['w:evenAndOddHeaders'] = {};
  }

  zip.file('word/settings.xml', buildXml(settingsRoot));
};

const ensureHeaderAndFooter = async (
  zip: JSZip,
  documentRoot: XmlNode,
  ruleConfig: PaperRuleConfig
): Promise<void> => {
  const sectPr = getSectionProperties(documentRoot);
  const relsRoot = await ensureDocumentRelationships(zip);
  const contentTypesRoot = await ensureContentTypes(zip);

  const headerTokens = parseConfiguredTokens(ruleConfig.headerRule);
  const oddHeaderText = headerTokens[0]?.replace(/^奇数页[:：]/, '').trim()
    ?? (hasNoRequirement(ruleConfig.headerRule) ? undefined : ruleConfig.headerRule?.trim());
  const evenHeaderText = headerTokens[1]?.replace(/^偶数页[:：]/, '').trim() ?? oddHeaderText;

  if (oddHeaderText) {
    const oddHeaderRelId = await ensureHeaderPart(zip, relsRoot, contentTypesRoot, 1, oddHeaderText);
    upsertReference(sectPr, 'w:headerReference', 'default', oddHeaderRelId);
  }

  if (evenHeaderText) {
    const evenHeaderRelId = await ensureHeaderPart(zip, relsRoot, contentTypesRoot, 2, evenHeaderText);
    upsertReference(sectPr, 'w:headerReference', 'even', evenHeaderRelId);
    await ensureSettingsPart(zip, relsRoot, contentTypesRoot);
  }

  if (!hasNoRequirement(ruleConfig.pageNumberRule)) {
    const footerAlignment = parseAlignment(
      selectRuleSegment(ruleConfig.pageNumberRule ?? '', ['顶部', '底部', '页码'])
    ) ?? 'center';
    const footerRelId = await ensureFooterPart(zip, relsRoot, contentTypesRoot, 1, footerAlignment);
    upsertReference(sectPr, 'w:footerReference', 'default', footerRelId);
  }

  zip.file('word/_rels/document.xml.rels', buildXml(relsRoot));
  zip.file('[Content_Types].xml', buildXml(contentTypesRoot));
};

const getHeadingRuleMap = (
  ruleConfig: PaperRuleConfig
): Map<number, {
  font?: string;
  fontSizePt?: number;
  alignment?: ParagraphAlignment;
  lineHeight?: { mode: 'multiple' | 'points'; value: number };
  spacing?: { before?: number; after?: number };
  firstLineIndent?: number;
}> =>
  new Map(
    parseHeadingRules(ruleConfig.headingFormats).map((rule) => [
      rule.level,
      {
        font: rule.font,
        fontSizePt: rule.fontSizePt,
        alignment: rule.alignment,
        lineHeight: rule.lineHeight,
        spacing: rule.spacing,
        firstLineIndent: rule.firstLineIndent,
      },
    ])
  );

const getAbstractTitleRule = (
  ruleConfig: PaperRuleConfig
): ParagraphStyleRule => {
  const segments = parseConfiguredTokens(ruleConfig.abstractFormat);
  const titleSegment = segments.find((segment) => segment.includes('标题')) ?? segments[0] ?? ruleConfig.abstractFormat;
  return parseParagraphStyleRule(titleSegment);
};

const getCaptionRule = (value: string | undefined, prefix: '图' | '表'): ParagraphStyleRule & { position?: 'above' | 'below' } => {
  const resolved = value ?? '';
  return {
    ...parseParagraphStyleRule(resolved, [`${prefix}题注`, '题注']),
    position: resolved.includes('上方') ? 'above' : resolved.includes('下方') ? 'below' : undefined,
  };
};

const getTocRule = (value: string | undefined): {
  title: ParagraphStyleRule;
  chapter: ParagraphStyleRule;
  section: ParagraphStyleRule;
  subsection: ParagraphStyleRule;
} => {
  const resolved = value ?? '';
  const segments = parseConfiguredTokens(resolved);
  const parseSegment = (keywords: string[]): ParagraphStyleRule | undefined => {
    const segment = segments.find((item) => keywords.some((keyword) => item.includes(keyword)));
    return segment ? parseParagraphStyleRule(segment) : undefined;
  };
  const legacyBody = parseSegment(['目录正文', '正文']) ?? {};
  const plainTitleSegment = segments.find((item) => /^标题(?:\||[:：=]|$)/.test(item));
  return {
    title: parseSegment(['目录标题']) ?? (plainTitleSegment ? parseParagraphStyleRule(plainTitleSegment) : {}),
    chapter: {
      ...legacyBody,
      ...(parseSegment(['各章目录', '章目录']) ?? {}),
    },
    section: {
      ...legacyBody,
      ...(parseSegment(['一级节标题目录']) ?? {}),
    },
    subsection: {
      ...legacyBody,
      ...(parseSegment(['二级节标题目录']) ?? {}),
    },
  };
};

const getTocEntryLevelFromText = (text: string): number => {
  const resolved = text.trim();
  if (/^\d+\.\d+\.\d+\s+\S+/.test(resolved)) {
    return 3;
  }

  if (/^\d+\.\d+\s+\S+/.test(resolved)) {
    return 2;
  }

  return 1;
};

const getTocEntryRule = (tocRule: ReturnType<typeof getTocRule>, text: string): ParagraphStyleRule => {
  const level = getTocEntryLevelFromText(text);
  if (level >= 3) {
    return tocRule.subsection;
  }

  return level === 2 ? tocRule.section : tocRule.chapter;
};

const applyParagraphStyleRule = (paragraphNode: XmlNode, rule: ParagraphStyleRule): void => {
  applyParagraphFormatting(paragraphNode, {
    fontFamily: rule.font,
    fontSizePt: rule.fontSizePt,
    alignment: rule.alignment,
    lineHeight: rule.lineHeight,
    spacing: rule.spacing,
    firstLineChars: rule.firstLineIndent,
  });
};

const updateSectionPageLayout = (documentRoot: XmlNode, ruleConfig: PaperRuleConfig): void => {
  const sectPr = getSectionProperties(documentRoot);
  const pageSizeNode = toXmlObject(sectPr['w:pgSz']) ?? {};
  if (!hasNoRequirement(ruleConfig.pageSize) && ruleConfig.pageSize.trim().toUpperCase() === 'A4') {
    pageSizeNode['w:w'] = '11906';
    pageSizeNode['w:h'] = '16838';
  }

  sectPr['w:pgSz'] = pageSizeNode;

  const margins = parseMarginRule(ruleConfig.margin);
  const marginNode = toXmlObject(sectPr['w:pgMar']) ?? {};
  if (margins.top !== undefined) {
    marginNode['w:top'] = twipsFromCm(margins.top);
  }

  if (margins.bottom !== undefined) {
    marginNode['w:bottom'] = twipsFromCm(margins.bottom);
  }

  if (margins.left !== undefined) {
    marginNode['w:left'] = twipsFromCm(margins.left);
  }

  if (margins.right !== undefined) {
    marginNode['w:right'] = twipsFromCm(margins.right);
  }

  sectPr['w:pgMar'] = marginNode;
};

const normalizeKeywordsLine = (text: string): string => {
  const content = text.replace(/^(关键词|keywords?)[:：]?\s*/i, '').trim();
  const tokens = content
    .split(/[;；,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return text.trim();
  }

  return `关键词：${tokens.join('；')}`;
};

const looksLikeTocEntry = (text: string): boolean => {
  const resolved = text.trim();
  if (!resolved) {
    return false;
  }

  return /([\.·…]{2,}|\s{2,}|\t)+\d+$/.test(resolved)
    || /^[0-9一二三四五六七八九十]+(\.[0-9]+)*\s+\S+.+\d+$/.test(resolved)
    || /^第[一二三四五六七八九十百]+[章节部分篇]\s+\S+.+\d+$/.test(resolved);
};

const ensureAbstractAndKeywords = (paragraphNodes: XmlNode[], parsedDocument: ParsedDocxModel, ruleConfig: PaperRuleConfig): XmlNode[] => {
  const nextParagraphs = [...paragraphNodes];
  const alignedParsedParagraphs = alignParsedParagraphsToNodes(nextParagraphs, parsedDocument);
  const abstractIndex = alignedParsedParagraphs.findIndex((paragraph) =>
    paragraph && (matchesToken(paragraph.text, '摘要') || matchesToken(paragraph.text, 'abstract'))
  );
  const keywordIndex = alignedParsedParagraphs.findIndex((paragraph) =>
    paragraph && /(关\s*键\s*词|keywords?)/i.test(paragraph.text)
  );
  const bodyFont = hasNoRequirement(ruleConfig.bodyFont) ? undefined : ruleConfig.bodyFont;
  const bodyFontSize = parseFontSizePt(ruleConfig.bodyFontSize);
  const bodyLineHeight = parseLineHeightRule(ruleConfig.lineHeight);
  const bodySpacing = parseSpacingRule(ruleConfig.paragraphSpacing);
  const abstractTitleRule = getAbstractTitleRule(ruleConfig);

  if (abstractIndex < 0) {
    return nextParagraphs;
  }

  applyParagraphFormatting(nextParagraphs[abstractIndex], {
    fontFamily: abstractTitleRule.font ?? '黑体',
    fontSizePt: abstractTitleRule.fontSizePt ?? 18,
    bold: abstractTitleRule.bold,
    alignment: abstractTitleRule.alignment ?? 'center',
    lineHeight: abstractTitleRule.lineHeight,
    spacing: abstractTitleRule.spacing,
    firstLineChars: abstractTitleRule.firstLineIndent,
  });

  const abstractBodyStart = abstractIndex + 1;
  const abstractBodyEnd = keywordIndex > abstractIndex ? keywordIndex : parsedDocument.paragraphs.length;
  const abstractBodyIndexes = Array.from({ length: Math.max(abstractBodyEnd - abstractBodyStart, 0) }, (_, offset) => abstractBodyStart + offset);
  for (const bodyIndex of abstractBodyIndexes) {
    if (!nextParagraphs[bodyIndex]) {
      continue;
    }

    applyParagraphFormatting(nextParagraphs[bodyIndex], {
      fontFamily: bodyFont,
      fontSizePt: bodyFontSize,
      lineHeight: bodyLineHeight,
      spacing: bodySpacing,
    });
  }

  if (keywordIndex >= 0 && nextParagraphs[keywordIndex]) {
    replaceParagraphText(nextParagraphs[keywordIndex], normalizeKeywordsLine(getParagraphText(nextParagraphs[keywordIndex])), {
      fontFamily: bodyFont,
      fontSizePt: bodyFontSize,
      lineHeight: bodyLineHeight,
      spacing: bodySpacing,
    });
  }

  return nextParagraphs;
};

const ensureTableOfContents = (paragraphNodes: XmlNode[], ruleConfig: PaperRuleConfig): XmlNode[] => {
  if (hasNoRequirement(ruleConfig.tocRule)) {
    return paragraphNodes;
  }

  const nextParagraphs = [...paragraphNodes];
  const tocRule = getTocRule(ruleConfig.tocRule);
  const titleIndex = nextParagraphs.findIndex((paragraphNode) => matchesToken(getParagraphText(paragraphNode), '目录'));

  const buildTitleNode = (): XmlNode => {
    const node = createParagraphNode('目录', {
      fontFamily: tocRule.title.font ?? '黑体',
      fontSizePt: tocRule.title.fontSizePt ?? 18,
      alignment: tocRule.title.alignment ?? 'center',
      styleId: 'Heading1',
    });
    applyParagraphStyleRule(node, tocRule.title);
    return node;
  };

  const buildEntryNode = (text: string): XmlNode => {
    const entryRule = getTocEntryRule(tocRule, text);
    const node = createParagraphNode(text, {
      fontFamily: entryRule.font ?? '宋体',
      fontSizePt: entryRule.fontSizePt ?? 12,
      alignment: entryRule.alignment,
    });
    applyParagraphStyleRule(node, entryRule);
    return node;
  };

  if (titleIndex < 0) {
    return [
      ...nextParagraphs,
      buildTitleNode(),
    ];
  }

  applyParagraphStyleRule(nextParagraphs[titleIndex], tocRule.title);

  const existingEntries: XmlNode[] = [];
  for (const paragraphNode of nextParagraphs.slice(titleIndex + 1)) {
    const text = getParagraphText(paragraphNode);
    if (!text.trim()) {
      if (existingEntries.length > 0) {
        break;
      }
      continue;
    }

    if (looksLikeTocEntry(text)) {
      existingEntries.push(paragraphNode);
      continue;
    }

    if (existingEntries.length > 0) {
      break;
    }
  }

  if (existingEntries.length === 0) {
    return nextParagraphs;
  }

  existingEntries.forEach((paragraphNode) => {
    applyParagraphStyleRule(paragraphNode, getTocEntryRule(tocRule, getParagraphText(paragraphNode)));
  });
  return nextParagraphs;
};

const collectReferencedTokensFromNodes = (paragraphNodes: XmlNode[], prefix: '图' | '表'): Array<{ token: string; index: number }> => {
  const pattern = new RegExp(`${prefix}\\s*\\d+(?:\\.\\d+)*`, 'g');
  const results: Array<{ token: string; index: number }> = [];

  paragraphNodes.forEach((paragraphNode, index) => {
    const matches = getParagraphText(paragraphNode).match(pattern);
    if (!matches) {
      return;
    }

    for (const match of matches) {
      results.push({
        token: match.replace(/\s+/g, ''),
        index: index + 1,
      });
    }
  });

  return results;
};

const extractCaptionToken = (text: string, prefix: '图' | '表'): string | undefined => {
  const match = text.trim().match(new RegExp(`^${prefix}\\s*(\\d+(?:\\.\\d+)*)`));
  return match ? `${prefix}${match[1]}` : undefined;
};

const isValidCaption = (text: string, prefix: '图' | '表'): boolean =>
  new RegExp(`^${prefix}\\s*\\d+(?:\\.\\d+)*\\s+\\S+`).test(text.trim());

const alignParsedParagraphsToNodes = (
  paragraphNodes: XmlNode[],
  parsedDocument: ParsedDocxModel
): Array<ParsedParagraph | undefined> => {
  let searchStart = 0;

  return paragraphNodes.map((paragraphNode, index) => {
    const text = getParagraphText(paragraphNode);
    const matchedIndex = parsedDocument.paragraphs.findIndex((paragraph, paragraphIndex) =>
      paragraphIndex >= searchStart && paragraph.text === text
    );

    if (matchedIndex >= 0) {
      searchStart = matchedIndex + 1;
      return parsedDocument.paragraphs[matchedIndex];
    }

    const fallback = parsedDocument.paragraphs[index];
    return fallback?.text === text ? fallback : undefined;
  });
};

const isMainContentHeadingText = (text: string): boolean => {
  const resolved = text.trim();
  return /^第[一二三四五六七八九十百千万0-9]+章\s+\S+/.test(resolved)
    || /^\d+\.\d+(?:\.\d+)?\s+\S+/.test(resolved);
};

const repairCaptions = (paragraphNodes: XmlNode[], parsedDocument: ParsedDocxModel, ruleConfig: PaperRuleConfig): XmlNode[] => {
  const nextParagraphs = [...paragraphNodes];

  for (const prefix of ['图', '表'] as const) {
    const captionRule = getCaptionRule(prefix === '图' ? ruleConfig.figureCaptionRule : ruleConfig.tableCaptionRule, prefix);
    nextParagraphs.forEach((paragraphNode) => {
      const text = getParagraphText(paragraphNode);
      const token = extractCaptionToken(text, prefix);
      if (!token) {
        return;
      }

      applyParagraphFormatting(paragraphNode, {
        fontFamily: captionRule.font,
        fontSizePt: captionRule.fontSizePt,
        alignment: captionRule.alignment,
        lineHeight: captionRule.lineHeight,
        spacing: captionRule.spacing,
        firstLineChars: captionRule.firstLineIndent,
      });
    });
  }

  return nextParagraphs;
};

const applyParagraphLevelFixes = (
  paragraphNodes: XmlNode[],
  parsedDocument: ParsedDocxModel,
  ruleConfig: PaperRuleConfig,
  options: { body: boolean; headings: boolean }
): void => {
  const headingRuleMap = getHeadingRuleMap(ruleConfig);
  const bodyFont = hasNoRequirement(ruleConfig.bodyFont) ? undefined : ruleConfig.bodyFont;
  const bodyFontSize = parseFontSizePt(ruleConfig.bodyFontSize);
  const lineHeightRule = parseLineHeightRule(ruleConfig.lineHeight);
  const spacingRule = parseSpacingRule(ruleConfig.paragraphSpacing);
  const firstLineIndent = parseFirstLineIndentRule(ruleConfig.firstLineIndent);
  const alignedParsedParagraphs = alignParsedParagraphsToNodes(paragraphNodes, parsedDocument);
  const firstMainHeadingIndex = parsedDocument.paragraphs
    .find((paragraph) => paragraph.headingLevel && isMainContentHeadingText(paragraph.text))?.index;

  paragraphNodes.forEach((paragraphNode, index) => {
    const parsedParagraph = alignedParsedParagraphs[index];
    if (!parsedParagraph) {
      return;
    }

    const text = parsedParagraph.text;

    if (!text || (firstMainHeadingIndex !== undefined && parsedParagraph.index < firstMainHeadingIndex)) {
      return;
    }

    if (parsedParagraph.headingLevel) {
      if (options.headings) {
        const rule = headingRuleMap.get(parsedParagraph.headingLevel);
        applyParagraphFormatting(paragraphNode, {
          fontFamily: rule?.font,
          fontSizePt: rule?.fontSizePt,
          alignment: rule?.alignment,
          lineHeight: rule?.lineHeight,
          spacing: rule?.spacing,
          firstLineChars: rule?.firstLineIndent,
        });
      }
      return;
    }

    if (!options.body || !text) {
      return;
    }

    applyParagraphFormatting(paragraphNode, {
      fontFamily: bodyFont,
      fontSizePt: bodyFontSize,
      lineHeight: lineHeightRule,
      spacing: spacingRule,
      firstLineChars: firstLineIndent,
    });
  });
};

export const createFixedDocumentDownload = async (input: {
  filePath: string;
  originalFilename: string;
  parsedDocument: ParsedDocxModel;
  ruleConfig: PaperRuleConfig;
  fixOptions?: FixOption[];
  logger?: FixExportLogger;
}): Promise<{ buffer: Buffer; filename: string }> => {
  const buffer = await readFile(input.filePath);
  const zip = await JSZip.loadAsync(buffer);
  const selectedFixOptions = new Set(input.fixOptions ?? defaultFixOptions);

  await emitFixLog(input.logger, 'docx_fix.start', {
    filePath: input.filePath,
    originalFilename: input.originalFilename,
    originalBytes: buffer.length,
    selectedFixOptions: [...selectedFixOptions],
    parsedParagraphCount: input.parsedDocument.paragraphs.length,
    zipEntryCount: Object.keys(zip.files).length,
    hasDocumentXml: Boolean(zip.file('word/document.xml')),
    hasContentTypesXml: Boolean(zip.file('[Content_Types].xml')),
    hasDocumentRels: Boolean(zip.file('word/_rels/document.xml.rels')),
  });

  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    await emitFixLog(input.logger, 'docx_fix.missing_document_xml');
    throw new Error('The uploaded .docx file does not contain word/document.xml.');
  }

  await emitFixLog(input.logger, 'docx_fix.original_document_inspection', inspectDocumentXml(documentXml));

  const documentRoot = xmlParser.parse(documentXml) as XmlNode;
  ensureDocumentNamespace(documentRoot);
  if (selectedFixOptions.has('page_layout')) {
    await emitFixLog(input.logger, 'docx_fix.option.start', { option: 'page_layout' });
    updateSectionPageLayout(documentRoot, input.ruleConfig);
    await emitFixLog(input.logger, 'docx_fix.option.done', { option: 'page_layout' });
  }
  if (selectedFixOptions.has('header_footer')) {
    await emitFixLog(input.logger, 'docx_fix.option.start', { option: 'header_footer' });
    await ensureHeaderAndFooter(zip, documentRoot, input.ruleConfig);
    await emitFixLog(input.logger, 'docx_fix.option.done', {
      option: 'header_footer',
      hasDocumentRels: Boolean(zip.file('word/_rels/document.xml.rels')),
      headerParts: Object.keys(zip.files).filter((name) => /^word\/header\d+\.xml$/i.test(name)),
      footerParts: Object.keys(zip.files).filter((name) => /^word\/footer\d+\.xml$/i.test(name)),
    });
  }

  const originalParagraphNodes = getBodyParagraphNodes(documentRoot);
  const originalParagraphSnapshots = new WeakMap<XmlNode, string>();
  originalParagraphNodes.forEach((paragraphNode) => {
    originalParagraphSnapshots.set(paragraphNode, JSON.stringify(paragraphNode));
  });
  let paragraphNodes = [...originalParagraphNodes];
  await emitFixLog(input.logger, 'docx_fix.paragraphs.loaded', {
    original: inspectParagraphNodes(originalParagraphNodes),
  });
  if (selectedFixOptions.has('body_format') || selectedFixOptions.has('heading_format')) {
    await emitFixLog(input.logger, 'docx_fix.option.start', {
      option: 'paragraph_format',
      enabledOptions: {
        body: selectedFixOptions.has('body_format'),
        headings: selectedFixOptions.has('heading_format'),
      },
      before: inspectParagraphNodes(paragraphNodes),
    });
    applyParagraphLevelFixes(paragraphNodes, input.parsedDocument, input.ruleConfig, {
      body: selectedFixOptions.has('body_format'),
      headings: selectedFixOptions.has('heading_format'),
    });
    await emitFixLog(input.logger, 'docx_fix.option.done', {
      option: 'paragraph_format',
      enabledOptions: {
        body: selectedFixOptions.has('body_format'),
        headings: selectedFixOptions.has('heading_format'),
      },
      after: inspectParagraphNodes(paragraphNodes),
    });
  }
  if (selectedFixOptions.has('abstract_keywords')) {
    await emitFixLog(input.logger, 'docx_fix.option.start', {
      option: 'abstract_keywords',
      before: inspectParagraphNodes(paragraphNodes),
    });
    paragraphNodes = ensureAbstractAndKeywords(paragraphNodes, input.parsedDocument, input.ruleConfig);
    await emitFixLog(input.logger, 'docx_fix.option.done', {
      option: 'abstract_keywords',
      after: inspectParagraphNodes(paragraphNodes),
    });
  }
  if (selectedFixOptions.has('toc')) {
    await emitFixLog(input.logger, 'docx_fix.option.start', {
      option: 'toc',
      before: inspectParagraphNodes(paragraphNodes),
    });
    paragraphNodes = ensureTableOfContents(paragraphNodes, input.ruleConfig);
    await emitFixLog(input.logger, 'docx_fix.option.done', {
      option: 'toc',
      after: inspectParagraphNodes(paragraphNodes),
    });
  }
  if (selectedFixOptions.has('captions')) {
    await emitFixLog(input.logger, 'docx_fix.option.start', {
      option: 'captions',
      before: inspectParagraphNodes(paragraphNodes),
    });
    paragraphNodes = repairCaptions(paragraphNodes, input.parsedDocument, input.ruleConfig);
    await emitFixLog(input.logger, 'docx_fix.option.done', {
      option: 'captions',
      after: inspectParagraphNodes(paragraphNodes),
    });
  }
  if (selectedFixOptions.has('cover_fields')) {
    await emitFixLog(input.logger, 'docx_fix.option.start', {
      option: 'cover_fields',
      before: inspectParagraphNodes(paragraphNodes),
    });
    await emitFixLog(input.logger, 'docx_fix.option.done', {
      option: 'cover_fields',
      skipped: 'missing cover fields are not auto-generated',
      after: inspectParagraphNodes(paragraphNodes),
    });
  }
  if (selectedFixOptions.has('required_sections')) {
    await emitFixLog(input.logger, 'docx_fix.option.start', {
      option: 'required_sections',
      before: inspectParagraphNodes(paragraphNodes),
    });
    await emitFixLog(input.logger, 'docx_fix.option.done', {
      option: 'required_sections',
      skipped: 'missing required sections are not auto-generated',
      after: inspectParagraphNodes(paragraphNodes),
    });
  }
  if (selectedFixOptions.has('references_section')) {
    await emitFixLog(input.logger, 'docx_fix.option.start', {
      option: 'references_section',
      before: inspectParagraphNodes(paragraphNodes),
    });
    await emitFixLog(input.logger, 'docx_fix.option.done', {
      option: 'references_section',
      skipped: 'missing references are not auto-generated',
      after: inspectParagraphNodes(paragraphNodes),
    });
  }
  setBodyParagraphNodes(documentRoot, paragraphNodes);

  const documentRebuildStats: DocumentRebuildStats = {
    preservedOriginalParagraphs: 0,
    rebuiltOriginalParagraphs: 0,
    insertedParagraphs: 0,
  };
  const repairedDocumentXml = buildOrderedDocumentXml(
    documentXml,
    documentRoot,
    originalParagraphNodes,
    paragraphNodes,
    originalParagraphSnapshots,
    documentRebuildStats
  );
  await emitFixLog(input.logger, 'docx_fix.document_rebuild', { ...documentRebuildStats });
  const repairedInspection = inspectDocumentXml(repairedDocumentXml);
  await emitFixLog(input.logger, 'docx_fix.repaired_document_inspection', repairedInspection);
  zip.file('word/document.xml', repairedDocumentXml);

  const repairedBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const ext = path.extname(input.originalFilename) || '.docx';
  const basename = path.basename(input.originalFilename, ext);
  const filename = `${basename}_fixed_${formatTimestampForFilename(new Date())}${ext}`;

  await emitFixLog(input.logger, 'docx_fix.done', {
    outputFilename: filename,
    outputBytes: repairedBuffer.length,
    zipEntryCount: Object.keys(zip.files).length,
    repairedInspection,
  });

  return {
    buffer: repairedBuffer,
    filename,
  };
};
