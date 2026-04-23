import { afterEach, describe, expect, it } from 'vitest';
import { parseDocxFile } from '../src/services/docx-parser-service.js';
import { createDocxFixture } from './helpers/docx-fixture.js';

const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanupTasks.length > 0) {
    const cleanup = cleanupTasks.pop();
    if (cleanup) {
      await cleanup();
    }
  }
});

describe('parseDocxFile', () => {
  it('extracts page layout, header text, page numbers, and numbering metadata from a fixture docx', async () => {
    const fixture = await createDocxFixture({
      headers: ['地大高等学历继续教育', '学生姓名：论文题目'],
      headerParagraphs: [
        {
          text: '页眉样式示例',
          alignment: 'center',
          fontFamily: '宋体',
          fontSizeHalfPoints: 18,
          line: 240,
          before: 0,
          after: 0,
        },
      ],
      footerParagraphs: [
        {
          text: '第 1 页',
          alignment: 'center',
          fontFamily: '宋体',
          fontSizeHalfPoints: 18,
          line: 240,
          before: 0,
          after: 0,
        },
      ],
      includeFooterPageNumber: true,
      footerAlignment: 'center',
      numbering: [
        { numId: '10', abstractNumId: '100', format: 'decimal', levelText: '%1.' },
      ],
      paragraphs: [
        { text: 'Abstract', styleId: 'Heading1' },
        {
          text: 'Keywords: parser; numbering',
          fontFamily: 'Times New Roman',
          fontSizeHalfPoints: 24,
        },
        {
          text: 'Reference entry from numbered list',
          numbering: { numId: '10', ilvl: 0 },
          fontFamily: 'Times New Roman',
          fontSizeHalfPoints: 24,
        },
      ],
    });
    cleanupTasks.push(fixture.cleanup);

    const parsed = await parseDocxFile(fixture.filePath);

    expect(parsed.paragraphCount).toBe(3);
    expect(parsed.pageSize?.label).toBe('A4');
    expect(parsed.headerTexts).toEqual(['地大高等学历继续教育', '学生姓名：论文题目', '页眉样式示例']);
    expect(parsed.headerParagraphs?.some((paragraph) =>
      paragraph.text === '页眉样式示例'
      && paragraph.fontFamily === '宋体'
      && paragraph.fontSizePt === 9
      && paragraph.alignment === 'center'
    )).toBe(true);
    expect(parsed.hasPageNumberField).toBe(true);
    expect(parsed.pageNumberAlignment).toBe('center');
    expect(parsed.footerParagraphs?.some((paragraph) =>
      paragraph.text === '第 1 页'
      && paragraph.fontFamily === '宋体'
      && paragraph.fontSizePt === 9
      && paragraph.alignment === 'center'
    )).toBe(true);
    expect(parsed.paragraphs[0]?.headingLevel).toBe(1);
    expect(parsed.paragraphs[2]?.numbering).toMatchObject({
      numId: '10',
      level: 0,
      format: 'decimal',
      isOrdered: true,
    });
  });

  it('extracts cover-page paragraphs from tables in document order', async () => {
    const fixture = await createDocxFixture({
      documentBlocks: [
        {
          type: 'paragraph',
          paragraph: { text: '\u9ad8\u7b49\u5b66\u5386\u7ee7\u7eed\u6559\u80b2\u672c\u79d1\u751f\u6bd5\u4e1a\u8bba\u6587(\u8bbe\u8ba1)' },
        },
        {
          type: 'paragraph',
          paragraph: { text: '\u57fa\u4e8eVue 3\u4e0eNode.js\u7684\u667a\u6167\u6821\u56ed\u4fe1\u606f\u5e73\u53f0\u8bbe\u8ba1\u4e0e\u5b9e\u73b0' },
        },
        {
          type: 'table',
          table: {
            rows: [
              {
                cells: [
                  {
                    paragraphs: [
                      { text: '\u6559\u5b66\u70b9\u540d\u79f0\uff1a\u7ee7\u7eed\u6559\u80b2\u5b66\u9662' },
                    ],
                  },
                  {
                    paragraphs: [
                      { text: '\u5b66\u53f7\uff1a20260001' },
                    ],
                  },
                ],
              },
              {
                cells: [
                  {
                    paragraphs: [
                      { text: '\u5b66\u751f\u59d3\u540d\uff1a\u5f20\u4e09' },
                    ],
                  },
                  {
                    paragraphs: [
                      { text: '\u5b66\u79d1\u4e13\u4e1a\uff1a\u8ba1\u7b97\u673a\u79d1\u5b66\u4e0e\u6280\u672f' },
                    ],
                  },
                ],
              },
              {
                cells: [
                  {
                    paragraphs: [
                      { text: '\u6307\u5bfc\u6559\u5e08\uff1a\u674e\u8001\u5e08' },
                    ],
                  },
                  {
                    paragraphs: [
                      { text: '\u8bc4\u9605\u6559\u5e08\uff1a\u738b\u8001\u5e08' },
                    ],
                  },
                ],
              },
            ],
          },
        },
        {
          type: 'paragraph',
          paragraph: { text: '\u4e8c\u3007\u4e8c\u516d\u5e74\u4e09\u6708' },
        },
        {
          type: 'paragraph',
          paragraph: { text: '\u6458\u8981', styleId: 'Heading1' },
        },
      ],
    });
    cleanupTasks.push(fixture.cleanup);

    const parsed = await parseDocxFile(fixture.filePath);

    expect(parsed.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      '\u9ad8\u7b49\u5b66\u5386\u7ee7\u7eed\u6559\u80b2\u672c\u79d1\u751f\u6bd5\u4e1a\u8bba\u6587(\u8bbe\u8ba1)',
      '\u57fa\u4e8eVue 3\u4e0eNode.js\u7684\u667a\u6167\u6821\u56ed\u4fe1\u606f\u5e73\u53f0\u8bbe\u8ba1\u4e0e\u5b9e\u73b0',
      '\u6559\u5b66\u70b9\u540d\u79f0\uff1a\u7ee7\u7eed\u6559\u80b2\u5b66\u9662',
      '\u5b66\u53f7\uff1a20260001',
      '\u5b66\u751f\u59d3\u540d\uff1a\u5f20\u4e09',
      '\u5b66\u79d1\u4e13\u4e1a\uff1a\u8ba1\u7b97\u673a\u79d1\u5b66\u4e0e\u6280\u672f',
      '\u6307\u5bfc\u6559\u5e08\uff1a\u674e\u8001\u5e08',
      '\u8bc4\u9605\u6559\u5e08\uff1a\u738b\u8001\u5e08',
      '\u4e8c\u3007\u4e8c\u516d\u5e74\u4e09\u6708',
      '\u6458\u8981',
    ]);
  });
});
