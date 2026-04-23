import { expect, test } from '@playwright/test';
import { clearBrowserStorage, createAuthenticatedSession } from './helpers/auth';

test('redirects unauthenticated users to the auth page', async ({ page }) => {
  await clearBrowserStorage(page);

  await page.goto('/');

  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByText(/论文格式合规检查器|Paper Format Checker/)).toBeVisible();
});

test('loads the dashboard for an authenticated user', async ({ page, request }) => {
  await createAuthenticatedSession(page, request);

  await page.goto('/');

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('page-dashboard')).toBeVisible();
});

test('switches the interface language to English after sign-in', async ({ page, request }) => {
  await createAuthenticatedSession(page, request);

  await page.goto('/dashboard');

  await page.getByTestId('language-switcher').click();
  await page.getByTitle('English').click();

  await expect(page.getByText('Paper Format Compliance Checker')).toBeVisible();
  await expect(page.getByText('Dashboard')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent Checks' })).toBeVisible();
});

test('opens the paper check page after sign-in', async ({ page, request }) => {
  await createAuthenticatedSession(page, request);

  await page.goto('/check');

  await expect(page.getByTestId('page-check')).toBeVisible();
  await expect(page.getByTestId('start-check-button')).toBeVisible();
});

test('opens the rule editor page after sign-in', async ({ page, request }) => {
  await createAuthenticatedSession(page, request);

  await page.goto('/rules');

  await expect(page.getByTestId('page-rules')).toBeVisible();
  await expect(page.locator('form').first()).toBeVisible();
});

test('opens the template management page after sign-in', async ({ page, request }) => {
  await createAuthenticatedSession(page, request);

  await page.goto('/templates');

  await expect(page.getByTestId('page-templates')).toBeVisible();
  await expect(page.getByRole('button', { name: /新建模板|New Template/ })).toBeVisible();
});

test('shows the empty state on the result page when no check context exists', async ({ page, request }) => {
  await createAuthenticatedSession(page, request);

  await page.goto('/result');

  await expect(page.getByTestId('page-result')).toBeVisible();
  await expect(page.getByTestId('empty-result-state')).toBeVisible();
});
