import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('loads the main application shell and redirects to dashboard', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('page-dashboard')).toBeVisible();
});

test('opens the paper check page', async ({ page }) => {
  await page.goto('/check');

  await expect(page.getByTestId('page-check')).toBeVisible();
  await expect(page.getByTestId('start-check-button')).toBeVisible();
});

test('opens the rule editor page', async ({ page }) => {
  await page.goto('/rules');

  await expect(page.getByTestId('page-rules')).toBeVisible();
  await expect(page.locator('form').first()).toBeVisible();
});

test('opens the template management page', async ({ page }) => {
  await page.goto('/templates');

  await expect(page.getByTestId('page-templates')).toBeVisible();
  await expect(page.getByTestId('create-template-button')).toBeVisible();
});

test('shows the empty state on the result page without context', async ({ page }) => {
  await page.goto('/result');

  await expect(page.getByTestId('page-result')).toBeVisible();
  await expect(page.getByTestId('empty-result-state')).toBeVisible();
});
