export interface PaperRuleConfig {
  pageSize: string;
  margin: string;
  headerRule?: string;
  coverItems?: string;
  requiredSections?: string;
  bodyFont: string;
  bodyFontSize: string;
  lineHeight: number | string;
  paragraphSpacing: string;
  firstLineIndent: string;
  headingFormats: string;
  pageNumberRule: string;
  abstractFormat: string;
  keywordFormat: string;
  referenceFormat: string;
  figureCaptionRule?: string;
  tableCaptionRule?: string;
}

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  config: PaperRuleConfig;
  updatedAt: string;
  isDefault: boolean;
}

export interface UploadedPaper {
  id: string;
  filename: string;
  size: number;
  uploadStatus: 'uploading' | 'success' | 'error';
  url?: string;
}

export interface CheckIssue {
  id: string;
  category: 'page' | 'body' | 'heading' | 'reference' | 'other';
  location: string;
  currentValue: string;
  expectedValue: string;
  reason: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
}

export interface CheckResult {
  id: string;
  paperId: string;
  templateId: string;
  status: 'pending' | 'checking' | 'completed' | 'failed';
  totalIssues: number;
  issues: CheckIssue[];
  createdAt: string;
}

export interface DashboardStats {
  totalTemplates: number;
  recentCheckCount: number;
  lastCheckTime: string;
  pendingFixIssues: number;
}
