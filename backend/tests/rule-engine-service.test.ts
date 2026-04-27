import { afterEach, describe, expect, it } from 'vitest';
import { defaultRuleConfig } from '../src/constants/defaults.js';
import { parseDocxFile } from '../src/services/docx-parser-service.js';
import { evaluateDocumentAgainstRules } from '../src/services/rule-engine-service.js';
import type { ParsedDocxModel } from '../src/types/index.js';
import { createDocxFixture } from './helpers/docx-fixture.js';

const zh = {
  headerLeft: '\u5730\u5927\u9ad8\u7b49\u5b66\u5386\u7ee7\u7eed\u6559\u80b2',
  headerRight: '\u5b66\u751f\u59d3\u540d\uff1a\u8bba\u6587\u9898\u76ee',
  headerRightWithValues: '\u5b66\u751f\u59d3\u540d\uff1a\u5f20\u4e09\uff1b\u8bba\u6587\u9898\u76ee\uff1a\u6d4b\u8bd5\u8bba\u6587',
  title: '\u8bba\u6587\u9898\u76ee\uff1a\u6d4b\u8bd5\u8bba\u6587',
  teachingPoint: '\u6559\u5b66\u70b9\u540d\u79f0\uff1a\u7ee7\u7eed\u6559\u80b2\u5b66\u9662',
  studentNo: '\u5b66\u53f7\uff1a20260001',
  studentName: '\u5b66\u751f\u59d3\u540d\uff1a\u5f20\u4e09',
  major: '\u5b66\u79d1\u4e13\u4e1a\uff1a\u8ba1\u7b97\u673a\u79d1\u5b66\u4e0e\u6280\u672f',
  advisor: '\u6307\u5bfc\u6559\u5e08\uff1a\u674e\u8001\u5e08',
  reviewer: '\u8bc4\u9605\u6559\u5e08\uff1a\u738b\u8001\u5e08',
  completionDate: '\u5b8c\u6210\u65f6\u95f4\uff1a\u4e8c\u3007\u4e8c\u516d\u5e74\u56db\u6708',
  originality: '\u6bd5\u4e1a\u8bba\u6587\u539f\u521b\u6027\u58f0\u660e',
  signature: '\u4f5c\u8005\u624b\u5199\u7535\u5b50\u7b7e\u540d\uff1a\u5f20\u4e09 \u65e5\u671f\uff1a2026\u5e744\u6708',
  toc: '\u76ee\u5f55',
  tocEntry1: '1 \u7eea\u8bba........................1',
  tocEntry2: '2 \u7814\u7a76\u65b9\u6cd5........................3',
  abstract: '\u6458\u8981',
  abstractText: '\u8fd9\u662f\u4e00\u6bb5\u7528\u4e8e\u6458\u8981\u957f\u5ea6\u6821\u9a8c\u7684\u5185\u5bb9\u3002',
  keywords: '\u5173\u952e\u8bcd\uff1a\u6d4b\u8bd5\uff1b\u89c4\u5219\uff1b\u6392\u7248',
  bodyText: '\u8fd9\u662f\u7b26\u5408\u8981\u6c42\u7684\u6b63\u6587\u6bb5\u843d\u3002',
  acknowledgement: '\u81f4\u8c22',
  acknowledgementText: '\u611f\u8c22\u6307\u5bfc\u8001\u5e08\u548c\u8bc4\u9605\u8001\u5e08\u3002',
  supervisorReview: '\u6307\u5bfc\u6559\u5e08\u6307\u5bfc\u610f\u89c1\u8868',
  supervisorReviewText: '\u6307\u5bfc\u6559\u5e08\u6307\u5bfc\u610f\u89c1\uff1a\u540c\u610f\u63d0\u4ea4\u3002',
  reviewerReview: '\u8bc4\u9605\u6559\u5e08\u8bc4\u9605\u610f\u89c1\u8868',
  reviewerReviewText: '\u8bc4\u9605\u6559\u5e08\u8bc4\u9605\u610f\u89c1\uff1a\u683c\u5f0f\u57fa\u672c\u89c4\u8303\u3002',
  references: '\u53c2\u8003\u6587\u732e',
  coursePaper: '\u8bfe\u7a0b\u8bba\u6587',
  shortAbstract: '\u6458\u8981\u5185\u5bb9\u8fc7\u77ed\u3002',
  badKeywords: '\u5173\u952e\u8bcd \u6d4b\u8bd5, \u89c4\u5219',
  figureAndTableReference: '\u5982\u56fe2.1\u548c\u88683.1\u6240\u793a\uff0c\u7ed3\u679c\u663e\u8457\u3002',
  figureAndTableReferenceHyphen: '\u5982\u56fe3-1\u548c\u88686-1\u6240\u793a\uff0c\u7ed3\u679c\u663e\u8457\u3002',
  figureCaptionOnly: '\u56fe2.1',
  figureCaptionHyphen: '\u56fe3-1 \u901a\u77e5\u53d1\u5e03\u6d41\u7a0b\u56fe',
  tableCaptionHyphen: '\u88686-1 \u6d4b\u8bd5\u73af\u5883\u4e0e\u7248\u672c\u4fe1\u606f',
  bodyFont: '\u5b8b\u4f53',
  headingFont: '\u9ed1\u4f53',
  headingRule: 'Level 1: \u9ed1\u4f53 \u5c0f\u4e8c',
};

const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanupTasks.length > 0) {
    const cleanup = cleanupTasks.pop();
    if (cleanup) {
      await cleanup();
    }
  }
});

describe('evaluateDocumentAgainstRules', () => {
  it('detects a standalone spaced abstract title without relying on Word heading style', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 4,
      headerTexts: [],
      hasPageNumberField: false,
      pageSize: { widthCm: 21, heightCm: 29.7, label: 'A4' },
      marginsCm: { top: 3, bottom: 3, left: 3, right: 3 },
      defaultFontFamily: zh.bodyFont,
      defaultFontSizePt: 12,
      paragraphs: [
        { index: 1, text: '\u6458  \u8981', fontFamily: zh.headingFont, fontSizePt: 18, alignment: 'center' },
        { index: 2, text: zh.abstractText, fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 3, text: zh.keywords, fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 4, text: '第一章 绪论', fontFamily: zh.headingFont, fontSizePt: 16 },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      pageSize: '无要求',
      margin: '无要求',
      headerRule: '无要求',
      pageNumberRule: '无要求',
      coverItems: '无要求',
      requiredSections: '无要求',
      keywordFormat: '无要求',
      headingFormats: '无要求',
      referenceFormat: '无要求',
      tocRule: '无要求',
      figureCaptionRule: '无要求',
      tableCaptionRule: '无要求',
      abstractFormat: '摘要标题: 黑体 小二; 摘要正文: 宋体 小四',
    });

    expect(issues.some((issue) => issue.reason.toLowerCase().includes('abstract heading'))).toBe(false);
  });

  it('does not treat a references entry inside the table of contents as the real references section', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 3,
      headerTexts: [],
      hasPageNumberField: false,
      pageSize: { widthCm: 21, heightCm: 29.7, label: 'A4' },
      marginsCm: { top: 3, bottom: 3, left: 3, right: 3 },
      defaultFontFamily: zh.bodyFont,
      defaultFontSizePt: 12,
      paragraphs: [
        { index: 1, text: zh.toc, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
        { index: 2, text: '第一章 绪论\t1', styleId: 'TOC1', styleName: 'toc 1', fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 3, text: '参考文献\t44', styleId: 'TOC1', styleName: 'toc 1', fontFamily: zh.bodyFont, fontSizePt: 12 },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      pageSize: '无要求',
      margin: '无要求',
      headerRule: '无要求',
      pageNumberRule: '无要求',
      coverItems: '无要求',
      requiredSections: '无要求',
      abstractFormat: '无要求',
      keywordFormat: '无要求',
      headingFormats: '无要求',
      tocRule: '无要求',
      figureCaptionRule: '无要求',
      tableCaptionRule: '无要求',
      referenceFormat: 'GB/T 7714',
    });

    expect(issues.some((issue) => issue.reason.toLowerCase().includes('references section'))).toBe(true);
  });

  it('does not flag compliant school headers, required sections, or numbered references when the model matches the template', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 24,
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
        { index: 8, text: zh.completionDate },
        { index: 9, text: zh.originality },
        { index: 10, text: zh.signature },
        { index: 11, text: zh.toc, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 16, alignment: 'center' },
        { index: 12, text: zh.tocEntry1, fontFamily: zh.bodyFont, fontSizePt: 14, alignment: 'both', lineHeight: 20, lineHeightMode: 'points', spacingBeforePt: 0, spacingAfterPt: 0 },
        { index: 13, text: zh.tocEntry2, fontFamily: zh.bodyFont, fontSizePt: 14, alignment: 'both', lineHeight: 20, lineHeightMode: 'points', spacingBeforePt: 0, spacingAfterPt: 0 },
        { index: 14, text: zh.abstract, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
        { index: 15, text: zh.abstractText.repeat(20), fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points' },
        { index: 16, text: zh.keywords, fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 17, text: zh.bodyText, fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points', spacingBeforePt: 0, spacingAfterPt: 0, firstLineChars: 2 },
        { index: 18, text: zh.acknowledgement, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
        { index: 19, text: zh.acknowledgementText, fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 20, text: zh.supervisorReview, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
        { index: 21, text: zh.supervisorReviewText, fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 22, text: zh.reviewerReview, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
        { index: 23, text: zh.reviewerReviewText, fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 24, text: zh.references, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
        {
          index: 25,
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

  it('does not miss cover fields when the title page uses a table layout', async () => {
    const fixture = await createDocxFixture({
      documentBlocks: [
        { type: 'paragraph', paragraph: { text: '\u9ad8\u7b49\u5b66\u5386\u7ee7\u7eed\u6559\u80b2\u672c\u79d1\u751f\u6bd5\u4e1a\u8bba\u6587(\u8bbe\u8ba1)', fontFamily: zh.headingFont, fontSizeHalfPoints: 32 } },
        { type: 'paragraph', paragraph: { text: '\u57fa\u4e8eVue 3\u4e0eNode.js\u7684\u667a\u6167\u6821\u56ed\u4fe1\u606f\u5e73\u53f0\u8bbe\u8ba1\u4e0e\u5b9e\u73b0', fontFamily: zh.headingFont, fontSizeHalfPoints: 36 } },
        {
          type: 'table',
          table: {
            rows: [
              { cells: [{ paragraphs: [{ text: zh.teachingPoint }] }, { paragraphs: [{ text: zh.studentNo }] }] },
              { cells: [{ paragraphs: [{ text: zh.studentName }] }, { paragraphs: [{ text: zh.major }] }] },
              { cells: [{ paragraphs: [{ text: zh.advisor }] }, { paragraphs: [{ text: zh.reviewer }] }] },
            ],
          },
        },
        { type: 'paragraph', paragraph: { text: zh.completionDate } },
        { type: 'paragraph', paragraph: { text: zh.originality, styleId: 'Heading1' } },
      ],
      headers: [zh.headerLeft, zh.headerRight],
      includeFooterPageNumber: true,
      footerAlignment: 'center',
    });
    cleanupTasks.push(fixture.cleanup);

    const parsed = await parseDocxFile(fixture.filePath);
    const issues = evaluateDocumentAgainstRules(parsed, {
      ...defaultRuleConfig,
      requiredSections: '\u6bd5\u4e1a\u8bba\u6587\u539f\u521b\u6027\u58f0\u660e',
      abstractLength: '无要求',
      keywordRule: '无要求',
      headingFormats: '',
      referenceFormat: '无要求',
      figureCaptionRule: '无要求',
      tableCaptionRule: '无要求',
      bodyFontRule: '无要求',
      bodySizeRule: '无要求',
      bodyParagraphRule: '无要求',
      pageNumberRule: '无要求',
    });

    expect(issues.some((issue) => issue.reason.includes('cover-field label'))).toBe(false);
  });

  it('accepts common cover-field aliases and a bare Chinese completion date on the title page', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 10,
      headerTexts: [zh.headerLeft, zh.headerRight],
      hasPageNumberField: false,
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
        { index: 1, text: '高等学历继续教育本科生毕业论文（设计）', fontFamily: zh.headingFont, fontSizePt: 22 },
        { index: 2, text: '基于Vue 3与Node.js的智慧校园信息平台设计与实现', fontFamily: zh.headingFont, fontSizePt: 18 },
        { index: 3, text: '学习中心：继续教育学院' },
        { index: 4, text: '学籍号：20260001' },
        { index: 5, text: '姓 名：张三' },
        { index: 6, text: '专业名称：计算机科学与技术' },
        { index: 7, text: '指导老师：李老师' },
        { index: 8, text: '评阅老师：王老师' },
        { index: 9, text: '二〇二六年四月' },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      requiredSections: '无要求',
      headerRule: '无要求',
      pageNumberRule: '无要求',
      bodyFont: '无要求',
      bodyFontSize: '无要求',
      lineHeight: '无要求',
      paragraphSpacing: '无要求',
      firstLineIndent: '无要求',
      headingFormats: '',
      abstractFormat: '无要求',
      keywordFormat: '无要求',
      referenceFormat: '无要求',
      figureCaptionRule: '无要求',
      tableCaptionRule: '无要求',
      tocRule: '无要求',
    });

    expect(issues.some((issue) => issue.reason.includes('cover-field label'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('cover completion date'))).toBe(false);
  });

  it('accepts a resolved student-name and paper-title header when the rule uses placeholders', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 21,
      headerTexts: [
        '\u5730\u5927\u9ad8\u7b49\u5b66\u5386\u7ee7\u7eed\u6559\u80b2',
        '\u8499\u4e30\u534e\uff1a\u57fa\u4e8eVue 3\u4e0eNode.js\u7684\u667a\u6167\u6821\u56ed\u4fe1\u606f\u5e73\u53f0\u8bbe\u8ba1\u4e0e\u5b9e\u73b0',
      ],
      hasPageNumberField: false,
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
      paragraphs: [
        { index: 1, text: zh.bodyText },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      headerRule: '\u5947\u6570\u9875\uff1a\u5730\u5927\u9ad8\u7b49\u5b66\u5386\u7ee7\u7eed\u6559\u80b2\uff1b\u5076\u6570\u9875\uff1a\u5b66\u751f\u59d3\u540d\uff1a\u8bba\u6587\u9898\u76ee',
      coverItems: '\u65e0\u8981\u6c42',
      requiredSections: '\u65e0\u8981\u6c42',
      pageNumberRule: '\u65e0\u8981\u6c42',
      bodyFont: '\u65e0\u8981\u6c42',
      bodyFontSize: '\u65e0\u8981\u6c42',
      lineHeight: '\u65e0\u8981\u6c42',
      paragraphSpacing: '\u65e0\u8981\u6c42',
      firstLineIndent: '\u65e0\u8981\u6c42',
      headingFormats: '',
      abstractFormat: '\u65e0\u8981\u6c42',
      keywordFormat: '\u65e0\u8981\u6c42',
      referenceFormat: '\u65e0\u8981\u6c42',
      figureCaptionRule: '\u65e0\u8981\u6c42',
      tableCaptionRule: '\u65e0\u8981\u6c42',
      tocRule: '\u65e0\u8981\u6c42',
    });

    expect(issues.some((issue) => issue.reason.toLowerCase().includes('school header text'))).toBe(false);
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

    expect(issues.some((issue) => issue.reason.toLowerCase().includes('school header text'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('cover-field label'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('required section heading'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('page number alignment'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('abstract title font'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('abstract length'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('missing a standard label and colon'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('semicolon separators'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('number of keywords'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('references section'))).toBe(true);
  });

  it('flags a cover completion date that does not use the required Chinese year-month format', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 2,
      headerTexts: [],
      hasPageNumberField: false,
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
        { index: 2, text: '完成时间：2026年4月' },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      coverItems: '完成时间',
      requiredSections: '无要求',
      headerRule: '无要求',
      pageNumberRule: '无要求',
      bodyFont: '无要求',
      bodyFontSize: '无要求',
      lineHeight: '无要求',
      paragraphSpacing: '无要求',
      firstLineIndent: '无要求',
      headingFormats: '',
      abstractFormat: '无要求',
      keywordFormat: '无要求',
      referenceFormat: '无要求',
      figureCaptionRule: '无要求',
      tableCaptionRule: '无要求',
      tocRule: '无要求',
    });

    expect(issues.some((issue) => issue.reason.includes('cover completion date'))).toBe(true);
  });

  it('does not report completion time as missing when a bare Chinese date placeholder is present on the cover', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 3,
      headerTexts: [],
      hasPageNumberField: false,
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
        { index: 2, text: '\u4e8c\u25cb\u00d7\u00d7\u5e74\u00d7\u6708' },
        { index: 3, text: zh.abstract, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      coverItems: '完成时间',
      requiredSections: '无要求',
      headerRule: '无要求',
      pageNumberRule: '无要求',
      bodyFont: '无要求',
      bodyFontSize: '无要求',
      lineHeight: '无要求',
      paragraphSpacing: '无要求',
      firstLineIndent: '无要求',
      headingFormats: '',
      abstractFormat: '无要求',
      keywordFormat: '无要求',
      referenceFormat: '无要求',
      figureCaptionRule: '无要求',
      tableCaptionRule: '无要求',
      tocRule: '无要求',
    });

    expect(issues.some((issue) => issue.reason.includes('cover-field label'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('cover completion date'))).toBe(false);
  });

  it('does not infer heading line spacing from the level number when the rule omits a line-height requirement', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 4,
      headerTexts: [],
      hasPageNumberField: false,
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
        { index: 1, text: '第一章 绪论', styleId: '1', styleName: 'heading 1', headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 16, alignment: 'center', lineHeight: 1, lineHeightMode: 'multiple' },
        { index: 2, text: '1.1 研究背景', styleId: '2', styleName: 'heading 2', headingLevel: 2, fontFamily: zh.headingFont, fontSizePt: 14, alignment: 'center', lineHeight: 1, lineHeightMode: 'multiple' },
        { index: 3, text: '1.1.1 研究动因', fontFamily: zh.headingFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points' },
        { index: 4, text: zh.bodyText, fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points', firstLineChars: 2 },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      coverItems: '无要求',
      requiredSections: '无要求',
      headerRule: '无要求',
      pageNumberRule: '无要求',
      abstractFormat: '无要求',
      keywordFormat: '无要求',
      referenceFormat: '无要求',
      figureCaptionRule: '无要求',
      tableCaptionRule: '无要求',
      tocRule: '无要求',
      headingFormats: 'Level 1: 字体=黑体 | 字号=16pt | 对齐=居中; Level 2: 字体=黑体 | 字号=14pt | 对齐=居中; Level 3: 字体=黑体 | 字号=12pt',
      bodyFont: '宋体',
      bodyFontSize: '12pt',
      lineHeight: '20pt',
      paragraphSpacing: '无要求',
      firstLineIndent: '2字符',
    });

    expect(issues.some((issue) => issue.reason.includes('Heading line spacing'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('No heading found'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('body font does not match'))).toBe(false);
  });

  it('does not infer missing signature or date prompts from originality statement content', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 2,
      headerTexts: [],
      hasPageNumberField: false,
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
        { index: 1, text: zh.originality, alignment: 'center' },
        {
          index: 2,
          text: '\u672c\u4eba\u90d1\u91cd\u58f0\u660e\uff1a\u672c\u4eba\u6240\u5448\u4ea4\u7684\u672c\u79d1\u6bd5\u4e1a\u8bba\u6587\u4e3a\u72ec\u7acb\u64b0\u5199\u5b8c\u6210\u3002',
          fontFamily: zh.bodyFont,
          fontSizePt: 12,
        },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      coverItems: '\u65e0\u8981\u6c42',
      requiredSections: zh.originality,
      headerRule: '\u65e0\u8981\u6c42',
      pageNumberRule: '\u65e0\u8981\u6c42',
      abstractFormat: '\u65e0\u8981\u6c42',
      keywordFormat: '\u65e0\u8981\u6c42',
      referenceFormat: '\u65e0\u8981\u6c42',
      figureCaptionRule: '\u65e0\u8981\u6c42',
      tableCaptionRule: '\u65e0\u8981\u6c42',
      tocRule: '\u65e0\u8981\u6c42',
      headingFormats: '\u65e0\u8981\u6c42',
      bodyFont: '\u65e0\u8981\u6c42',
      bodyFontSize: '\u65e0\u8981\u6c42',
      lineHeight: '\u65e0\u8981\u6c42',
      paragraphSpacing: '\u65e0\u8981\u6c42',
      firstLineIndent: '\u65e0\u8981\u6c42',
    });

    expect(issues.some((issue) => issue.reason.includes('originality statement'))).toBe(false);
  });

  it('reports mixed fonts inside a single body paragraph', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 1,
      headerTexts: [],
      hasPageNumberField: false,
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
        ...Array.from({ length: 20 }, (_, index) => ({
          index: index + 1,
          text: `cover ${index + 1}`,
          fontFamily: zh.bodyFont,
          fontSizePt: 12,
        })),
        {
          index: 21,
          text: zh.bodyText,
          fontFamily: zh.bodyFont,
          fontFamilies: [zh.bodyFont, '\u5fae\u8f6f\u96c5\u9ed1'],
          fontSizePt: 12,
          lineHeight: 20,
          lineHeightMode: 'points',
          firstLineChars: 2,
        },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      coverItems: '\u65e0\u8981\u6c42',
      requiredSections: '\u65e0\u8981\u6c42',
      headerRule: '\u65e0\u8981\u6c42',
      pageNumberRule: '\u65e0\u8981\u6c42',
      abstractFormat: '\u65e0\u8981\u6c42',
      keywordFormat: '\u65e0\u8981\u6c42',
      referenceFormat: '\u65e0\u8981\u6c42',
      figureCaptionRule: '\u65e0\u8981\u6c42',
      tableCaptionRule: '\u65e0\u8981\u6c42',
      tocRule: '\u65e0\u8981\u6c42',
      headingFormats: '\u65e0\u8981\u6c42',
      bodyFont: zh.bodyFont,
      bodyFontSize: '12pt',
      lineHeight: '20pt',
      paragraphSpacing: '\u65e0\u8981\u6c42',
      firstLineIndent: '2\u5b57\u7b26',
    });

    const fontIssue = issues.find((issue) => issue.reason === 'The body font does not match the rule configuration.');

    expect(fontIssue?.currentValue).toBe(`${zh.bodyFont} / \u5fae\u8f6f\u96c5\u9ed1`);
  });

  it('prefers the real references heading over the table of contents entry', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 7,
      headerTexts: [],
      hasPageNumberField: false,
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
        { index: 1, text: zh.toc, headingLevel: 1, styleId: '1', styleName: 'heading 1', fontFamily: zh.headingFont, fontSizePt: 16 },
        { index: 2, text: '参考文献', styleId: 'TOC1', styleName: 'toc 1', fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 3, text: '第一章 绪论', styleId: 'TOC1', styleName: 'toc 1', fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 4, text: zh.references, styleId: '1', styleName: 'heading 1', headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 16, alignment: 'center' },
        { index: 5, text: '[1] 参考文献条目示例。', fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points' },
        { index: 6, text: zh.supervisorReview, fontFamily: zh.headingFont, fontSizePt: 16, alignment: 'center' },
        { index: 7, text: '指导教师意见：同意提交。', fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points' },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      coverItems: '无要求',
      headerRule: '无要求',
      pageNumberRule: '无要求',
      abstractFormat: '无要求',
      keywordFormat: '无要求',
      figureCaptionRule: '无要求',
      tableCaptionRule: '无要求',
      tocRule: '无要求',
      headingFormats: '',
      bodyFont: '无要求',
      bodyFontSize: '无要求',
      lineHeight: '无要求',
      paragraphSpacing: '无要求',
      firstLineIndent: '无要求',
      requiredSections: '参考文献; 指导教师指导意见表',
      referenceFormat: 'GB/T 7714-2005',
    });

    expect(issues.some((issue) => issue.reason.includes('reference list does not look like a numbered standard format'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('required section heading'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('body font does not match'))).toBe(false);
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

  it('flags caption paragraph formatting mismatches and missing TOC entries when the new rules are violated', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 6,
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
        { index: 2, text: zh.toc, headingLevel: 1, fontFamily: zh.bodyFont, fontSizePt: 12, alignment: 'left' },
        { index: 3, text: zh.abstract, headingLevel: 1, fontFamily: zh.headingFont, fontSizePt: 18 },
        { index: 4, text: zh.abstractText.repeat(20), fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points' },
        { index: 5, text: zh.figureAndTableReference, fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points', spacingBeforePt: 0, spacingAfterPt: 0, firstLineChars: 2 },
        { index: 6, text: '图2.1 示意图', fontFamily: zh.bodyFont, fontSizePt: 12, alignment: 'left', spacingBeforePt: 6, spacingAfterPt: 0 },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      headingFormats: '',
    });

    expect(issues.some((issue) => issue.reason.includes('Figure caption font size'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('Figure caption alignment'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('table of contents heading but no plausible TOC entries'))).toBe(true);
    expect(issues.some((issue) => issue.reason.includes('Table of contents title font'))).toBe(true);
  });

  it('accepts spaced abstract and toc headings, toc styles, and skips cover title plus toc entries from body checks', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 9,
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
        { index: 1, text: '高等学历继续教育本科生毕业论文（设计）', fontFamily: zh.headingFont, fontSizePt: 22 },
        { index: 2, text: '测试论文题目', fontFamily: zh.headingFont, fontSizePt: 22 },
        { index: 3, text: '摘 要', fontFamily: zh.headingFont, fontSizePt: 18, alignment: 'center' },
        { index: 4, text: zh.abstractText.repeat(20), fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points' },
        { index: 5, text: zh.keywords, fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points' },
        { index: 6, text: '目 录', fontFamily: zh.headingFont, fontSizePt: 16, alignment: 'center' },
        { index: 7, text: '第一章 绪论', styleId: 'TOC1', styleName: 'toc 1', fontFamily: zh.bodyFont, fontSizePt: 14, alignment: 'both', lineHeight: 20, lineHeightMode: 'points', spacingBeforePt: 0, spacingAfterPt: 0 },
        { index: 8, text: '1.1 研究背景', styleId: 'TOC2', styleName: 'toc 2', fontFamily: zh.bodyFont, fontSizePt: 12, alignment: 'both', lineHeight: 20, lineHeightMode: 'points', spacingBeforePt: 0, spacingAfterPt: 0, firstLineChars: 1 },
        { index: 9, text: '1.1.1 研究动因', styleId: 'TOC3', styleName: 'toc 3', fontFamily: zh.bodyFont, fontSizePt: 12, alignment: 'both', lineHeight: 20, lineHeightMode: 'points', spacingBeforePt: 0, spacingAfterPt: 0, firstLineChars: 2 },
        { index: 10, text: zh.bodyText, fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points', spacingBeforePt: 0, spacingAfterPt: 0, firstLineChars: 2 },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      coverItems: '论文题目',
      requiredSections: '无要求',
      headingFormats: '',
      referenceFormat: '无要求',
      figureCaptionRule: '无要求',
      tableCaptionRule: '无要求',
    });

    expect(issues.some((issue) => issue.reason.includes('abstract heading'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('table of contents heading but no plausible TOC entries'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('cover-field label'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('body font'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('body font size'))).toBe(false);
  });

  it('accepts header placeholders with actual values and hyphenated figure or table numbering', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 7,
      headerTexts: [zh.headerLeft, zh.headerRightWithValues],
      hasPageNumberField: false,
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
        { index: 1, text: zh.figureAndTableReferenceHyphen, fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 2, text: zh.figureCaptionHyphen, fontFamily: zh.bodyFont, fontSizePt: 10.5, alignment: 'center' },
        { index: 3, text: zh.tableCaptionHyphen, fontFamily: zh.bodyFont, fontSizePt: 10.5, alignment: 'center' },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      coverItems: '无要求',
      requiredSections: '无要求',
      pageNumberRule: '无要求',
      bodyFont: '无要求',
      bodyFontSize: '无要求',
      lineHeight: '无要求',
      paragraphSpacing: '无要求',
      firstLineIndent: '无要求',
      headingFormats: '',
      abstractFormat: '无要求',
      keywordFormat: '无要求',
      referenceFormat: '无要求',
      tocRule: '无要求',
    });

    expect(issues.some((issue) => issue.reason.includes('school header text'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('figure caption does not match'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('table caption does not match'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('matching figure caption'))).toBe(false);
    expect(issues.some((issue) => issue.reason.includes('matching table caption'))).toBe(false);
  });

  it('does not treat figure range prose as a malformed caption', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 3,
      headerTexts: [],
      hasPageNumberField: true,
      defaultFontFamily: zh.bodyFont,
      defaultFontSizePt: 12,
      paragraphs: [
        { index: 1, text: '图6-1 系统登录界面', fontFamily: zh.bodyFont, fontSizePt: 10.5, alignment: 'center' },
        { index: 2, text: '图6-1至图6-16展示了上述过程中的关键证据截图。其中，PDF 解析预览页面内容较长，因此将三道题的解析结果分别截取，以保证图中文字清晰可辨。', fontFamily: zh.bodyFont, fontSizePt: 12 },
        { index: 3, text: zh.bodyText, fontFamily: zh.bodyFont, fontSizePt: 12, lineHeight: 20, lineHeightMode: 'points', spacingBeforePt: 0, spacingAfterPt: 0, firstLineChars: 2 },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      coverItems: '无要求',
      requiredSections: '无要求',
      headingFormats: '',
      abstractFormat: '无要求',
      keywordFormat: '无要求',
      referenceFormat: '无要求',
      tocRule: '无要求',
      tableCaptionRule: '无要求',
    });

    expect(issues.some((issue) => issue.location === 'Paragraph 2' && issue.reason.includes('figure caption'))).toBe(false);
  });

  it('checks abstract spacing plus header and footer text styles without confusing them with header text or page-number alignment rules', () => {
    const documentModel: ParsedDocxModel = {
      paragraphCount: 3,
      headerTexts: [zh.headerLeft, zh.headerRightWithValues],
      headerParagraphs: [
        {
          index: 1,
          text: zh.headerLeft,
          fontFamily: zh.bodyFont,
          fontSizePt: 10.5,
          alignment: 'left',
          lineHeight: 1,
          lineHeightMode: 'multiple',
          spacingBeforePt: 0,
          spacingAfterPt: 0,
        },
      ],
      footerParagraphs: [
        {
          index: 1,
          text: '第 1 页',
          fontFamily: zh.bodyFont,
          fontSizePt: 9,
          alignment: 'left',
          lineHeight: 1,
          lineHeightMode: 'multiple',
          spacingBeforePt: 0,
          spacingAfterPt: 0,
        },
      ],
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
        {
          index: 1,
          text: zh.abstract,
          headingLevel: 1,
          fontFamily: zh.headingFont,
          fontSizePt: 18,
          alignment: 'center',
          lineHeight: 24,
          lineHeightMode: 'points',
          spacingBeforePt: 0,
          spacingAfterPt: 0,
        },
        {
          index: 2,
          text: zh.abstractText.repeat(20),
          fontFamily: zh.bodyFont,
          fontSizePt: 12,
          lineHeight: 20,
          lineHeightMode: 'points',
          spacingBeforePt: 6,
          spacingAfterPt: 6,
        },
        {
          index: 3,
          text: zh.keywords,
          fontFamily: zh.bodyFont,
          fontSizePt: 12,
        },
      ],
    };

    const issues = evaluateDocumentAgainstRules(documentModel, {
      ...defaultRuleConfig,
      coverItems: '无要求',
      requiredSections: '无要求',
      bodyFont: '无要求',
      bodyFontSize: '无要求',
      lineHeight: '无要求',
      paragraphSpacing: '无要求',
      firstLineIndent: '无要求',
      headingFormats: '',
      abstractFormat: '摘要标题|字体=黑体|字号=18pt|对齐=居中|行距=20pt|段前=12pt|段后=6pt；正文|字体=宋体|字号=12pt|行距=20pt|段前=0pt|段后=0pt；300-500字',
      keywordFormat: '无要求',
      referenceFormat: '无要求',
      figureCaptionRule: '无要求',
      tableCaptionRule: '无要求',
      tocRule: '无要求',
      headerRule: '奇数页：地大高等学历继续教育；偶数页：学生姓名：论文题目；页眉样式|字体=宋体|字号=9pt|对齐=居中|行距=1.0|段前=0pt|段后=0pt',
      pageNumberRule: '底部居中，阿拉伯数字；页脚样式|字体=宋体|字号=9pt|对齐=居左|行距=1.0|段前=0pt|段后=0pt',
    });

    expect(issues.some((issue) => issue.reason.toLowerCase().includes('school header text'))).toBe(false);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('page number alignment'))).toBe(false);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('header text font size'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('header text alignment'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('abstract title line spacing'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('abstract title paragraph spacing'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('abstract body paragraph spacing'))).toBe(true);
    expect(issues.some((issue) => issue.reason.toLowerCase().includes('footer text alignment'))).toBe(false);
  });
});
