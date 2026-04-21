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
  it('extracts page layout, page numbers, and numbering metadata from a fixture docx', async () => {
    const fixture = await createDocxFixture({
      includeFooterPageNumber: true,
      footerAlignment: 'center',
      numbering: [
        { numId: '10', abstractNumId: '100', format: 'decimal', levelText: '%1.' },
      ],
      paragraphs: [
        { text: 'Abstract', styleId: 'Heading1' },
        {
          text: 'Keywords: parser, numbering',
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
    expect(parsed.hasPageNumberField).toBe(true);
    expect(parsed.pageNumberAlignment).toBe('center');
    expect(parsed.paragraphs[0]?.headingLevel).toBe(1);
    expect(parsed.paragraphs[2]?.numbering).toMatchObject({
      numId: '10',
      level: 0,
      format: 'decimal',
      isOrdered: true,
    });
  });
});
