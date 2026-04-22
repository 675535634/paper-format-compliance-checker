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
      ruleConfig: {
        ...defaultRuleConfig,
        headingFormats: 'Level 1: 黑体 小二',
      },
    });

    expect(repaired.filename).toBe('sample_fixed.docx');

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'paper-checker-fixed-'));
    cleanupTasks.push(async () => rm(tempDir, { recursive: true, force: true }));

    const repairedPath = path.join(tempDir, repaired.filename);
    await writeFile(repairedPath, repaired.buffer);

    const parsedAfterFix = await parseDocxFile(repairedPath);
    const issuesAfterFix = evaluateDocumentAgainstRules(parsedAfterFix, {
      ...defaultRuleConfig,
      headingFormats: 'Level 1: 黑体 小二',
    });

    expect(issuesAfterFix).toHaveLength(0);
  });
});
