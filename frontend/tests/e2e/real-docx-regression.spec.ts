import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createAuthenticatedSession } from './helpers/auth';

const backendApiBase = 'http://127.0.0.1:16667/api';
const realDocxPath = process.env.REAL_DOCX_PATH;
const expectedTitle = '基于Vue 3与Node.js的智慧校园信息平台设计与实现';

test('reads the real thesis docx without regressing header or caption parsing', async ({ page, request }) => {
  test.setTimeout(180_000);

  expect(realDocxPath, 'REAL_DOCX_PATH must be provided for the real-docx regression test.').toBeTruthy();
  const expectedFilename = path.basename(realDocxPath!);
  const { authHeaders } = await createAuthenticatedSession(page, request);

  const templatesResponse = await request.get(`${backendApiBase}/templates`, {
    headers: authHeaders,
  });
  expect(templatesResponse.ok()).toBeTruthy();
  const templates = await templatesResponse.json() as Array<{ id: string; isDefault: boolean }>;
  const defaultTemplate = templates.find((template) => template.isDefault) ?? templates[0];
  expect(defaultTemplate?.id).toBeTruthy();

  await page.goto(`/check?templateId=${defaultTemplate.id}`);
  await expect(page.getByTestId('page-check')).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(realDocxPath!);
  await expect(page.getByText(expectedFilename).first()).toBeVisible();
  await expect(page.getByTestId('start-check-button')).toBeEnabled();

  await page.getByTestId('start-check-button').click();
  await expect(page).toHaveURL(/\/result\/.+$/, { timeout: 120_000 });
  await expect(page.getByTestId('page-result')).toBeVisible();

  const checkId = page.url().split('/result/')[1]?.split('?')[0];
  expect(checkId).toBeTruthy();

  const checkResponse = await request.get(`${backendApiBase}/checks/${checkId}`, {
    headers: authHeaders,
  });
  expect(checkResponse.ok()).toBeTruthy();
  const check = await checkResponse.json() as { paperId: string };

  const paperResponse = await request.get(`${backendApiBase}/files/${check.paperId}`, {
    headers: authHeaders,
  });
  expect(paperResponse.ok()).toBeTruthy();
  const uploadedPaper = await paperResponse.json() as { filename: string };
  expect(uploadedPaper.filename).toBe(expectedFilename);

  const resultResponse = await request.get(`${backendApiBase}/checks/${checkId}/result`, {
    headers: authHeaders,
  });
  expect(resultResponse.ok()).toBeTruthy();
  const result = await resultResponse.json() as {
    issues: Array<{ location: string; currentValue: string; reason: string }>;
  };

  const debugLogResponse = await request.get(`${backendApiBase}/checks/${checkId}/debug-log`, {
    headers: authHeaders,
  });
  expect(debugLogResponse.ok()).toBeTruthy();
  const debugLog = JSON.parse(await debugLogResponse.text()) as {
    readSummary: {
      sectionSignals: {
        abstractDetected: boolean;
      };
    };
    paragraphPreview: Array<{ text: string }>;
  };

  expect(debugLog.readSummary.sectionSignals.abstractDetected).toBe(true);
  expect(debugLog.paragraphPreview.some((paragraph) => paragraph.text.includes(expectedTitle))).toBe(true);
  expect(result.issues.some((issue) => issue.reason.includes('school header text'))).toBe(false);
  expect(result.issues.some((issue) => issue.reason.includes('figure caption does not match'))).toBe(false);
  expect(result.issues.some((issue) => issue.reason.includes('table caption does not match'))).toBe(false);
  expect(result.issues.some((issue) => issue.reason.includes('matching figure caption'))).toBe(false);
  const missingTableCaptionIssues = result.issues.filter((issue) =>
    issue.reason.includes('matching table caption')
  );
  expect(missingTableCaptionIssues.length).toBeLessThanOrEqual(1);
  expect(missingTableCaptionIssues.every((issue) => issue.currentValue === '表5-1')).toBe(true);
  expect(result.issues.some((issue) => issue.currentValue === '表5')).toBe(false);
});
