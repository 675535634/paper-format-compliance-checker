import type { CheckIssue, PaperRuleConfig, ParsedDocxModel, ParsedParagraph } from '../types/index.js';
import { createId } from './id-service.js';

const fontAliases: Record<string, string[]> = {
  simsun: ['宋体', 'simsun'],
  simhei: ['黑体', 'simhei'],
  kaiti: ['楷体', '楷体_gb2312', 'kaiti'],
  fangsong: ['仿宋', 'fangsong'],
  timesnewroman: ['times new roman', 'timesnewroman'],
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

const alignmentAliases: Record<string, string[]> = {
  left: ['left', '居左', '左对齐'],
  center: ['center', 'centre', '居中', '中间'],
  right: ['right', '居右', '右对齐'],
};

const sectionAliases: Record<string, string[]> = {
  摘要: ['摘要', 'abstract'],
  关键词: ['关键词', 'keywords'],
  参考文献: ['参考文献', 'references'],
  致谢: ['致谢', '谢辞', 'acknowledgements', 'acknowledgment'],
  毕业论文原创性声明: ['毕业论文原创性声明', '原创性声明'],
  目录: ['目录', 'contents'],
  附录: ['附录', 'appendix'],
};

const addIssue = (issues: CheckIssue[], issue: Omit<CheckIssue, 'id'>): void => {
  issues.push({
    id: createId('issue'),
    ...issue,
  });
};

const normalizeFontToken = (value: string): string => value.toLowerCase().replace(/\s+/g, '');
const noRequirementToken = '无要求';
const NO_REQUIREMENT = '无要求';
const hasNoRequirement = (value: string | undefined | null): boolean =>
  !value || value.trim() === '' || value.includes(noRequirementToken);

const normalizeText = (value: string): string =>
  value
    .replace(/\s+/g, '')
    .replace(/[：:;；,，。、“”"'`]/g, '')
    .trim()
    .toLowerCase();

const normalizeLabeledToken = (value: string): string => {
  const normalized = normalizeText(value);
  return normalized
    .replace(/^奇数页/, '')
    .replace(/^偶数页/, '')
    .replace(/^页眉/, '')
    .replace(/^默认页眉/, '')
    .trim();
};

const fontMatches = (expected: string, actual?: string): boolean => {
  if (!actual) {
    return false;
  }

  const normalizedExpected = normalizeFontToken(expected);
  const normalizedActual = normalizeFontToken(actual);

  if (normalizedActual.includes(normalizedExpected) || normalizedExpected.includes(normalizedActual)) {
    return true;
  }

  for (const aliasGroup of Object.values(fontAliases)) {
    const normalizedGroup = aliasGroup.map((item) => normalizeFontToken(item));
    if (normalizedGroup.includes(normalizedExpected) && normalizedGroup.includes(normalizedActual)) {
      return true;
    }
  }

  return false;
};

const parseNumericSpec = (value: string): number | undefined => {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return undefined;
  }

  const numeric = Number.parseFloat(match[1]);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const parseExpectedAlignment = (value: string): string | undefined => {
  if (hasNoRequirement(value)) {
    return undefined;
  }

  const normalized = value.toLowerCase();

  for (const [alignment, aliases] of Object.entries(alignmentAliases)) {
    if (aliases.some((alias) => normalized.includes(alias.toLowerCase()))) {
      return alignment;
    }
  }

  return undefined;
};

const parseFontSizePt = (value: string): number | undefined => {
  if (hasNoRequirement(value)) {
    return undefined;
  }

  if (fontSizeMap[value]) {
    return fontSizeMap[value];
  }

  const matchedToken = Object.keys(fontSizeMap).find((token) => value.includes(token));
  if (matchedToken) {
    return fontSizeMap[matchedToken];
  }

  if (value.toLowerCase().includes('pt')) {
    return parseNumericSpec(value);
  }

  return parseNumericSpec(value);
};

const parseExpectedFont = (value: string): string | undefined =>
  hasNoRequirement(value)
    ? undefined
    : Object.values(fontAliases)
      .flat()
      .find((alias) => value.toLowerCase().includes(alias.toLowerCase()));

const parsePageSizeLabel = (value: string): string => (hasNoRequirement(value) ? '' : value.trim().toUpperCase());

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
  if (hasNoRequirement(value)) {
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
  if (hasNoRequirement(value)) {
    return undefined;
  }

  const match = value.match(/(\d+(?:\.\d+)?)\s*(chars?|字符)/i);
  if (match) {
    return Number.parseFloat(match[1]);
  }

  return parseNumericSpec(value);
};

const parseHeadingRules = (
  value: string
): Array<{
  level: number;
  font?: string;
  fontSizePt?: number;
  alignment?: 'left' | 'center' | 'right';
  lineHeight?: { mode: 'multiple' | 'points'; value: number };
  spacing?: { before?: number; after?: number };
  firstLineIndent?: number;
}> =>
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

      const font = Object.values(fontAliases)
        .flat()
        .find((alias) => item.toLowerCase().includes(alias.toLowerCase()));

      const detailSegments = item.split('|').map((segment) => segment.trim());
      const alignmentSegment = detailSegments.find((segment) => /对齐|居中|居左|居右|left|center|right/i.test(segment)) ?? item;
      const lineHeightSegment = detailSegments.find((segment) => /行距|line/i.test(segment)) ?? item;
      const spacingSegment = detailSegments.find((segment) => /段前|段后|before|after/i.test(segment)) ?? item;
      const indentSegment = detailSegments.find((segment) => /首行缩进|字符|indent/i.test(segment)) ?? item;

      return {
        level,
        font,
        fontSizePt: parseFontSizePt(item),
        alignment: parseExpectedAlignment(alignmentSegment) as 'left' | 'center' | 'right' | undefined,
        lineHeight: parseLineHeightRule(lineHeightSegment),
        spacing: parseSpacingRule(spacingSegment),
        firstLineIndent: parseFirstLineIndentRule(indentSegment),
      };
    })
    .filter(Boolean) as Array<{
      level: number;
      font?: string;
      fontSizePt?: number;
      alignment?: 'left' | 'center' | 'right';
      lineHeight?: { mode: 'multiple' | 'points'; value: number };
      spacing?: { before?: number; after?: number };
      firstLineIndent?: number;
    }>;

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

const parseHeaderFragments = (value: string | undefined): string[] =>
  parseConfiguredTokens(value).map((item) => normalizeLabeledToken(item)).filter(Boolean);

const parseValueRange = (value: string): { min: number; max: number } | undefined => {
  const rangeMatch = value.match(/(\d+(?:\.\d+)?)\s*[-~～至]\s*(\d+(?:\.\d+)?)/);
  if (!rangeMatch) {
    return undefined;
  }

  const min = Number.parseFloat(rangeMatch[1]);
  const max = Number.parseFloat(rangeMatch[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined;
  }

  return { min, max };
};

const nearlyEqual = (left?: number, right?: number, tolerance = 0.5): boolean => {
  if (left === undefined || right === undefined) {
    return false;
  }

  return Math.abs(left - right) <= tolerance;
};

const humanParagraphLocation = (paragraph: ParsedParagraph): string => {
  if (paragraph.headingLevel) {
    return `Heading ${paragraph.headingLevel}: ${paragraph.text || `Paragraph ${paragraph.index}`}`;
  }

  return `Paragraph ${paragraph.index}`;
};

const matchesSectionLabel = (text: string, label: string): boolean => {
  const normalizedText = normalizeText(text);
  const aliases = sectionAliases[label] ?? [label];
  return aliases.some((alias) => normalizedText.includes(normalizeText(alias)));
};

const findSectionParagraph = (documentModel: ParsedDocxModel, label: string): ParsedParagraph | undefined =>
  documentModel.paragraphs.find((paragraph) => matchesSectionLabel(paragraph.text, label));

const selectBodyParagraphs = (documentModel: ParsedDocxModel): ParsedParagraph[] =>
  documentModel.paragraphs.filter((paragraph) => {
    if (!paragraph.text || paragraph.headingLevel) {
      return false;
    }

    const lower = paragraph.text.toLowerCase();
    return !lower.includes('abstract')
      && !lower.includes('keywords')
      && !lower.includes('references')
      && !lower.includes('摘要')
      && !lower.includes('关键词')
      && !lower.includes('参考文献')
      && !/^图\s*\d+(?:\.\d+)*/.test(paragraph.text.trim())
      && !/^表\s*\d+(?:\.\d+)*/.test(paragraph.text.trim());
  });

const findAbstractHeadingIndex = (documentModel: ParsedDocxModel): number =>
  documentModel.paragraphs.findIndex((paragraph) => /^(摘要|abstract)$/i.test(paragraph.text.trim()));

const findKeywordsParagraphIndex = (documentModel: ParsedDocxModel): number =>
  documentModel.paragraphs.findIndex((paragraph) => /(关键词|keywords?)/i.test(paragraph.text));

const getAbstractBodyText = (documentModel: ParsedDocxModel): string => {
  const abstractHeadingIndex = findAbstractHeadingIndex(documentModel);
  if (abstractHeadingIndex < 0) {
    return '';
  }

  const keywordsIndex = findKeywordsParagraphIndex(documentModel);
  const stopIndex = keywordsIndex > abstractHeadingIndex
    ? keywordsIndex
    : documentModel.paragraphs.findIndex((paragraph, index) => index > abstractHeadingIndex && Boolean(paragraph.headingLevel));

  const endIndex = stopIndex > abstractHeadingIndex ? stopIndex : documentModel.paragraphs.length;

  return documentModel.paragraphs
    .slice(abstractHeadingIndex + 1, endIndex)
    .map((paragraph) => paragraph.text.trim())
    .filter(Boolean)
    .join('');
};

const getKeywordItems = (text: string): string[] => {
  const keywordPart = text.replace(/^(关键词|keywords?)[:：]?\s*/i, '').trim();
  if (!keywordPart) {
    return [];
  }

  return keywordPart
    .split(/[;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const getCoverParagraphs = (documentModel: ParsedDocxModel): ParsedParagraph[] => {
  const boundaryIndex = documentModel.paragraphs.findIndex((paragraph) =>
    ['毕业论文原创性声明', '原创性声明', '摘要', 'abstract', '目录', 'contents'].some((token) =>
      matchesSectionLabel(paragraph.text, token)
    )
  );

  return documentModel.paragraphs.slice(0, boundaryIndex > 0 ? boundaryIndex : 20);
};

const findCoverField = (coverParagraphs: ParsedParagraph[], label: string): ParsedParagraph | undefined => {
  const normalizedLabel = normalizeText(label);
  return coverParagraphs.find((paragraph) => normalizeText(paragraph.text).includes(normalizedLabel));
};

const extractCaptionToken = (text: string, prefix: '图' | '表'): string | undefined => {
  const match = text.trim().match(new RegExp(`^${prefix}\\s*(\\d+(?:\\.\\d+)*)`));
  return match ? `${prefix}${match[1]}` : undefined;
};

const isValidCaption = (text: string, prefix: '图' | '表'): boolean =>
  new RegExp(`^${prefix}\\s*\\d+(?:\\.\\d+)*\\s+\\S+`).test(text.trim());

const findCaptionParagraphs = (documentModel: ParsedDocxModel, prefix: '图' | '表'): ParsedParagraph[] =>
  documentModel.paragraphs.filter((paragraph) => paragraph.text.trim().startsWith(prefix));

const collectReferencedTokens = (documentModel: ParsedDocxModel, prefix: '图' | '表'): Array<{ token: string; paragraph: ParsedParagraph }> => {
  const results: Array<{ token: string; paragraph: ParsedParagraph }> = [];
  const pattern = new RegExp(`${prefix}\\s*\\d+(?:\\.\\d+)*`, 'g');

  for (const paragraph of documentModel.paragraphs) {
    const matches = paragraph.text.match(pattern);
    if (!matches) {
      continue;
    }

    for (const match of matches) {
      results.push({
        token: match.replace(/\s+/g, ''),
        paragraph,
      });
    }
  }

  return results;
};

export const evaluateDocumentAgainstRules = (
  documentModel: ParsedDocxModel,
  ruleConfig: PaperRuleConfig
): CheckIssue[] => {
  const issues: CheckIssue[] = [];

  const expectedPageSize = parsePageSizeLabel(ruleConfig.pageSize);
  if (documentModel.pageSize && expectedPageSize && documentModel.pageSize.label !== expectedPageSize) {
    addIssue(issues, {
      category: 'page',
      location: 'Global page settings',
      currentValue: documentModel.pageSize.label,
      expectedValue: expectedPageSize,
      reason: 'The document page size does not match the configured template.',
      suggestion: `Change the page size to ${expectedPageSize} in the document layout settings.`,
      severity: 'high',
    });
  }

  const expectedMargins = parseMarginRule(ruleConfig.margin);
  if (documentModel.marginsCm) {
    const marginPairs: Array<[keyof typeof expectedMargins, string]> = [
      ['top', 'Top margin'],
      ['bottom', 'Bottom margin'],
      ['left', 'Left margin'],
      ['right', 'Right margin'],
    ];

    for (const [key, label] of marginPairs) {
      const actualValue = documentModel.marginsCm[key];
      const expectedValue = expectedMargins[key];
      if (expectedValue !== undefined && !nearlyEqual(actualValue, expectedValue, 0.3)) {
        addIssue(issues, {
          category: 'page',
          location: 'Global page settings',
          currentValue: `${label} ${actualValue.toFixed(2)}cm`,
          expectedValue: `${label} ${expectedValue.toFixed(2)}cm`,
          reason: `${label} differs from the configured rule.`,
          suggestion: `Adjust ${label.toLowerCase()} to ${expectedValue.toFixed(2)}cm.`,
          severity: 'high',
        });
      }
    }
  }

  const expectedHeaderFragments = parseHeaderFragments(ruleConfig.headerRule);
  if (expectedHeaderFragments.length > 0) {
    const missingHeaderFragment = expectedHeaderFragments.find((fragment) =>
      !documentModel.headerTexts.some((headerText) => normalizeLabeledToken(headerText).includes(fragment))
    );

    if (missingHeaderFragment) {
      addIssue(issues, {
        category: 'page',
        location: 'Header',
        currentValue: documentModel.headerTexts.join(' | ') || 'No header text detected',
        expectedValue: ruleConfig.headerRule ?? '',
        reason: 'The document header does not contain the configured school header text.',
        suggestion: `Add the required header text fragment: ${missingHeaderFragment}.`,
        severity: 'medium',
      });
    }
  }

  if (!hasNoRequirement(ruleConfig.pageNumberRule) && !documentModel.hasPageNumberField) {
    addIssue(issues, {
      category: 'page',
      location: 'Footer',
      currentValue: 'Page number field not detected',
      expectedValue: ruleConfig.pageNumberRule,
      reason: 'The document footer does not appear to contain a page number field.',
      suggestion: 'Insert a page number field in the footer and match the configured alignment style.',
      severity: 'medium',
    });
  }

  const expectedPageNumberAlignment = parseExpectedAlignment(ruleConfig.pageNumberRule);
  if (
    !hasNoRequirement(ruleConfig.pageNumberRule)
    && documentModel.hasPageNumberField
    && expectedPageNumberAlignment
    && documentModel.pageNumberAlignment
    && documentModel.pageNumberAlignment !== expectedPageNumberAlignment
  ) {
    addIssue(issues, {
      category: 'page',
      location: 'Footer',
      currentValue: `Page number alignment ${documentModel.pageNumberAlignment}`,
      expectedValue: `Page number alignment ${expectedPageNumberAlignment}`,
      reason: 'The page number alignment does not match the configured rule.',
      suggestion: `Adjust the footer page number alignment to ${expectedPageNumberAlignment}.`,
      severity: 'medium',
    });
  }

  const coverParagraphs = getCoverParagraphs(documentModel);
  for (const coverItem of parseConfiguredTokens(ruleConfig.coverItems)) {
    if (!findCoverField(coverParagraphs, coverItem)) {
      addIssue(issues, {
        category: 'other',
        location: 'Cover page',
        currentValue: coverParagraphs.map((paragraph) => paragraph.text).filter(Boolean).join(' | ') || 'No cover content detected',
        expectedValue: coverItem,
        reason: 'A required cover-field label was not detected in the cover-page area.',
        suggestion: `Add the cover-field label “${coverItem}” to the title page.`,
        severity: 'medium',
      });
    }
  }

  for (const requiredSection of parseConfiguredTokens(ruleConfig.requiredSections)) {
    const sectionParagraph = findSectionParagraph(documentModel, requiredSection);
    if (!sectionParagraph) {
      addIssue(issues, {
        category: 'other',
        location: 'Document structure',
        currentValue: 'Section not detected',
        expectedValue: requiredSection,
        reason: 'A required section heading was not detected in the document.',
        suggestion: `Add the section “${requiredSection}” according to the school template.`,
        severity: 'medium',
      });
      continue;
    }

    if (requiredSection === '毕业论文原创性声明') {
      const normalizedWindow = documentModel.paragraphs
        .slice(Math.max(0, sectionParagraph.index - 1), Math.min(documentModel.paragraphs.length, sectionParagraph.index + 5))
        .map((paragraph) => paragraph.text)
        .join(' ');

      if (!/签名|署名|日期/.test(normalizedWindow)) {
        addIssue(issues, {
          category: 'other',
          location: humanParagraphLocation(sectionParagraph),
          currentValue: normalizedWindow || sectionParagraph.text,
          expectedValue: '包含签名与日期信息',
          reason: 'The originality statement section does not appear to include signature or date prompts.',
          suggestion: 'Add signature and date fields to the originality statement page.',
          severity: 'low',
        });
      }
    }
  }

  const bodyParagraphs = selectBodyParagraphs(documentModel);
  const expectedBodyFont = parseExpectedFont(ruleConfig.bodyFont);
  const firstMismatchedBody = bodyParagraphs.find((paragraph) =>
    expectedBodyFont && paragraph.fontFamily && !fontMatches(expectedBodyFont, paragraph.fontFamily)
  );
  if (firstMismatchedBody && expectedBodyFont) {
    addIssue(issues, {
      category: 'body',
      location: humanParagraphLocation(firstMismatchedBody),
      currentValue: firstMismatchedBody.fontFamily ?? 'Unknown',
      expectedValue: expectedBodyFont,
      reason: 'The body font does not match the rule configuration.',
      suggestion: `Apply ${expectedBodyFont} to the body text.`,
      severity: 'high',
    });
  }

  const expectedBodyFontSize = parseFontSizePt(ruleConfig.bodyFontSize);
  const fontSizeMismatch = bodyParagraphs.find((paragraph) =>
    expectedBodyFontSize !== undefined
      && paragraph.fontSizePt !== undefined
      && !nearlyEqual(paragraph.fontSizePt, expectedBodyFontSize, 0.6)
  );
  if (fontSizeMismatch && expectedBodyFontSize !== undefined) {
    addIssue(issues, {
      category: 'body',
      location: humanParagraphLocation(fontSizeMismatch),
      currentValue: `${fontSizeMismatch.fontSizePt?.toFixed(1)}pt`,
      expectedValue: `${expectedBodyFontSize.toFixed(1)}pt`,
      reason: 'The body font size does not match the configured value.',
      suggestion: `Set the body font size to ${expectedBodyFontSize.toFixed(1)}pt.`,
      severity: 'high',
    });
  }

  const expectedLineHeight = parseLineHeightRule(ruleConfig.lineHeight);
  const lineHeightMismatch = bodyParagraphs.find((paragraph) => {
    if (!expectedLineHeight || paragraph.lineHeight === undefined || !paragraph.lineHeightMode) {
      return false;
    }

    if (expectedLineHeight.mode !== paragraph.lineHeightMode) {
      return true;
    }

    return !nearlyEqual(paragraph.lineHeight, expectedLineHeight.value, expectedLineHeight.mode === 'multiple' ? 0.15 : 1);
  });
  if (lineHeightMismatch && expectedLineHeight) {
    addIssue(issues, {
      category: 'body',
      location: humanParagraphLocation(lineHeightMismatch),
      currentValue: lineHeightMismatch.lineHeightMode === 'points'
        ? `${lineHeightMismatch.lineHeight?.toFixed(1)}pt`
        : `${lineHeightMismatch.lineHeight?.toFixed(2)}x`,
      expectedValue: expectedLineHeight.mode === 'points'
        ? `${expectedLineHeight.value.toFixed(1)}pt`
        : `${expectedLineHeight.value.toFixed(2)}x`,
      reason: 'The paragraph line spacing does not meet the template requirement.',
      suggestion: 'Update the paragraph line spacing to the configured value.',
      severity: 'medium',
    });
  }

  const expectedSpacing = parseSpacingRule(ruleConfig.paragraphSpacing);
  const spacingMismatch = bodyParagraphs.find((paragraph) => {
    const beforeMismatch = expectedSpacing.before !== undefined
      && paragraph.spacingBeforePt !== undefined
      && !nearlyEqual(paragraph.spacingBeforePt, expectedSpacing.before, 1);
    const afterMismatch = expectedSpacing.after !== undefined
      && paragraph.spacingAfterPt !== undefined
      && !nearlyEqual(paragraph.spacingAfterPt, expectedSpacing.after, 1);

    return beforeMismatch || afterMismatch;
  });
  if (spacingMismatch) {
    addIssue(issues, {
      category: 'body',
      location: humanParagraphLocation(spacingMismatch),
      currentValue: `Before ${spacingMismatch.spacingBeforePt?.toFixed(1) ?? 'N/A'}pt, After ${spacingMismatch.spacingAfterPt?.toFixed(1) ?? 'N/A'}pt`,
      expectedValue: `Before ${expectedSpacing.before ?? 0}pt, After ${expectedSpacing.after ?? 0}pt`,
      reason: 'Paragraph spacing differs from the configured rule.',
      suggestion: 'Align the paragraph spacing with the template.',
      severity: 'medium',
    });
  }

  const expectedIndent = parseFirstLineIndentRule(ruleConfig.firstLineIndent);
  const indentMismatch = bodyParagraphs.find((paragraph) =>
    expectedIndent !== undefined
      && paragraph.firstLineChars !== undefined
      && !nearlyEqual(paragraph.firstLineChars, expectedIndent, 0.25)
  );
  if (indentMismatch && expectedIndent !== undefined) {
    addIssue(issues, {
      category: 'body',
      location: humanParagraphLocation(indentMismatch),
      currentValue: `${indentMismatch.firstLineChars?.toFixed(2)} chars`,
      expectedValue: `${expectedIndent.toFixed(2)} chars`,
      reason: 'The first-line indentation does not match the configured rule.',
      suggestion: 'Adjust the first-line indent in paragraph settings.',
      severity: 'low',
    });
  }

  const headingRules = parseHeadingRules(ruleConfig.headingFormats);
  for (const headingRule of headingRules) {
    const headingParagraph = documentModel.paragraphs.find((paragraph) => paragraph.headingLevel === headingRule.level && paragraph.text);
    if (!headingParagraph) {
      addIssue(issues, {
        category: 'heading',
        location: `Heading level ${headingRule.level}`,
        currentValue: 'No heading found',
        expectedValue: `Heading level ${headingRule.level} should exist`,
        reason: 'The parser did not find a heading paragraph for this configured level.',
        suggestion: 'Check whether the document uses Word heading styles for this level.',
        severity: 'low',
      });
      continue;
    }

    if (headingRule.font && !fontMatches(headingRule.font, headingParagraph.fontFamily)) {
      addIssue(issues, {
        category: 'heading',
        location: humanParagraphLocation(headingParagraph),
        currentValue: headingParagraph.fontFamily ?? 'Unknown',
        expectedValue: headingRule.font,
        reason: 'Heading font does not match the configured style.',
        suggestion: 'Apply the correct heading font to this title.',
        severity: 'high',
      });
    }

    if (headingRule.fontSizePt && headingParagraph.fontSizePt !== undefined && !nearlyEqual(headingParagraph.fontSizePt, headingRule.fontSizePt, 0.8)) {
      addIssue(issues, {
        category: 'heading',
        location: humanParagraphLocation(headingParagraph),
        currentValue: `${headingParagraph.fontSizePt.toFixed(1)}pt`,
        expectedValue: `${headingRule.fontSizePt.toFixed(1)}pt`,
        reason: 'Heading font size does not match the configured style.',
        suggestion: 'Adjust the heading font size to match the template.',
        severity: 'high',
      });
    }

    if (headingRule.alignment && headingParagraph.alignment && headingParagraph.alignment !== headingRule.alignment) {
      addIssue(issues, {
        category: 'heading',
        location: humanParagraphLocation(headingParagraph),
        currentValue: headingParagraph.alignment,
        expectedValue: headingRule.alignment,
        reason: 'Heading alignment does not match the configured style.',
        suggestion: 'Adjust the heading alignment to match the template.',
        severity: 'medium',
      });
    }

    if (headingRule.lineHeight && headingParagraph.lineHeight !== undefined && headingParagraph.lineHeightMode) {
      const lineHeightMismatch = headingRule.lineHeight.mode !== headingParagraph.lineHeightMode
        || !nearlyEqual(
          headingParagraph.lineHeight,
          headingRule.lineHeight.value,
          headingRule.lineHeight.mode === 'multiple' ? 0.15 : 1
        );
      if (lineHeightMismatch) {
        addIssue(issues, {
          category: 'heading',
          location: humanParagraphLocation(headingParagraph),
          currentValue: headingParagraph.lineHeightMode === 'points'
            ? `${headingParagraph.lineHeight.toFixed(1)}pt`
            : `${headingParagraph.lineHeight.toFixed(2)}x`,
          expectedValue: headingRule.lineHeight.mode === 'points'
            ? `${headingRule.lineHeight.value.toFixed(1)}pt`
            : `${headingRule.lineHeight.value.toFixed(2)}x`,
          reason: 'Heading line spacing does not match the configured style.',
          suggestion: 'Adjust the heading line spacing to match the template.',
          severity: 'medium',
        });
      }
    }

    if (headingRule.spacing) {
      const beforeMismatch = headingRule.spacing.before !== undefined
        && headingParagraph.spacingBeforePt !== undefined
        && !nearlyEqual(headingParagraph.spacingBeforePt, headingRule.spacing.before, 1);
      const afterMismatch = headingRule.spacing.after !== undefined
        && headingParagraph.spacingAfterPt !== undefined
        && !nearlyEqual(headingParagraph.spacingAfterPt, headingRule.spacing.after, 1);

      if (beforeMismatch || afterMismatch) {
        addIssue(issues, {
          category: 'heading',
          location: humanParagraphLocation(headingParagraph),
          currentValue: `Before ${headingParagraph.spacingBeforePt?.toFixed(1) ?? 'N/A'}pt, After ${headingParagraph.spacingAfterPt?.toFixed(1) ?? 'N/A'}pt`,
          expectedValue: `Before ${headingRule.spacing.before ?? 'N/A'}pt, After ${headingRule.spacing.after ?? 'N/A'}pt`,
          reason: 'Heading paragraph spacing does not match the configured style.',
          suggestion: 'Adjust the heading paragraph spacing to match the template.',
          severity: 'medium',
        });
      }
    }

    if (
      headingRule.firstLineIndent !== undefined
      && headingParagraph.firstLineChars !== undefined
      && !nearlyEqual(headingParagraph.firstLineChars, headingRule.firstLineIndent, 0.25)
    ) {
      addIssue(issues, {
        category: 'heading',
        location: humanParagraphLocation(headingParagraph),
        currentValue: `${headingParagraph.firstLineChars.toFixed(2)} chars`,
        expectedValue: `${headingRule.firstLineIndent.toFixed(2)} chars`,
        reason: 'Heading first-line indent does not match the configured style.',
        suggestion: 'Adjust the heading first-line indent to match the template.',
        severity: 'low',
      });
    }
  }

  if (!hasNoRequirement(ruleConfig.abstractFormat)) {
    const abstractHeadingIndex = findAbstractHeadingIndex(documentModel);
    const abstractParagraph = abstractHeadingIndex >= 0 ? documentModel.paragraphs[abstractHeadingIndex] : undefined;
    if (!abstractParagraph) {
      addIssue(issues, {
        category: 'other',
        location: 'Abstract section',
        currentValue: 'Abstract title not detected',
        expectedValue: ruleConfig.abstractFormat,
        reason: 'The parser did not detect an abstract heading.',
        suggestion: 'Add a clearly marked abstract section using a standard heading title.',
        severity: 'medium',
      });
    } else {
      const abstractTitleSegment = selectRuleSegment(ruleConfig.abstractFormat, ['摘要标题', '标题']);
      const expectedAbstractFont = parseExpectedFont(abstractTitleSegment);
      const expectedAbstractFontSize = parseFontSizePt(abstractTitleSegment);

      if (expectedAbstractFont && !fontMatches(expectedAbstractFont, abstractParagraph.fontFamily)) {
        addIssue(issues, {
          category: 'other',
          location: humanParagraphLocation(abstractParagraph),
          currentValue: abstractParagraph.fontFamily ?? 'Unknown',
          expectedValue: expectedAbstractFont,
          reason: 'The abstract title font does not match the configured format.',
          suggestion: 'Adjust the abstract title font to match the rule.',
          severity: 'medium',
        });
      }

      if (
        expectedAbstractFontSize !== undefined
        && abstractParagraph.fontSizePt !== undefined
        && !nearlyEqual(abstractParagraph.fontSizePt, expectedAbstractFontSize, 0.8)
      ) {
        addIssue(issues, {
          category: 'other',
          location: humanParagraphLocation(abstractParagraph),
          currentValue: `${abstractParagraph.fontSizePt.toFixed(1)}pt`,
          expectedValue: `${expectedAbstractFontSize.toFixed(1)}pt`,
          reason: 'The abstract title font size does not match the configured format.',
          suggestion: 'Adjust the abstract title font size to match the rule.',
          severity: 'medium',
        });
      }

      const expectedAbstractAlignment = parseExpectedAlignment(abstractTitleSegment);
      if (
        expectedAbstractAlignment
        && abstractParagraph.alignment
        && abstractParagraph.alignment !== expectedAbstractAlignment
      ) {
        addIssue(issues, {
          category: 'other',
          location: humanParagraphLocation(abstractParagraph),
          currentValue: abstractParagraph.alignment,
          expectedValue: expectedAbstractAlignment,
          reason: 'The abstract title alignment does not match the configured format.',
          suggestion: 'Adjust the abstract title alignment to match the rule.',
          severity: 'medium',
        });
      }

      const abstractLengthRange = parseValueRange(ruleConfig.abstractFormat);
      const abstractBodyText = getAbstractBodyText(documentModel).replace(/\s+/g, '');
      if (
        abstractLengthRange
        && (abstractBodyText.length < abstractLengthRange.min || abstractBodyText.length > abstractLengthRange.max)
      ) {
        addIssue(issues, {
          category: 'other',
          location: 'Abstract section',
          currentValue: `${abstractBodyText.length} characters`,
          expectedValue: `${abstractLengthRange.min}-${abstractLengthRange.max} characters`,
          reason: 'The abstract length does not fall within the configured range.',
          suggestion: 'Adjust the abstract body length to fit the template requirement.',
          severity: 'low',
        });
      }
    }
  }

  if (!hasNoRequirement(ruleConfig.keywordFormat)) {
    const keywordsParagraph = documentModel.paragraphs.find((paragraph) => /(关键词|keywords?)/i.test(paragraph.text));
    if (!keywordsParagraph) {
      addIssue(issues, {
        category: 'other',
        location: 'Keywords section',
        currentValue: 'Keywords line not detected',
        expectedValue: ruleConfig.keywordFormat,
        reason: 'The parser did not detect a keywords line in the document.',
        suggestion: 'Add a keywords line after the abstract section.',
        severity: 'medium',
      });
    } else {
      if (!/(关键词|keywords?)[:：]/i.test(keywordsParagraph.text)) {
        addIssue(issues, {
          category: 'other',
          location: humanParagraphLocation(keywordsParagraph),
          currentValue: keywordsParagraph.text,
          expectedValue: '关键词：关键词1；关键词2',
          reason: 'The keywords line is missing a standard label and colon.',
          suggestion: 'Rewrite the line to start with “关键词：” or “Keywords:”.',
          severity: 'low',
        });
      }

      const expectsSemicolonSeparator = /分号|semicolon/i.test(ruleConfig.keywordFormat);
      if (expectsSemicolonSeparator && !/[;；]/.test(keywordsParagraph.text)) {
        addIssue(issues, {
          category: 'other',
          location: humanParagraphLocation(keywordsParagraph),
          currentValue: keywordsParagraph.text,
          expectedValue: 'Keywords separated by semicolons',
          reason: 'The keywords line does not use semicolon separators as configured.',
          suggestion: 'Separate keywords with semicolons.',
          severity: 'low',
        });
      }

      const keywordCountRange = parseValueRange(ruleConfig.keywordFormat);
      const keywordItems = getKeywordItems(keywordsParagraph.text);
      if (
        keywordCountRange
        && (keywordItems.length < keywordCountRange.min || keywordItems.length > keywordCountRange.max)
      ) {
        addIssue(issues, {
          category: 'other',
          location: humanParagraphLocation(keywordsParagraph),
          currentValue: `${keywordItems.length} keywords`,
          expectedValue: `${keywordCountRange.min}-${keywordCountRange.max} keywords`,
          reason: 'The number of keywords does not match the configured range.',
          suggestion: 'Adjust the keyword count to fit the template requirement.',
          severity: 'low',
        });
      }
    }
  }

  if (!hasNoRequirement(ruleConfig.referenceFormat)) {
    const referencesHeadingIndex = documentModel.paragraphs.findIndex((paragraph) => /^(参考文献|references)$/i.test(paragraph.text));
    if (referencesHeadingIndex < 0) {
      addIssue(issues, {
        category: 'reference',
        location: 'References section',
        currentValue: 'References heading not detected',
        expectedValue: ruleConfig.referenceFormat,
        reason: 'The parser did not detect a references section.',
        suggestion: 'Add a dedicated references heading at the end of the paper.',
        severity: 'medium',
      });
    } else {
      const referenceEntries = documentModel.paragraphs
        .slice(referencesHeadingIndex + 1)
        .filter((paragraph) => paragraph.text)
        .slice(0, 5);

      if (referenceEntries.length === 0) {
        addIssue(issues, {
          category: 'reference',
          location: 'References section',
          currentValue: 'No reference entries found',
          expectedValue: 'At least one formatted reference entry',
          reason: 'The document has a references heading but no reference content.',
          suggestion: 'Add the reference entries below the references heading.',
          severity: 'medium',
        });
      } else {
        const numberingLooksValid = referenceEntries.some((paragraph) =>
          /^\[\d+\]/.test(paragraph.text) || Boolean(paragraph.numbering?.isOrdered)
        );
        if (!numberingLooksValid && /gb\/t|ieee/i.test(ruleConfig.referenceFormat.toLowerCase())) {
          addIssue(issues, {
            category: 'reference',
            location: 'References section',
            currentValue: referenceEntries[0]?.text ?? 'No reference entries found',
            expectedValue: 'Entries should follow numbered reference formatting such as [1] ...',
            reason: 'The reference list does not look like a numbered standard format.',
            suggestion: 'Format the references with numbered entries that follow the configured standard.',
            severity: 'low',
          });
        }
      }
    }
  }

  if (!hasNoRequirement(ruleConfig.figureCaptionRule)) {
    const figureCaptionRule = ruleConfig.figureCaptionRule ?? NO_REQUIREMENT;
    const figureCaptions = findCaptionParagraphs(documentModel, '图');
    for (const caption of figureCaptions) {
      if (!isValidCaption(caption.text, '图')) {
        addIssue(issues, {
          category: 'other',
          location: humanParagraphLocation(caption),
          currentValue: caption.text,
          expectedValue: figureCaptionRule,
          reason: 'The figure caption does not match the configured numbering pattern.',
          suggestion: 'Rewrite the figure caption using a format such as “图1.1 标题”.',
          severity: 'low',
        });
      }
    }

    const captionTokens = new Set(
      figureCaptions
        .map((paragraph) => extractCaptionToken(paragraph.text, '图'))
        .filter(Boolean)
    );

    const missingFigureReference = collectReferencedTokens(documentModel, '图').find(({ token, paragraph }) =>
      !captionTokens.has(token)
      && !paragraph.text.trim().startsWith('图')
    );

    if (missingFigureReference) {
      addIssue(issues, {
        category: 'other',
        location: humanParagraphLocation(missingFigureReference.paragraph),
        currentValue: missingFigureReference.token,
        expectedValue: figureCaptionRule,
        reason: 'The document references a figure number but no matching figure caption was detected.',
        suggestion: `Add a matching caption for ${missingFigureReference.token}.`,
        severity: 'low',
      });
    }
  }

  if (!hasNoRequirement(ruleConfig.tableCaptionRule)) {
    const tableCaptionRule = ruleConfig.tableCaptionRule ?? NO_REQUIREMENT;
    const tableCaptions = findCaptionParagraphs(documentModel, '表');
    for (const caption of tableCaptions) {
      if (!isValidCaption(caption.text, '表')) {
        addIssue(issues, {
          category: 'other',
          location: humanParagraphLocation(caption),
          currentValue: caption.text,
          expectedValue: tableCaptionRule,
          reason: 'The table caption does not match the configured numbering pattern.',
          suggestion: 'Rewrite the table caption using a format such as “表1.1 标题”.',
          severity: 'low',
        });
      }
    }

    const captionTokens = new Set(
      tableCaptions
        .map((paragraph) => extractCaptionToken(paragraph.text, '表'))
        .filter(Boolean)
    );

    const missingTableReference = collectReferencedTokens(documentModel, '表').find(({ token, paragraph }) =>
      !captionTokens.has(token)
      && !paragraph.text.trim().startsWith('表')
    );

    if (missingTableReference) {
      addIssue(issues, {
        category: 'other',
        location: humanParagraphLocation(missingTableReference.paragraph),
        currentValue: missingTableReference.token,
        expectedValue: tableCaptionRule,
        reason: 'The document references a table number but no matching table caption was detected.',
        suggestion: `Add a matching caption for ${missingTableReference.token}.`,
        severity: 'low',
      });
    }
  }

  return issues;
};
