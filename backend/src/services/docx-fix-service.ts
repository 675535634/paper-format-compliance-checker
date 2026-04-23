import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import type { PaperRuleConfig, ParsedDocxModel, ParsedParagraph } from '../types/index.js';

type XmlNode = Record<string, unknown>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: false,
  processEntities: false,
});

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  suppressEmptyNode: true,
  format: true,
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

  const beforeMatch = normalized.match(/(before|段前)\s*(\d+(?:\.\d+)?)\s*(pt|磅)?/i);
  const afterMatch = normalized.match(/(after|段后)\s*(\d+(?:\.\d+)?)\s*(pt|磅)?/i);

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
  alignment?: 'left' | 'center' | 'right';
  lineHeight?: { mode: 'multiple' | 'points'; value: number };
  spacing?: { before?: number; after?: number };
  firstLineIndent?: number;
};

const parseParagraphStyleRule = (value: string, preferredKeywords: string[] = []): ParagraphStyleRule => {
  const segment = preferredKeywords.length > 0 ? selectRuleSegment(value, preferredKeywords) : value;
  const detailSegments = segment.split('|').map((item) => item.trim());
  const fontSegment = detailSegments.find((item) => /字体/i.test(item)) ?? segment;
  const sizeSegment = detailSegments.find((item) => /字号/i.test(item)) ?? segment;
  const alignmentSegment = detailSegments.find((item) => /对齐|居中|居左|居右|left|center|right/i.test(item)) ?? segment;
  const lineHeightSegment = detailSegments.find((item) => /行距|line/i.test(item)) ?? segment;
  const spacingSegment = detailSegments.find((item) => /段前|段后|before|after/i.test(item)) ?? segment;
  const indentSegment = detailSegments.find((item) => /首行缩进|字符|indent/i.test(item)) ?? segment;

  return {
    font: ['宋体', '黑体', '楷体', '仿宋', 'Times New Roman']
      .find((alias) => fontSegment.toLowerCase().includes(alias.toLowerCase())),
    fontSizePt: parseFontSizePt(sizeSegment),
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

const parseAlignment = (value: string): 'left' | 'center' | 'right' | undefined => {
  const normalized = value.toLowerCase();
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

const buildXml = (root: XmlNode): string => `${xmlHeader}${xmlBuilder.build(root)}`;

const createParagraphNode = (text: string, options?: {
  fontFamily?: string;
  fontSizePt?: number;
  styleId?: string;
  alignment?: 'left' | 'center' | 'right';
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

const ensureParagraphProperties = (paragraphNode: XmlNode): XmlNode => {
  const existing = toXmlObject(paragraphNode['w:pPr']);
  if (existing) {
    return existing;
  }

  const created: XmlNode = {};
  paragraphNode['w:pPr'] = created;
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
  runNode['w:rPr'] = created;
  return created;
};

const replaceParagraphText = (paragraphNode: XmlNode, text: string, options?: {
  fontFamily?: string;
  fontSizePt?: number;
  alignment?: 'left' | 'center' | 'right';
  lineHeight?: { mode: 'multiple' | 'points'; value: number };
  spacing?: { before?: number; after?: number };
  firstLineChars?: number;
}): void => {
  const newParagraph = createParagraphNode(text, options);
  paragraphNode['w:r'] = newParagraph['w:r'];
  if (newParagraph['w:pPr']) {
    paragraphNode['w:pPr'] = {
      ...(toXmlObject(paragraphNode['w:pPr']) ?? {}),
      ...(toXmlObject(newParagraph['w:pPr']) ?? {}),
    };
  }
};

const applyRunFont = (runNode: XmlNode, fontFamily?: string, fontSizePt?: number): void => {
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
};

const applyParagraphFormatting = (
  paragraphNode: XmlNode,
  options: {
    fontFamily?: string;
    fontSizePt?: number;
    lineHeight?: { mode: 'multiple' | 'points'; value: number };
    spacing?: { before?: number; after?: number };
    firstLineChars?: number;
    alignment?: 'left' | 'center' | 'right';
  }
): void => {
  const runs = getOrCreateDirectRuns(paragraphNode);
  for (const run of runs) {
    applyRunFont(run, options.fontFamily, options.fontSizePt);
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
  alignment: 'left' | 'center' | 'right'
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
  alignment?: 'left' | 'center' | 'right';
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
): { font?: string; fontSizePt?: number; alignment?: 'left' | 'center' | 'right' } => {
  const segments = parseConfiguredTokens(ruleConfig.abstractFormat);
  const titleSegment = segments.find((segment) => segment.includes('标题')) ?? segments[0] ?? ruleConfig.abstractFormat;
  return {
    font: ['宋体', '黑体', '楷体', '仿宋', 'Times New Roman']
      .find((alias) => titleSegment.toLowerCase().includes(alias.toLowerCase())),
    fontSizePt: parseFontSizePt(titleSegment),
    alignment: parseAlignment(titleSegment),
  };
};

const getCaptionRule = (value: string | undefined, prefix: '图' | '表'): ParagraphStyleRule & { position?: 'above' | 'below' } => {
  const resolved = value ?? '';
  return {
    ...parseParagraphStyleRule(resolved, [`${prefix}题注`, '题注']),
    position: resolved.includes('上方') ? 'above' : resolved.includes('下方') ? 'below' : undefined,
  };
};

const getTocRule = (value: string | undefined): { title: ParagraphStyleRule; body: ParagraphStyleRule } => {
  const resolved = value ?? '';
  return {
    title: parseParagraphStyleRule(resolved, ['目录标题', '标题']),
    body: parseParagraphStyleRule(resolved, ['目录正文', '正文']),
  };
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

const addMissingCoverFields = (paragraphNodes: XmlNode[], ruleConfig: PaperRuleConfig): XmlNode[] => {
  const missingNodes = parseConfiguredTokens(ruleConfig.coverItems)
    .filter((token) => !paragraphNodes.some((paragraphNode) => matchesToken(getParagraphText(paragraphNode), token)))
    .map((token) => createParagraphNode(token === '完成时间'
      ? `完成时间：待补充（示例：${formatChineseYearMonth(new Date())}）`
      : `${token}：待补充`, { fontFamily: '宋体', fontSizePt: 12 }));

  return missingNodes.length > 0 ? [...missingNodes, ...paragraphNodes] : paragraphNodes;
};

const ensureSection = (paragraphNodes: XmlNode[], title: string, bodyLines: string[]): XmlNode[] => {
  if (paragraphNodes.some((paragraphNode) => normalizeText(getParagraphText(paragraphNode)) === normalizeText(title))) {
    return paragraphNodes;
  }

  return [
    ...paragraphNodes,
    createParagraphNode(title, { fontFamily: '黑体', fontSizePt: 18, styleId: 'Heading1', alignment: 'center' }),
    ...bodyLines.map((line) => createParagraphNode(line, { fontFamily: '宋体', fontSizePt: 12 })),
  ];
};

const toChineseDigit = (digit: string): string => ({
  '0': '〇',
  '1': '一',
  '2': '二',
  '3': '三',
  '4': '四',
  '5': '五',
  '6': '六',
  '7': '七',
  '8': '八',
  '9': '九',
}[digit] ?? digit);

const formatChineseMonth = (month: number): string => {
  if (month <= 10) {
    return month === 10 ? '十' : toChineseDigit(String(month));
  }

  if (month < 20) {
    return `十${toChineseDigit(String(month % 10))}`;
  }

  return `${toChineseDigit(String(Math.floor(month / 10)))}十${month % 10 === 0 ? '' : toChineseDigit(String(month % 10))}`;
};

const formatChineseYearMonth = (date: Date): string => {
  const year = String(date.getFullYear()).split('').map((digit) => toChineseDigit(digit)).join('');
  const month = formatChineseMonth(date.getMonth() + 1);
  return `${year}年${month}月`;
};

const sectionPlaceholderBodies: Record<string, string[]> = {
  毕业论文原创性声明: [
    '本人郑重声明：本论文为本人在指导教师指导下独立完成。',
    '作者手写电子签名：待补充    日期：待补充',
  ],
  致谢: [
    '请在此补充致谢内容。',
  ],
  参考文献: [
    '[1] 待补充参考文献',
  ],
  图清单: [
    '图1.1 待补充图题注........................1',
  ],
  表清单: [
    '表1.1 待补充表题注........................1',
  ],
  指导教师指导意见表: [
    '指导教师指导意见：待补充',
    '指导教师签名：待补充    日期：待补充',
  ],
  评阅教师评阅意见表: [
    '评阅教师评阅意见：待补充',
    '评阅教师签名：待补充    日期：待补充',
  ],
};

const ensureConfiguredSections = (paragraphNodes: XmlNode[], ruleConfig: PaperRuleConfig): XmlNode[] => {
  let nextParagraphNodes = paragraphNodes;

  for (const token of parseConfiguredTokens(ruleConfig.requiredSections)) {
    const bodyLines = sectionPlaceholderBodies[token] ?? [`请在此补充${token}内容。`];
    nextParagraphNodes = ensureSection(nextParagraphNodes, token, bodyLines);
  }

  return nextParagraphNodes;
};

const normalizeKeywordsLine = (text: string): string => {
  const content = text.replace(/^(关键词|keywords?)[:：]?\s*/i, '').trim();
  const tokens = content
    .split(/[;；,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const normalizedTokens = tokens.length > 0 ? [...tokens] : ['待补充关键词1', '待补充关键词2', '待补充关键词3'];
  while (normalizedTokens.length < 3) {
    normalizedTokens.push(`待补充关键词${normalizedTokens.length + 1}`);
  }
  return `关键词：${normalizedTokens.join('；')}`;
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

const buildPlaceholderAbstractBody = (): string => {
  const base = '本摘要为系统自动补齐的占位内容，请根据论文研究目的、方法、结果与结论进一步完善。';
  let text = base;
  while (text.replace(/\s+/g, '').length < 320) {
    text += base;
  }

  return text;
};

const ensureAbstractAndKeywords = (paragraphNodes: XmlNode[], parsedDocument: ParsedDocxModel, ruleConfig: PaperRuleConfig): XmlNode[] => {
  const nextParagraphs = [...paragraphNodes];
  const abstractIndex = parsedDocument.paragraphs.findIndex((paragraph) => matchesToken(paragraph.text, '摘要') || matchesToken(paragraph.text, 'abstract'));
  const keywordIndex = parsedDocument.paragraphs.findIndex((paragraph) => /(关\s*键\s*词|keywords?)/i.test(paragraph.text));
  const bodyFont = hasNoRequirement(ruleConfig.bodyFont) ? undefined : ruleConfig.bodyFont;
  const bodyFontSize = parseFontSizePt(ruleConfig.bodyFontSize);
  const bodyLineHeight = parseLineHeightRule(ruleConfig.lineHeight);
  const bodySpacing = parseSpacingRule(ruleConfig.paragraphSpacing);
  const abstractTitleRule = getAbstractTitleRule(ruleConfig);

  if (abstractIndex < 0) {
    nextParagraphs.push(createParagraphNode('摘要', {
      fontFamily: abstractTitleRule.font ?? '黑体',
      fontSizePt: abstractTitleRule.fontSizePt ?? 18,
      styleId: 'Heading1',
      alignment: abstractTitleRule.alignment ?? 'center',
    }));
    nextParagraphs.push(createParagraphNode(buildPlaceholderAbstractBody(), {
      fontFamily: bodyFont,
      fontSizePt: bodyFontSize,
      lineHeight: bodyLineHeight,
      spacing: bodySpacing,
    }));
    nextParagraphs.push(createParagraphNode('关键词：待补充关键词1；待补充关键词2；待补充关键词3', {
      fontFamily: bodyFont,
      fontSizePt: bodyFontSize,
      lineHeight: bodyLineHeight,
      spacing: bodySpacing,
    }));
    return nextParagraphs;
  }

  const abstractBodyStart = abstractIndex + 1;
  const abstractBodyEnd = keywordIndex > abstractIndex ? keywordIndex : parsedDocument.paragraphs.length;
  const abstractBodyIndexes = Array.from({ length: Math.max(abstractBodyEnd - abstractBodyStart, 0) }, (_, offset) => abstractBodyStart + offset);
  const currentLength = abstractBodyIndexes
    .map((index) => getParagraphText(nextParagraphs[index] ?? {}))
    .join('')
    .replace(/\s+/g, '')
    .length;

  if (abstractBodyIndexes.length > 0 && currentLength < 300) {
    replaceParagraphText(nextParagraphs[abstractBodyIndexes[0]], buildPlaceholderAbstractBody(), {
      fontFamily: bodyFont,
      fontSizePt: bodyFontSize,
      lineHeight: bodyLineHeight,
      spacing: bodySpacing,
    });
  } else if (abstractBodyIndexes.length === 0) {
    nextParagraphs.splice(abstractIndex + 1, 0, createParagraphNode(buildPlaceholderAbstractBody(), {
      fontFamily: bodyFont,
      fontSizePt: bodyFontSize,
      lineHeight: bodyLineHeight,
      spacing: bodySpacing,
    }));
  }

  const resolvedKeywordIndex = keywordIndex >= 0 ? keywordIndex : abstractIndex + 2;
  if (keywordIndex >= 0 && nextParagraphs[keywordIndex]) {
    replaceParagraphText(nextParagraphs[keywordIndex], normalizeKeywordsLine(getParagraphText(nextParagraphs[keywordIndex])), {
      fontFamily: bodyFont,
      fontSizePt: bodyFontSize,
      lineHeight: bodyLineHeight,
      spacing: bodySpacing,
    });
  } else {
    nextParagraphs.splice(Math.min(resolvedKeywordIndex, nextParagraphs.length), 0, createParagraphNode('关键词：待补充关键词1；待补充关键词2；待补充关键词3', {
      fontFamily: bodyFont,
      fontSizePt: bodyFontSize,
      lineHeight: bodyLineHeight,
      spacing: bodySpacing,
    }));
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
    const node = createParagraphNode(text, {
      fontFamily: tocRule.body.font ?? '宋体',
      fontSizePt: tocRule.body.fontSizePt ?? 12,
      alignment: tocRule.body.alignment,
    });
    applyParagraphStyleRule(node, tocRule.body);
    return node;
  };

  const fallbackEntries = [
    '1 摘要........................1',
    '2 参考文献........................2',
  ];

  if (titleIndex < 0) {
    return [
      ...nextParagraphs,
      buildTitleNode(),
      ...fallbackEntries.map((text) => buildEntryNode(text)),
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
    nextParagraphs.splice(titleIndex + 1, 0, ...fallbackEntries.map((text) => buildEntryNode(text)));
    return nextParagraphs;
  }

  existingEntries.forEach((paragraphNode) => applyParagraphStyleRule(paragraphNode, tocRule.body));
  return nextParagraphs;
};

const collectReferencedTokens = (paragraphs: ParsedParagraph[], prefix: '图' | '表'): Array<{ token: string; index: number }> => {
  const pattern = new RegExp(`${prefix}\\s*\\d+(?:\\.\\d+)*`, 'g');
  const results: Array<{ token: string; index: number }> = [];

  for (const paragraph of paragraphs) {
    const matches = paragraph.text.match(pattern);
    if (!matches) {
      continue;
    }

    for (const match of matches) {
      results.push({
        token: match.replace(/\s+/g, ''),
        index: paragraph.index,
      });
    }
  }

  return results;
};

const extractCaptionToken = (text: string, prefix: '图' | '表'): string | undefined => {
  const match = text.trim().match(new RegExp(`^${prefix}\\s*(\\d+(?:\\.\\d+)*)`));
  return match ? `${prefix}${match[1]}` : undefined;
};

const isValidCaption = (text: string, prefix: '图' | '表'): boolean =>
  new RegExp(`^${prefix}\\s*\\d+(?:\\.\\d+)*\\s+\\S+`).test(text.trim());

const repairCaptions = (paragraphNodes: XmlNode[], parsedDocument: ParsedDocxModel, ruleConfig: PaperRuleConfig): XmlNode[] => {
  const nextParagraphs = [...paragraphNodes];

  for (const prefix of ['图', '表'] as const) {
    const captionRule = getCaptionRule(prefix === '图' ? ruleConfig.figureCaptionRule : ruleConfig.tableCaptionRule, prefix);
    const existingCaptionTokens = new Set<string>();

    nextParagraphs.forEach((paragraphNode) => {
      const text = getParagraphText(paragraphNode);
      const token = extractCaptionToken(text, prefix);
      if (!token) {
        return;
      }

      existingCaptionTokens.add(token);
      if (!isValidCaption(text, prefix)) {
        replaceParagraphText(paragraphNode, `${token} 待补充题注`, {
          fontFamily: captionRule.font ?? '宋体',
          fontSizePt: captionRule.fontSizePt ?? 10.5,
        });
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

    const referencedTokens = collectReferencedTokens(parsedDocument.paragraphs, prefix);
    for (const reference of referencedTokens) {
      if (existingCaptionTokens.has(reference.token)) {
        continue;
      }

      const insertIndex = Math.min(reference.index, nextParagraphs.length);
      const newCaption = createParagraphNode(`${reference.token} 待补充题注`, {
        fontFamily: captionRule.font ?? '宋体',
        fontSizePt: captionRule.fontSizePt ?? 10.5,
        alignment: captionRule.alignment ?? 'center',
      });
      applyParagraphFormatting(newCaption, {
        fontFamily: captionRule.font,
        fontSizePt: captionRule.fontSizePt,
        alignment: captionRule.alignment,
        lineHeight: captionRule.lineHeight,
        spacing: captionRule.spacing,
        firstLineChars: captionRule.firstLineIndent,
      });
      nextParagraphs.splice(insertIndex, 0, newCaption);
      existingCaptionTokens.add(reference.token);
    }
  }

  return nextParagraphs;
};

const applyParagraphLevelFixes = (paragraphNodes: XmlNode[], parsedDocument: ParsedDocxModel, ruleConfig: PaperRuleConfig): void => {
  const headingRuleMap = getHeadingRuleMap(ruleConfig);
  const bodyFont = hasNoRequirement(ruleConfig.bodyFont) ? undefined : ruleConfig.bodyFont;
  const bodyFontSize = parseFontSizePt(ruleConfig.bodyFontSize);
  const lineHeightRule = parseLineHeightRule(ruleConfig.lineHeight);
  const spacingRule = parseSpacingRule(ruleConfig.paragraphSpacing);
  const firstLineIndent = parseFirstLineIndentRule(ruleConfig.firstLineIndent);
  const abstractTitleRule = getAbstractTitleRule(ruleConfig);

  parsedDocument.paragraphs.forEach((parsedParagraph, index) => {
    const paragraphNode = paragraphNodes[index];
    if (!paragraphNode) {
      return;
    }

    const text = parsedParagraph.text;

    if (matchesToken(text, '摘要') || matchesToken(text, 'abstract')) {
      applyParagraphFormatting(paragraphNode, {
        fontFamily: abstractTitleRule.font,
        fontSizePt: abstractTitleRule.fontSizePt,
        alignment: abstractTitleRule.alignment,
      });
      return;
    }

    if (/(关\s*键\s*词|keywords?)/i.test(text)) {
      replaceParagraphText(paragraphNode, normalizeKeywordsLine(text), { fontFamily: bodyFont, fontSizePt: bodyFontSize });
      return;
    }

    if (parsedParagraph.headingLevel) {
      const rule = headingRuleMap.get(parsedParagraph.headingLevel);
      applyParagraphFormatting(paragraphNode, {
        fontFamily: rule?.font,
        fontSizePt: rule?.fontSizePt,
        alignment: rule?.alignment,
        lineHeight: rule?.lineHeight,
        spacing: rule?.spacing,
        firstLineChars: rule?.firstLineIndent,
      });
      return;
    }

    if (!text) {
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
}): Promise<{ buffer: Buffer; filename: string }> => {
  const buffer = await readFile(input.filePath);
  const zip = await JSZip.loadAsync(buffer);

  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new Error('The uploaded .docx file does not contain word/document.xml.');
  }

  const documentRoot = xmlParser.parse(documentXml) as XmlNode;
  ensureDocumentNamespace(documentRoot);
  updateSectionPageLayout(documentRoot, input.ruleConfig);
  await ensureHeaderAndFooter(zip, documentRoot, input.ruleConfig);

  let paragraphNodes = getBodyParagraphNodes(documentRoot);
  applyParagraphLevelFixes(paragraphNodes, input.parsedDocument, input.ruleConfig);
  paragraphNodes = ensureAbstractAndKeywords(paragraphNodes, input.parsedDocument, input.ruleConfig);
  paragraphNodes = ensureTableOfContents(paragraphNodes, input.ruleConfig);
  paragraphNodes = repairCaptions(paragraphNodes, input.parsedDocument, input.ruleConfig);
  paragraphNodes = addMissingCoverFields(paragraphNodes, input.ruleConfig);
  paragraphNodes = ensureConfiguredSections(paragraphNodes, input.ruleConfig);
  paragraphNodes = ensureSection(paragraphNodes, '参考文献', sectionPlaceholderBodies.参考文献);
  setBodyParagraphNodes(documentRoot, paragraphNodes);

  zip.file('word/document.xml', buildXml(documentRoot));

  const repairedBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const ext = path.extname(input.originalFilename) || '.docx';
  const basename = path.basename(input.originalFilename, ext);

  return {
    buffer: repairedBuffer,
    filename: `${basename}_fixed${ext}`,
  };
};
