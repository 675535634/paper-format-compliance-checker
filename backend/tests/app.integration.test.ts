import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocxFixture } from './helpers/docx-fixture.js';

const registerAndGetToken = async (app: ReturnType<typeof import('../src/app.js')['createApp']>) => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'tester',
      email: 'tester@example.com',
      password: 'secret123',
      displayName: 'Test User',
    });

  expect(response.status).toBe(201);
  return response.body.token as string;
};

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

  it('serves auth-protected template CRUD using isolated storage', async () => {
    const { ensureStorage } = await import('../src/storage/database.js');
    await ensureStorage();
    const { createApp } = await import('../src/app.js');
    const app = createApp();

    const healthResponse = await request(app).get('/api/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body.status).toBe('ok');

    const unauthenticatedResponse = await request(app).get('/api/templates');
    expect(unauthenticatedResponse.status).toBe(401);

    const token = await registerAndGetToken(app);

    const listResponse = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${token}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(2);
    expect(listResponse.body[0].ownerId).not.toBe('user_system_seed');

    const createResponse = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Integration Template',
        description: 'Created during integration testing.',
        visibility: 'public',
        config: {
          pageSize: 'A4',
          margin: 'Top 2.5cm, Bottom 2.5cm, Left 3cm, Right 2.5cm',
          bodyFont: 'Times New Roman',
          bodyFontSize: '12pt',
          lineHeight: '1.5',
          paragraphSpacing: 'Before 0pt, After 0pt',
          firstLineIndent: '2 chars',
          headingFormats: 'Level 1: SimHei No. 3',
          pageNumberRule: 'Bottom center Arabic numerals',
          abstractFormat: 'Title bold with 12pt body text',
          keywordFormat: 'Keywords line should be present',
          referenceFormat: 'GB/T 7714-2015',
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.name).toBe('Integration Template');
    expect(createResponse.body.visibility).toBe('public');

    const nextListResponse = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${token}`);
    expect(nextListResponse.status).toBe(200);
    expect(nextListResponse.body).toHaveLength(3);

    const publicGalleryResponse = await request(app)
      .get('/api/public-templates')
      .set('Authorization', `Bearer ${token}`);
    expect(publicGalleryResponse.status).toBe(200);
    expect(publicGalleryResponse.body.items.some((item: { name: string }) => item.name === 'Integration Template')).toBe(true);
  });

  it('returns validation errors for malformed template payloads after authentication', async () => {
    const { ensureStorage } = await import('../src/storage/database.js');
    await ensureStorage();
    const { createApp } = await import('../src/app.js');
    const app = createApp();
    const token = await registerAndGetToken(app);

    const response = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Request validation failed.');
    expect(Array.isArray(response.body.issues)).toBe(true);
  });

  it('returns validation errors for malformed login payloads', async () => {
    const { ensureStorage } = await import('../src/storage/database.js');
    await ensureStorage();
    const { createApp } = await import('../src/app.js');
    const app = createApp();

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: '',
        password: '',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Request validation failed.');
    expect(Array.isArray(response.body.issues)).toBe(true);
  });

  it('allows logging in again after registering and logging out', async () => {
    const { ensureStorage } = await import('../src/storage/database.js');
    await ensureStorage();
    const { createApp } = await import('../src/app.js');
    const app = createApp();

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'relogin-user',
        email: 'TEST@qq.com',
        password: 'secret123',
        displayName: 'Relogin User',
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.email).toBe('test@qq.com');

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${registerResponse.body.token}`);
    expect(logoutResponse.status).toBe(204);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'TEST@qq.com',
        password: 'secret123',
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.email).toBe('test@qq.com');
  });

  it('rejects invalid or temporary docx uploads before creating a check task', async () => {
    const { ensureStorage } = await import('../src/storage/database.js');
    await ensureStorage();
    const { createApp } = await import('../src/app.js');
    const app = createApp();
    const token = await registerAndGetToken(app);

    const temporaryFileResponse = await request(app)
      .post('/api/files/upload-docx')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not-a-real-docx'), {
        filename: '~$paper.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(temporaryFileResponse.status).toBe(400);
    expect(temporaryFileResponse.body.message).toContain('~$');

    const corruptedDocxResponse = await request(app)
      .post('/api/files/upload-docx')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not-a-real-docx'), {
        filename: 'paper.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(corruptedDocxResponse.status).toBe(400);
    expect(corruptedDocxResponse.body.message).toContain('invalid or corrupted');
  });

  it('downloads a repaired docx for a completed check', async () => {
    const { ensureStorage } = await import('../src/storage/database.js');
    await ensureStorage();
    const { createApp } = await import('../src/app.js');
    const app = createApp();
    const token = await registerAndGetToken(app);

    const fixture = await createDocxFixture({
      paragraphs: [
        { text: '论文题目：测试论文' },
        { text: '摘要' },
        { text: '这是一段用于修复导出测试的摘要正文。' },
        { text: '关键词 测试；导出' },
      ],
    });

    try {
      const uploadResponse = await request(app)
        .post('/api/files/upload-docx')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', fixture.filePath);

      expect(uploadResponse.status).toBe(201);

      const templatesResponse = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${token}`);

      expect(templatesResponse.status).toBe(200);
      expect(templatesResponse.body.length).toBeGreaterThan(0);

      const checkResponse = await request(app)
        .post('/api/checks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fileId: uploadResponse.body.id,
          templateId: templatesResponse.body[0].id,
        });

      expect(checkResponse.status).toBe(201);
      expect(checkResponse.body.status).toBe('completed');

      const fixResponse = await request(app)
        .get(`/api/checks/${checkResponse.body.id}/fix-download`)
        .set('Authorization', `Bearer ${token}`);

      expect(fixResponse.status).toBe(200);
      expect(fixResponse.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(fixResponse.headers['content-disposition']).toContain('_fixed.docx');
      expect(Number.parseInt(fixResponse.headers['content-length'] ?? '0', 10)).toBeGreaterThan(0);
    } finally {
      await fixture.cleanup();
    }
  });
});
