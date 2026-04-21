import { create } from 'zustand';
import type { RuleTemplate, CheckResult, UploadedPaper } from '../types';

interface AppState {
  templates: RuleTemplate[];
  setTemplates: (templates: RuleTemplate[]) => void;
  
  currentPaper: UploadedPaper | null;
  setCurrentPaper: (paper: UploadedPaper | null) => void;
  
  currentResult: CheckResult | null;
  setCurrentResult: (result: CheckResult | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  templates: [],
  setTemplates: (templates) => set({ templates }),
  
  currentPaper: null,
  setCurrentPaper: (paper) => set({ currentPaper: paper }),
  
  currentResult: null,
  setCurrentResult: (result) => set({ currentResult: result })
}));
