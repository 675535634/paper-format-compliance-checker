export type IssueCategory = 'page' | 'body' | 'heading' | 'reference' | 'other';
export type Severity = 'high' | 'medium' | 'low';
export type UploadStatus = 'uploading' | 'success' | 'error';
export type CheckStatus = 'pending' | 'checking' | 'completed' | 'failed';
export type TemplateVisibility = 'private' | 'public';
export const fixOptionValues = [
  'page_layout',
  'header_footer',
  'body_format',
  'heading_format',
  'abstract_keywords',
  'toc',
  'captions',
  'cover_fields',
  'required_sections',
  'references_section',
] as const;
export type FixOption = typeof fixOptionValues[number];

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
  tocRule?: string;
}

export interface RuleTemplate {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  config: PaperRuleConfig;
  updatedAt: string;
  isDefault: boolean;
  visibility: TemplateVisibility;
  publishedAt?: string;
  favoriteCount: number;
  viewCount: number;
  useCount: number;
  hotScore: number;
}

export interface UploadedFileRecord {
  id: string;
  ownerId: string;
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

export type RecognizedContentSection =
  | 'body'
  | 'heading'
  | 'header'
  | 'footer'
  | 'toc'
  | 'abstract'
  | 'keywords'
  | 'references'
  | 'acknowledgement'
  | 'originality_statement'
  | 'appendix';

export interface RecognizedContentItem extends ParsedParagraph {
  id: string;
  section: RecognizedContentSection;
  displayHeadingLevel?: number;
}

export interface CheckTask {
  id: string;
  userId: string;
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
  userId: string;
  paperId: string;
  templateId: string;
  status: CheckStatus;
  totalIssues: number;
  issues: CheckIssue[];
  recognizedContents: RecognizedContentItem[];
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
  userId: string;
  paperId: string;
  templateId: string;
  status: CheckStatus;
  totalIssues: number;
  issues: CheckIssue[];
  recognizedContents?: RecognizedContentItem[];
  createdAt: string;
}

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}

export interface TemplateFavoriteRecord {
  id: string;
  userId: string;
  templateId: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

export interface PublicTemplateSummary extends RuleTemplate {
  ownerDisplayName: string;
  isFavorited: boolean;
}

export interface PublicTemplateListResult {
  items: PublicTemplateSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DatabaseState {
  users: UserRecord[];
  authTokens: AuthTokenRecord[];
  uploadedFiles: UploadedFileRecord[];
  templates: RuleTemplate[];
  templateFavorites: TemplateFavoriteRecord[];
  checks: CheckTask[];
  results: StoredCheckResult[];
}

export interface ParsedParagraph {
  index: number;
  text: string;
  pageNumber?: number;
  styleId?: string;
  styleName?: string;
  headingLevel?: number;
  hasPageBreakAfter?: boolean;
  isInTable?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'both' | 'justify' | 'distribute';
  fontFamily?: string;
  fontFamilies?: string[];
  fontSizePt?: number;
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  underlineStyle?: string;
  lineHeight?: number;
  lineHeightMode?: 'multiple' | 'points';
  spacingBeforePt?: number;
  spacingAfterPt?: number;
  firstLineChars?: number;
  leftIndentChars?: number;
  rightIndentChars?: number;
  hangingIndentChars?: number;
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
  headerTexts: string[];
  headerParagraphs?: ParsedParagraph[];
  footerTexts?: string[];
  footerParagraphs?: ParsedParagraph[];
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
