import { expect, test } from '@playwright/test';
import { registerTestUser, seedPersistedAppState } from './helpers/auth';

test("does not restore another user's local check context after switching accounts", async ({ page, request }) => {
  const firstUser = await registerTestUser(request);
  const secondUser = await registerTestUser(request);

  await seedPersistedAppState(page, {
    authToken: secondUser.session.token,
    currentUser: secondUser.session.user,
    contextByUser: {
      [firstUser.session.user.id]: {
        currentPaper: {
          id: 'paper_stale',
          ownerId: firstUser.session.user.id,
          filename: 'stale-user-one-paper.docx',
          size: 1024,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          storagePath: 'uploads/stale-user-one-paper.docx',
          uploadStatus: 'success',
          createdAt: new Date().toISOString(),
        },
        currentResult: {
          id: 'check_stale',
          userId: firstUser.session.user.id,
          paperId: 'paper_stale',
          templateId: 'tpl_stale',
          status: 'completed',
          totalIssues: 1,
          issues: [
            {
              id: 'issue_stale',
              category: 'other',
              location: 'Abstract section',
              currentValue: 'stale',
              expectedValue: 'fresh',
              reason: 'stale result',
              suggestion: 'ignore',
              severity: 'low',
            },
          ],
          createdAt: new Date().toISOString(),
        },
      },
    },
  });

  await page.goto('/check');

  await expect(page.getByTestId('page-check')).toBeVisible();
  await expect(page.getByText(/Click or drag a file here to upload|点击或将文件拖到这里上传/)).toBeVisible();
  await expect(page.getByText('stale-user-one-paper.docx')).toHaveCount(0);
  await expect(page.getByText(/已从本地恢复最近一次工作上下文|Restored the latest local working context/)).toHaveCount(0);

  await page.goto('/result');

  await expect(page.getByTestId('page-result')).toBeVisible();
  await expect(page.getByTestId('empty-result-state')).toBeVisible();
});
