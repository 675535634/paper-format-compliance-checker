import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RuleTemplate, CheckResult, UploadedPaper } from '../types';

interface AppState {
  templates: RuleTemplate[];
  setTemplates: (templates: RuleTemplate[]) => void;

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

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      templates: [],
      setTemplates: (templates) => set({ templates }),

      currentPaper: null,
      setCurrentPaper: (paper) => set((state) => ({
        currentPaper: paper,
        currentResult:
          paper && state.currentResult?.paperId === paper.id
            ? state.currentResult
            : null,
        restoredPaperNoticeVisible: false,
        restoredResultNoticeVisible: false,
      })),

      currentResult: null,
      setCurrentResult: (result) => set({
        currentResult: result,
        restoredResultNoticeVisible: false,
      }),

      hasHydrated: false,
      restoredPaperNoticeVisible: false,
      restoredResultNoticeVisible: false,
      dismissRestoredPaperNotice: () => set({ restoredPaperNoticeVisible: false }),
      dismissRestoredResultNotice: () => set({ restoredResultNoticeVisible: false }),
      clearCurrentContext: () => set({
        currentPaper: null,
        currentResult: null,
        restoredPaperNoticeVisible: false,
        restoredResultNoticeVisible: false,
      }),
      applyHydratedContextFlags: () => set((state) => ({
        hasHydrated: true,
        restoredPaperNoticeVisible: Boolean(state.currentPaper),
        restoredResultNoticeVisible: Boolean(state.currentResult),
      })),
    }),
    {
      name: 'paper-format-compliance-checker-app',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentPaper: state.currentPaper,
        currentResult: state.currentResult,
      }),
      onRehydrateStorage: () => (state) => {
        state?.applyHydratedContextFlags();
      },
    },
  ),
);
