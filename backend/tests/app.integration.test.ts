import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('backend app integration', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'paper-checker-app-'));
    process.env.DATA_DIR = path.join(tempRoot, 'data');
    process.env.UPLOAD_DIR = path.join(tempRoot, 'uploads');
    process.env.DATABASE_FILE = path.join(tempRoot, 'data', 'database.json');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    delete process.env.UPLOAD_DIR;
    delete process.env.DATABASE_FILE;
    vi.resetModules();
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('serves health and template CRUD using isolated storage', async () => {
    const { ensureStorage } = await import('../src/storage/database.js');
    await ensureStorage();
    const { createApp } = await import('../src/app.js');
    const app = createApp();

    const healthResponse = await request(app).get('/api/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body.status).toBe('ok');

    const listResponse = await request(app).get('/api/templates');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(2);

    const createResponse = await request(app)
      .post('/api/templates')
      .send({
        name: 'Integration Template',
        description: 'Created during integration testing.',
        config: {
          pageSize: 'A4',
          margin: 'Top 2.5cm, Bottom 2.5cm, Left 3cm, Right 2.5cm',
          bodyFont: 'Times New Roman',
          bodyFontSize: '12pt',
          lineHeight: '1.5',
          paragraphSpacing: 'Before 0pt, After 0pt',
          firstLineIndent: '2 chars',
          headingFormats: 'Level 1: 黑体 三号',
          pageNumberRule: 'Bottom center Arabic numerals',
          abstractFormat: 'Title bold with 12pt body text',
          keywordFormat: 'Keywords line should be present',
          referenceFormat: 'GB/T 7714-2015',
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.name).toBe('Integration Template');

    const nextListResponse = await request(app).get('/api/templates');
    expect(nextListResponse.status).toBe(200);
    expect(nextListResponse.body).toHaveLength(3);
  });

  it('returns validation errors for malformed template payloads', async () => {
    const { ensureStorage } = await import('../src/storage/database.js');
    await ensureStorage();
    const { createApp } = await import('../src/app.js');
    const app = createApp();

    const response = await request(app)
      .post('/api/templates')
      .send({
        name: '',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Request validation failed.');
    expect(Array.isArray(response.body.issues)).toBe(true);
  });
});
