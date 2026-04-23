import { expect, test } from '@playwright/test';
import { createAuthenticatedSession } from './helpers/auth';

const backendApiBase = 'http://127.0.0.1:16667/api';

test('creates a template and applies it to the check page', async ({ page, request }) => {
  const templateName = `Playwright 模板 ${Date.now()}`;
  const templateDescription = 'Playwright happy path 自动创建';
  const { authHeaders } = await createAuthenticatedSession(page, request);

  try {
    await page.goto('/rules');

    await expect(page.getByTestId('page-rules')).toBeVisible();
    await page.getByTestId('template-name-input').fill(templateName);
    await page.getByTestId('template-description-input').fill(templateDescription);
    await page.getByTestId('save-template-button').click();

    await expect(page).toHaveURL(/\/templates$/);
    await expect(page.getByTestId('page-templates')).toBeVisible();

    const templateRow = page.locator('tr').filter({ hasText: templateName });
    await expect(templateRow).toBeVisible();
    await expect(templateRow).toContainText(templateDescription);

    await templateRow.getByRole('button', { name: /使用|Use/ }).click();

    await expect(page).toHaveURL(/\/check\?templateId=/);
    await expect(page.getByTestId('page-check')).toBeVisible();
    await expect(page.getByTestId('template-select')).toContainText(templateName);
    await expect(page.getByTestId('start-check-button')).toBeDisabled();
  } finally {
    const response = await request.get(`${backendApiBase}/templates`, { headers: authHeaders });
    if (response.ok()) {
      const templates = await response.json() as Array<{ id: string; name: string }>;
      const createdTemplate = templates.find((template) => template.name === templateName);
      if (createdTemplate) {
        await request.delete(`${backendApiBase}/templates/${createdTemplate.id}`, {
          headers: authHeaders,
        });
      }
    }
  }
});
