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
  '初号': 42,
  '小初': 36,
  '一号': 26,
  '小一': 24,
  '二号': 22,
  '小二': 18,
  '三号': 16,
  '小三': 15,
  '四号': 14,
  '小四': 12,
  '五号': 10.5,
  '小五': 9,
};

const alignmentAliases: Record<string, string[]> = {
  left: ['left', '居左', '左对齐'],
  center: ['center', 'centre', '居中', '中间'],
  right: ['right', '居右', '右对齐'],
};

const addIssue = (
  issues: CheckIssue[],
  issue: Omit<CheckIssue, 'id'>
): void => {
  issues.push({
    id: createId('issue'),
    ...issue,
  });
};

const normalizeFontToken = (value: string): string => value.toLowerCase().replace(/\s+/g, '');

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
  const normalized = value.toLowerCase();

  for (const [alignment, aliases] of Object.entries(alignmentAliases)) {
    if (aliases.some((alias) => normalized.includes(alias.toLowerCase()))) {
      return alignment;
    }
  }

  return undefined;
};

const parseFontSizePt = (value: string): number | undefined => {
  if (fontSizeMap[value]) {
    return fontSizeMap[value];
  }

  if (value.toLowerCase().includes('pt')) {
    return parseNumericSpec(value);
  }

  return parseNumericSpec(value);
};

const parseExpectedFont = (value: string): string | undefined =>
  Object.values(fontAliases)
    .flat()
    .find((alias) => value.toLowerCase().includes(alias.toLowerCase()));

const parsePageSizeLabel = (value: string): string => value.trim().toUpperCase();

const parseMarginRule = (value: string): { top?: number; bottom?: number; left?: number; right?: number } => {
  const normalized = value.replace(/，/g, ',');
  const numbers = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*cm/gi)].map((match) => Number.parseFloat(match[1]));
  const result: { top?: number; bottom?: number; left?: number; right?: number } = {};

  const labelPatterns: Array<[keyof typeof result, RegExp]> = [
    ['top', /(top|上)\s*(\d+(?:\.\d+)?)\s*cm/i],
    ['bottom', /(bottom|下)\s*(\d+(?:\.\d+)?)\s*cm/i],
    ['left', /(left|左)\s*(\d+(?:\.\d+)?)\s*cm/i],
    ['right', /(right|右)\s*(\d+(?:\.\d+)?)\s*cm/i],
  ];

  for (const [key, pattern] of labelPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      result[key] = Number.parseFloat(match[2]);
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

  const numeric = parseNumericSpec(value);
  if (!numeric) {
    return undefined;
  }

  return value.toLowerCase().includes('pt')
    ? { mode: 'points', value: numeric }
    : { mode: 'multiple', value: numeric };
};

const parseSpacingRule = (value: string): { before?: number; after?: number } => {
  const normalized = value.replace(/，/g, ',');
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
  const match = value.match(/(\d+(?:\.\d+)?)\s*(chars?|字符)/i);
  if (match) {
    return Number.parseFloat(match[1]);
  }

  return parseNumericSpec(value);
};

const parseHeadingRules = (value: string): Array<{ level: number; font?: string; fontSizePt?: number }> =>
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

      const sizeToken = Object.keys(fontSizeMap).find((token) => item.includes(token));
      const fontSizePt = sizeToken ? fontSizeMap[sizeToken] : parseFontSizePt(item);

      return { level, font, fontSizePt };
    })
    .filter(Boolean) as Array<{ level: number; font?: string; fontSizePt?: number }>;

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

const selectBodyParagraphs = (documentModel: ParsedDocxModel): ParsedParagraph[] =>
  documentModel.paragraphs.filter((paragraph) => {
    if (!paragraph.text) {
      return false;
    }

    if (paragraph.headingLevel) {
      return false;
    }

    const lower = paragraph.text.toLowerCase();
    return !lower.includes('abstract') && !lower.includes('keywords') && !lower.includes('参考文献') && !lower.includes('references');
  });

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
          severity: key === 'left' ? 'high' : 'medium',
        });
      }
    }
  }

  if (ruleConfig.pageNumberRule && !documentModel.hasPageNumberField) {
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
    ruleConfig.pageNumberRule
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

  const bodyParagraphs = selectBodyParagraphs(documentModel);
  const firstMismatchedBody = bodyParagraphs.find((paragraph) =>
    paragraph.fontFamily && !fontMatches(ruleConfig.bodyFont, paragraph.fontFamily)
  );
  if (firstMismatchedBody) {
    addIssue(issues, {
      category: 'body',
      location: humanParagraphLocation(firstMismatchedBody),
      currentValue: firstMismatchedBody.fontFamily ?? 'Unknown',
      expectedValue: ruleConfig.bodyFont,
      reason: 'The body font does not match the rule configuration.',
      suggestion: `Apply ${ruleConfig.bodyFont} to the body text.`,
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
  }

  const abstractParagraph = documentModel.paragraphs.find((paragraph) => /^(摘要|abstract\b)/i.test(paragraph.text));
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
    const expectedAbstractFont = parseExpectedFont(ruleConfig.abstractFormat);
    const expectedAbstractFontSize = parseFontSizePt(ruleConfig.abstractFormat);

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
  }

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
        expectedValue: 'Keywords: keyword 1; keyword 2',
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
  }

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

  return issues;
};
