import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defaultRuleConfig } from '../src/constants/defaults.js';
import { parseDocxFile } from '../src/services/docx-parser-service.js';
import { createFixedDocumentDownload } from '../src/services/docx-fix-service.js';
import { evaluateDocumentAgainstRules } from '../src/services/rule-engine-service.js';
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

    expect(repaired.filename).toBe('sample_fixed.docx');

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'paper-checker-fixed-'));
    cleanupTasks.push(async () => rm(tempDir, { recursive: true, force: true }));

    const repairedPath = path.join(tempDir, repaired.filename);
    await writeFile(repairedPath, repaired.buffer);

    const parsedAfterFix = await parseDocxFile(repairedPath);
    const issuesAfterFix = evaluateDocumentAgainstRules(parsedAfterFix, repairRuleConfig);

    const tocTitle = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u76ee\u5f55');
    const tocEntry = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.includes('\u6458\u8981........................1'));
    const figureCaption = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u56fe2.1 \u5f85\u8865\u5145\u9898\u6ce8');
    const tableCaption = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u88683.1 \u5f85\u8865\u5145\u9898\u6ce8');
    const completionDate = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.includes('\u5b8c\u6210\u65f6\u95f4\uff1a'));
    const supervisorReview = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u6307\u5bfc\u6559\u5e08\u6307\u5bfc\u610f\u89c1\u8868');
    const reviewerReview = parsedAfterFix.paragraphs.find((paragraph) => paragraph.text.trim() === '\u8bc4\u9605\u6559\u5e08\u8bc4\u9605\u610f\u89c1\u8868');

    expect(issuesAfterFix).toHaveLength(0);
    expect(completionDate?.text).toContain('\u5b8c\u6210\u65f6\u95f4\uff1a');
    expect(tocTitle).toMatchObject({
      fontFamily: '\u9ed1\u4f53',
      fontSizePt: 18,
      alignment: 'center',
    });
    expect(tocEntry).toMatchObject({
      fontFamily: '\u5b8b\u4f53',
      fontSizePt: 12,
    });
    expect(figureCaption).toMatchObject({
      fontFamily: '\u5b8b\u4f53',
      fontSizePt: 10.5,
      alignment: 'center',
    });
    expect(tableCaption).toMatchObject({
      fontFamily: '\u5b8b\u4f53',
      fontSizePt: 10.5,
      alignment: 'center',
    });
    expect(supervisorReview).toMatchObject({
      fontFamily: '\u9ed1\u4f53',
      fontSizePt: 18,
      alignment: 'center',
    });
    expect(reviewerReview).toMatchObject({
      fontFamily: '\u9ed1\u4f53',
      fontSizePt: 18,
      alignment: 'center',
    });
  });
});
