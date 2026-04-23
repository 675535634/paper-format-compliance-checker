import { describe, expect, it } from 'vitest';
import { normalizeUploadedFilename } from '../src/services/file-service.js';

describe('normalizeUploadedFilename', () => {
  it('repairs mojibake chinese filenames from multipart uploads', () => {
    expect(normalizeUploadedFilename('313K24241003_èä¸°å_åºäºVue3ä¸Nodejsçæºæ§æ ¡å­ä¿¡æ¯å¹³å°è®¾è®¡ä¸å®ç°_V7.docx'))
      .toBe('313K24241003_蒙丰华_基于Vue3与Nodejs的智慧校园信息平台设计与实现_V7.docx');
  });

  it('keeps already-correct filenames unchanged', () => {
    expect(normalizeUploadedFilename('paper-sample.docx')).toBe('paper-sample.docx');
    expect(normalizeUploadedFilename('蒙丰华_论文.docx')).toBe('蒙丰华_论文.docx');
  });
});
