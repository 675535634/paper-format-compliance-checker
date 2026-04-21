import { describe, expect, it } from 'vitest';
import { defaultRuleConfig } from '../src/constants/defaults.js';
import { evaluateDocumentAgainstRules } from '../src/services/rule-engine-service.js';
import type { ParsedDocxModel } from '../src/types/index.js';

describe('evaluateDocumentAgainstRules', () => {
  it('does not flag numbered references when paragraphs are marked as ordered lists', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 5,
      hasPageNumberField: true,
      pageSize: {
        widthCm: 21,
        heightCm: 29.7,
        label: 'A4',
      },
      marginsCm: {
        top: 2.5,
        bottom: 2.5,
        left: 3,
        right: 2.5,
      },
      defaultFontFamily: 'Times New Roman',
      defaultFontSizePt: 12,
      paragraphs: [
        { index: 1, text: 'Abstract', headingLevel: 1, fontFamily: '黑体', fontSizePt: 16 },
        { index: 2, text: 'Keywords: testing, rules', fontFamily: 'Times New Roman', fontSizePt: 12 },
        { index: 3, text: 'References', fontFamily: 'Times New Roman', fontSizePt: 12 },
        {
          index: 4,
          text: 'Smith. Testing paper.',
          fontFamily: 'Times New Roman',
          fontSizePt: 12,
          numbering: {
            numId: '10',
            level: 0,
            format: 'decimal',
            levelText: '%1.',
            isOrdered: true,
          },
        },
        { index: 5, text: 'Body paragraph', fontFamily: 'Times New Roman', fontSizePt: 12, lineHeight: 1.5, lineHeightMode: 'multiple', spacingBeforePt: 0, spacingAfterPt: 0, firstLineChars: 2 },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      headingFormats: 'Level 1: 黑体 三号',
    });

    expect(issues.some((issue) => issue.category === 'reference')).toBe(false);
    expect(issues.some((issue) => issue.category === 'page')).toBe(false);
  });

  it('flags page-number alignment, keyword separator, and empty references when they violate rules', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 3,
      hasPageNumberField: true,
      pageNumberAlignment: 'right',
      pageSize: {
        widthCm: 21,
        heightCm: 29.7,
        label: 'A4',
      },
      marginsCm: {
        top: 2.5,
        bottom: 2.5,
        left: 3,
        right: 2.5,
      },
      defaultFontFamily: 'Times New Roman',
      defaultFontSizePt: 12,
      paragraphs: [
        { index: 1, text: '摘要', headingLevel: 1, fontFamily: '宋体', fontSizePt: 12 },
        { index: 2, text: '关键词 测试, 规则', fontFamily: 'Times New Roman', fontSizePt: 12 },
        { index: 3, text: '参考文献', fontFamily: 'Times New Roman', fontSizePt: 12 },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      pageNumberRule: '底部居中，阿拉伯数字',
      abstractFormat: '黑体小四',
      keywordFormat: '黑体小四，词间分号隔开',
      headingFormats: '',
    });

    expect(issues.some((issue) => issue.reason.includes('page number alignment'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('abstract title font'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('missing a standard label and colon'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('semicolon separators'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('no reference content'))).toBe(true);
  });
});
