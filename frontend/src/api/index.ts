
import axios from 'axios';
import type {
  AuthSession,
  AuthUser,
  DashboardStats,
  PublicTemplateListResult,
  PublicTemplateSummary,
  RuleTemplate,
  CheckResult,
  UploadedPaper,
} from '../types';
import { useAppStore } from '../store';

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

apiClient.interceptors.request.use((config) => {
  const token = useAppStore.getState().authToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
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
  register: async (payload: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }): Promise<AuthSession> => {
    const { data } = await apiClient.post<AuthSession>('/auth/register', payload);
    return data;
  },

  login: async (payload: {
    identifier: string;
    password: string;
  }): Promise<AuthSession> => {
    const { data } = await apiClient.post<AuthSession>('/auth/login', payload);
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getCurrentUser: async (): Promise<AuthUser> => {
    const { data } = await apiClient.get<AuthUser>('/auth/me');
    return data;
  },

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

  updateTemplateVisibility: async (id: string, visibility: 'private' | 'public'): Promise<RuleTemplate> => {
    const { data } = await apiClient.patch<RuleTemplate>(`/templates/${id}/visibility`, { visibility });
    return data;
  },

  getPublicTemplates: async (params: {
    page: number;
    pageSize: number;
    query?: string;
    sort?: 'latest' | 'hottest' | 'favorites' | 'uses';
  }): Promise<PublicTemplateListResult> => {
    const { data } = await apiClient.get<PublicTemplateListResult>('/public-templates', { params });
    return data;
  },

  getPublicTemplate: async (id: string): Promise<PublicTemplateSummary> => {
    const { data } = await apiClient.get<PublicTemplateSummary>(`/public-templates/${id}`);
    return data;
  },

  favoritePublicTemplate: async (id: string): Promise<PublicTemplateSummary> => {
    const { data } = await apiClient.post<PublicTemplateSummary>(`/public-templates/${id}/favorite`);
    return data;
  },

  unfavoritePublicTemplate: async (id: string): Promise<PublicTemplateSummary> => {
    const { data } = await apiClient.delete<PublicTemplateSummary>(`/public-templates/${id}/favorite`);
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
