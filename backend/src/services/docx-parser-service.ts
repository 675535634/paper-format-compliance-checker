import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type { ParsedDocxModel, ParsedParagraph } from '../types/index.js';

type XmlNode = Record<string, unknown>;

interface StyleDefinition {
  id: string;
  name?: string;
  basedOn?: string;
  paragraphProperties?: XmlNode;
  runProperties?: XmlNode;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: false,
  processEntities: false,
});

const getZipEntryText = async (zip: JSZip, targetPath: string): Promise<string | undefined> => {
  const normalizedTarget = targetPath.replace(/\\/g, '/');
  const entryName = Object.keys(zip.files).find((name) => name.replace(/\\/g, '/') === normalizedTarget);
  return entryName ? zip.file(entryName)?.async('string') : undefined;
};

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const toXmlObject = (value: unknown): XmlNode | undefined =>
  value && typeof value === 'object' ? value as XmlNode : undefined;

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
  defaults: { fontFamily?: string; fontSizePt?: number; }
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

  return {
    styleId,
    styleName: resolvedStyle?.name,
    headingLevel: parseHeadingLevel(styleId, resolvedStyle?.name, mergedParagraphProperties),
    fontFamily,
    fontSizePt,
    lineHeight,
    lineHeightMode,
    spacingBeforePt: twipsToPt(getWordAttr(spacing, 'before')),
    spacingAfterPt: twipsToPt(getWordAttr(spacing, 'after')),
    firstLineChars: firstLineCharsValue,
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
  const documentRoot = xmlParser.parse(documentXml) as XmlNode;
  const stylesRoot = stylesXml ? xmlParser.parse(stylesXml) as XmlNode : undefined;
  const styleMap = buildStyleMap(stylesRoot);
  const defaults = getDocumentDefaults(stylesRoot);

  const body = toXmlObject(toXmlObject(documentRoot['w:document'])?.['w:body']);
  const paragraphNodes = asArray(toXmlObject(body)?.['w:p']).map((item) => toXmlObject(item)).filter(Boolean) as XmlNode[];
  const paragraphs: ParsedParagraph[] = paragraphNodes.map((paragraphNode, index) => {
    const runText = collectRunNodes(paragraphNode)
      .map((runNode) => getTextValue(runNode['w:t']))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      index: index + 1,
      text: runText,
      ...resolveParagraphMetrics(paragraphNode, styleMap, defaults),
    };
  });

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
  const hasPageNumberField = footerContents.some((footer) =>
    typeof footer === 'string' && (footer.includes('PAGE') || footer.includes('NUMPAGES'))
  );

  return {
    paragraphCount: paragraphs.length,
    paragraphs,
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
  };
};
