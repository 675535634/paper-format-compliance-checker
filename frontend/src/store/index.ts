import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthUser, RuleTemplate, CheckResult, UploadedPaper } from '../types';

interface UserLocalContext {
  currentPaper: UploadedPaper | null;
  currentResult: CheckResult | null;
}

interface AppState {
  templates: RuleTemplate[];
  setTemplates: (templates: RuleTemplate[]) => void;

  authToken: string | null;
  currentUser: AuthUser | null;
  contextByUser: Record<string, UserLocalContext>;
  setSession: (token: string, user: AuthUser) => void;
  clearSession: () => void;

  currentPaper: UploadedPaper | null;
  setCurrentPaper: (paper: UploadedPaper | null) => void;

  currentResult: CheckResult | null;
  setCurrentResult: (result: CheckResult | null) => void;

  hasHydrated: boolean;
  restoredPaperNoticeVisible: boolean;
  restoredResultNoticeVisible: boolean;
  dismissRestoredPaperNotice: () => void;
  dismissRestoredResultNotice: () => void;
  clearCurrentContext: () => void;
  applyHydratedContextFlags: () => void;
}

const emptyUserContext = (): UserLocalContext => ({
  currentPaper: null,
  currentResult: null,
});

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      templates: [],
      setTemplates: (templates) => set({ templates }),

      authToken: null,
      currentUser: null,
      contextByUser: {},
      setSession: (authToken, currentUser) => set((state) => {
        const restoredContext = state.contextByUser[currentUser.id] ?? emptyUserContext();
        return {
          authToken,
          currentUser,
          currentPaper: restoredContext.currentPaper,
          currentResult: restoredContext.currentResult,
          restoredPaperNoticeVisible: Boolean(restoredContext.currentPaper),
          restoredResultNoticeVisible: Boolean(restoredContext.currentResult),
        };
      }),
      clearSession: () => set({
        authToken: null,
        currentUser: null,
        currentPaper: null,
        currentResult: null,
        restoredPaperNoticeVisible: false,
        restoredResultNoticeVisible: false,
      }),

      currentPaper: null,
      setCurrentPaper: (paper) => set((state) => ({
        currentPaper: paper,
        currentResult:
          paper && state.currentResult?.paperId === paper.id
            ? state.currentResult
            : null,
        restoredPaperNoticeVisible: false,
        restoredResultNoticeVisible: false,
        contextByUser: state.currentUser
          ? {
              ...state.contextByUser,
              [state.currentUser.id]: {
                currentPaper: paper,
                currentResult:
                  paper && state.currentResult?.paperId === paper.id
                    ? state.currentResult
                    : null,
              },
            }
          : state.contextByUser,
      })),

      currentResult: null,
      setCurrentResult: (result) => set((state) => ({
        currentResult: result,
        restoredResultNoticeVisible: false,
        contextByUser: state.currentUser
          ? {
              ...state.contextByUser,
              [state.currentUser.id]: {
                currentPaper: state.currentPaper,
                currentResult: result,
              },
            }
          : state.contextByUser,
      })),

      hasHydrated: false,
      restoredPaperNoticeVisible: false,
      restoredResultNoticeVisible: false,
      dismissRestoredPaperNotice: () => set({ restoredPaperNoticeVisible: false }),
      dismissRestoredResultNotice: () => set({ restoredResultNoticeVisible: false }),
      clearCurrentContext: () => set((state) => ({
        currentPaper: null,
        currentResult: null,
        restoredPaperNoticeVisible: false,
        restoredResultNoticeVisible: false,
        contextByUser: state.currentUser
          ? {
              ...state.contextByUser,
              [state.currentUser.id]: emptyUserContext(),
            }
          : state.contextByUser,
      })),
      applyHydratedContextFlags: () => set((state) => {
        const restoredContext = state.currentUser
          ? state.contextByUser[state.currentUser.id] ?? emptyUserContext()
          : emptyUserContext();

        return {
          hasHydrated: true,
          currentPaper: restoredContext.currentPaper,
          currentResult: restoredContext.currentResult,
          restoredPaperNoticeVisible: Boolean(restoredContext.currentPaper),
          restoredResultNoticeVisible: Boolean(restoredContext.currentResult),
        };
      }),
    }),
    {
      name: 'paper-format-compliance-checker-app',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        authToken: state.authToken,
        currentUser: state.currentUser,
        contextByUser: state.contextByUser,
      }),
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Partial<AppState> & {
          currentPaper?: UploadedPaper | null;
          currentResult?: CheckResult | null;
        };

        if ((version ?? 0) < 1) {
          return {
            ...state,
            contextByUser: state.currentUser?.id
              ? {
                  [state.currentUser.id]: {
                    currentPaper: state.currentPaper ?? null,
                    currentResult: state.currentResult ?? null,
                  },
                }
              : {},
          };
        }

        return state;
      },
      onRehydrateStorage: () => (state) => {
        state?.applyHydratedContextFlags();
      },
    },
  ),
);
