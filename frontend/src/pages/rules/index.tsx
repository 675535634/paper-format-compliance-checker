import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  type FormInstance,
  Input,
  InputNumber,
  Row,
  Select,
  Skeleton,
  Space,
  message,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '../../api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PaperRuleConfig, RuleTemplate } from '../../types';

type NamePath = Array<string | number>;
type FontMode = 'none' | 'preset' | 'custom';
type SizeMode = 'none' | 'named' | 'custom';
type LineHeightMode = 'none' | 'fixed' | 'multiple';
type SpacingMode = 'none' | 'custom';
type IndentMode = 'none' | 'custom';
type AlignmentOption = 'none' | 'left' | 'center' | 'right';
type PagePosition = 'top' | 'bottom';
type PageNumberMode = 'none' | 'custom';
type NumberStyle = 'none' | 'arabic' | 'romanLower' | 'romanUpper' | 'chinese';
type KeywordSeparator = 'none' | 'semicolon' | 'comma' | 'dunhao';
type HeaderPreset = 'none' | 'geoscienceDefault' | 'sameSchoolName' | 'custom';
type ReferencePreset = '__none__' | '__custom__' | 'GB/T 7714-2005' | 'GB/T 7714-2015' | 'APA' | 'MLA' | 'IEEE';
type CaptionMode = 'none' | 'custom';

interface FontChoiceValue {
  mode: FontMode;
  preset: string;
  custom: string;
}

interface SizeChoiceValue {
  mode: SizeMode;
  named: string;
  value: number;
  unit: 'pt' | '磅';
}

interface LineHeightValue {
  mode: LineHeightMode;
  value: number;
  unit: 'pt' | '磅' | '倍';
}

interface SpacingValue {
  mode: SpacingMode;
  before: number;
  after: number;
  unit: 'pt' | '磅';
}

interface IndentValue {
  mode: IndentMode;
  value: number;
  unit: '字符';
}

interface HeadingRuleFormValue {
  level: number;
  font: FontChoiceValue;
  size: SizeChoiceValue;
  alignment: AlignmentOption;
  lineHeight: LineHeightValue;
  spacing: SpacingValue;
  indent: IndentValue;
}

interface RuleFormValues {
  templateName: string;
  description: string;
  pageSize: 'none' | 'A4' | 'B5' | 'A3';
  margin: {
    mode: 'none' | 'custom';
    top: number;
    bottom: number;
    left: number;
    right: number;
    unit: 'cm' | 'mm';
  };
  header: {
    preset: HeaderPreset;
    oddText: string;
    evenText: string;
  };
  pageNumber: {
    mode: PageNumberMode;
    position: PagePosition;
    alignment: AlignmentOption;
    style: NumberStyle;
  };
  body: {
    font: FontChoiceValue;
    fontSize: SizeChoiceValue;
    lineHeight: LineHeightValue;
    spacing: SpacingValue;
    indent: IndentValue;
  };
  coverItems: string[];
  requiredSections: string[];
  headingRules: HeadingRuleFormValue[];
  abstract: {
    titleFont: FontChoiceValue;
    titleSize: SizeChoiceValue;
    titleAlignment: AlignmentOption;
    bodyFont: FontChoiceValue;
    bodySize: SizeChoiceValue;
    lineHeight: LineHeightValue;
    lengthMode: 'none' | 'custom';
    minLength: number;
    maxLength: number;
  };
  keywords: {
    font: FontChoiceValue;
    size: SizeChoiceValue;
    countMode: 'none' | 'custom';
    minCount: number;
    maxCount: number;
    separator: KeywordSeparator;
    labelBold: 'none' | 'bold' | 'normal';
  };
  reference: {
    preset: ReferencePreset;
    custom: string;
  };
  figureCaption: {
    mode: CaptionMode;
    position: 'above' | 'below';
  };
  tableCaption: {
    mode: CaptionMode;
    position: 'above' | 'below';
  };
}

const NO_REQUIREMENT = '无要求';
const TEMPLATE_NAME_DEFAULT = '地大论文检查模板';
const COMMON_FONTS = ['宋体', '黑体', '楷体', '仿宋', '仿宋_GB2312', 'Times New Roman'];
const NAMED_FONT_SIZES = ['初号', '小初', '一号', '小一', '二号', '小二', '三号', '小三', '四号', '小四', '五号', '小五'];
const REFERENCE_OPTIONS: ReferencePreset[] = ['GB/T 7714-2005', 'GB/T 7714-2015', 'APA', 'MLA', 'IEEE'];
const COVER_ITEM_OPTIONS = ['论文题目', '教学点名称', '学号', '学生姓名', '学科专业', '指导教师', '评阅教师'];
const REQUIRED_SECTION_OPTIONS = ['毕业论文原创性声明', '摘要', '目录', '致谢', '参考文献', '附录'];
const HEADER_PRESET_OPTIONS: Array<{ label: string; value: HeaderPreset; oddText: string; evenText: string }> = [
  { label: '无要求', value: 'none', oddText: '', evenText: '' },
  { label: '地大成教默认页眉', value: 'geoscienceDefault', oddText: '地大高等学历继续教育', evenText: '学生姓名：论文题目' },
  { label: '奇偶页都显示学校名称', value: 'sameSchoolName', oddText: '地大高等学历继续教育', evenText: '地大高等学历继续教育' },
  { label: '自定义页眉', value: 'custom', oddText: '', evenText: '' },
];

const defaultFontChoice = (font = '宋体'): FontChoiceValue => ({
  mode: 'preset',
  preset: font,
  custom: '',
});

const noRequirementFontChoice = (): FontChoiceValue => ({
  mode: 'none',
  preset: '宋体',
  custom: '',
});

const defaultSizeChoice = (named = '小四'): SizeChoiceValue => ({
  mode: 'named',
  named,
  value: 12,
  unit: 'pt',
});

const noRequirementSizeChoice = (): SizeChoiceValue => ({
  mode: 'none',
  named: '小四',
  value: 12,
  unit: 'pt',
});

const defaultLineHeight = (): LineHeightValue => ({
  mode: 'fixed',
  value: 20,
  unit: 'pt',
});

const noRequirementLineHeight = (): LineHeightValue => ({
  mode: 'none',
  value: 20,
  unit: 'pt',
});

const defaultSpacing = (): SpacingValue => ({
  mode: 'custom',
  before: 0,
  after: 0,
  unit: 'pt',
});

const noRequirementSpacing = (): SpacingValue => ({
  mode: 'none',
  before: 0,
  after: 0,
  unit: 'pt',
});

const defaultIndent = (): IndentValue => ({
  mode: 'custom',
  value: 2,
  unit: '字符',
});

const noRequirementIndent = (): IndentValue => ({
  mode: 'none',
  value: 2,
  unit: '字符',
});

const createHeadingRule = (level: number, namedSize = '小四'): HeadingRuleFormValue => ({
  level,
  font: defaultFontChoice('黑体'),
  size: defaultSizeChoice(namedSize),
  alignment: 'none',
  lineHeight: noRequirementLineHeight(),
  spacing: noRequirementSpacing(),
  indent: noRequirementIndent(),
});

const defaultRules: PaperRuleConfig = {
  pageSize: 'A4',
  margin: '上3cm，下3cm，左3cm，右3cm',
  headerRule: '奇数页：地大高等学历继续教育；偶数页：学生姓名：论文题目',
  coverItems: '论文题目; 教学点名称; 学号; 学生姓名; 学科专业; 指导教师; 评阅教师',
  requiredSections: '毕业论文原创性声明; 致谢',
  bodyFont: '宋体',
  bodyFontSize: '小四',
  lineHeight: '20pt',
  paragraphSpacing: '段前 0pt，段后 0pt',
  firstLineIndent: '2字符',
  headingFormats: 'Level 1: 黑体 三号; Level 2: 黑体 四号; Level 3: 黑体 小四',
  pageNumberRule: '底部居中，阿拉伯数字',
  abstractFormat: '摘要标题黑体小二居中；正文宋体小四，固定值20磅；300-500字',
  keywordFormat: '关键词三字加粗；宋体小四；3-5个，词间用分号分隔',
  referenceFormat: 'GB/T 7714-2005',
  figureCaptionRule: '图题注格式：图1.1 标题，题注位于图下方',
  tableCaptionRule: '表题注格式：表1.1 标题，题注位于表上方',
};

const defaultFormValues = (): RuleFormValues => ({
  templateName: TEMPLATE_NAME_DEFAULT,
  description: '',
  pageSize: 'A4',
  margin: {
    mode: 'custom',
    top: 3,
    bottom: 3,
    left: 3,
    right: 3,
    unit: 'cm',
  },
  header: {
    preset: 'geoscienceDefault',
    oddText: '地大高等学历继续教育',
    evenText: '学生姓名：论文题目',
  },
  pageNumber: {
    mode: 'custom',
    position: 'bottom',
    alignment: 'center',
    style: 'arabic',
  },
  body: {
    font: defaultFontChoice('宋体'),
    fontSize: defaultSizeChoice('小四'),
    lineHeight: defaultLineHeight(),
    spacing: defaultSpacing(),
    indent: defaultIndent(),
  },
  coverItems: [...COVER_ITEM_OPTIONS],
  requiredSections: ['毕业论文原创性声明', '致谢'],
  headingRules: [
    createHeadingRule(1, '三号'),
    createHeadingRule(2, '四号'),
    createHeadingRule(3, '小四'),
  ],
  abstract: {
    titleFont: defaultFontChoice('黑体'),
    titleSize: defaultSizeChoice('小二'),
    titleAlignment: 'center',
    bodyFont: defaultFontChoice('宋体'),
    bodySize: defaultSizeChoice('小四'),
    lineHeight: {
      mode: 'fixed',
      value: 20,
      unit: '磅',
    },
    lengthMode: 'custom',
    minLength: 300,
    maxLength: 500,
  },
  keywords: {
    font: defaultFontChoice('宋体'),
    size: defaultSizeChoice('小四'),
    countMode: 'custom',
    minCount: 3,
    maxCount: 5,
    separator: 'semicolon',
    labelBold: 'bold',
  },
  reference: {
    preset: 'GB/T 7714-2005',
    custom: '',
  },
  figureCaption: {
    mode: 'custom',
    position: 'below',
  },
  tableCaption: {
    mode: 'custom',
    position: 'above',
  },
});

const splitTokens = (value?: string): string[] =>
  (value ?? '')
    .split(/[;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
const ensureStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const ensureHeadingRuleArray = (value: unknown): HeadingRuleFormValue[] =>
  Array.isArray(value) ? value.filter((item): item is HeadingRuleFormValue => Boolean(item) && typeof item === 'object') : [];

const formatNumber = (value: number): string => (Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, ''));
const toHalfStep = (value: string | number | null | undefined): number => {
  const normalized = `${value ?? ''}`.replace(/[^\d.]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 2) / 2 : 0;
};
const toInteger = (value: string | number | null | undefined): number => {
  const normalized = `${value ?? ''}`.replace(/[^\d]/g, '');
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};
const hasNoRequirement = (value?: string | null): boolean => !value || value.trim() === '' || value.includes(NO_REQUIREMENT);

const resolveFontChoice = (value: FontChoiceValue, fallback: string): string => {
  if (value.mode === 'none') {
    return NO_REQUIREMENT;
  }

  if (value.mode === 'custom') {
    return value.custom.trim() || fallback;
  }

  return value.preset || fallback;
};

const resolveSizeChoice = (value: SizeChoiceValue, fallback: string): string => {
  if (value.mode === 'none') {
    return NO_REQUIREMENT;
  }

  if (value.mode === 'named') {
    return value.named || fallback;
  }

  return `${formatNumber(value.value || 0)}${value.unit}`;
};

const resolveLineHeight = (value: LineHeightValue): string => {
  if (value.mode === 'none') {
    return NO_REQUIREMENT;
  }

  if (value.mode === 'fixed') {
    return `${formatNumber(value.value)}${value.unit}`;
  }

  return `${formatNumber(value.value)}`;
};

const resolveSpacing = (value: SpacingValue): string => {
  if (value.mode === 'none') {
    return NO_REQUIREMENT;
  }

  return `段前 ${formatNumber(value.before)}${value.unit}，段后 ${formatNumber(value.after)}${value.unit}`;
};

const resolveIndent = (value: IndentValue): string => {
  if (value.mode === 'none') {
    return NO_REQUIREMENT;
  }

  return `${value.value}${value.unit}`;
};

const parseFontChoice = (value: string | undefined, fallback: string): FontChoiceValue => {
  const resolved = value?.trim() || fallback;
  if (hasNoRequirement(resolved)) {
    return noRequirementFontChoice();
  }

  return COMMON_FONTS.includes(resolved)
    ? { mode: 'preset', preset: resolved, custom: '' }
    : { mode: 'custom', preset: fallback, custom: resolved };
};

const parseSizeChoice = (value: string | undefined, fallback: string): SizeChoiceValue => {
  const resolved = value?.trim() || fallback;
  if (hasNoRequirement(resolved)) {
    return noRequirementSizeChoice();
  }

  const named = NAMED_FONT_SIZES.find((item) => resolved.includes(item));
  if (named) {
    return {
      mode: 'named',
      named,
      value: 12,
      unit: 'pt',
    };
  }

  const numericMatch = resolved.match(/(\d+(?:\.\d+)?)/);
  const numeric = numericMatch ? Number.parseFloat(numericMatch[1]) : 12;

  return {
    mode: 'custom',
    named: fallback,
    value: Number.isFinite(numeric) ? numeric : 12,
    unit: resolved.includes('磅') ? '磅' : 'pt',
  };
};

const parseLineHeight = (value: string | number | undefined, fallback: LineHeightValue): LineHeightValue => {
  const resolved = typeof value === 'number' ? `${value}` : value ?? '';
  if (hasNoRequirement(resolved)) {
    return noRequirementLineHeight();
  }

  const numericMatch = resolved.match(/(\d+(?:\.\d+)?)/);
  const numeric = numericMatch ? Number.parseFloat(numericMatch[1]) : fallback.value;
  if (/pt|磅/i.test(resolved)) {
    return {
      mode: 'fixed',
      value: Number.isFinite(numeric) ? numeric : fallback.value,
      unit: resolved.includes('磅') ? '磅' : 'pt',
    };
  }

  return {
    mode: 'multiple',
    value: Number.isFinite(numeric) ? numeric : 1.5,
    unit: '倍',
  };
};

const parseSpacing = (value: string | undefined, fallback: SpacingValue): SpacingValue => {
  const resolved = value ?? '';
  if (hasNoRequirement(resolved)) {
    return noRequirementSpacing();
  }

  const beforeMatch = resolved.match(/(?:Before|段前)\s*(\d+(?:\.\d+)?)\s*(pt|磅)?/i);
  const afterMatch = resolved.match(/(?:After|段后)\s*(\d+(?:\.\d+)?)\s*(pt|磅)?/i);

  return {
    mode: 'custom',
    before: beforeMatch ? Number.parseFloat(beforeMatch[1]) : fallback.before,
    after: afterMatch ? Number.parseFloat(afterMatch[1]) : fallback.after,
    unit: beforeMatch?.[2] === '磅' || afterMatch?.[2] === '磅' ? '磅' : fallback.unit,
  };
};

const parseIndent = (value: string | undefined, fallback: IndentValue): IndentValue => {
  const resolved = value ?? '';
  if (hasNoRequirement(resolved)) {
    return noRequirementIndent();
  }

  const numericMatch = resolved.match(/(\d+(?:\.\d+)?)/);
  const numeric = numericMatch ? Number.parseFloat(numericMatch[1]) : fallback.value;

  return {
    mode: 'custom',
    value: Number.isFinite(numeric) ? Math.round(numeric) : fallback.value,
    unit: '字符',
  };
};

const parseMargin = (value: string | undefined, fallback: RuleFormValues['margin']): RuleFormValues['margin'] => {
  const resolved = value ?? '';
  if (hasNoRequirement(resolved)) {
    return { ...fallback, mode: 'none' };
  }

  const extract = (pattern: RegExp, fallbackValue: number): number => {
    const match = resolved.match(pattern);
    if (!match) {
      return fallbackValue;
    }

    const parsed = Number.parseFloat(match[1]);
    return Number.isFinite(parsed) ? parsed : fallbackValue;
  };

  return {
    mode: 'custom',
    top: extract(/上\s*(\d+(?:\.\d+)?)/, fallback.top),
    bottom: extract(/下\s*(\d+(?:\.\d+)?)/, fallback.bottom),
    left: extract(/左\s*(\d+(?:\.\d+)?)/, fallback.left),
    right: extract(/右\s*(\d+(?:\.\d+)?)/, fallback.right),
    unit: /mm|毫米/i.test(resolved) ? 'mm' : 'cm',
  };
};

const parseHeader = (value: string | undefined, fallback: RuleFormValues['header']): RuleFormValues['header'] => {
  if (hasNoRequirement(value)) {
    return { preset: 'none', oddText: '', evenText: '' };
  }

  const oddText = value?.match(/奇数页[:：]\s*([^；;]+)/)?.[1]?.trim() ?? fallback.oddText;
  const evenText = value?.match(/偶数页[:：]\s*([^；;]+)/)?.[1]?.trim() ?? fallback.evenText;
  const preset = HEADER_PRESET_OPTIONS.find((item) => item.oddText === oddText && item.evenText === evenText)?.value ?? 'custom';

  return { preset, oddText, evenText };
};

const parsePageNumber = (value: string | undefined, fallback: RuleFormValues['pageNumber']): RuleFormValues['pageNumber'] => {
  if (hasNoRequirement(value)) {
    return { ...fallback, mode: 'none', alignment: 'none', style: 'none' };
  }

  const resolved = value ?? '';
  return {
    mode: 'custom',
    position: resolved.includes('顶部') ? 'top' : fallback.position,
    alignment: resolved.includes('居左') || resolved.includes('左对齐')
      ? 'left'
      : resolved.includes('居右') || resolved.includes('右对齐')
        ? 'right'
        : 'center',
    style: resolved.includes('大写罗马')
      ? 'romanUpper'
      : resolved.includes('小写罗马')
        ? 'romanLower'
        : resolved.includes('中文')
          ? 'chinese'
          : 'arabic',
  };
};

const parseAlignmentOption = (value: string | undefined): AlignmentOption => {
  const resolved = value ?? '';
  if (hasNoRequirement(resolved)) {
    return 'none';
  }

  if (resolved.includes('居左') || resolved.includes('左对齐') || /\bleft\b/i.test(resolved)) {
    return 'left';
  }

  if (resolved.includes('居右') || resolved.includes('右对齐') || /\bright\b/i.test(resolved)) {
    return 'right';
  }

  if (resolved.includes('居中') || /\bcenter\b/i.test(resolved)) {
    return 'center';
  }

  return 'none';
};

const parseHeadingRules = (value: string | undefined): HeadingRuleFormValue[] => {
  const fallback = defaultFormValues().headingRules;
  return splitTokens(value)
    .map((segment) => {
      const levelMatch = segment.match(/level\s*([1-9])/i);
      const level = levelMatch ? Number.parseInt(levelMatch[1], 10) : undefined;
      if (!level) {
        return null;
      }

      const fallbackRule = fallback.find((item) => item.level === level) ?? createHeadingRule(level);
      const parts = segment.split('|').map((item) => item.trim());
      const spacingSegment = parts.find((item) => item.includes('段前') || item.includes('段后')) ?? segment;
      const lineHeightSegment = parts.find((item) => item.includes('行距')) ?? segment;
      const indentSegment = parts.find((item) => item.includes('首行缩进')) ?? segment;
      const alignmentSegment = parts.find((item) => item.includes('对齐') || item.includes('居中') || item.includes('居左') || item.includes('居右')) ?? segment;
      const font = COMMON_FONTS.find((item) => segment.includes(item));

      return {
        level,
        font: parseFontChoice(font ?? (segment.includes(NO_REQUIREMENT) ? NO_REQUIREMENT : fallbackRule.font.preset), fallbackRule.font.preset),
        size: parseSizeChoice(segment.includes('字号=') ? segment.split('字号=').slice(1).join('字号=') : segment, fallbackRule.size.named),
        alignment: parseAlignmentOption(alignmentSegment),
        lineHeight: parseLineHeight(lineHeightSegment, fallbackRule.lineHeight),
        spacing: parseSpacing(spacingSegment, fallbackRule.spacing),
        indent: parseIndent(indentSegment, fallbackRule.indent),
      };
    })
    .filter((item): item is HeadingRuleFormValue => Boolean(item))
    .sort((left, right) => left.level - right.level);
};

const parseAbstract = (value: string | undefined, fallback: RuleFormValues['abstract']): RuleFormValues['abstract'] => {
  const segments = splitTokens(value);
  const titleSegment = segments.find((item) => item.includes('标题')) ?? '';
  const bodySegment = segments.find((item) => item.includes('正文')) ?? '';
  const lengthSegment = segments.find((item) => item.includes('字')) ?? '';
  const lengthMatch = lengthSegment.match(/(\d+)\s*[-~至]\s*(\d+)/);
  const titleFont = COMMON_FONTS.find((item) => titleSegment.includes(item));
  const bodyFont = COMMON_FONTS.find((item) => bodySegment.includes(item));

  return {
    titleFont: parseFontChoice(titleFont ?? (titleSegment.includes(NO_REQUIREMENT) ? NO_REQUIREMENT : fallback.titleFont.preset), fallback.titleFont.preset),
    titleSize: parseSizeChoice(titleSegment, fallback.titleSize.named),
    titleAlignment: parseAlignmentOption(titleSegment),
    bodyFont: parseFontChoice(bodyFont ?? (bodySegment.includes(NO_REQUIREMENT) ? NO_REQUIREMENT : fallback.bodyFont.preset), fallback.bodyFont.preset),
    bodySize: parseSizeChoice(bodySegment, fallback.bodySize.named),
    lineHeight: parseLineHeight(bodySegment, fallback.lineHeight),
    lengthMode: lengthMatch ? 'custom' : 'none',
    minLength: lengthMatch ? Number.parseInt(lengthMatch[1], 10) : fallback.minLength,
    maxLength: lengthMatch ? Number.parseInt(lengthMatch[2], 10) : fallback.maxLength,
  };
};

const parseKeywords = (value: string | undefined, fallback: RuleFormValues['keywords']): RuleFormValues['keywords'] => {
  const resolved = value ?? '';
  const countMatch = resolved.match(/(\d+)\s*[-~至]\s*(\d+)\s*个/);
  const font = COMMON_FONTS.find((item) => resolved.includes(item));

  return {
    font: parseFontChoice(font ?? (resolved.includes(NO_REQUIREMENT) ? NO_REQUIREMENT : fallback.font.preset), fallback.font.preset),
    size: parseSizeChoice(resolved, fallback.size.named),
    countMode: countMatch ? 'custom' : 'none',
    minCount: countMatch ? Number.parseInt(countMatch[1], 10) : fallback.minCount,
    maxCount: countMatch ? Number.parseInt(countMatch[2], 10) : fallback.maxCount,
    separator: resolved.includes('逗号') ? 'comma' : resolved.includes('顿号') ? 'dunhao' : resolved.includes('分号') ? 'semicolon' : 'none',
    labelBold: resolved.includes('加粗') ? 'bold' : resolved.includes('常规') ? 'normal' : 'none',
  };
};

const parseReference = (value: string | undefined): RuleFormValues['reference'] => {
  if (hasNoRequirement(value)) {
    return { preset: '__none__', custom: '' };
  }

  const resolved = value?.trim() || 'GB/T 7714-2005';
  return REFERENCE_OPTIONS.includes(resolved as ReferencePreset)
    ? { preset: resolved as ReferencePreset, custom: '' }
    : { preset: '__custom__', custom: resolved };
};

const parseCaption = (value: string | undefined, fallback: 'above' | 'below'): { mode: CaptionMode; position: 'above' | 'below' } => {
  if (hasNoRequirement(value)) {
    return { mode: 'none', position: fallback };
  }

  return {
    mode: 'custom',
    position: value?.includes('上方') ? 'above' : value?.includes('下方') ? 'below' : fallback,
  };
};

const buildFormValues = (config: PaperRuleConfig, template?: Pick<RuleTemplate, 'name' | 'description'>): RuleFormValues => {
  const fallback = defaultFormValues();
  const headingRules = parseHeadingRules(config.headingFormats);

  return {
    ...fallback,
    templateName: template?.name ?? TEMPLATE_NAME_DEFAULT,
    description: template?.description ?? '',
    pageSize: hasNoRequirement(config.pageSize) ? 'none' : ((config.pageSize as RuleFormValues['pageSize']) || fallback.pageSize),
    margin: parseMargin(config.margin, fallback.margin),
    header: parseHeader(config.headerRule, fallback.header),
    pageNumber: parsePageNumber(config.pageNumberRule, fallback.pageNumber),
    body: {
      font: parseFontChoice(config.bodyFont, fallback.body.font.preset),
      fontSize: parseSizeChoice(config.bodyFontSize, fallback.body.fontSize.named),
      lineHeight: parseLineHeight(config.lineHeight, fallback.body.lineHeight),
      spacing: parseSpacing(config.paragraphSpacing, fallback.body.spacing),
      indent: parseIndent(config.firstLineIndent, fallback.body.indent),
    },
    coverItems: hasNoRequirement(config.coverItems)
      ? [NO_REQUIREMENT]
      : splitTokens(config.coverItems).length > 0 ? splitTokens(config.coverItems) : fallback.coverItems,
    requiredSections: hasNoRequirement(config.requiredSections)
      ? [NO_REQUIREMENT]
      : splitTokens(config.requiredSections).length > 0 ? splitTokens(config.requiredSections) : fallback.requiredSections,
    headingRules: headingRules.length > 0 ? headingRules : fallback.headingRules,
    abstract: parseAbstract(config.abstractFormat, fallback.abstract),
    keywords: parseKeywords(config.keywordFormat, fallback.keywords),
    reference: parseReference(config.referenceFormat),
    figureCaption: parseCaption(config.figureCaptionRule, 'below'),
    tableCaption: parseCaption(config.tableCaptionRule, 'above'),
  };
};

const buildHeadingSegment = (item: HeadingRuleFormValue): string | null => {
  const parts: string[] = [];
  const font = resolveFontChoice(item.font, '黑体');
  const size = resolveSizeChoice(item.size, '小四');
  const lineHeight = resolveLineHeight(item.lineHeight);
  const spacing = resolveSpacing(item.spacing);
  const indent = resolveIndent(item.indent);

  if (!hasNoRequirement(font)) {
    parts.push(`字体=${font}`);
  }

  if (!hasNoRequirement(size)) {
    parts.push(`字号=${size}`);
  }

  if (item.alignment !== 'none') {
    parts.push(`对齐=${item.alignment === 'left' ? '居左' : item.alignment === 'right' ? '居右' : '居中'}`);
  }

  if (!hasNoRequirement(lineHeight)) {
    parts.push(`行距=${lineHeight}`);
  }

  if (!hasNoRequirement(spacing)) {
    parts.push(`段前=${formatNumber(item.spacing.before)}${item.spacing.unit}`);
    parts.push(`段后=${formatNumber(item.spacing.after)}${item.spacing.unit}`);
  }

  if (!hasNoRequirement(indent)) {
    parts.push(`首行缩进=${indent}`);
  }

  return parts.length > 0 ? `Level ${item.level}: ${parts.join(' | ')}` : null;
};

const buildPageNumberRule = (value: RuleFormValues['pageNumber']): string => {
  if (value.mode === 'none') {
    return NO_REQUIREMENT;
  }

  const positionText = value.position === 'top' ? '顶部' : '底部';
  const alignmentText = value.alignment === 'left' ? '居左' : value.alignment === 'right' ? '居右' : value.alignment === 'center' ? '居中' : NO_REQUIREMENT;
  const styleText = value.style === 'romanLower'
    ? '小写罗马数字'
    : value.style === 'romanUpper'
      ? '大写罗马数字'
      : value.style === 'chinese'
        ? '中文数字'
        : value.style === 'arabic'
          ? '阿拉伯数字'
          : NO_REQUIREMENT;

  return `${positionText}${alignmentText}，${styleText}`;
};

const buildRuleConfig = (values: RuleFormValues): PaperRuleConfig => {
  const normalizedHeadingRules = ensureHeadingRuleArray(values.headingRules);
  const normalizedCoverItems = ensureStringArray(values.coverItems);
  const normalizedRequiredSections = ensureStringArray(values.requiredSections);
  const headingSegments = normalizedHeadingRules
    .slice()
    .sort((left, right) => left.level - right.level)
    .map((item) => buildHeadingSegment(item))
    .filter((item): item is string => Boolean(item));
  const coverItems = normalizedCoverItems.includes(NO_REQUIREMENT) || normalizedCoverItems.length === 0
    ? NO_REQUIREMENT
    : normalizedCoverItems.join('; ');
  const requiredSections = normalizedRequiredSections.includes(NO_REQUIREMENT) || normalizedRequiredSections.length === 0
    ? NO_REQUIREMENT
    : normalizedRequiredSections.join('; ');

  const abstractTitleParts = [
    resolveFontChoice(values.abstract.titleFont, '黑体'),
    resolveSizeChoice(values.abstract.titleSize, '小二'),
    values.abstract.titleAlignment === 'left' ? '居左' : values.abstract.titleAlignment === 'right' ? '居右' : values.abstract.titleAlignment === 'center' ? '居中' : NO_REQUIREMENT,
  ].filter((item) => !hasNoRequirement(item));
  const abstractBodyParts = [
    resolveFontChoice(values.abstract.bodyFont, '宋体'),
    resolveSizeChoice(values.abstract.bodySize, '小四'),
    resolveLineHeight(values.abstract.lineHeight),
  ].filter((item) => !hasNoRequirement(item));
  const abstractSegments = [
    abstractTitleParts.length > 0 ? `标题${abstractTitleParts.join('')}` : '标题无要求',
    abstractBodyParts.length > 0
      ? `正文${abstractBodyParts[0]}${abstractBodyParts[1] ?? ''}${abstractBodyParts[2] ? `，${abstractBodyParts[2].includes('pt') || abstractBodyParts[2].includes('磅') ? `固定值${abstractBodyParts[2]}` : `${abstractBodyParts[2]}倍行距`}` : ''}`
      : '正文无要求',
    values.abstract.lengthMode === 'custom' ? `${values.abstract.minLength}-${values.abstract.maxLength}字` : '字数无要求',
  ];

  const keywordParts = [
    values.keywords.labelBold === 'bold' ? '关键词标题加粗' : values.keywords.labelBold === 'normal' ? '关键词标题常规' : '关键词标题无要求',
    `${resolveFontChoice(values.keywords.font, '宋体')}${resolveSizeChoice(values.keywords.size, '小四')}`,
    values.keywords.countMode === 'custom' ? `${values.keywords.minCount}-${values.keywords.maxCount}个` : '数量无要求',
    values.keywords.separator === 'semicolon'
      ? '词间用分号分隔'
      : values.keywords.separator === 'comma'
        ? '词间用逗号分隔'
        : values.keywords.separator === 'dunhao'
          ? '词间用顿号分隔'
          : '分隔符无要求',
  ];

  return {
    pageSize: values.pageSize === 'none' ? NO_REQUIREMENT : values.pageSize,
    margin: values.margin.mode === 'none'
      ? NO_REQUIREMENT
      : `上${formatNumber(values.margin.top)}${values.margin.unit}，下${formatNumber(values.margin.bottom)}${values.margin.unit}，左${formatNumber(values.margin.left)}${values.margin.unit}，右${formatNumber(values.margin.right)}${values.margin.unit}`,
    headerRule: values.header.preset === 'none'
      ? NO_REQUIREMENT
      : `奇数页：${values.header.oddText.trim() || '地大高等学历继续教育'}；偶数页：${values.header.evenText.trim() || '学生姓名：论文题目'}`,
    coverItems,
    requiredSections,
    bodyFont: resolveFontChoice(values.body.font, '宋体'),
    bodyFontSize: resolveSizeChoice(values.body.fontSize, '小四'),
    lineHeight: resolveLineHeight(values.body.lineHeight),
    paragraphSpacing: resolveSpacing(values.body.spacing),
    firstLineIndent: resolveIndent(values.body.indent),
    headingFormats: headingSegments.join('; ') || 'Level 1: 无要求',
    pageNumberRule: buildPageNumberRule(values.pageNumber),
    abstractFormat: abstractSegments.join('；'),
    keywordFormat: keywordParts.join('；'),
    referenceFormat: values.reference.preset === '__none__'
      ? NO_REQUIREMENT
      : values.reference.preset === '__custom__'
        ? values.reference.custom.trim() || 'GB/T 7714-2005'
        : values.reference.preset,
    figureCaptionRule: values.figureCaption.mode === 'none'
      ? NO_REQUIREMENT
      : `图题注格式：图1.1 标题，题注位于图${values.figureCaption.position === 'above' ? '上方' : '下方'}`,
    tableCaptionRule: values.tableCaption.mode === 'none'
      ? NO_REQUIREMENT
      : `表题注格式：表1.1 标题，题注位于表${values.tableCaption.position === 'above' ? '上方' : '下方'}`,
  };
};

const FontChoiceField: React.FC<{
  form: FormInstance<RuleFormValues>;
  label: string;
  name: NamePath;
}> = ({ form, label, name }) => {
  const mode = Form.useWatch([...name, 'mode'], form) as FontMode | undefined;

  return (
    <Form.Item label={label}>
      <Space.Compact block>
        <Form.Item name={[...name, 'mode']} noStyle>
          <Select
            style={{ width: 120 }}
            options={[
              { label: '无要求', value: 'none' },
              { label: '常用字体', value: 'preset' },
              { label: '自定义', value: 'custom' },
            ]}
          />
        </Form.Item>
        {mode === 'custom' ? (
          <Form.Item name={[...name, 'custom']} noStyle>
            <Input placeholder="输入字体名称" />
          </Form.Item>
        ) : (
          <Form.Item name={[...name, 'preset']} noStyle>
            <Select
              disabled={mode === 'none'}
              options={COMMON_FONTS.map((item) => ({ label: item, value: item }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        )}
      </Space.Compact>
    </Form.Item>
  );
};

const SizeChoiceField: React.FC<{
  form: FormInstance<RuleFormValues>;
  label: string;
  name: NamePath;
}> = ({ form, label, name }) => {
  const mode = Form.useWatch([...name, 'mode'], form) as SizeMode | undefined;

  return (
    <Form.Item label={label}>
      <Space.Compact block>
        <Form.Item name={[...name, 'mode']} noStyle>
          <Select
            style={{ width: 120 }}
            options={[
              { label: '无要求', value: 'none' },
              { label: '常用字号', value: 'named' },
              { label: '自定义', value: 'custom' },
            ]}
          />
        </Form.Item>
        {mode === 'custom' ? (
          <>
            <Form.Item name={[...name, 'value']} noStyle>
              <InputNumber<number> style={{ width: '100%' }} min={5} max={72} step={0.5} precision={1} parser={toHalfStep} />
            </Form.Item>
            <Form.Item name={[...name, 'unit']} noStyle>
              <Select style={{ width: 90 }} options={[{ label: 'pt', value: 'pt' }, { label: '磅', value: '磅' }]} />
            </Form.Item>
          </>
        ) : (
          <Form.Item name={[...name, 'named']} noStyle>
            <Select
              disabled={mode === 'none'}
              options={NAMED_FONT_SIZES.map((item) => ({ label: item, value: item }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        )}
      </Space.Compact>
    </Form.Item>
  );
};

const LineHeightField: React.FC<{
  form: FormInstance<RuleFormValues>;
  label: string;
  name: NamePath;
}> = ({ form, label, name }) => {
  const mode = Form.useWatch([...name, 'mode'], form) as LineHeightMode | undefined;

  return (
    <Form.Item label={label}>
      <Space.Compact block>
        <Form.Item name={[...name, 'mode']} noStyle>
          <Select
            style={{ width: 120 }}
            options={[
              { label: '无要求', value: 'none' },
              { label: '固定值', value: 'fixed' },
              { label: '倍数', value: 'multiple' },
            ]}
          />
        </Form.Item>
        <Form.Item name={[...name, 'value']} noStyle>
          <InputNumber<number>
            style={{ width: '100%' }}
            disabled={mode === 'none'}
            min={mode === 'multiple' ? 1 : 10}
            max={mode === 'multiple' ? 5 : 72}
            step={0.5}
            precision={1}
            parser={toHalfStep}
          />
        </Form.Item>
        <Form.Item name={[...name, 'unit']} noStyle>
          <Select
            style={{ width: 100 }}
            disabled={mode === 'none'}
            options={mode === 'multiple'
              ? [{ label: '倍', value: '倍' }]
              : [{ label: 'pt', value: 'pt' }, { label: '磅', value: '磅' }]}
          />
        </Form.Item>
      </Space.Compact>
    </Form.Item>
  );
};

const SpacingField: React.FC<{
  form: FormInstance<RuleFormValues>;
  label: string;
  name: NamePath;
}> = ({ form, label, name }) => {
  const mode = Form.useWatch([...name, 'mode'], form) as SpacingMode | undefined;

  return (
    <Form.Item label={label}>
      <Space.Compact block>
        <Form.Item name={[...name, 'mode']} noStyle>
          <Select
            style={{ width: 120 }}
            options={[
              { label: '无要求', value: 'none' },
              { label: '自定义', value: 'custom' },
            ]}
          />
        </Form.Item>
        <Form.Item name={[...name, 'before']} noStyle>
          <InputNumber<number>
            style={{ width: '100%' }}
            disabled={mode === 'none'}
            min={0}
            max={72}
            step={0.5}
            precision={1}
            parser={toHalfStep}
            placeholder="段前"
          />
        </Form.Item>
        <Form.Item name={[...name, 'after']} noStyle>
          <InputNumber<number>
            style={{ width: '100%' }}
            disabled={mode === 'none'}
            min={0}
            max={72}
            step={0.5}
            precision={1}
            parser={toHalfStep}
            placeholder="段后"
          />
        </Form.Item>
        <Form.Item name={[...name, 'unit']} noStyle>
          <Select
            style={{ width: 90 }}
            disabled={mode === 'none'}
            options={[{ label: 'pt', value: 'pt' }, { label: '磅', value: '磅' }]}
          />
        </Form.Item>
      </Space.Compact>
    </Form.Item>
  );
};

const IndentField: React.FC<{
  form: FormInstance<RuleFormValues>;
  label: string;
  name: NamePath;
}> = ({ form, label, name }) => {
  const mode = Form.useWatch([...name, 'mode'], form) as IndentMode | undefined;

  return (
    <Form.Item label={label}>
      <Space.Compact block>
        <Form.Item name={[...name, 'mode']} noStyle>
          <Select
            style={{ width: 120 }}
            options={[
              { label: '无要求', value: 'none' },
              { label: '自定义', value: 'custom' },
            ]}
          />
        </Form.Item>
        <Form.Item name={[...name, 'value']} noStyle>
          <InputNumber<number>
            style={{ width: '100%' }}
            disabled={mode === 'none'}
            min={0}
            max={10}
            step={1}
            precision={0}
            parser={toInteger}
          />
        </Form.Item>
        <Form.Item name={[...name, 'unit']} noStyle>
          <Select style={{ width: 90 }} disabled options={[{ label: '字符', value: '字符' }]} />
        </Form.Item>
      </Space.Compact>
    </Form.Item>
  );
};

const AlignmentField: React.FC<{
  label: string;
  name: NamePath;
}> = ({ label, name }) => (
  <Form.Item name={name} label={label}>
    <Select
      options={[
        { label: '无要求', value: 'none' },
        { label: '居左', value: 'left' },
        { label: '居中', value: 'center' },
        { label: '居右', value: 'right' },
      ]}
    />
  </Form.Item>
);

const HeadingRuleCard: React.FC<{
  form: FormInstance<RuleFormValues>;
  name: number;
  remove: (index: number) => void;
}> = ({ form, name, remove }) => {
  const level = Form.useWatch(['headingRules', name, 'level'], form) as number | undefined;

  return (
    <Card
      size="small"
      title={`标题层级 ${level ?? ''}`}
      extra={
        <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)}>
          删除
        </Button>
      }
    >
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name={['headingRules', name, 'level']} label="级别">
            <InputNumber<number> style={{ width: '100%' }} min={1} max={9} step={1} precision={0} parser={toInteger} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <FontChoiceField form={form} label="字体" name={['headingRules', name, 'font']} />
        </Col>
        <Col span={8}>
          <SizeChoiceField form={form} label="字号" name={['headingRules', name, 'size']} />
        </Col>
        <Col span={8}>
                    <AlignmentField label="对齐方式" name={['headingRules', name, 'alignment']} />
        </Col>
        <Col span={8}>
          <LineHeightField form={form} label="行距" name={['headingRules', name, 'lineHeight']} />
        </Col>
        <Col span={8}>
          <SpacingField form={form} label="段前段后" name={['headingRules', name, 'spacing']} />
        </Col>
        <Col span={8}>
          <IndentField form={form} label="首行缩进" name={['headingRules', name, 'indent']} />
        </Col>
      </Row>
    </Card>
  );
};

const RulesConfig: React.FC = () => {
  const [form] = Form.useForm<RuleFormValues>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<RuleTemplate | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId');
  const referencePreset = Form.useWatch(['reference', 'preset'], form);
  const headingRulesValue = Form.useWatch('headingRules', form) as unknown;
  const headingRules = ensureHeadingRuleArray(headingRulesValue);

  const nextHeadingLevel = useMemo(() => {
    const levels = headingRules.map((item) => item.level).filter((value) => Number.isFinite(value));
    return levels.length > 0 ? Math.max(...levels) + 1 : 1;
  }, [headingRules]);

  useEffect(() => {
    if (!templateId) {
      setCurrentTemplate(null);
      form.setFieldsValue(defaultFormValues());
      return;
    }

    const loadTemplate = async () => {
      setLoading(true);
      try {
        const template = await api.getTemplate(templateId);
        setCurrentTemplate(template);
        form.setFieldsValue(buildFormValues({ ...defaultRules, ...template.config }, template));
      } catch {
        message.error('加载模板失败');
      } finally {
        setLoading(false);
      }
    };

    void loadTemplate();
  }, [form, templateId]);

  const handleValuesChange = (changedValues: Partial<RuleFormValues>) => {
    if (!changedValues.header?.preset) {
      if (changedValues.coverItems) {
        const nextCoverItems = ensureStringArray(changedValues.coverItems);
        const normalized = nextCoverItems.includes(NO_REQUIREMENT)
          ? [NO_REQUIREMENT]
          : nextCoverItems.filter((item) => item !== NO_REQUIREMENT);
        if (normalized.join('|') !== ensureStringArray(form.getFieldValue('coverItems')).join('|')) {
          form.setFieldValue('coverItems', normalized);
        }
      }

      if (changedValues.requiredSections) {
        const nextRequiredSections = ensureStringArray(changedValues.requiredSections);
        const normalized = nextRequiredSections.includes(NO_REQUIREMENT)
          ? [NO_REQUIREMENT]
          : nextRequiredSections.filter((item) => item !== NO_REQUIREMENT);
        if (normalized.join('|') !== ensureStringArray(form.getFieldValue('requiredSections')).join('|')) {
          form.setFieldValue('requiredSections', normalized);
        }
      }

      return;
    }

    const preset = HEADER_PRESET_OPTIONS.find((item) => item.value === changedValues.header?.preset);
    if (!preset) {
      return;
    }

    if (preset.value === 'custom') {
      return;
    }

    form.setFieldsValue({
      header: {
        ...form.getFieldValue('header'),
        preset: preset.value,
        oddText: preset.oddText,
        evenText: preset.evenText,
      },
    });
  };

  const handleSave = async (values: RuleFormValues) => {
    const normalizedHeadingRules = ensureHeadingRuleArray(values.headingRules)
      .filter((item) => Number.isFinite(item.level))
      .slice()
      .sort((left, right) => left.level - right.level);
    const levelSet = new Set<number>();
    for (const item of normalizedHeadingRules) {
      if (levelSet.has(item.level)) {
        message.error(`标题层级 ${item.level} 重复了，请调整后再保存`);
        return;
      }

      levelSet.add(item.level);
    }

    if (values.abstract.lengthMode === 'custom' && values.abstract.minLength > values.abstract.maxLength) {
      message.error('摘要字数范围设置有误，最少字数不能大于最多字数');
      return;
    }

    if (values.keywords.countMode === 'custom' && values.keywords.minCount > values.keywords.maxCount) {
      message.error('关键词数量范围设置有误，最少数量不能大于最多数量');
      return;
    }

    setSaving(true);
    try {
      const { templateName, description, ...configValues } = values;
      const normalizedValues = {
        templateName,
        description,
        ...configValues,
        headingRules: normalizedHeadingRules,
      };
      await api.saveTemplate({
        id: currentTemplate?.id,
        name: templateName,
        description,
        config: buildRuleConfig(normalizedValues),
        isDefault: currentTemplate?.isDefault ?? false,
      });
      form.setFieldValue('headingRules', normalizedHeadingRules);
      message.success(currentTemplate ? '模板更新成功' : '模板保存成功');
      navigate('/templates');
    } catch {
      message.error('模板保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (currentTemplate) {
      form.setFieldsValue(buildFormValues({ ...defaultRules, ...currentTemplate.config }, currentTemplate));
      return;
    }

    form.setFieldsValue(defaultFormValues());
  };

  return (
    <div data-testid="page-rules" style={{ maxWidth: 1220, margin: '0 auto' }}>
      <Card variant="borderless" title={<span style={{ fontSize: 20 }}>{currentTemplate ? '编辑模板' : '规则配置'}</span>}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 16 }} />
        ) : (
          <>
            <Form
              form={form}
              layout="vertical"
              initialValues={defaultFormValues()}
              onValuesChange={handleValuesChange}
              onFinish={handleSave}
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name="templateName" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
                    <Input placeholder="例如：地大本科毕业论文模板" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="description" label="模板说明">
                    <Input placeholder="说明这套规则适用的论文类型" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>页面与页眉页码</Divider>
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="pageSize" label="纸张规格">
                    <Select
                      options={[
                        { label: '无要求', value: 'none' },
                        { label: 'A4（210 × 297 mm）', value: 'A4' },
                        { label: 'B5（176 × 250 mm）', value: 'B5' },
                        { label: 'A3（297 × 420 mm）', value: 'A3' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item label="页边距">
                    <Space.Compact block>
                      <Form.Item name={['margin', 'mode']} noStyle>
                        <Select
                          style={{ width: 120 }}
                          options={[
                            { label: '无要求', value: 'none' },
                            { label: '自定义', value: 'custom' },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item name={['margin', 'top']} noStyle>
                        <InputNumber<number> style={{ width: '100%' }} min={0} max={10} step={0.5} precision={1} parser={toHalfStep} placeholder="上" disabled={Form.useWatch(['margin', 'mode'], form) === 'none'} />
                      </Form.Item>
                      <Form.Item name={['margin', 'bottom']} noStyle>
                        <InputNumber<number> style={{ width: '100%' }} min={0} max={10} step={0.5} precision={1} parser={toHalfStep} placeholder="下" disabled={Form.useWatch(['margin', 'mode'], form) === 'none'} />
                      </Form.Item>
                      <Form.Item name={['margin', 'left']} noStyle>
                        <InputNumber<number> style={{ width: '100%' }} min={0} max={10} step={0.5} precision={1} parser={toHalfStep} placeholder="左" disabled={Form.useWatch(['margin', 'mode'], form) === 'none'} />
                      </Form.Item>
                      <Form.Item name={['margin', 'right']} noStyle>
                        <InputNumber<number> style={{ width: '100%' }} min={0} max={10} step={0.5} precision={1} parser={toHalfStep} placeholder="右" disabled={Form.useWatch(['margin', 'mode'], form) === 'none'} />
                      </Form.Item>
                      <Form.Item name={['margin', 'unit']} noStyle>
                        <Select style={{ width: 100 }} disabled={Form.useWatch(['margin', 'mode'], form) === 'none'} options={[{ label: 'cm', value: 'cm' }, { label: 'mm', value: 'mm' }]} />
                      </Form.Item>
                    </Space.Compact>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['header', 'preset']} label="页眉方案">
                    <Select options={HEADER_PRESET_OPTIONS.map((item) => ({ label: item.label, value: item.value }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['header', 'oddText']} label="奇数页页眉">
                    <Input placeholder="输入奇数页内容" disabled={Form.useWatch(['header', 'preset'], form) === 'none'} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['header', 'evenText']} label="偶数页页眉">
                    <Input placeholder="输入偶数页内容" disabled={Form.useWatch(['header', 'preset'], form) === 'none'} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['pageNumber', 'mode']} label="页码要求">
                    <Select options={[{ label: '无要求', value: 'none' }, { label: '自定义', value: 'custom' }]} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['pageNumber', 'position']} label="页码位置">
                    <Select disabled={Form.useWatch(['pageNumber', 'mode'], form) === 'none'} options={[{ label: '顶部', value: 'top' }, { label: '底部', value: 'bottom' }]} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['pageNumber', 'alignment']} label="页码对齐">
                    <Select
                      disabled={Form.useWatch(['pageNumber', 'mode'], form) === 'none'}
                      options={[
                        { label: '无要求', value: 'none' },
                        { label: '居左', value: 'left' },
                        { label: '居中', value: 'center' },
                        { label: '居右', value: 'right' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['pageNumber', 'style']} label="页码样式">
                    <Select
                      disabled={Form.useWatch(['pageNumber', 'mode'], form) === 'none'}
                      options={[
                        { label: '无要求', value: 'none' },
                        { label: '阿拉伯数字', value: 'arabic' },
                        { label: '小写罗马数字', value: 'romanLower' },
                        { label: '大写罗马数字', value: 'romanUpper' },
                        { label: '中文数字', value: 'chinese' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>正文格式</Divider>
              <Row gutter={24}>
                <Col span={12}>
                  <FontChoiceField form={form} label="正文字体" name={['body', 'font']} />
                </Col>
                <Col span={12}>
                  <SizeChoiceField form={form} label="正文字号" name={['body', 'fontSize']} />
                </Col>
                <Col span={12}>
                  <LineHeightField form={form} label="行距" name={['body', 'lineHeight']} />
                </Col>
                <Col span={12}>
                  <SpacingField form={form} label="段前段后" name={['body', 'spacing']} />
                </Col>
                <Col span={12}>
                  <IndentField form={form} label="首行缩进" name={['body', 'indent']} />
                </Col>
              </Row>

              <Divider>结构与章节</Divider>
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item label="封面字段">
                    <Form.Item name="coverItems" noStyle>
                      <Select
                        mode="tags"
                        tokenSeparators={[';', '；', ',']}
                        options={[NO_REQUIREMENT, ...COVER_ITEM_OPTIONS].map((item) => ({ label: item, value: item }))}
                        placeholder="选择或补充需要检查的封面字段"
                      />
                    </Form.Item>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="必需章节">
                    <Form.Item name="requiredSections" noStyle>
                      <Select
                        mode="tags"
                        tokenSeparators={[';', '；', ',']}
                        options={[NO_REQUIREMENT, ...REQUIRED_SECTION_OPTIONS].map((item) => ({ label: item, value: item }))}
                        placeholder="选择或补充必需章节"
                      />
                    </Form.Item>
                  </Form.Item>
                </Col>
              </Row>

              <Divider>标题层级</Divider>
              <Form.List name="headingRules">
                {(fields, { add, remove }) => (
                  <>
                    <Space style={{ marginBottom: 16 }}>
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => add(createHeadingRule(nextHeadingLevel))}
                      >
                        添加标题层级
                      </Button>
                      <span>可继续添加 4 级、5 级等标题规则</span>
                    </Space>
                    <Row gutter={[16, 16]}>
                      {fields.map((field) => (
                        <Col span={24} key={field.key}>
                          <HeadingRuleCard form={form} name={field.name} remove={remove} />
                        </Col>
                      ))}
                    </Row>
                  </>
                )}
              </Form.List>

              <Divider>摘要与关键词</Divider>
              <Row gutter={24}>
                <Col span={12}>
                  <Card size="small" title="摘要标题">
                    <FontChoiceField form={form} label="字体" name={['abstract', 'titleFont']} />
                    <SizeChoiceField form={form} label="字号" name={['abstract', 'titleSize']} />
                    <AlignmentField label="对齐方式" name={['abstract', 'titleAlignment']} />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="摘要正文">
                    <FontChoiceField form={form} label="字体" name={['abstract', 'bodyFont']} />
                    <SizeChoiceField form={form} label="字号" name={['abstract', 'bodySize']} />
                    <LineHeightField form={form} label="行距" name={['abstract', 'lineHeight']} />
                    <Form.Item label="字数范围">
                      <Space.Compact block>
                        <Form.Item name={['abstract', 'lengthMode']} noStyle>
                          <Select
                            style={{ width: 120 }}
                            options={[
                              { label: '无要求', value: 'none' },
                              { label: '自定义', value: 'custom' },
                            ]}
                          />
                        </Form.Item>
                        <Form.Item name={['abstract', 'minLength']} noStyle>
                          <InputNumber<number>
                            style={{ width: '100%' }}
                            min={0}
                            max={10000}
                            step={1}
                            precision={0}
                            parser={toInteger}
                            disabled={Form.useWatch(['abstract', 'lengthMode'], form) === 'none'}
                            placeholder="最少"
                          />
                        </Form.Item>
                        <Form.Item name={['abstract', 'maxLength']} noStyle>
                          <InputNumber<number>
                            style={{ width: '100%' }}
                            min={0}
                            max={10000}
                            step={1}
                            precision={0}
                            parser={toInteger}
                            disabled={Form.useWatch(['abstract', 'lengthMode'], form) === 'none'}
                            placeholder="最多"
                          />
                        </Form.Item>
                        <Button disabled style={{ width: 80 }}>
                          字
                        </Button>
                      </Space.Compact>
                    </Form.Item>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="关键词">
                    <FontChoiceField form={form} label="字体" name={['keywords', 'font']} />
                    <SizeChoiceField form={form} label="字号" name={['keywords', 'size']} />
                    <Form.Item name={['keywords', 'separator']} label="分隔符">
                      <Select
                        options={[
                          { label: '无要求', value: 'none' },
                          { label: '分号', value: 'semicolon' },
                          { label: '逗号', value: 'comma' },
                          { label: '顿号', value: 'dunhao' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name={['keywords', 'labelBold']} label="关键词标题样式">
                      <Select
                        options={[
                          { label: '无要求', value: 'none' },
                          { label: '加粗', value: 'bold' },
                          { label: '常规', value: 'normal' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item label="关键词数量">
                      <Space.Compact block>
                        <Form.Item name={['keywords', 'countMode']} noStyle>
                          <Select
                            style={{ width: 120 }}
                            options={[
                              { label: '无要求', value: 'none' },
                              { label: '自定义', value: 'custom' },
                            ]}
                          />
                        </Form.Item>
                        <Form.Item name={['keywords', 'minCount']} noStyle>
                          <InputNumber<number>
                            style={{ width: '100%' }}
                            min={1}
                            max={20}
                            step={1}
                            precision={0}
                            parser={toInteger}
                            disabled={Form.useWatch(['keywords', 'countMode'], form) === 'none'}
                            placeholder="最少"
                          />
                        </Form.Item>
                        <Form.Item name={['keywords', 'maxCount']} noStyle>
                          <InputNumber<number>
                            style={{ width: '100%' }}
                            min={1}
                            max={20}
                            step={1}
                            precision={0}
                            parser={toInteger}
                            disabled={Form.useWatch(['keywords', 'countMode'], form) === 'none'}
                            placeholder="最多"
                          />
                        </Form.Item>
                        <Button disabled style={{ width: 80 }}>
                          个
                        </Button>
                      </Space.Compact>
                    </Form.Item>
                  </Card>
                </Col>
              </Row>

              <Divider>参考文献与图表题注</Divider>
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item label="参考文献格式">
                    <Space.Compact block>
                      <Form.Item name={['reference', 'preset']} noStyle>
                        <Select
                          style={{ width: 160 }}
                          options={[
                            { label: '无要求', value: '__none__' },
                            ...REFERENCE_OPTIONS.map((item) => ({ label: item, value: item })),
                            { label: '自定义', value: '__custom__' },
                          ]}
                        />
                      </Form.Item>
                      {referencePreset === '__custom__' ? (
                        <Form.Item name={['reference', 'custom']} noStyle>
                          <Input placeholder="输入参考文献规范名称" />
                        </Form.Item>
                      ) : (
                        <Input disabled value={referencePreset === '__none__' ? '当前为无要求' : '已选择常用规范'} />
                      )}
                    </Space.Compact>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="图题注">
                    <Space.Compact block>
                      <Form.Item name={['figureCaption', 'mode']} noStyle>
                        <Select style={{ width: 120 }} options={[{ label: '无要求', value: 'none' }, { label: '自定义', value: 'custom' }]} />
                      </Form.Item>
                      <Form.Item name={['figureCaption', 'position']} noStyle>
                        <Select disabled={Form.useWatch(['figureCaption', 'mode'], form) === 'none'} options={[{ label: '图上方', value: 'above' }, { label: '图下方', value: 'below' }]} />
                      </Form.Item>
                    </Space.Compact>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="表题注">
                    <Space.Compact block>
                      <Form.Item name={['tableCaption', 'mode']} noStyle>
                        <Select style={{ width: 120 }} options={[{ label: '无要求', value: 'none' }, { label: '自定义', value: 'custom' }]} />
                      </Form.Item>
                      <Form.Item name={['tableCaption', 'position']} noStyle>
                        <Select disabled={Form.useWatch(['tableCaption', 'mode'], form) === 'none'} options={[{ label: '表上方', value: 'above' }, { label: '表下方', value: 'below' }]} />
                      </Form.Item>
                    </Space.Compact>
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Button type="primary" htmlType="submit" size="large" loading={saving} style={{ width: 160 }}>
                  {currentTemplate ? '保存修改' : '保存为模板'}
                </Button>
                <Button size="large" style={{ marginLeft: 16 }} onClick={handleReset}>
                  {currentTemplate ? '恢复当前模板' : '恢复默认值'}
                </Button>
              </div>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
};

export default RulesConfig;
