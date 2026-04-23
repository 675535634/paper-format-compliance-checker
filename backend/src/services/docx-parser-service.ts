import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import type { ParsedDocxModel, ParsedParagraph } from '../types/index.js';

type XmlNode = Record<string, unknown>;
type OrderedXmlNode = Record<string, unknown>;

interface StyleDefinition {
  id: string;
  name?: string;
  basedOn?: string;
  paragraphProperties?: XmlNode;
  runProperties?: XmlNode;
}

interface NumberingDefinition {
  abstractNumId?: string;
  levels: Map<number, { format?: string; levelText?: string }>;
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
const orderedXmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  suppressEmptyNode: true,
  preserveOrder: true,
});

const getZipEntryText = async (zip: JSZip, targetPath: string): Promise<string | undefined> => {
  const normalizedTarget = targetPath.replace(/\\/g, '/');
  const entryName = Object.keys(zip.files).find((name) => name.replace(/\\/g, '/') === normalizedTarget);
  return entryName ? zip.file(entryName)?.async('string') : undefined;
};

const parseLevelNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const toXmlObject = (value: unknown): XmlNode | undefined =>
  value && typeof value === 'object' ? value as XmlNode : undefined;

const toOrderedXmlNodes = (value: unknown): OrderedXmlNode[] =>
  Array.isArray(value)
    ? value
      .map((item) => toXmlObject(item))
      .filter(Boolean) as OrderedXmlNode[]
    : [];

const getWordAttr = (node: XmlNode | undefined, name: string): string | undefined => {
  if (!node) {
    return undefined;
  }

  const direct = node[`w:${name}`];
  return typeof direct === 'string' ? direct : undefined;
};

const getTextValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => getTextValue(item)).join('');
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (typeof objectValue['#text'] === 'string') {
      return objectValue['#text'];
    }
  }

  return '';
};

const getParagraphAlignment = (paragraphNode: XmlNode | undefined): string | undefined =>
  getWordAttr(toXmlObject(toXmlObject(paragraphNode)?.['w:pPr'])?.['w:jc'] as XmlNode | undefined, 'val');

const twipsToCm = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric / 567 : undefined;
};

const twipsToPt = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric / 20 : undefined;
};

const sizeHalfPointsToPt = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric / 2 : undefined;
};

const normalizePageLabel = (widthCm?: number, heightCm?: number): string => {
  if (!widthCm || !heightCm) {
    return 'Unknown';
  }

  const closeTo = (left: number, right: number) => Math.abs(left - right) <= 0.4;

  if (closeTo(widthCm, 21) && closeTo(heightCm, 29.7)) {
    return 'A4';
  }

  if (closeTo(widthCm, 17.6) && closeTo(heightCm, 25)) {
    return 'B5';
  }

  if (closeTo(widthCm, 29.7) && closeTo(heightCm, 42)) {
    return 'A3';
  }

  return `${widthCm.toFixed(1)}cm x ${heightCm.toFixed(1)}cm`;
};

const mergeProperties = (base?: XmlNode, override?: XmlNode): XmlNode | undefined => {
  if (!base && !override) {
    return undefined;
  }

  return {
    ...(base ?? {}),
    ...(override ?? {}),
  };
};

const buildStyleMap = (stylesDocument: XmlNode | undefined): Map<string, StyleDefinition> => {
  const map = new Map<string, StyleDefinition>();
  const stylesRoot = toXmlObject(stylesDocument?.['w:styles']);

  for (const styleNode of asArray(toXmlObject(stylesRoot)?.['w:style'])) {
    const style = toXmlObject(styleNode);
    if (!style) {
      continue;
    }

    const id = getWordAttr(style, 'styleId');
    if (!id) {
      continue;
    }

    const nameNode = toXmlObject(style['w:name']);
    const basedOnNode = toXmlObject(style['w:basedOn']);

    map.set(id, {
      id,
      name: getWordAttr(nameNode, 'val'),
      basedOn: getWordAttr(basedOnNode, 'val'),
      paragraphProperties: toXmlObject(style['w:pPr']),
      runProperties: toXmlObject(style['w:rPr']),
    });
  }

  return map;
};

const buildNumberingMap = (numberingDocument: XmlNode | undefined): Map<string, NumberingDefinition> => {
  const map = new Map<string, NumberingDefinition>();
  const numberingRoot = toXmlObject(numberingDocument?.['w:numbering']);
  if (!numberingRoot) {
    return map;
  }

  const abstractDefinitions = new Map<string, NumberingDefinition>();
  for (const abstractNode of asArray(toXmlObject(numberingRoot)?.['w:abstractNum'])) {
    const abstractDefinition = toXmlObject(abstractNode);
    const abstractNumId = getWordAttr(abstractDefinition, 'abstractNumId');
    if (!abstractNumId) {
      continue;
    }

    const levels = new Map<number, { format?: string; levelText?: string }>();
    for (const levelNode of asArray(toXmlObject(abstractDefinition)?.['w:lvl'])) {
      const levelDefinition = toXmlObject(levelNode);
      const level = parseLevelNumber(getWordAttr(levelDefinition, 'ilvl'));
      if (level === undefined) {
        continue;
      }

      levels.set(level, {
        format: getWordAttr(toXmlObject(levelDefinition?.['w:numFmt']), 'val'),
        levelText: getWordAttr(toXmlObject(levelDefinition?.['w:lvlText']), 'val'),
      });
    }

    abstractDefinitions.set(abstractNumId, { abstractNumId, levels });
  }

  for (const numberingNode of asArray(toXmlObject(numberingRoot)?.['w:num'])) {
    const numberingDefinition = toXmlObject(numberingNode);
    const numId = getWordAttr(numberingDefinition, 'numId');
    const abstractNumId = getWordAttr(toXmlObject(numberingDefinition?.['w:abstractNumId']), 'val');
    if (!numId) {
      continue;
    }

    const abstractDefinition = abstractNumId ? abstractDefinitions.get(abstractNumId) : undefined;
    map.set(numId, {
      abstractNumId,
      levels: abstractDefinition?.levels ?? new Map(),
    });
  }

  return map;
};

const resolveStyle = (
  styleId: string | undefined,
  styleMap: Map<string, StyleDefinition>,
  visited = new Set<string>()
): StyleDefinition | undefined => {
  if (!styleId || visited.has(styleId)) {
    return undefined;
  }

  const style = styleMap.get(styleId);
  if (!style) {
    return undefined;
  }

  visited.add(styleId);
  const parent = resolveStyle(style.basedOn, styleMap, visited);
  if (!parent) {
    return style;
  }

  return {
    ...parent,
    ...style,
    paragraphProperties: mergeProperties(parent.paragraphProperties, style.paragraphProperties),
    runProperties: mergeProperties(parent.runProperties, style.runProperties),
  };
};

const getDocumentDefaults = (stylesDocument: XmlNode | undefined): {
  fontFamily?: string;
  fontSizePt?: number;
} => {
  const stylesRoot = toXmlObject(stylesDocument?.['w:styles']);
  const docDefaults = toXmlObject(stylesRoot?.['w:docDefaults']);
  const runProperties = toXmlObject(toXmlObject(docDefaults?.['w:rPrDefault'])?.['w:rPr']);

  const fonts = toXmlObject(runProperties?.['w:rFonts']);
  const fontFamily = getWordAttr(fonts, 'eastAsia') ?? getWordAttr(fonts, 'ascii') ?? getWordAttr(fonts, 'hAnsi');
  const fontSizePt = sizeHalfPointsToPt(getWordAttr(toXmlObject(runProperties?.['w:sz']), 'val'));

  return { fontFamily, fontSizePt };
};

const collectRunNodes = (paragraphNode: XmlNode): XmlNode[] => {
  const directRuns = asArray(toXmlObject(paragraphNode)?.['w:r']).map((item) => toXmlObject(item)).filter(Boolean) as XmlNode[];
  const hyperlinkRuns = asArray(toXmlObject(paragraphNode)?.['w:hyperlink'])
    .flatMap((hyperlink) => asArray(toXmlObject(hyperlink)?.['w:r']).map((item) => toXmlObject(item)).filter(Boolean) as XmlNode[]);

  return [...directRuns, ...hyperlinkRuns];
};

const extractParagraphText = (paragraphNode: XmlNode): string =>
  collectRunNodes(paragraphNode)
    .map((runNode) => getTextValue(runNode['w:t']))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

const getOrderedRootChildren = (
  xml: string,
  rootKey: 'w:document' | 'w:hdr' | 'w:ftr',
  nestedKey?: 'w:body'
): OrderedXmlNode[] => {
  const parsed = orderedXmlParser.parse(xml) as OrderedXmlNode[];
  const rootEntry = parsed.find((node) => Object.prototype.hasOwnProperty.call(node, rootKey));
  if (!rootEntry) {
    return [];
  }

  const rootChildren = toOrderedXmlNodes(rootEntry[rootKey]);
  if (!nestedKey) {
    return rootChildren;
  }

  const nestedEntry = rootChildren.find((node) => Object.prototype.hasOwnProperty.call(node, nestedKey));
  return nestedEntry ? toOrderedXmlNodes(nestedEntry[nestedKey]) : [];
};

const collectOrderedParagraphEntries = (nodes: OrderedXmlNode[]): OrderedXmlNode[] => {
  const paragraphs: OrderedXmlNode[] = [];

  for (const node of nodes) {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'w:p') {
        paragraphs.push({ [key]: toOrderedXmlNodes(value) });
        continue;
      }

      paragraphs.push(...collectOrderedParagraphEntries(toOrderedXmlNodes(value)));
    }
  }

  return paragraphs;
};

const extractOrderedParagraphNodes = (
  xml: string,
  rootKey: 'w:document' | 'w:hdr' | 'w:ftr',
  nestedKey?: 'w:body'
): XmlNode[] =>
  collectOrderedParagraphEntries(getOrderedRootChildren(xml, rootKey, nestedKey))
    .map((entry) => {
      const paragraphXml = orderedXmlBuilder.build([entry]);
      const parsed = xmlParser.parse(paragraphXml) as XmlNode;
      return toXmlObject(parsed['w:p']);
    })
    .filter(Boolean) as XmlNode[];

const extractDocumentParagraphTexts = (xml: string, rootKey: 'w:hdr' | 'w:ftr'): string[] => {
  return extractOrderedParagraphNodes(xml, rootKey)
    .map((paragraphNode) => extractParagraphText(paragraphNode))
    .filter(Boolean);
};

const extractExternalParagraphs = (
  xml: string,
  rootKey: 'w:hdr' | 'w:ftr',
  styleMap: Map<string, StyleDefinition>,
  numberingMap: Map<string, NumberingDefinition>,
  defaults: { fontFamily?: string; fontSizePt?: number }
): ParsedParagraph[] => {
  return extractOrderedParagraphNodes(xml, rootKey).map((paragraphNode, index) => ({
    index: index + 1,
    text: extractParagraphText(paragraphNode),
    ...resolveParagraphMetrics(paragraphNode, styleMap, numberingMap, defaults),
  }));
};

const parseHeadingLevel = (styleId: string | undefined, styleName: string | undefined, paragraphProperties?: XmlNode): number | undefined => {
  const outlineLevel = getWordAttr(toXmlObject(paragraphProperties?.['w:outlineLvl']), 'val');
  if (outlineLevel) {
    const numeric = Number.parseInt(outlineLevel, 10);
    if (Number.isFinite(numeric)) {
      return numeric + 1;
    }
  }

  const source = `${styleId ?? ''} ${styleName ?? ''}`.toLowerCase();
  const headingMatch = source.match(/heading\s*([1-9])/i) ?? source.match(/标题\s*([1-9])/i);
  if (headingMatch) {
    return Number.parseInt(headingMatch[1], 10);
  }

  return undefined;
};

const resolveParagraphMetrics = (
  paragraphNode: XmlNode,
  styleMap: Map<string, StyleDefinition>,
  numberingMap: Map<string, NumberingDefinition>,
  defaults: { fontFamily?: string; fontSizePt?: number }
): Omit<ParsedParagraph, 'index' | 'text'> => {
  const paragraphProperties = toXmlObject(paragraphNode['w:pPr']);
  const styleId = getWordAttr(toXmlObject(paragraphProperties?.['w:pStyle']), 'val');
  const resolvedStyle = resolveStyle(styleId, styleMap);
  const mergedParagraphProperties = mergeProperties(resolvedStyle?.paragraphProperties, paragraphProperties);

  const runNodes = collectRunNodes(paragraphNode);
  const firstRunProperties = mergeProperties(
    resolvedStyle?.runProperties,
    toXmlObject(runNodes[0]?.['w:rPr'])
  );

  const fonts = toXmlObject(firstRunProperties?.['w:rFonts']);
  const fontFamily = getWordAttr(fonts, 'eastAsia')
    ?? getWordAttr(fonts, 'ascii')
    ?? getWordAttr(fonts, 'hAnsi')
    ?? defaults.fontFamily;

  const fontSizePt = sizeHalfPointsToPt(getWordAttr(toXmlObject(firstRunProperties?.['w:sz']), 'val')) ?? defaults.fontSizePt;

  const spacing = toXmlObject(mergedParagraphProperties?.['w:spacing']);
  const lineRaw = getWordAttr(spacing, 'line');
  const lineRule = getWordAttr(spacing, 'lineRule');
  const lineRawValue = Number.parseFloat(lineRaw ?? '');
  const hasLineValue = Number.isFinite(lineRawValue);
  const lineHeightMode = hasLineValue
    ? (lineRule === 'exact' || lineRule === 'atLeast' ? 'points' : 'multiple')
    : undefined;
  const lineHeight = hasLineValue
    ? (lineHeightMode === 'points' ? lineRawValue / 20 : lineRawValue / 240)
    : undefined;

  const indentation = toXmlObject(mergedParagraphProperties?.['w:ind']);
  const firstLineChars = Number.parseFloat(getWordAttr(indentation, 'firstLineChars') ?? '');
  const firstLineCharsValue = Number.isFinite(firstLineChars) ? firstLineChars / 100 : undefined;
  const numberingProperties = toXmlObject(mergedParagraphProperties?.['w:numPr']);
  const numId = getWordAttr(toXmlObject(numberingProperties?.['w:numId']), 'val');
  const level = parseLevelNumber(getWordAttr(toXmlObject(numberingProperties?.['w:ilvl']), 'val'));
  const numberingDefinition = numId ? numberingMap.get(numId) : undefined;
  const levelDefinition = level !== undefined ? numberingDefinition?.levels.get(level) : undefined;
  const numberingFormat = levelDefinition?.format;

  return {
    styleId,
    styleName: resolvedStyle?.name,
    headingLevel: parseHeadingLevel(styleId, resolvedStyle?.name, mergedParagraphProperties),
    alignment: getParagraphAlignment({ 'w:pPr': mergedParagraphProperties } as XmlNode) as 'left' | 'center' | 'right' | undefined,
    fontFamily,
    fontSizePt,
    lineHeight,
    lineHeightMode,
    spacingBeforePt: twipsToPt(getWordAttr(spacing, 'before')),
    spacingAfterPt: twipsToPt(getWordAttr(spacing, 'after')),
    firstLineChars: firstLineCharsValue,
    numbering: numId ? {
      numId,
      level,
      format: numberingFormat,
      levelText: levelDefinition?.levelText,
      isOrdered: Boolean(numberingFormat && numberingFormat !== 'bullet' && numberingFormat !== 'none'),
    } : undefined,
  };
};

const getSectionProperties = (documentRoot: XmlNode | undefined): XmlNode | undefined => {
  const body = toXmlObject(toXmlObject(documentRoot?.['w:document'])?.['w:body']);
  if (!body) {
    return undefined;
  }

  const paragraphs = asArray(toXmlObject(body)?.['w:p']);
  for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
    const paragraphProperties = toXmlObject(toXmlObject(paragraphs[index])?.['w:pPr']);
    const sectionProperties = toXmlObject(paragraphProperties?.['w:sectPr']);
    if (sectionProperties) {
      return sectionProperties;
    }
  }

  return toXmlObject(body['w:sectPr']);
};

export const parseDocxFile = async (filePath: string): Promise<ParsedDocxModel> => {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);

  const documentXml = await getZipEntryText(zip, 'word/document.xml');
  if (!documentXml) {
    throw new Error('The uploaded .docx file does not contain word/document.xml.');
  }

  const stylesXml = await getZipEntryText(zip, 'word/styles.xml');
  const numberingXml = await getZipEntryText(zip, 'word/numbering.xml');
  const documentRoot = xmlParser.parse(documentXml) as XmlNode;
  const stylesRoot = stylesXml ? xmlParser.parse(stylesXml) as XmlNode : undefined;
  const numberingRoot = numberingXml ? xmlParser.parse(numberingXml) as XmlNode : undefined;
  const styleMap = buildStyleMap(stylesRoot);
  const numberingMap = buildNumberingMap(numberingRoot);
  const defaults = getDocumentDefaults(stylesRoot);

  const body = toXmlObject(toXmlObject(documentRoot['w:document'])?.['w:body']);
  const paragraphNodes = extractOrderedParagraphNodes(documentXml, 'w:document', 'w:body');
  const paragraphs: ParsedParagraph[] = paragraphNodes.map((paragraphNode, index) => ({
    index: index + 1,
    text: extractParagraphText(paragraphNode),
    ...resolveParagraphMetrics(paragraphNode, styleMap, numberingMap, defaults),
  }));

  const sectionProperties = getSectionProperties(documentRoot);
  const pageSize = toXmlObject(sectionProperties?.['w:pgSz']);
  const margins = toXmlObject(sectionProperties?.['w:pgMar']);
  const widthCm = twipsToCm(getWordAttr(pageSize, 'w'));
  const heightCm = twipsToCm(getWordAttr(pageSize, 'h'));

  const footerContents = await Promise.all(
    Object.keys(zip.files)
      .filter((name) => name.replace(/\\/g, '/').startsWith('word/footer'))
      .map(async (name) => zip.file(name)?.async('string'))
  );
  const headerContents = await Promise.all(
    Object.keys(zip.files)
      .filter((name) => name.replace(/\\/g, '/').startsWith('word/header'))
      .map(async (name) => zip.file(name)?.async('string'))
  );

  const hasPageNumberField = footerContents.some((footer) =>
    typeof footer === 'string' && (footer.includes('PAGE') || footer.includes('NUMPAGES'))
  );
  const pageNumberFooter = footerContents.find((footer) =>
    typeof footer === 'string' && (footer.includes('PAGE') || footer.includes('NUMPAGES'))
  );
  const pageNumberAlignment = pageNumberFooter
    ? getParagraphAlignment(
        asArray(toXmlObject((xmlParser.parse(pageNumberFooter) as XmlNode)?.['w:ftr'])?.['w:p'])
          .map((item) => toXmlObject(item))
          .find(Boolean) as XmlNode | undefined
      )
    : undefined;

  return {
    paragraphCount: paragraphs.length,
    paragraphs,
    headerTexts: headerContents
      .flatMap((header) => typeof header === 'string' ? extractDocumentParagraphTexts(header, 'w:hdr') : [])
      .filter(Boolean),
    headerParagraphs: headerContents
      .flatMap((header) => typeof header === 'string'
        ? extractExternalParagraphs(header, 'w:hdr', styleMap, numberingMap, defaults)
        : []),
    footerTexts: footerContents
      .flatMap((footer) => typeof footer === 'string' ? extractDocumentParagraphTexts(footer, 'w:ftr') : [])
      .filter(Boolean),
    footerParagraphs: footerContents
      .flatMap((footer) => typeof footer === 'string'
        ? extractExternalParagraphs(footer, 'w:ftr', styleMap, numberingMap, defaults)
        : []),
    pageSize: widthCm && heightCm ? {
      widthCm,
      heightCm,
      label: normalizePageLabel(widthCm, heightCm),
    } : undefined,
    marginsCm: {
      top: twipsToCm(getWordAttr(margins, 'top')) ?? 0,
      bottom: twipsToCm(getWordAttr(margins, 'bottom')) ?? 0,
      left: twipsToCm(getWordAttr(margins, 'left')) ?? 0,
      right: twipsToCm(getWordAttr(margins, 'right')) ?? 0,
    },
    defaultFontFamily: defaults.fontFamily,
    defaultFontSizePt: defaults.fontSizePt,
    hasPageNumberField: Boolean(hasPageNumberField),
    pageNumberAlignment,
  };
};
