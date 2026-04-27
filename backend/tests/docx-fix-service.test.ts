import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { defaultRuleConfig } from '../src/constants/defaults.js';
import { parseDocxFile } from '../src/services/docx-parser-service.js';
import { createFixedDocumentDownload } from '../src/services/docx-fix-service.js';
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

describe('createFixedDocumentDownload', () => {
  it('generates a repaired docx that satisfies the current high-confidence rules', async () => {
    const repairRuleConfig = {
      ...defaultRuleConfig,
      headingFormats: '无要求',
      referenceFormat: '无要求',
    };

    const fixture = await createDocxFixture({
      paragraphs: [
        { text: '\u8bba\u6587\u9898\u76ee\uff1a\u6d4b\u8bd5\u8bba\u6587' },
        { text: '\u6458\u8981', styleId: 'Heading1', fontFamily: '\u5b8b\u4f53', fontSizeHalfPoints: 24 },
        { text: '\u6458\u8981\u5185\u5bb9\u8fc7\u77ed\u3002', fontFamily: 'Times New Roman', fontSizeHalfPoints: 24, line: 360 },
        { text: '\u5173\u952e\u8bcd \u6d4b\u8bd5, \u89c4\u5219', fontFamily: 'Times New Roman', fontSizeHalfPoints: 24 },
        { text: '\u76ee\u5f55', fontFamily: 'Times New Roman', fontSizeHalfPoints: 24 },
        { text: '\u6458\u8981........................1', fontFamily: 'Times New Roman', fontSizeHalfPoints: 24 },
        { text: '1' },
        { text: '\u5982\u56fe2.1\u548c\u88683.1\u6240\u793a\uff0c\u7ed3\u679c\u663e\u8457\u3002', fontFamily: 'Times New Roman', fontSizeHalfPoints: 24, line: 360 },
        { text: '\u56fe2.1', fontFamily: 'Times New Roman', fontSizeHalfPoints: 21 },
      ],
    });
    cleanupTasks.push(fixture.cleanup);

    const parsedBeforeFix = await parseDocxFile(fixture.filePath);
    const repaired = await createFixedDocumentDownload({
      filePath: fixture.filePath,
      originalFilename: 'sample.docx',
      parsedDocument: parsedBeforeFix,
      ruleConfig: repairRuleConfig,
    });

    expect(repaired.filename).toMatch(/^sample_fixed_\d{14}\.docx$/);

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'paper-checker-fixed-'));
    cleanupTasks.push(async () => rm(tempDir, { recursive: true, force: true }));

    const repairedPath = path.join(tempDir, repaired.filename);
    await writeFile(repairedPath, repaired.buffer);

    const repairedZip = await JSZip.loadAsync(repaired.buffer);
    const documentXml = await repairedZip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeDefined();
    expect(documentXml).not.toMatch(/\sw:t=/);
    expect(documentXml).not.toMatch(/\s(?:w|a|pic|m):[A-Za-z0-9]+=""/);
    expect(documentXml).toMatch(/<w:t[>\s]/);

    const parsedAfterFix = await parseDocxFile(repairedPath);

    const tocTitle = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u76ee\u5f55');
    const tocEntry = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.includes('\u6458\u8981........................1'));
    const fakeReferenceEntry = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.includes('\u53c2\u8003\u6587\u732e........................2'));
    const figureCaption = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u56fe2.1');
    const tableCaption = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u88683.1 \u5f85\u8865\u5145\u9898\u6ce8');
    const completionDate = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.includes('\u5b8c\u6210\u65f6\u95f4\uff1a'));
    const supervisorReview = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u6307\u5bfc\u6559\u5e08\u6307\u5bfc\u610f\u89c1\u8868');
    const reviewerReview = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u8bc4\u9605\u6559\u5e08\u8bc4\u9605\u610f\u89c1\u8868');

    expect(completionDate).toBeUndefined();
    expect(fakeReferenceEntry).toBeUndefined();
    expect(tocTitle).toMatchObject({
      fontFamily: '\u9ed1\u4f53',
      fontSizePt: 16,
      alignment: 'center',
    });
    expect(tocEntry).toMatchObject({
      fontFamily: '\u5b8b\u4f53',
      fontSizePt: 14,
      alignment: 'both',
    });
    expect(figureCaption).toMatchObject({
      fontFamily: '\u5b8b\u4f53',
      fontSizePt: 10.5,
      alignment: 'center',
    });
    expect(tableCaption).toBeUndefined();
    expect(supervisorReview).toBeUndefined();
    expect(reviewerReview).toBeUndefined();
  });

  it('applies only the selected repair groups when fix options are provided', async () => {
    const fixture = await createDocxFixture({
      paragraphs: [
        { text: '\u6b63\u6587\u5f15\u7528\u4e86\u56fe2.1\uff0c\u9700\u8981\u8865\u5168\u9898\u6ce8\u3002' },
        { text: '\u56fe2.1', fontFamily: 'Times New Roman', fontSizeHalfPoints: 21 },
      ],
    });
    cleanupTasks.push(fixture.cleanup);

    const parsedBeforeFix = await parseDocxFile(fixture.filePath);
    const repaired = await createFixedDocumentDownload({
      filePath: fixture.filePath,
      originalFilename: 'sample.docx',
      parsedDocument: parsedBeforeFix,
      ruleConfig: defaultRuleConfig,
      fixOptions: ['captions'],
    });

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'paper-checker-fixed-selected-'));
    cleanupTasks.push(async () => rm(tempDir, { recursive: true, force: true }));

    const repairedPath = path.join(tempDir, repaired.filename);
    await writeFile(repairedPath, repaired.buffer);

    const repairedZip = await JSZip.loadAsync(repaired.buffer);
    const documentXml = await repairedZip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeDefined();
    expect(documentXml).not.toMatch(/\sw:t=/);
    expect(documentXml).not.toMatch(/\s(?:w|a|pic|m):[A-Za-z0-9]+=""/);
    expect(documentXml).toMatch(/<w:t[>\s]/);

    const parsedAfterFix = await parseDocxFile(repairedPath);
    const tocTitle = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u76ee\u5f55');
    const referencesHeading = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u53c2\u8003\u6587\u732e');
    const figureCaption = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u56fe2.1');

    expect(figureCaption).toMatchObject({
      fontFamily: '\u5b8b\u4f53',
      fontSizePt: 10.5,
    });
    expect(tocTitle).toBeUndefined();
    expect(referencesHeading).toBeUndefined();
  });

  it('does not insert fake TOC entries when an existing TOC field has no parsed static entries', async () => {
    const fixture = await createDocxFixture({
      paragraphs: [
        { text: '\u76ee\u5f55', fontFamily: 'Times New Roman', fontSizeHalfPoints: 24 },
        { text: '\u7b2c\u4e00\u7ae0 \u7eea\u8bba', styleId: 'Heading1' },
      ],
    });
    cleanupTasks.push(fixture.cleanup);

    const parsedBeforeFix = await parseDocxFile(fixture.filePath);
    const repaired = await createFixedDocumentDownload({
      filePath: fixture.filePath,
      originalFilename: 'sample.docx',
      parsedDocument: parsedBeforeFix,
      ruleConfig: defaultRuleConfig,
      fixOptions: ['toc'],
    });

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'paper-checker-toc-no-fake-'));
    cleanupTasks.push(async () => rm(tempDir, { recursive: true, force: true }));
    const repairedPath = path.join(tempDir, repaired.filename);
    await writeFile(repairedPath, repaired.buffer);
    const parsedAfterFix = await parseDocxFile(repairedPath);

    expect(parsedAfterFix.paragraphs.some((paragraph) => paragraph.text.includes('\u6458\u8981........................1'))).toBe(false);
    expect(parsedAfterFix.paragraphs.some((paragraph) => paragraph.text.includes('\u53c2\u8003\u6587\u732e........................2'))).toBe(false);
  });

  it('allows body and heading formatting to be repaired independently', async () => {
    const splitRuleConfig = {
      ...defaultRuleConfig,
      bodyFont: '\u5b8b\u4f53',
      bodyFontSize: '\u5c0f\u56db',
      headingFormats: 'Level 1: \u9ed1\u4f53 \u4e09\u53f7',
    };
    const fixture = await createDocxFixture({
      paragraphs: [
        { text: '\u7b2c\u4e00\u7ae0 \u7eea\u8bba', fontFamily: 'Times New Roman', fontSizeHalfPoints: 21 },
        { text: '\u8fd9\u662f\u4e00\u6bb5\u6b63\u6587\u5185\u5bb9\u3002', fontFamily: 'Times New Roman', fontSizeHalfPoints: 21 },
      ],
    });
    cleanupTasks.push(fixture.cleanup);

    const parsedBeforeFix = await parseDocxFile(fixture.filePath);
    const bodyOnly = await createFixedDocumentDownload({
      filePath: fixture.filePath,
      originalFilename: 'body-only.docx',
      parsedDocument: parsedBeforeFix,
      ruleConfig: splitRuleConfig,
      fixOptions: ['body_format'],
    });
    const headingOnly = await createFixedDocumentDownload({
      filePath: fixture.filePath,
      originalFilename: 'heading-only.docx',
      parsedDocument: parsedBeforeFix,
      ruleConfig: splitRuleConfig,
      fixOptions: ['heading_format'],
    });

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'paper-checker-split-fix-'));
    cleanupTasks.push(async () => rm(tempDir, { recursive: true, force: true }));
    const bodyOnlyPath = path.join(tempDir, bodyOnly.filename);
    const headingOnlyPath = path.join(tempDir, headingOnly.filename);
    await writeFile(bodyOnlyPath, bodyOnly.buffer);
    await writeFile(headingOnlyPath, headingOnly.buffer);

    const parsedBodyOnly = await parseDocxFile(bodyOnlyPath);
    const parsedHeadingOnly = await parseDocxFile(headingOnlyPath);
    const bodyOnlyHeading = parsedBodyOnly.paragraphs.find((paragraph) => paragraph.text.includes('\u7eea\u8bba'));
    const bodyOnlyBody = parsedBodyOnly.paragraphs.find((paragraph) => paragraph.text.includes('\u6b63\u6587\u5185\u5bb9'));
    const headingOnlyHeading = parsedHeadingOnly.paragraphs.find((paragraph) => paragraph.text.includes('\u7eea\u8bba'));
    const headingOnlyBody = parsedHeadingOnly.paragraphs.find((paragraph) => paragraph.text.includes('\u6b63\u6587\u5185\u5bb9'));

    expect(bodyOnlyHeading?.fontFamily).toBe('Times New Roman');
    expect(bodyOnlyBody).toMatchObject({
      fontFamily: '\u5b8b\u4f53',
      fontSizePt: 12,
    });
    expect(headingOnlyHeading).toMatchObject({
      fontFamily: '\u9ed1\u4f53',
      fontSizePt: 16,
    });
    expect(headingOnlyBody?.fontFamily).toBe('Times New Roman');
  });

  it('preserves the original top-level body order when rebuilding a document with tables', async () => {
    const fixture = await createDocxFixture({
      documentBlocks: [
        { type: 'paragraph', paragraph: { text: 'Before table paragraph' } },
        {
          type: 'table',
          table: {
            rows: [
              {
                cells: [
                  { paragraphs: [{ text: 'Inside table paragraph' }] },
                ],
              },
            ],
          },
        },
        { type: 'paragraph', paragraph: { text: 'After table paragraph' } },
      ],
    });
    cleanupTasks.push(fixture.cleanup);

    const parsedBeforeFix = await parseDocxFile(fixture.filePath);
    const repaired = await createFixedDocumentDownload({
      filePath: fixture.filePath,
      originalFilename: 'sample.docx',
      parsedDocument: parsedBeforeFix,
      ruleConfig: defaultRuleConfig,
      fixOptions: ['references_section'],
    });

    const repairedZip = await JSZip.loadAsync(repaired.buffer);
    const documentXml = await repairedZip.file('word/document.xml')?.async('string');

    expect(documentXml).toBeDefined();
    const beforeIndex = documentXml?.indexOf('Before table paragraph') ?? -1;
    const tableIndex = documentXml?.indexOf('<w:tbl') ?? -1;
    const insideIndex = documentXml?.indexOf('Inside table paragraph') ?? -1;
    const afterIndex = documentXml?.indexOf('After table paragraph') ?? -1;

    expect(beforeIndex).toBeGreaterThan(-1);
    expect(tableIndex).toBeGreaterThan(beforeIndex);
    expect(insideIndex).toBeGreaterThan(tableIndex);
    expect(afterIndex).toBeGreaterThan(insideIndex);
  });

  it('keeps OpenXML empty elements from being serialized as empty attributes', async () => {
    const fixture = await createDocxFixture({
      paragraphs: [
        { text: 'Paragraph with drawing markup' },
      ],
    });
    cleanupTasks.push(fixture.cleanup);

    const sourceZip = await JSZip.loadAsync(await readFile(fixture.filePath));
    const sourceDocumentXml = await sourceZip.file('word/document.xml')?.async('string');
    expect(sourceDocumentXml).toBeDefined();

    const documentWithEmptyElements = sourceDocumentXml!
      .replace(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
      )
      .replace(
        '<w:sectPr>',
        '<w:sectPr><w:titlePg/>'
      )
      .replace(
        '<w:t>Paragraph with drawing markup</w:t>',
        '<w:drawing><a:noFill/><a:srcRect/></w:drawing><w:t>Paragraph with drawing markup</w:t>'
      );
    sourceZip.file('word/document.xml', documentWithEmptyElements);
    await writeFile(fixture.filePath, await sourceZip.generateAsync({ type: 'nodebuffer' }));

    const parsedBeforeFix = await parseDocxFile(fixture.filePath);
    const repaired = await createFixedDocumentDownload({
      filePath: fixture.filePath,
      originalFilename: 'sample.docx',
      parsedDocument: parsedBeforeFix,
      ruleConfig: defaultRuleConfig,
      fixOptions: ['body_format'],
    });

    const repairedZip = await JSZip.loadAsync(repaired.buffer);
    const repairedDocumentXml = await repairedZip.file('word/document.xml')?.async('string');

    expect(repairedDocumentXml).toBeDefined();
    expect(repairedDocumentXml).toContain('<w:titlePg/>');
    expect(repairedDocumentXml).toContain('<a:noFill/>');
    expect(repairedDocumentXml).toContain('<a:srcRect/>');
    expect(repairedDocumentXml).not.toMatch(/\s(?:w|a|pic|m):[A-Za-z0-9]+=""/);
  });

  it('preserves unchanged original paragraph XML when inserting repair paragraphs', async () => {
    const fixture = await createDocxFixture({
      paragraphs: [
        { text: 'Paragraph with drawing markup' },
        { text: '\u7b2c\u4e00\u7ae0 \u7eea\u8bba', styleId: 'Heading1' },
      ],
    });
    cleanupTasks.push(fixture.cleanup);

    const sourceZip = await JSZip.loadAsync(await readFile(fixture.filePath));
    const sourceDocumentXml = await sourceZip.file('word/document.xml')?.async('string');
    expect(sourceDocumentXml).toBeDefined();

    const drawingRun = '<w:r><w:drawing><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><a:noFill/><a:srcRect/></a:graphicData></a:graphic></w:drawing></w:r>';
    const documentWithDrawing = sourceDocumentXml!
      .replace(
        '<w:t>Paragraph with drawing markup</w:t>',
        `${drawingRun}<w:t>Paragraph with drawing markup</w:t>`
      );
    sourceZip.file('word/document.xml', documentWithDrawing);
    await writeFile(fixture.filePath, await sourceZip.generateAsync({ type: 'nodebuffer' }));

    const parsedBeforeFix = await parseDocxFile(fixture.filePath);
    const repaired = await createFixedDocumentDownload({
      filePath: fixture.filePath,
      originalFilename: 'sample.docx',
      parsedDocument: parsedBeforeFix,
      ruleConfig: defaultRuleConfig,
      fixOptions: ['toc'],
    });

    const repairedZip = await JSZip.loadAsync(repaired.buffer);
    const repairedDocumentXml = await repairedZip.file('word/document.xml')?.async('string');

    expect(repairedDocumentXml).toBeDefined();
    expect(repairedDocumentXml).toContain(drawingRun);
    expect(repairedDocumentXml).toContain('\u76ee\u5f55');
  });
});
