import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const backendApiBase = 'http://127.0.0.1:16667/api';
const storageKey = 'paper-format-compliance-checker-app';

type AuthSession = {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    createdAt: string;
  };
  expiresAt: string;
};

export const seedPersistedAppState = async (page: Page, payload: {
  authToken: string | null;
  currentUser: AuthSession['user'] | null;
  contextByUser?: Record<string, { currentPaper: unknown; currentResult: unknown }>;
}): Promise<void> => {
  await page.addInitScript((state: typeof payload & { storageKey: string }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(state.storageKey, JSON.stringify({
      state: {
        authToken: state.authToken,
        currentUser: state.currentUser,
        contextByUser: state.contextByUser ?? {},
      },
      version: 1,
    }));
  }, {
    ...payload,
    storageKey,
  });
};

export const registerTestUser = async (
  request: APIRequestContext
): Promise<{
  session: AuthSession;
  authHeaders: Record<string, string>;
}> => {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await request.post(`${backendApiBase}/auth/register`, {
    data: {
      username: `playwright-${uniqueSuffix}`,
      displayName: `Playwright ${uniqueSuffix}`,
      email: `playwright-${uniqueSuffix}@example.com`,
      password: 'playwright-pass-123',
    },
  });

  expect(response.ok()).toBeTruthy();
  const session = await response.json() as AuthSession;

  return {
    session,
    authHeaders: {
      Authorization: `Bearer ${session.token}`,
    },
  };
};

export const createAuthenticatedSession = async (
  page: Page,
  request: APIRequestContext
): Promise<{
  session: AuthSession;
  authHeaders: Record<string, string>;
}> => {
  const authSession = await registerTestUser(request);

  await seedPersistedAppState(page, {
    authToken: authSession.session.token,
    currentUser: authSession.session.user,
    contextByUser: {},
  });

  return authSession;
};

export const clearBrowserStorage = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
};
