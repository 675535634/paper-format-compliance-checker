import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  App as AntdApp,
  Card,
  Result,
  Button,
  Checkbox,
  Table,
  Tag,
  Typography,
  Space,
  Select,
  Empty,
  Alert,
  Modal,
  Radio,
  Skeleton,
  Row,
  Col,
  Pagination,
  Input,
} from 'antd';
import { DownloadOutlined, ExclamationCircleOutlined, FileSearchOutlined, ToolOutlined } from '@ant-design/icons';
import { api, extractApiErrorMessage, isUnauthorizedError } from '../../api';
import { useAppStore } from '../../store';
import { useNavigate, useParams } from 'react-router-dom';
import { fixOptionValues } from '../../types';
import type { CheckIssue, FixOption, RecognizedContentItem } from '../../types';
import { useI18n } from '../../i18n';

const { Text } = Typography;
const CARD_PAGE_SIZE = 12;
type RecognizedSourceValue = RecognizedContentItem['section'];
type RecognizedStatusFilter = 'all' | 'passed' | 'issue' | 'manual';
type RecognizedHeadingLevelFilter = 'all' | 'none' | string;
const nonGeneratingFixOptions = new Set<FixOption>(['cover_fields', 'required_sections', 'references_section']);

const getCategoryMap = (isEnglish: boolean): Record<string, string> => ({
  page: isEnglish ? 'Page Setup' : '页面设置',
  body: isEnglish ? 'Body Text' : '正文格式',
  heading: isEnglish ? 'Headings' : '标题格式',
  reference: isEnglish ? 'References' : '参考文献',
  other: isEnglish ? 'Other' : '其他',
});

const getSeverityMap = (isEnglish: boolean): Record<string, { color: string; icon: ReactNode; text: string }> => ({
  high: { color: 'error', icon: <ExclamationCircleOutlined />, text: isEnglish ? 'High' : '高风险' },
  medium: { color: 'warning', icon: <ExclamationCircleOutlined />, text: isEnglish ? 'Medium' : '需关注' },
  low: { color: 'processing', icon: <ExclamationCircleOutlined />, text: isEnglish ? 'Low' : '建议调整' },
});

const getFixOptionItems = (isEnglish: boolean): Array<{
  value: FixOption;
  label: string;
  description: string;
}> => [
  {
    value: 'page_layout',
    label: isEnglish ? 'Page Layout' : '页边距与纸张',
    description: isEnglish ? 'Repair page size and margins.' : '修复纸张大小和页边距。',
  },
  {
    value: 'header_footer',
    label: isEnglish ? 'Header and Footer' : '页眉页脚',
    description: isEnglish ? 'Repair headers, footers, and page numbers.' : '修复页眉、页脚和页码。',
  },
  {
    value: 'body_format',
    label: isEnglish ? 'Body Text' : '正文格式',
    description: isEnglish ? 'Repair body text formatting.' : '修复正文排版。',
  },
  {
    value: 'heading_format',
    label: isEnglish ? 'Headings' : '标题格式',
    description: isEnglish ? 'Repair heading formatting.' : '修复标题排版。',
  },
  {
    value: 'abstract_keywords',
    label: isEnglish ? 'Abstract and Keywords' : '摘要与关键词',
    description: isEnglish ? 'Format existing abstract and keyword content only.' : '仅修复已有摘要和关键词格式，不自动补写内容。',
  },
  {
    value: 'toc',
    label: isEnglish ? 'Table of Contents' : '目录',
    description: isEnglish ? 'Insert or repair the table of contents section.' : '插入或修复目录部分。',
  },
  {
    value: 'captions',
    label: isEnglish ? 'Figure and Table Captions' : '图表题注',
    description: isEnglish ? 'Format existing figure and table captions only.' : '仅修复已有图题、表题格式，不自动补写题注。',
  },
  {
    value: 'cover_fields',
    label: isEnglish ? 'Cover Fields' : '封面字段',
    description: isEnglish ? 'Keep cover-field issues visible; missing fields are not generated.' : '保留封面字段检查提示，不自动补写字段。',
  },
  {
    value: 'required_sections',
    label: isEnglish ? 'Required Sections' : '必备章节',
    description: isEnglish ? 'Keep required-section issues visible; missing sections are not generated.' : '保留必备章节检查提示，不自动补写章节。',
  },
  {
    value: 'references_section',
    label: isEnglish ? 'References Section' : '参考文献章节',
    description: isEnglish ? 'Format detected references only; missing references are not generated.' : '仅处理已识别的参考文献，不自动生成条目。',
  },
];

const getIssueFixOptions = (issue: CheckIssue): FixOption[] => {
  const text = `${issue.location} ${issue.currentValue} ${issue.expectedValue} ${issue.reason} ${issue.suggestion}`.toLowerCase();
  const options = new Set<FixOption>();

  if (issue.category === 'page') {
    options.add('page_layout');
    if (/header|footer|page number|页眉|页脚|页码/.test(text)) {
      options.add('header_footer');
    }
  }

  if (issue.category === 'body') {
    options.add('body_format');
  }

  if (issue.category === 'heading') {
    options.add('heading_format');
  }

  if (/abstract|keyword|摘要|关键词/.test(text)) {
    options.add('abstract_keywords');
  }

  if (/table of contents|contents|toc|目录/.test(text)) {
    options.add('toc');
  }

  if (/caption|figure|table|图题|表题|图表/.test(text)) {
    options.add('captions');
  }

  return [...options];
};

const issueReasonZh: Record<string, string> = {
  'The document page size does not match the configured template.': '文档纸张大小与模板要求不一致。',
  'The document header does not contain the configured school header text.': '页眉中未检测到模板要求的学校或论文信息。',
  'The document footer does not appear to contain a page number field.': '页脚中未检测到页码字段。',
  'The page number alignment does not match the configured rule.': '页码对齐方式与模板要求不一致。',
  'A required cover-field label was not detected in the cover-page area.': '封面区域未检测到必填字段标签。',
  'The cover completion date does not appear to use the required Chinese year-month format.': '封面完成时间未使用要求的中文年月格式。',
  'A required section heading was not detected in the document.': '文档中未检测到模板要求的章节标题。',
  'The originality statement section does not appear to include signature or date prompts.': '原创性声明区域未检测到签名或日期提示。',
  'The body font does not match the rule configuration.': '正文中文字体与规则配置不一致。',
  'The body font size does not match the configured value.': '正文字号与规则配置不一致。',
  'The paragraph line spacing does not meet the template requirement.': '正文段落行距不符合模板要求。',
  'Paragraph spacing differs from the configured rule.': '正文段前段后间距与模板要求不一致。',
  'The first-line indentation does not match the configured rule.': '正文首行缩进与模板要求不一致。',
  'The parser did not find a heading paragraph for this configured level.': '未检测到该标题层级对应的标题段落。',
  'Heading font does not match the configured style.': '标题字体与模板要求不一致。',
  'Heading font size does not match the configured style.': '标题字号与模板要求不一致。',
  'Heading alignment does not match the configured style.': '标题对齐方式与模板要求不一致。',
  'Heading line spacing does not match the configured style.': '标题行距与模板要求不一致。',
  'Heading paragraph spacing does not match the configured style.': '标题段前段后间距与模板要求不一致。',
  'Heading first-line indent does not match the configured style.': '标题首行缩进与模板要求不一致。',
  'The parser did not detect an abstract heading.': '未检测到摘要标题。',
  'The abstract length does not fall within the configured range.': '摘要字数不在模板要求范围内。',
  'The parser did not detect a keywords line in the document.': '未检测到关键词行。',
  'The keywords line is missing a standard label and colon.': '关键词行缺少规范的标签或冒号。',
  'The keywords line does not use semicolon separators as configured.': '关键词未按配置使用分号分隔。',
  'The number of keywords does not match the configured range.': '关键词数量不符合模板要求范围。',
  'The parser did not detect a references section.': '未检测到参考文献章节。',
  'The document has a references heading but no reference content.': '检测到参考文献标题，但未检测到参考文献条目。',
  'The reference list does not look like a numbered standard format.': '参考文献列表不像规范的编号格式。',
  'The parser did not detect a table of contents heading.': '未检测到目录标题。',
  'The document contains a table of contents heading but no plausible TOC entries were detected.': '检测到目录标题，但未检测到有效的目录条目。',
  'The figure caption does not match the configured numbering pattern.': '图题编号格式与模板要求不一致。',
  'The document references a figure number but no matching figure caption was detected.': '正文引用了图编号，但未检测到匹配的图题。',
  'The table caption does not match the configured numbering pattern.': '表题编号格式与模板要求不一致。',
  'The document references a table number but no matching table caption was detected.': '正文引用了表编号，但未检测到匹配的表题。',
};

const issueLabelZh: Record<string, string> = {
  'Header text': '页眉文字',
  'Footer text': '页脚文字',
  'Abstract title': '摘要标题',
  'Abstract body': '摘要正文',
  'Table of contents title': '目录标题',
  'Table of contents entry': '目录条目',
  'Chapter table of contents entry': '各章目录',
  'First-level section table of contents entry': '一级节标题目录',
  'Second-level section table of contents entry': '二级节标题目录',
  'Figure caption': '图题',
  'Table caption': '表题',
  'Top margin': '上边距',
  'Bottom margin': '下边距',
  'Left margin': '左边距',
  'Right margin': '右边距',
};

const translateIssueLabel = (label: string): string => {
  const exact = issueLabelZh[label];
  if (exact) {
    return exact;
  }

  const normalized = Object.keys(issueLabelZh).find((key) => key.toLowerCase() === label.toLowerCase());
  return normalized ? issueLabelZh[normalized] : label;
};

const formatIssueLocation = (location: string, isEnglish: boolean): string => {
  if (isEnglish) {
    return location;
  }

  return location
    .replace(/^Paragraph (\d+)$/, '段落 $1')
    .replace(/^Heading level (\d+)$/, '标题层级 $1')
    .replace(/^Heading (\d+):/, '标题 $1：')
    .replace(/Paragraph (\d+)/g, '段落 $1')
    .replace(/\bHeader\b/g, '页眉')
    .replace(/\bFooter\b/g, '页脚');
};

const formatIssueReason = (reason: string, isEnglish: boolean): string => {
  if (isEnglish) {
    return reason;
  }

  const exact = issueReasonZh[reason];
  if (exact) {
    return exact;
  }

  const labelStyleMatch = reason.match(/^(.+) (font|font size|alignment|line spacing|paragraph spacing|first-line indent) does not match the configured style\.$/);
  if (labelStyleMatch) {
    const label = translateIssueLabel(labelStyleMatch[1]);
    const propertyMap: Record<string, string> = {
      font: '字体',
      'font size': '字号',
      alignment: '对齐方式',
      'line spacing': '行距',
      'paragraph spacing': '段前段后间距',
      'first-line indent': '首行缩进',
    };
    return `${label}${propertyMap[labelStyleMatch[2]] ?? '格式'}与模板要求不一致。`;
  }

  const marginMatch = reason.match(/^(.+) differs from the configured rule\.$/);
  if (marginMatch) {
    return `${translateIssueLabel(marginMatch[1])}与模板规则不一致。`;
  }

  return reason;
};

const formatIssueSuggestion = (suggestion: string, isEnglish: boolean): string => {
  if (isEnglish) {
    return suggestion;
  }

  const headerFragmentMatch = suggestion.match(/^Add the required header text fragment: (.+)\.$/);
  if (headerFragmentMatch) {
    return `补充页眉中缺少的文本片段：${headerFragmentMatch[1]}。`;
  }

  const coverFieldMatch = suggestion.match(/^Add the cover-field label [“"](.+)[”"] to the title page\.$/);
  if (coverFieldMatch) {
    return `在封面补充“${coverFieldMatch[1]}”字段。`;
  }

  const matchingCaptionMatch = suggestion.match(/^Add a matching caption for (.+)\.$/);
  if (matchingCaptionMatch) {
    return `为 ${matchingCaptionMatch[1]} 补充匹配的题注。`;
  }

  const bodyFontSizeMatch = suggestion.match(/^Set the body font size to (.+)\.$/);
  if (bodyFontSizeMatch) {
    return `将正文字号调整为 ${bodyFontSizeMatch[1]}。`;
  }

  const addSectionMatch = suggestion.match(/^Add the section [“"](.+)[”"] according to the school template\.$/);
  if (addSectionMatch) {
    return `按模板补充“${addSectionMatch[1]}”章节标题。`;
  }

  const styleSuggestionMatch = suggestion.match(/^Adjust the (.+) (font|font size|alignment|line spacing|paragraph spacing|first-line indent|bold style) to match the rule\.$/);
  if (styleSuggestionMatch) {
    const label = translateIssueLabel(styleSuggestionMatch[1]);
    const propertyMap: Record<string, string> = {
      font: '字体',
      'font size': '字号',
      alignment: '对齐方式',
      'line spacing': '行距',
      'paragraph spacing': '段前段后间距',
      'first-line indent': '首行缩进',
      'bold style': '加粗样式',
    };
    return `将${label}${propertyMap[styleSuggestionMatch[2]] ?? '格式'}调整为模板要求。`;
  }

  if (suggestion === 'Rewrite the figure caption using a format such as “图1.1 标题” or “图3-1 标题”.') {
    return '将图题改为“图1.1 标题”或“图3-1 标题”这类格式。';
  }

  if (suggestion === 'Rewrite the table caption using a format such as “表1.1 标题” or “表6-1 标题”.') {
    return '将表题改为“表1.1 标题”或“表6-1 标题”这类格式。';
  }

  const exactSuggestions: Record<string, string> = {
    'Add signature and date fields to the originality statement page.': '在原创性声明页补充签名和日期信息。',
    'Insert a page number field in the footer and match the configured alignment style.': '在页脚插入页码字段，并按模板要求设置对齐方式。',
    'Update the paragraph line spacing to the configured value.': '将段落行距调整为模板配置值。',
    'Align the paragraph spacing with the template.': '将段前段后间距调整为模板要求。',
    'Adjust the first-line indent in paragraph settings.': '在段落设置中调整首行缩进。',
    'Apply the correct heading font to this title.': '将该标题字体调整为模板要求。',
    'Adjust the heading font size to match the template.': '将标题字号调整为模板要求。',
    'Adjust the heading alignment to match the template.': '将标题对齐方式调整为模板要求。',
    'Adjust the heading line spacing to match the template.': '将标题行距调整为模板要求。',
    'Adjust the heading paragraph spacing to match the template.': '将标题段前段后间距调整为模板要求。',
    'Adjust the heading first-line indent to match the template.': '将标题首行缩进调整为模板要求。',
    'Add a clearly marked abstract section using a standard heading title.': '使用规范标题补充摘要章节。',
    'Adjust the abstract body length to fit the template requirement.': '调整摘要正文长度，使其符合模板要求。',
    'Add a keywords line after the abstract section.': '在摘要后补充关键词行。',
    'Separate keywords with semicolons.': '使用分号分隔关键词。',
    'Adjust the keyword count to fit the template requirement.': '调整关键词数量，使其符合模板要求。',
    'Add a dedicated references heading at the end of the paper.': '在论文末尾补充参考文献标题。',
    'Add the reference entries below the references heading.': '在参考文献标题下补充参考文献条目。',
    'Format the references with numbered entries that follow the configured standard.': '按配置标准将参考文献整理为编号条目。',
  };

  return exactSuggestions[suggestion] ?? suggestion;
};

const formatIssueValue = (value: string, isEnglish: boolean): string => {
  if (isEnglish) {
    return value;
  }

  const exactValues: Record<string, string> = {
    'Section not detected': '未检测到章节',
    'No heading found': '未检测到标题',
    Unknown: '未知',
    'Abstract title not detected': '未检测到摘要标题',
    'Keywords line not detected': '未检测到关键词行',
    'References heading not detected': '未检测到参考文献标题',
    'No reference entries detected': '未检测到参考文献条目',
    'Directory title not detected': '未检测到目录标题',
  };

  if (exactValues[value]) {
    return exactValues[value];
  }

  return value
    .replace(/\bBefore\b/g, '段前')
    .replace(/\bAfter\b/g, '段后')
    .replace(/\bN\/A\b/g, '无')
    .replace(/\bkeywords\b/g, '个关键词')
    .replace(/\bBold\b/g, '加粗')
    .replace(/\bRegular\b/g, '常规');
};

const getRecognizedSectionText = (section: RecognizedSourceValue, isEnglish: boolean): string => {
  const sectionMap: Record<RecognizedSourceValue, string> = {
    header: isEnglish ? 'Header' : '页眉',
    body: isEnglish ? 'Body' : '正文',
    heading: isEnglish ? 'Heading' : '标题',
    toc: isEnglish ? 'Table of Contents' : '目录',
    footer: isEnglish ? 'Footer' : '页脚',
    abstract: isEnglish ? 'Abstract' : '摘要',
    keywords: isEnglish ? 'Keywords' : '关键词',
    references: isEnglish ? 'References' : '参考文献',
    acknowledgement: isEnglish ? 'Acknowledgement' : '致谢',
    originality_statement: isEnglish ? 'Originality Statement' : '原创声明',
    appendix: isEnglish ? 'Appendix' : '附录',
  };

  return sectionMap[section];
};

const getRecognizedIssueCount = (
  record: RecognizedContentItem,
  source: RecognizedSourceValue,
  issueCounts: Map<string, number>,
): number => {
  return (issueCounts.get(record.id) ?? 0)
    + (source === 'body' ? (issueCounts.get(`body-${record.index}`) ?? 0) : 0)
    + (issueCounts.get(source) ?? 0);
};

const getRecognizedHeadingLevelValue = (item: RecognizedContentItem): string | undefined => {
  const value = item.displayHeadingLevel ?? item.headingLevel;
  return value === undefined || value === null ? undefined : String(value);
};

const formatOptionalText = (value: unknown, fallback: string): string => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value);
};

const formatPointValue = (value: number | undefined, fallback: string): string =>
  value === undefined ? fallback : `${value.toFixed(1)}pt`;

const formatCharValue = (value: number | undefined, fallback: string): string =>
  value === undefined ? fallback : `${value.toFixed(2)} 字符`;

const formatBooleanValue = (value: boolean | undefined, isEnglish: boolean, fallback?: string): string => {
  if (value === undefined) {
    return fallback ?? (isEnglish ? 'No' : '否');
  }

  return value
    ? (isEnglish ? 'Yes' : '是')
    : (isEnglish ? 'No' : '否');
};

const formatPageValue = (value: number | undefined, record: RecognizedContentItem, isEnglish: boolean, fallback: string): string => {
  if (value !== undefined) {
    return String(value);
  }

  if (record.section === 'header') {
    return isEnglish ? 'Header' : '页眉';
  }

  if (record.section === 'footer') {
    return isEnglish ? 'Footer' : '页脚';
  }

  return fallback;
};

const formatAlignment = (value: string | undefined, isEnglish: boolean, fallback: string): string => {
  if (!value) {
    return fallback;
  }

  const zhMap: Record<string, string> = {
    left: '左对齐',
    center: '居中',
    right: '右对齐',
    both: '两端对齐',
    justify: '两端对齐',
    distribute: '分散对齐',
  };
  const enMap: Record<string, string> = {
    left: 'Left',
    center: 'Center',
    right: 'Right',
    both: 'Justified',
    justify: 'Justified',
    distribute: 'Distributed',
  };

  return (isEnglish ? enMap[value] : zhMap[value]) ?? value;
};

const formatLineHeight = (item: RecognizedContentItem, fallback: string): string => {
  if (item.lineHeight === undefined) {
    return fallback;
  }

  return item.lineHeightMode === 'points'
    ? `${item.lineHeight.toFixed(1)}pt`
    : `${item.lineHeight.toFixed(2)}x`;
};

const getIssueLocationKeys = (issue: CheckIssue): string[] => {
  const keys = [issue.location];
  const paragraphMatch = issue.location.match(/^Paragraph (\d+)/);
  if (paragraphMatch) {
    keys.push(`body-${paragraphMatch[1]}`);
  }

  const headingMatch = issue.location.match(/^Heading \d+: .*Paragraph (\d+)/);
  if (headingMatch) {
    keys.push(`body-${headingMatch[1]}`);
  }

  if (/Header/i.test(issue.location)) {
    keys.push('header');
  }

  if (/Footer/i.test(issue.location)) {
    keys.push('footer');
  }

  return keys;
};

const getIssueParagraphIndex = (issue: CheckIssue): number | undefined => {
  const paragraphMatch = issue.location.match(/^Paragraph (\d+)/);
  if (paragraphMatch) {
    return Number.parseInt(paragraphMatch[1], 10);
  }

  const headingParagraphMatch = issue.location.match(/Paragraph (\d+)/);
  if (headingParagraphMatch) {
    return Number.parseInt(headingParagraphMatch[1], 10);
  }

  return undefined;
};

const getIssueParagraphText = (
  issue: CheckIssue,
  recognizedContents: RecognizedContentItem[] | undefined,
): string | undefined => {
  const paragraphIndex = getIssueParagraphIndex(issue);
  if (paragraphIndex === undefined) {
    return undefined;
  }

  const item = recognizedContents?.find((content) => content.index === paragraphIndex);
  return item?.text ?? '';
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const CheckResultPage: React.FC = () => {
  const { isEnglish } = useI18n();
  const { message } = AntdApp.useApp();
  const storedResult = useAppStore((state) => state.currentResult);
  const storedPaper = useAppStore((state) => state.currentPaper);
  const setCurrentResult = useAppStore((state) => state.setCurrentResult);
  const setCurrentPaper = useAppStore((state) => state.setCurrentPaper);
  const restoredPaperNoticeVisible = useAppStore((state) => state.restoredPaperNoticeVisible);
  const restoredResultNoticeVisible = useAppStore((state) => state.restoredResultNoticeVisible);
  const dismissRestoredPaperNotice = useAppStore((state) => state.dismissRestoredPaperNotice);
  const dismissRestoredResultNotice = useAppStore((state) => state.dismissRestoredResultNotice);
  const clearCurrentContext = useAppStore((state) => state.clearCurrentContext);
  const navigate = useNavigate();
  const { checkId } = useParams();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [logDownloading, setLogDownloading] = useState(false);
  const [fixDownloading, setFixDownloading] = useState(false);
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [selectedFixOptions, setSelectedFixOptions] = useState<FixOption[]>([...fixOptionValues]);
  const [cardPage, setCardPage] = useState(1);
  const [recognizedSourceFilter, setRecognizedSourceFilter] = useState<'all' | RecognizedSourceValue>('all');
  const [recognizedStatusFilter, setRecognizedStatusFilter] = useState<RecognizedStatusFilter>('all');
  const [recognizedHeadingLevelFilter, setRecognizedHeadingLevelFilter] = useState<RecognizedHeadingLevelFilter>('all');
  const [recognizedHideEmptyParagraphs, setRecognizedHideEmptyParagraphs] = useState(true);
  const [recognizedKeyword, setRecognizedKeyword] = useState('');
  const [recognizedSourceOverrides, setRecognizedSourceOverrides] = useState<Record<string, RecognizedSourceValue>>({});
  const categoryMap = useMemo(() => getCategoryMap(isEnglish), [isEnglish]);
  const severityMap = useMemo(() => getSeverityMap(isEnglish), [isEnglish]);
  const fixOptionItems = useMemo(() => getFixOptionItems(isEnglish), [isEnglish]);
  const recognizedSourceOptions = useMemo(() => [
    { value: 'body', label: getRecognizedSectionText('body', isEnglish) },
    { value: 'heading', label: getRecognizedSectionText('heading', isEnglish) },
    { value: 'header', label: getRecognizedSectionText('header', isEnglish) },
    { value: 'toc', label: getRecognizedSectionText('toc', isEnglish) },
    { value: 'footer', label: getRecognizedSectionText('footer', isEnglish) },
    { value: 'abstract', label: getRecognizedSectionText('abstract', isEnglish) },
    { value: 'keywords', label: getRecognizedSectionText('keywords', isEnglish) },
    { value: 'references', label: getRecognizedSectionText('references', isEnglish) },
    { value: 'acknowledgement', label: getRecognizedSectionText('acknowledgement', isEnglish) },
    { value: 'originality_statement', label: getRecognizedSectionText('originality_statement', isEnglish) },
    { value: 'appendix', label: getRecognizedSectionText('appendix', isEnglish) },
  ] satisfies Array<{ value: RecognizedSourceValue; label: string }>, [isEnglish]);

  useEffect(() => {
    if (!checkId) {
      setLoadError('');
      return;
    }

    if (storedResult?.id === checkId && storedPaper) {
      setLoadError('');
      return;
    }

    const loadCheckResult = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [check, result] = await Promise.all([
          api.getCheck(checkId),
          api.getCheckResult(checkId),
        ]);
        const paper = await api.getUploadedPaper(check.paperId);
        setCurrentResult(result);
        setCurrentPaper(paper);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          return;
        }

        setLoadError(isEnglish ? 'Failed to load the check result. Please try again later.' : '加载检测结果失败，请稍后重试。');
      } finally {
        setLoading(false);
      }
    };

    void loadCheckResult();
  }, [checkId, isEnglish, setCurrentPaper, setCurrentResult, storedPaper, storedResult]);

  useEffect(() => {
    setCardPage(1);
  }, [categoryFilter, severityFilter, viewMode]);

  const handleDownloadLog = async () => {
    if (!checkId) {
      return;
    }

    setLogDownloading(true);
    try {
      const { blob, filename } = await api.downloadCheckDebugLog(checkId);
      downloadBlob(blob, filename);
      message.success(isEnglish ? 'The parser log download has started.' : '解析日志已开始下载');
    } catch (error) {
      if (isUnauthorizedError(error)) {
        return;
      }

      message.error(extractApiErrorMessage(error) ?? (isEnglish ? 'Failed to download the parser log.' : '解析日志下载失败'));
    } finally {
      setLogDownloading(false);
    }
  };

  const handleOpenFixModal = () => {
    setFixModalOpen(true);
  };

  const handleDownloadFixedDocx = async () => {
    if (!checkId || selectedFixOptions.length === 0) {
      return;
    }

    setFixDownloading(true);
    try {
      const { blob, filename } = await api.downloadFixedDocx(checkId, selectedFixOptions);
      downloadBlob(blob, filename);
      setFixModalOpen(false);
      message.success(isEnglish ? 'The repaired document download has started.' : '修正版文档已开始下载');
    } catch (error) {
      if (isUnauthorizedError(error)) {
        return;
      }

      message.error(extractApiErrorMessage(error) ?? (isEnglish ? 'Failed to export the repaired document.' : '修正版文档导出失败'));
    } finally {
      setFixDownloading(false);
    }
  };

  const handleSelectAllFixOptions = () => {
    setSelectedFixOptions([...fixOptionValues]);
  };

  const handleClearFixOptions = () => {
    setSelectedFixOptions([]);
  };

  const result = checkId && storedResult?.id !== checkId ? null : storedResult;
  const currentPaper = checkId && storedResult?.id !== checkId ? null : storedPaper;
  const showRestoredNotice = Boolean(result && currentPaper && (restoredPaperNoticeVisible || restoredResultNoticeVisible));

  const fixOptionIssueCounts = useMemo(() => {
    const counts = Object.fromEntries(fixOptionValues.map((value) => [value, 0])) as Record<FixOption, number>;
    for (const issue of result?.issues ?? []) {
      for (const option of getIssueFixOptions(issue)) {
        counts[option] += 1;
      }
    }

    return counts;
  }, [result]);

  const recommendedFixOptions = useMemo(() => {
    const options = fixOptionValues.filter((value) => fixOptionIssueCounts[value] > 0);
    return options.length > 0
      ? options
      : fixOptionValues.filter((value) => !nonGeneratingFixOptions.has(value));
  }, [fixOptionIssueCounts]);

  useEffect(() => {
    if (result) {
      setSelectedFixOptions(recommendedFixOptions);
    }
  }, [recommendedFixOptions, result]);

  useEffect(() => {
    setRecognizedSourceOverrides({});
    setRecognizedSourceFilter('all');
    setRecognizedStatusFilter('all');
    setRecognizedHeadingLevelFilter('all');
    setRecognizedHideEmptyParagraphs(true);
    setRecognizedKeyword('');
  }, [result?.id]);

  const filteredIssues = useMemo(() => {
    if (!result) {
      return [];
    }

    return result.issues.filter((issue) => {
      if (categoryFilter !== 'all' && issue.category !== categoryFilter) {
        return false;
      }

      if (severityFilter !== 'all' && issue.severity !== severityFilter) {
        return false;
      }

      return true;
    });
  }, [categoryFilter, result, severityFilter]);

  const pagedIssues = useMemo(() => {
    const start = (cardPage - 1) * CARD_PAGE_SIZE;
    return filteredIssues.slice(start, start + CARD_PAGE_SIZE);
  }, [cardPage, filteredIssues]);

  const recognizedIssueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of result?.issues ?? []) {
      for (const key of getIssueLocationKeys(issue)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return counts;
  }, [result]);

  const recognizedHeadingLevelOptions = useMemo(() => {
    const levels = new Set<string>();
    for (const item of result?.recognizedContents ?? []) {
      const level = getRecognizedHeadingLevelValue(item);
      if (level) {
        levels.add(level);
      }
    }

    return [...levels]
      .sort((left, right) => Number(left) - Number(right))
      .map((level) => ({
        value: level,
        label: isEnglish ? `Level ${level}` : `${level} 级标题`,
      }));
  }, [isEnglish, result]);

  const filteredRecognizedContents = useMemo(() => {
    const keyword = recognizedKeyword.trim().toLowerCase();

    return (result?.recognizedContents ?? []).filter((item) => {
      const effectiveSource = recognizedSourceOverrides[item.id] ?? item.section;
      const issueCount = getRecognizedIssueCount(item, effectiveSource, recognizedIssueCounts);
      const isManual = effectiveSource !== item.section;
      const headingLevel = getRecognizedHeadingLevelValue(item);

      if (recognizedHideEmptyParagraphs && !item.text.trim()) {
        return false;
      }

      if (recognizedSourceFilter !== 'all' && effectiveSource !== recognizedSourceFilter) {
        return false;
      }

      if (recognizedHeadingLevelFilter === 'none' && headingLevel) {
        return false;
      }

      if (
        recognizedHeadingLevelFilter !== 'all'
        && recognizedHeadingLevelFilter !== 'none'
        && headingLevel !== recognizedHeadingLevelFilter
      ) {
        return false;
      }

      if (recognizedStatusFilter === 'passed' && issueCount > 0) {
        return false;
      }

      if (recognizedStatusFilter === 'issue' && issueCount === 0) {
        return false;
      }

      if (recognizedStatusFilter === 'manual' && !isManual) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [
        item.text,
        item.styleName,
        item.styleId,
        item.fontFamily,
        item.fontColor,
        headingLevel ? (isEnglish ? `Level ${headingLevel}` : `${headingLevel} 级标题`) : undefined,
        getRecognizedSectionText(effectiveSource, isEnglish),
      ].filter(Boolean).join(' ').toLowerCase().includes(keyword);
    });
  }, [
    isEnglish,
    recognizedHeadingLevelFilter,
    recognizedHideEmptyParagraphs,
    recognizedIssueCounts,
    recognizedKeyword,
    recognizedSourceFilter,
    recognizedSourceOverrides,
    recognizedStatusFilter,
    result,
  ]);

  const handleRecognizedSourceChange = (record: RecognizedContentItem, source: RecognizedSourceValue) => {
    setRecognizedSourceOverrides((current) => {
      const next = { ...current };
      if (source === record.section) {
        delete next[record.id];
      } else {
        next[record.id] = source;
      }

      return next;
    });
  };

  const handleResetRecognizedFilters = () => {
    setRecognizedSourceFilter('all');
    setRecognizedStatusFilter('all');
    setRecognizedHeadingLevelFilter('all');
    setRecognizedHideEmptyParagraphs(true);
    setRecognizedKeyword('');
    setRecognizedSourceOverrides({});
  };

  const handleCloseRestoredNotice = () => {
    dismissRestoredPaperNotice();
    dismissRestoredResultNotice();
  };

  const handleClearCurrentContext = () => {
    clearCurrentContext();
    navigate('/check');
  };

  if (loading) {
    return (
      <div data-testid="page-result">
        <Card variant="borderless">
          <Skeleton active paragraph={{ rows: 10 }} />
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div data-testid="page-result">
        <Card variant="borderless">
          <Result
            status="error"
            icon={<ExclamationCircleOutlined />}
            title={isEnglish ? 'Result Load Failed' : '结果加载失败'}
            subTitle={loadError}
            extra={[
              <Button key="back" onClick={() => navigate('/dashboard')}>{isEnglish ? 'Back to Dashboard' : '返回概览'}</Button>,
              <Button type="primary" key="retry" onClick={() => navigate(0)}>{isEnglish ? 'Reload' : '重新加载'}</Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  if (!result || !currentPaper) {
    return (
      <div data-testid="page-result">
        <Card variant="borderless">
          <Empty data-testid="empty-result-state" description={isEnglish ? 'No check result available' : '暂无检测结果'} image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={() => navigate('/check')}>
              {isEnglish ? 'Go to Check' : '去检测论文'}
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  const columns = [
    {
      title: isEnglish ? 'No.' : '序号',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (_text: string, _record: unknown, index: number) => index + 1,
    },
    {
      title: isEnglish ? 'Severity' : '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (severity: string) => (
        <Tag color={severityMap[severity].color} icon={severityMap[severity].icon}>
          {severityMap[severity].text}
        </Tag>
      ),
    },
    {
      title: isEnglish ? 'Category' : '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => categoryMap[category],
    },
    {
      title: isEnglish ? 'Location' : '位置',
      dataIndex: 'location',
      key: 'location',
      width: 180,
      render: (text: string) => <Text strong>{formatIssueLocation(text, isEnglish)}</Text>,
    },
    {
      title: isEnglish ? 'Issue Details' : '问题描述',
      key: 'description',
      render: (_: unknown, record: CheckIssue) => {
        const paragraphText = getIssueParagraphText(record, result.recognizedContents);
        return (
          <div>
            {paragraphText !== undefined && (
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary">{isEnglish ? 'Text:' : '段落内容：'}</Text>
                {paragraphText
                  ? <Text>{paragraphText}</Text>
                  : <Text type="secondary">{isEnglish ? 'Empty paragraph' : '空段落'}</Text>}
              </div>
            )}
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary">{isEnglish ? 'Current:' : '当前值：'}</Text>
              {formatIssueValue(record.currentValue, isEnglish)}
            </div>
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary">{isEnglish ? 'Expected:' : '期望值：'}</Text>
              <Text type="success">{formatIssueValue(record.expectedValue, isEnglish)}</Text>
            </div>
            <div>
              <Text type="secondary">{isEnglish ? 'Reason:' : '原因：'}</Text>
              <Text type="danger">{formatIssueReason(record.reason, isEnglish)}</Text>
            </div>
          </div>
        );
      },
    },
    {
      title: isEnglish ? 'Suggestion' : '修改建议',
      dataIndex: 'suggestion',
      key: 'suggestion',
      render: (text: string) => <Alert title={formatIssueSuggestion(text, isEnglish)} type="info" showIcon />,
    },
  ];
  const emptyValue = isEnglish ? 'Not detected' : '未识别';
  const inheritedValue = isEnglish ? 'Default/inherited' : '默认/继承';
  const noneValue = isEnglish ? 'None' : '无';
  const recognizedColumns = [
    {
      title: isEnglish ? 'Status' : '状态',
      key: 'status',
      width: 110,
      fixed: 'left' as const,
      render: (_: unknown, record: RecognizedContentItem) => {
        const effectiveSource = recognizedSourceOverrides[record.id] ?? record.section;
        const count = getRecognizedIssueCount(record, effectiveSource, recognizedIssueCounts);
        if (count > 0) {
          return (
            <Tag color="warning">
              {isEnglish ? `${count} issue(s)` : `${count} 个问题`}
            </Tag>
          );
        }

        return (
          <Tag color={effectiveSource !== record.section ? 'processing' : 'success'}>
            {effectiveSource !== record.section
              ? (isEnglish ? 'Manual passed' : '人工判断合格')
              : (isEnglish ? 'Passed' : '合格')}
          </Tag>
        );
      },
    },
    {
      title: isEnglish ? 'Source' : '来源',
      dataIndex: 'section',
      key: 'section',
      width: 180,
      fixed: 'left' as const,
      render: (_section: RecognizedContentItem['section'], record: RecognizedContentItem) => {
        const effectiveSource = recognizedSourceOverrides[record.id] ?? record.section;
        return (
          <Space direction="vertical" size={4}>
            <Select
              size="small"
              value={effectiveSource}
              options={recognizedSourceOptions}
              style={{ width: 150 }}
              onChange={(value) => handleRecognizedSourceChange(record, value)}
            />
            {effectiveSource !== record.section && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {isEnglish
                  ? `Original: ${getRecognizedSectionText(record.section, isEnglish)}`
                  : `原识别：${getRecognizedSectionText(record.section, isEnglish)}`}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: isEnglish ? 'Page (est.)' : '页码/估算',
      dataIndex: 'pageNumber',
      key: 'pageNumber',
      width: 100,
      render: (value: number | undefined, record: RecognizedContentItem) =>
        formatPageValue(value, record, isEnglish, emptyValue),
    },
    {
      title: isEnglish ? 'Paragraph' : '段落',
      dataIndex: 'index',
      key: 'index',
      width: 90,
    },
    {
      title: isEnglish ? 'Recognized Text' : '识别内容',
      dataIndex: 'text',
      key: 'text',
      width: 360,
      render: (text: string) => text ? <Text>{text}</Text> : <Text type="secondary">{isEnglish ? 'Empty paragraph' : '空段落'}</Text>,
    },
    {
      title: isEnglish ? 'Heading Level' : '标题层级',
      dataIndex: 'headingLevel',
      key: 'headingLevel',
      width: 100,
      render: (_value: number | undefined, record: RecognizedContentItem) =>
        formatOptionalText(record.displayHeadingLevel ?? record.headingLevel, noneValue),
    },
    {
      title: isEnglish ? 'Style' : '样式',
      key: 'style',
      width: 180,
      render: (_: unknown, record: RecognizedContentItem) =>
        formatOptionalText(record.styleName ?? record.styleId, emptyValue),
    },
    {
      title: isEnglish ? 'Font' : '字体',
      dataIndex: 'fontFamily',
      key: 'fontFamily',
      width: 120,
      render: (_: string | undefined, record: RecognizedContentItem) =>
        formatOptionalText(record.fontFamilies?.join(' / ') ?? record.fontFamily, emptyValue),
    },
    {
      title: isEnglish ? 'Size' : '字号',
      dataIndex: 'fontSizePt',
      key: 'fontSizePt',
      width: 90,
      render: (value: number | undefined) => formatPointValue(value, emptyValue),
    },
    {
      title: isEnglish ? 'Color' : '字体颜色',
      dataIndex: 'fontColor',
      key: 'fontColor',
      width: 110,
      render: (value: string | undefined) => value
        ? <Space size={6}><span style={{ width: 12, height: 12, borderRadius: 2, background: value, border: '1px solid #d9d9d9', display: 'inline-block' }} />{value}</Space>
        : inheritedValue,
    },
    {
      title: isEnglish ? 'Bold' : '加粗',
      dataIndex: 'bold',
      key: 'bold',
      width: 80,
      render: (value: boolean | undefined) => formatBooleanValue(value, isEnglish, emptyValue),
    },
    {
      title: isEnglish ? 'Italic' : '斜体',
      dataIndex: 'italic',
      key: 'italic',
      width: 80,
      render: (value: boolean | undefined) => formatBooleanValue(value, isEnglish, emptyValue),
    },
    {
      title: isEnglish ? 'Underline' : '下划线',
      key: 'underline',
      width: 110,
      render: (_: unknown, record: RecognizedContentItem) => {
        const enabled = formatBooleanValue(record.underline, isEnglish, emptyValue);
        return record.underlineStyle && record.underline
          ? `${enabled} (${record.underlineStyle})`
          : enabled;
      },
    },
    {
      title: isEnglish ? 'Line Spacing' : '行间距',
      key: 'lineHeight',
      width: 110,
      render: (_: unknown, record: RecognizedContentItem) => formatLineHeight(record, inheritedValue),
    },
    {
      title: isEnglish ? 'Before' : '段前',
      dataIndex: 'spacingBeforePt',
      key: 'spacingBeforePt',
      width: 90,
      render: (value: number | undefined) => formatPointValue(value, inheritedValue),
    },
    {
      title: isEnglish ? 'After' : '段后',
      dataIndex: 'spacingAfterPt',
      key: 'spacingAfterPt',
      width: 90,
      render: (value: number | undefined) => formatPointValue(value, inheritedValue),
    },
    {
      title: isEnglish ? 'First-line Indent' : '首行缩进',
      dataIndex: 'firstLineChars',
      key: 'firstLineChars',
      width: 120,
      render: (value: number | undefined) => formatCharValue(value, inheritedValue),
    },
    {
      title: isEnglish ? 'Left Indent' : '左缩进',
      dataIndex: 'leftIndentChars',
      key: 'leftIndentChars',
      width: 110,
      render: (value: number | undefined) => formatCharValue(value, inheritedValue),
    },
    {
      title: isEnglish ? 'Right Indent' : '右缩进',
      dataIndex: 'rightIndentChars',
      key: 'rightIndentChars',
      width: 110,
      render: (value: number | undefined) => formatCharValue(value, inheritedValue),
    },
    {
      title: isEnglish ? 'Hanging Indent' : '悬挂缩进',
      dataIndex: 'hangingIndentChars',
      key: 'hangingIndentChars',
      width: 120,
      render: (value: number | undefined) => formatCharValue(value, inheritedValue),
    },
    {
      title: isEnglish ? 'Alignment' : '对齐',
      dataIndex: 'alignment',
      key: 'alignment',
      width: 100,
      render: (value: string | undefined) => formatAlignment(value, isEnglish, inheritedValue),
    },
  ];

  return (
    <div data-testid="page-result">
      {showRestoredNotice && (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={handleCloseRestoredNotice}
          style={{ marginBottom: 24 }}
          title={isEnglish ? 'This result came from the latest restored local context' : '当前结果来自本地恢复的最近上下文'}
          description={isEnglish
            ? `Restored the paper "${currentPaper.filename}" and its latest check result from local storage. You can keep reviewing it or clear the local record and start again.`
            : `已从本地恢复论文“${currentPaper.filename}”及其最近检测结果。你可以继续查看，也可以清除本地记录后重新开始。`}
          action={(
            <Button size="small" onClick={handleClearCurrentContext}>
              {isEnglish ? 'Clear Local Context' : '清除本地记录'}
            </Button>
          )}
        />
      )}

      <Card variant="borderless" style={{ marginBottom: 24 }}>
        <Result
          status={result.totalIssues === 0 ? 'success' : 'warning'}
          title={result.totalIssues === 0
            ? isEnglish ? 'No formatting issues found' : '未发现格式问题'
            : isEnglish ? `Check completed with ${result.totalIssues} issue(s)` : `检测完成，共发现 ${result.totalIssues} 处问题`}
          subTitle={isEnglish
            ? `Document: ${currentPaper.filename} | Checked at: ${result.createdAt.replace('T', ' ').slice(0, 19)}`
            : `文档名称：${currentPaper.filename} | 检测时间：${result.createdAt.replace('T', ' ').slice(0, 19)}`}
          extra={[
            <Button key="recheck" icon={<FileSearchOutlined />} onClick={() => navigate('/check')}>
              {isEnglish ? 'Run Again' : '重新检测'}
            </Button>,
            <Button key="log" icon={<DownloadOutlined />} loading={logDownloading} onClick={() => void handleDownloadLog()}>
              {isEnglish ? 'Download Parser Log' : '下载解析日志'}
            </Button>,
            <Button
              type="primary"
              key="fix"
              icon={<ToolOutlined />}
              loading={fixDownloading}
              onClick={handleOpenFixModal}
            >
              {isEnglish ? 'Choose Repair Export' : '选择修复导出'}
            </Button>,
          ]}
        />
      </Card>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        title={isEnglish ? 'About Repair Export' : '修复导出说明'}
        description={isEnglish
          ? 'Choose the repair items you want to apply before exporting. The system now only formats existing content and will not insert placeholder sections.'
          : '导出前可以勾选要应用的修复项；系统只修复已有内容格式，不再插入占位章节或占位正文。'}
      />

      <Modal
        title={isEnglish ? 'Choose Repair Items' : '选择修复内容'}
        open={fixModalOpen}
        onCancel={() => setFixModalOpen(false)}
        onOk={() => void handleDownloadFixedDocx()}
        okText={isEnglish ? 'Export Repaired Copy' : '导出修复稿'}
        cancelText={isEnglish ? 'Cancel' : '取消'}
        okButtonProps={{ loading: fixDownloading, disabled: selectedFixOptions.length === 0 }}
        destroyOnHidden
      >
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Text type="secondary">
            {isEnglish ? `${selectedFixOptions.length} item(s) selected` : `已选择 ${selectedFixOptions.length} 项`}
          </Text>
          <Space size={8}>
            <Button size="small" onClick={handleSelectAllFixOptions}>
              {isEnglish ? 'Select All' : '全选'}
            </Button>
            <Button size="small" onClick={handleClearFixOptions}>
              {isEnglish ? 'Clear' : '清空'}
            </Button>
          </Space>
        </Space>

        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {fixOptionItems.map((item) => (
            <Card key={item.value} size="small">
              <Checkbox
                checked={selectedFixOptions.includes(item.value)}
                onChange={(event) => {
                  setSelectedFixOptions((current) => event.target.checked
                    ? [...new Set([...current, item.value])]
                    : current.filter((value) => value !== item.value));
                }}
              >
                <Space size={8}>
                  <Text strong>{item.label}</Text>
                  {fixOptionIssueCounts[item.value] > 0 && (
                    <Tag color="processing">
                      {isEnglish
                        ? `${fixOptionIssueCounts[item.value]} issue(s)`
                        : `${fixOptionIssueCounts[item.value]} 个问题`}
                    </Tag>
                  )}
                </Space>
              </Checkbox>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">{item.description}</Text>
              </div>
            </Card>
          ))}
        </Space>
      </Modal>

      <Card
        variant="borderless"
        style={{ marginBottom: 24 }}
        title={<span style={{ fontSize: 18 }}>{isEnglish ? 'Recognized Content Details' : '识别内容明细'}</span>}
        extra={(
          <Text type="secondary">
            {isEnglish
              ? `${filteredRecognizedContents.length}/${result.recognizedContents?.length ?? 0} item(s)`
              : `${filteredRecognizedContents.length}/${result.recognizedContents?.length ?? 0} 条`}
          </Text>
        )}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={isEnglish
            ? 'Shows all parsed header, body, and footer paragraphs, including content that passed the checks.'
            : '展示系统识别到的页眉、正文、页脚段落，包括检查合格的内容。'}
          description={isEnglish
            ? 'Page numbers are estimated from explicit page-break markers. You can adjust the source in this table to review the local judgement without changing the saved check result.'
            : '页码根据 Word 文档中的显式分页标记估算。可在表格中临时调整来源，页面会重新显示本地判断，不会覆盖已保存的检测结果。'}
        />
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            value={recognizedSourceFilter}
            onChange={setRecognizedSourceFilter}
            style={{ width: 180 }}
            options={[
              { value: 'all', label: isEnglish ? 'All Sources' : '全部来源' },
              ...recognizedSourceOptions,
            ]}
          />
          <Select
            value={recognizedStatusFilter}
            onChange={setRecognizedStatusFilter}
            style={{ width: 170 }}
            options={[
              { value: 'all', label: isEnglish ? 'All Statuses' : '全部状态' },
              { value: 'passed', label: isEnglish ? 'Passed' : '合格' },
              { value: 'issue', label: isEnglish ? 'Has Issues' : '存在问题' },
              { value: 'manual', label: isEnglish ? 'Manual Source' : '已手动调整来源' },
            ]}
          />
          <Select
            value={recognizedHeadingLevelFilter}
            onChange={setRecognizedHeadingLevelFilter}
            style={{ width: 170 }}
            options={[
              { value: 'all', label: isEnglish ? 'All Heading Levels' : '全部标题层级' },
              ...recognizedHeadingLevelOptions,
              { value: 'none', label: isEnglish ? 'No Heading Level' : '未识别标题层级' },
            ]}
          />
          <Input.Search
            allowClear
            value={recognizedKeyword}
            onChange={(event) => setRecognizedKeyword(event.target.value)}
            placeholder={isEnglish ? 'Search text, style, or font' : '搜索内容、样式或字体'}
            style={{ width: 260 }}
          />
          <Checkbox
            checked={recognizedHideEmptyParagraphs}
            onChange={(event) => setRecognizedHideEmptyParagraphs(event.target.checked)}
          >
            {isEnglish ? 'Hide empty paragraphs' : '去除空段落'}
          </Checkbox>
          <Button onClick={handleResetRecognizedFilters}>
            {isEnglish ? 'Reset' : '重置'}
          </Button>
        </Space>
        <Table
          columns={recognizedColumns}
          dataSource={filteredRecognizedContents}
          rowKey="id"
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 2540 }}
        />
      </Card>

      {result.totalIssues > 0 && (
        <Card
          variant="borderless"
          title={<span style={{ fontSize: 18 }}>{isEnglish ? 'Issue List' : '问题明细'}</span>}
          extra={
            <Radio.Group value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
              <Radio.Button value="table">{isEnglish ? 'Table View' : '表格视图'}</Radio.Button>
              <Radio.Button value="card">{isEnglish ? 'Card View' : '卡片视图'}</Radio.Button>
            </Radio.Group>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <Space wrap>
              <Select value={categoryFilter} onChange={setCategoryFilter} style={{ width: 160 }}>
                <Select.Option value="all">{isEnglish ? 'All Categories' : '全部分类'}</Select.Option>
                <Select.Option value="page">{categoryMap.page}</Select.Option>
                <Select.Option value="body">{categoryMap.body}</Select.Option>
                <Select.Option value="heading">{categoryMap.heading}</Select.Option>
                <Select.Option value="reference">{categoryMap.reference}</Select.Option>
                <Select.Option value="other">{categoryMap.other}</Select.Option>
              </Select>
              <Select value={severityFilter} onChange={setSeverityFilter} style={{ width: 160 }}>
                <Select.Option value="all">{isEnglish ? 'All Severities' : '全部严重程度'}</Select.Option>
                <Select.Option value="high">{severityMap.high.text}</Select.Option>
                <Select.Option value="medium">{severityMap.medium.text}</Select.Option>
                <Select.Option value="low">{severityMap.low.text}</Select.Option>
              </Select>
            </Space>
          </div>

          {filteredIssues.length === 0 ? (
            <Empty description={isEnglish ? 'No issues match the current filters' : '当前筛选条件下没有问题项'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : viewMode === 'table' ? (
            <Table
              columns={columns}
              dataSource={filteredIssues}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          ) : (
            <>
              <Row gutter={[16, 16]}>
                {pagedIssues.map((item) => {
                  const paragraphText = getIssueParagraphText(item, result.recognizedContents);
                  return (
                    <Col xs={24} sm={24} md={12} lg={12} xl={8} xxl={8} key={item.id}>
                      <Card
                        title={`${categoryMap[item.category]} - ${formatIssueLocation(item.location, isEnglish)}`}
                        size="small"
                        extra={(
                          <Tag color={severityMap[item.severity].color} icon={severityMap[item.severity].icon}>
                            {severityMap[item.severity].text}
                          </Tag>
                        )}
                      >
                        <div style={{ marginBottom: 12 }}>
                          {paragraphText !== undefined && (
                            <div>
                              <Text type="secondary">{isEnglish ? 'Text:' : '段落内容：'}</Text>
                              {paragraphText
                                ? <Text>{paragraphText}</Text>
                                : <Text type="secondary">{isEnglish ? 'Empty paragraph' : '空段落'}</Text>}
                            </div>
                          )}
                          <div>
                            <Text type="secondary">{isEnglish ? 'Current:' : '当前值：'}</Text>
                            {formatIssueValue(item.currentValue, isEnglish)}
                          </div>
                          <div>
                            <Text type="secondary">{isEnglish ? 'Expected:' : '期望值：'}</Text>
                            <Text type="success">{formatIssueValue(item.expectedValue, isEnglish)}</Text>
                          </div>
                          <div>
                            <Text type="secondary">{isEnglish ? 'Reason:' : '原因：'}</Text>
                            <Text type="danger">{formatIssueReason(item.reason, isEnglish)}</Text>
                          </div>
                        </div>
                        <Alert title={formatIssueSuggestion(item.suggestion, isEnglish)} type="info" showIcon />
                      </Card>
                    </Col>
                  );
                })}
              </Row>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <Pagination
                  current={cardPage}
                  pageSize={CARD_PAGE_SIZE}
                  total={filteredIssues.length}
                  onChange={setCardPage}
                  showSizeChanger={false}
                />
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
};

export default CheckResultPage;
