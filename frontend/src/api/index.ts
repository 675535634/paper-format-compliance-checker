
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

interface DownloadResponse {
  blob: Blob;
  filename: string;
}

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

const extractFilename = (contentDisposition: string | undefined, fallback: string): string => {
  if (!contentDisposition) {
    return fallback;
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const asciiMatch = contentDisposition.match(/filename="([^"]+)"/i);
  return asciiMatch?.[1] ?? fallback;
};

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

  getTemplate: async (id: string): Promise<RuleTemplate> => {
    const { data } = await apiClient.get<RuleTemplate>(`/templates/${id}`);
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

  copyTemplate: async (id: string): Promise<RuleTemplate> => {
    const { data } = await apiClient.post<RuleTemplate>(`/templates/${id}/copy`);
    return data;
  },

  applyTemplate: async (id: string): Promise<RuleTemplate> => {
    const { data } = await apiClient.post<RuleTemplate>(`/templates/${id}/apply`);
    return data;
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

  downloadCheckDebugLog: async (checkId: string): Promise<DownloadResponse> => {
    const response = await apiClient.get<Blob>(`/checks/${checkId}/debug-log`, {
      responseType: 'blob',
    });

    return {
      blob: response.data,
      filename: extractFilename(response.headers['content-disposition'], `${checkId}.debug.json`),
    };
  },

  downloadFixedDocx: async (checkId: string): Promise<DownloadResponse> => {
    const response = await apiClient.get<Blob>(`/checks/${checkId}/fix-download`, {
      responseType: 'blob',
      timeout: 120000,
    });

    return {
      blob: response.data,
      filename: extractFilename(response.headers['content-disposition'], `${checkId}.fixed.docx`),
    };
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
