
import axios from 'axios';
import type { DashboardStats, RuleTemplate, CheckResult, UploadedPaper } from '../types';

interface CheckTaskResponse {
  id: string;
  paperId: string;
  templateId: string;
  status: 'pending' | 'checking' | 'completed' | 'failed';
  createdAt: string;
}

export interface RecentCheckItem {
  id: string;
  name: string;
  time: string;
  status: 'pending' | 'checking' | 'completed' | 'failed';
  issues: number;
}

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const api = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    const { data } = await apiClient.get<DashboardStats>('/dashboard/stats');
    return data;
  },

  getRecentChecks: async (): Promise<RecentCheckItem[]> => {
    const { data } = await apiClient.get<RecentCheckItem[]>('/dashboard/recent-checks');
    return data;
  },
  
  getTemplates: async (): Promise<RuleTemplate[]> => {
    const { data } = await apiClient.get<RuleTemplate[]>('/templates');
    return data;
  },
  
  saveTemplate: async (template: Partial<RuleTemplate>): Promise<RuleTemplate> => {
    if (template.id) {
      const { data } = await apiClient.put<RuleTemplate>(`/templates/${template.id}`, template);
      return data;
    }

    const { data } = await apiClient.post<RuleTemplate>('/templates', template);
    return data;
  },
  
  deleteTemplate: async (id: string): Promise<void> => {
    await apiClient.delete(`/templates/${id}`);
  },
  
  uploadPaper: async (file: File): Promise<UploadedPaper> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<UploadedPaper>('/files/upload-docx', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return data;
  },
  
  checkPaperFormat: async (paperId: string, templateId: string): Promise<CheckResult> => {
    const { data: check } = await apiClient.post<CheckTaskResponse>('/checks', {
      fileId: paperId,
      templateId,
    });

    const { data: result } = await apiClient.get<CheckResult>(`/checks/${check.id}/result`);
    return result;
  },

  getCheckResult: async (checkId: string): Promise<CheckResult> => {
    const { data } = await apiClient.get<CheckResult>(`/checks/${checkId}/result`);
    return data;
  },

  getCheck: async (checkId: string): Promise<CheckTaskResponse> => {
    const { data } = await apiClient.get<CheckTaskResponse>(`/checks/${checkId}`);
    return data;
  },

  getUploadedPaper: async (paperId: string): Promise<UploadedPaper> => {
    const { data } = await apiClient.get<UploadedPaper>(`/files/${paperId}`);
    return data;
  }
};
