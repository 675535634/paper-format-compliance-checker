import { describe, expect, it } from 'vitest';
import { defaultRuleConfig } from '../src/constants/defaults.js';
import { evaluateDocumentAgainstRules } from '../src/services/rule-engine-service.js';
import type { ParsedDocxModel } from '../src/types/index.js';

const zh = {
  headerLeft: '\u5730\u5927\u9ad8\u7b49\u5b66\u5386\u7ee7\u7eed\u6559\u80b2',
  headerRight: '\u5b66\u751f\u59d3\u540d\uff1a\u8bba\u6587\u9898\u76ee',
  title: '\u8bba\u6587\u9898\u76ee\uff1a\u6d4b\u8bd5\u8bba\u6587',
  teachingPoint: '\u6559\u5b66\u70b9\u540d\u79f0\uff1a\u7ee7\u7eed\u6559\u80b2\u5b66\u9662',
  studentNo: '\u5b66\u53f7\uff1a20260001',
  studentName: '\u5b66\u751f\u59d3\u540d\uff1a\u5f20\u4e09',
  major: '\u5b66\u79d1\u4e13\u4e1a\uff1a\u8ba1\u7b97\u673a\u79d1\u5b66\u4e0e\u6280\u672f',
  advisor: '\u6307\u5bfc\u6559\u5e08\uff1a\u674e\u8001\u5e08',
  reviewer: '\u8bc4\u9605\u6559\u5e08\uff1a\u738b\u8001\u5e08',
  originality: '\u6bd5\u4e1a\u8bba\u6587\u539f\u521b\u6027\u58f0\u660e',
  signature: '\u4f5c\u8005\u624b\u5199\u7535\u5b50\u7b7e\u540d\uff1a\u5f20\u4e09 \u65e5\u671f\uff1a2026\u5e744\u6708',
  abstract: '\u6458\u8981',
  abstractText: '\u8fd9\u662f\u4e00\u6bb5\u7528\u4e8e\u6458\u8981\u957f\u5ea6\u6821\u9a8c\u7684\u5185\u5bb9\u3002',
  keywords: '\u5173\u952e\u8bcd\uff1a\u6d4b\u8bd5\uff1b\u89c4\u5219\uff1b\u6392\u7248',
  bodyText: '\u8fd9\u662f\u7b26\u5408\u8981\u6c42\u7684\u6b63\u6587\u6bb5\u843d\u3002',
  acknowledgement: '\u81f4\u8c22',
  acknowledgementText: '\u611f\u8c22\u6307\u5bfc\u8001\u5e08\u548c\u8bc4\u9605\u8001\u5e08\u3002',
  references: '\u53c2\u8003\u6587\u732e',
  coursePaper: '\u8bfe\u7a0b\u8bba\u6587',
  shortAbstract: '\u6458\u8981\u5185\u5bb9\u8fc7\u77ed\u3002',
  badKeywords: '\u5173\u952e\u8bcd \u6d4b\u8bd5, \u89c4\u5219',
  figureAndTableReference: '\u5982\u56fe2.1\u548c\u88683.1\u6240\u793a\uff0c\u7ed3\u679c\u663e\u8457\u3002',
  figureCaptionOnly: '\u56fe2.1',
  bodyFont: '\u5b8b\u4f53',
  headingFont: '\u9ed1\u4f53',
  headingRule: 'Level 1: \u9ed1\u4f53 \u5c0f\u4e8c',
};

describe('evaluateDocumentAgainstRules', () => {
  it('does not flag compliant school headers, required sections, or numbered references when the model matches the template', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 17,
      headerTexts: [zh.headerLeft, zh.headerRight],
      hasPageNumberField: true,
      pageNumberAlignment: 'center',
      pageSize: {
        widthCm: 21,
        heightCm: 29.7,
        label: 'A4',
      },
      marginsCm: {
        top: 3,
        bottom: 3,
        left: 3,
        right: 3,
      },
      defaultFontFamily: zh.bodyFont,
      defaultFontSizePt: 12,
      paragraphs: [
        { index: 1, text: zh.title },
        { index: 2, text: zh.teachingPoint },
        { index: 3, text: zh.studentNo },
        { index: 4, text: zh.studentName },
        { index: 5, text: zh.major },
        { index: 6, text: zh.advisor },
        { index: 7, text: zh.reviewer },
        { index: 8, text: zh.originality },
        { index: 9, text: zh.signature },
        { index: 10, text: zh.abstract, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
        { index: 11, text: zh.abstractText.repeat(20), fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points' },
        { index: 12, text: zh.keywords, fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 13, text: zh.bodyText, fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points', spacingBeforePt: 0, spacingAfterPt: 0, firstLineChars: 2 },
        { index: 14, text: zh.acknowledgement, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
        { index: 15, text: zh.acknowledgementText, fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 16, text: zh.references, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
        {
          index: 17,
          text: 'Smith. Testing paper.',
          fontFamily: zh.bodyFont,
          fontSizePt: 12,
          lineHeight: 20,
          lineHeightMode: 'points',
          spacingBeforePt: 0,
          spacingAfterPt: 0,
          firstLineChars: 2,
          numbering: {
            numId: '10',
            level: 0,
            format: 'decimal',
            levelText: '%1.',
            isOrdered: true,
          },
        },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      headingFormats: zh.headingRule,
    });

    expect(issues).toHaveLength(0);
  });

  it('flags missing cover fields, required sections, abstract length, keyword separators, and empty references when they violate rules', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 4,
      headerTexts: [zh.coursePaper],
      hasPageNumberField: true,
      pageNumberAlignment: 'right',
      pageSize: {
        widthCm: 21,
        heightCm: 29.7,
        label: 'A4',
      },
      marginsCm: {
        top: 3,
        bottom: 3,
        left: 3,
        right: 3,
      },
      defaultFontFamily: zh.bodyFont,
      defaultFontSizePt: 12,
      paragraphs: [
        { index: 1, text: zh.title },
        { index: 2, text: zh.abstract, headingLevel: 1, fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 3, text: zh.shortAbstract, fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points' },
        { index: 4, text: zh.badKeywords, fontFamily: zh.bodyFont, fontSizePt: 12 },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      headingFormats: '',
    });

    expect(issues.some((issue) => issue.reason.includes('school header text'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('cover-field label'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('required section heading'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('page number alignment'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('abstract title font'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('abstract length'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('missing a standard label and colon'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('semicolon separators'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('number of keywords'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('references section'))).toBe(true);
  });

  it('flags invalid caption formats and referenced figure or table numbers without matching captions', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 14,
      headerTexts: [zh.headerLeft, zh.headerRight],
      hasPageNumberField: true,
      pageNumberAlignment: 'center',
      pageSize: {
        widthCm: 21,
        heightCm: 29.7,
        label: 'A4',
      },
      marginsCm: {
        top: 3,
        bottom: 3,
        left: 3,
        right: 3,
      },
      defaultFontFamily: zh.bodyFont,
      defaultFontSizePt: 12,
      paragraphs: [
        { index: 1, text: zh.title },
        { index: 2, text: zh.teachingPoint },
        { index: 3, text: zh.studentNo },
        { index: 4, text: zh.studentName },
        { index: 5, text: zh.major },
        { index: 6, text: zh.advisor },
        { index: 7, text: zh.reviewer },
        { index: 8, text: zh.originality },
        { index: 9, text: zh.signature },
        { index: 10, text: zh.abstract, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
        { index: 11, text: zh.abstractText.repeat(20), fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points' },
        { index: 12, text: zh.keywords, fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 13, text: zh.figureAndTableReference, fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points', spacingBeforePt: 0, spacingAfterPt: 0, firstLineChars: 2 },
        { index: 14, text: zh.figureCaptionOnly, fontFamily: zh.bodyFont, fontSizePt: 10.5 },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      headingFormats: '',
    });

    expect(issues.some((issue) => issue.reason.includes('figure caption does not match'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('matching table caption'))).toBe(true);
  });
});
