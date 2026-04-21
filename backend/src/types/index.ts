export type IssueCategory = 'page' | 'body' | 'heading' | 'reference' | 'other';
export type Severity = 'high' | 'medium' | 'low';
export type UploadStatus = 'uploading' | 'success' | 'error';
export type CheckStatus = 'pending' | 'checking' | 'completed' | 'failed';

export interface PaperRuleConfig {
  pageSize: string;
  margin: string;
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
}

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  config: PaperRuleConfig;
  updatedAt: string;
  isDefault: boolean;
}

export interface UploadedFileRecord {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  storagePath: string;
  uploadStatus: UploadStatus;
  createdAt: string;
  url?: string;
}

export interface CheckIssue {
  id: string;
  category: IssueCategory;
  location: string;
  currentValue: string;
  expectedValue: string;
  reason: string;
  suggestion: string;
  severity: Severity;
}

export interface CheckTask {
  id: string;
  paperId: string;
  templateId: string;
  status: CheckStatus;
  totalIssues: number;
  summaryErrorCount: number;
  summaryWarningCount: number;
  summaryInfoCount: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface CheckResult {
  id: string;
  paperId: string;
  templateId: string;
  status: CheckStatus;
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

export interface RecentCheckItem {
  id: string;
  name: string;
  time: string;
  status: CheckStatus;
  issues: number;
}

export interface StoredCheckResult {
  id: string;
  checkId: string;
  paperId: string;
  templateId: string;
  status: CheckStatus;
  totalIssues: number;
  issues: CheckIssue[];
  createdAt: string;
}

export interface DatabaseState {
  uploadedFiles: UploadedFileRecord[];
  templates: RuleTemplate[];
  checks: CheckTask[];
  results: StoredCheckResult[];
}

export interface ParsedParagraph {
  index: number;
  text: string;
  styleId?: string;
  styleName?: string;
  headingLevel?: number;
  fontFamily?: string;
  fontSizePt?: number;
  lineHeight?: number;
  lineHeightMode?: 'multiple' | 'points';
  spacingBeforePt?: number;
  spacingAfterPt?: number;
  firstLineChars?: number;
  numbering?: {
    numId?: string;
    level?: number;
    format?: string;
    levelText?: string;
    isOrdered: boolean;
  };
}

export interface ParsedDocxModel {
  paragraphCount: number;
  paragraphs: ParsedParagraph[];
  pageSize?: {
    widthCm: number;
    heightCm: number;
    label: string;
  };
  marginsCm?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  defaultFontFamily?: string;
  defaultFontSizePt?: number;
  hasPageNumberField: boolean;
  pageNumberAlignment?: string;
}
