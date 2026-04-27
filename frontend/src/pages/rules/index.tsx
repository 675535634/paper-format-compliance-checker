import { useEffect, useMemo, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Form,
  Tabs,
  type FormInstance,
  Input,
  InputNumber,
  Row,
  Select,
  Skeleton,
  Space,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { api, isUnauthorizedError } from '../../api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PaperRuleConfig, RuleTemplate } from '../../types';
import { useI18n } from '../../i18n';

type NamePath = Array<string | number>;
type FontMode = 'none' | 'preset' | 'custom';
type SizeMode = 'none' | 'named' | 'custom';
type LineHeightMode = 'none' | 'fixed' | 'multiple';
type SpacingMode = 'none' | 'custom';
type IndentMode = 'none' | 'custom';
type AlignmentOption = 'none' | 'left' | 'center' | 'right' | 'justify';
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

interface ParagraphStyleFormValue {
  font: FontChoiceValue;
  size: SizeChoiceValue;
  alignment: AlignmentOption;
  lineHeight: LineHeightValue;
  spacing: SpacingValue;
  indent: IndentValue;
}

interface CaptionFormValue extends ParagraphStyleFormValue {
  mode: CaptionMode;
  position: 'above' | 'below';
}

interface TocFormValue {
  mode: 'none' | 'custom';
  title: ParagraphStyleFormValue;
  chapter: ParagraphStyleFormValue;
  section: ParagraphStyleFormValue;
  subsection: ParagraphStyleFormValue;
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
    style: ParagraphStyleFormValue;
  };
  pageNumber: {
    mode: PageNumberMode;
    position: PagePosition;
    alignment: AlignmentOption;
    style: NumberStyle;
    textStyle: ParagraphStyleFormValue;
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
    titleBold: 'none' | 'bold' | 'normal';
    titleAlignment: AlignmentOption;
    titleLineHeight: LineHeightValue;
    titleSpacing: SpacingValue;
    bodyFont: FontChoiceValue;
    bodySize: SizeChoiceValue;
    lineHeight: LineHeightValue;
    bodySpacing: SpacingValue;
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
  figureCaption: CaptionFormValue;
  tableCaption: CaptionFormValue;
  toc: TocFormValue;
}

const NO_REQUIREMENT = '无要求';
const TEMPLATE_NAME_DEFAULT = '地大论文检查模板';
const COMMON_FONTS = ['宋体', '黑体', '楷体', '仿宋', '仿宋_GB2312', 'Times New Roman'];
const NAMED_FONT_SIZES = ['初号', '小初', '一号', '小一', '二号', '小二', '三号', '小三', '四号', '小四', '五号', '小五'];
const REFERENCE_OPTIONS: ReferencePreset[] = ['GB/T 7714-2005', 'GB/T 7714-2015', 'APA', 'MLA', 'IEEE'];
const COVER_ITEM_OPTIONS = ['论文题目', '教学点名称', '学号', '学生姓名', '学科专业', '指导教师', '评阅教师', '完成时间'];
const REQUIRED_SECTION_OPTIONS = ['毕业论文原创性声明', '摘要', '目录', '图清单', '表清单', '致谢', '参考文献', '附录', '指导教师指导意见表', '评阅教师评阅意见表'];
const HEADER_PRESET_OPTIONS: Array<{ value: HeaderPreset; oddText: string; evenText: string }> = [
  { value: 'none', oddText: '', evenText: '' },
  { value: 'geoscienceDefault', oddText: '地大高等学历继续教育', evenText: '学生姓名：论文题目' },
  { value: 'sameSchoolName', oddText: '地大高等学历继续教育', evenText: '地大高等学历继续教育' },
  { value: 'custom', oddText: '', evenText: '' },
];

const FONT_DISPLAY_LABELS: Record<string, string> = {
  宋体: 'SimSun (宋体)',
  黑体: 'SimHei (黑体)',
  楷体: 'KaiTi (楷体)',
  仿宋: 'FangSong (仿宋)',
  仿宋_GB2312: 'FangSong GB2312 (仿宋_GB2312)',
  'Times New Roman': 'Times New Roman',
};

const NAMED_SIZE_DISPLAY_LABELS: Record<string, string> = {
  初号: 'Chuhao (初号)',
  小初: 'Small Chuhao (小初)',
  一号: 'No. 1 (一号)',
  小一: 'Small No. 1 (小一)',
  二号: 'No. 2 (二号)',
  小二: 'Small No. 2 (小二)',
  三号: 'No. 3 (三号)',
  小三: 'Small No. 3 (小三)',
  四号: 'No. 4 (四号)',
  小四: 'Small No. 4 (小四)',
  五号: 'No. 5 (五号)',
  小五: 'Small No. 5 (小五)',
};

const COVER_ITEM_DISPLAY_LABELS: Record<string, string> = {
  论文题目: 'Paper Title',
  教学点名称: 'Teaching Center',
  学号: 'Student ID',
  学生姓名: 'Student Name',
  学科专业: 'Major',
  指导教师: 'Supervisor',
  评阅教师: 'Reviewer',
  完成时间: 'Completion Date',
};

const REQUIRED_SECTION_DISPLAY_LABELS: Record<string, string> = {
  毕业论文原创性声明: 'Originality Statement',
  摘要: 'Abstract',
  目录: 'Table of Contents',
  图清单: 'List of Figures',
  表清单: 'List of Tables',
  致谢: 'Acknowledgements',
  参考文献: 'References',
  附录: 'Appendix',
  指导教师指导意见表: 'Supervisor Review Form',
  评阅教师评阅意见表: 'Reviewer Evaluation Form',
};

const getRulesCopy = (isEnglish: boolean) => isEnglish
  ? {
      defaultTemplateName: 'CUG Thesis Checker Template',
      pageTitleCreate: 'Rule Settings',
      pageTitleEdit: 'Edit Template',
      templateName: 'Template Name',
      templateDescription: 'Description',
      templateNamePlaceholder: 'For example: CUG undergraduate thesis template',
      templateDescriptionPlaceholder: 'Describe which thesis type this rule set applies to',
      sectionPage: 'Page, Header, and Page Number',
      sectionBody: 'Body Text',
      sectionStructure: 'Structure and Sections',
      sectionHeading: 'Heading Levels',
      sectionAbstract: 'Abstract and Keywords',
      sectionReference: 'References, Captions, and TOC',
      paperSize: 'Paper Size',
      margin: 'Margins',
      headerPreset: 'Header Preset',
      oddHeader: 'Odd-Page Header',
      evenHeader: 'Even-Page Header',
      headerStyle: 'Header Text Style',
      pageNumberRule: 'Page Number Rule',
      pageNumberPosition: 'Page Number Position',
      pageNumberAlignment: 'Page Number Alignment',
      pageNumberStyle: 'Page Number Style',
      footerStyle: 'Footer Text Style',
      bodyFont: 'Body Font',
      bodySize: 'Body Font Size',
      lineHeight: 'Line Height',
      spacing: 'Paragraph Spacing',
      indent: 'First-Line Indent',
      coverItems: 'Cover Fields',
      coverItemsPlaceholder: 'Select or add cover fields to check',
      requiredSections: 'Required Sections',
      requiredSectionsPlaceholder: 'Select or add required sections',
      addHeading: 'Add Heading Level',
      addHeadingHint: 'Add level-4, level-5, and deeper heading rules as needed.',
      headingLevelTitle: 'Heading Level',
      delete: 'Delete',
      level: 'Level',
      abstractTitle: 'Abstract Title',
      abstractTitleStyle: 'Title Style',
      abstractBody: 'Abstract Body',
      abstractLength: 'Word Count Range',
      keywords: 'Keywords',
      keywordSeparator: 'Separator',
      keywordLabelStyle: 'Keyword Label Style',
      keywordCount: 'Keyword Count',
      referenceFormat: 'Reference Format',
      figureCaption: 'Figure Caption',
      tableCaption: 'Table Caption',
      toc: 'Table of Contents',
      tocTitle: 'TOC Title',
      tocChapter: 'Chapter TOC Entries',
      tocSection: 'First-Level Section TOC Entries',
      tocSubsection: 'Second-Level Section TOC Entries',
      checkMode: 'Check Mode',
      font: 'Font',
      size: 'Font Size',
      alignment: 'Alignment',
      position: 'Position',
      fixedValue: 'Fixed',
      multiple: 'Multiple',
      noRequirement: 'No Requirement',
      commonFonts: 'Common Fonts',
      commonSizes: 'Named Sizes',
      custom: 'Custom',
      customFontPlaceholder: 'Enter a font name',
      before: 'Before',
      after: 'After',
      character: 'chars',
      left: 'Left',
      center: 'Center',
      right: 'Right',
      justify: 'Justify',
      top: 'Top',
      bottom: 'Bottom',
      arabic: 'Arabic',
      romanLower: 'Roman Lower',
      romanUpper: 'Roman Upper',
      chineseNumber: 'Chinese Numerals',
      semicolon: 'Semicolon',
      comma: 'Comma',
      dunhao: 'Dunhao',
      bold: 'Bold',
      normal: 'Normal',
      customHeader: 'Custom Header',
      geoscienceDefault: 'CUG Continuing Education Header',
      sameSchoolName: 'School Name on Both Pages',
      leftAlign: 'Align Left',
      centerAlign: 'Center',
      rightAlign: 'Align Right',
      customReferencePlaceholder: 'Enter a reference style name',
      currentNone: 'Currently set to no requirement',
      currentPreset: 'A common reference style is selected',
      saveCreate: 'Save Template',
      saveEdit: 'Save Changes',
      resetCreate: 'Reset to Default',
      resetEdit: 'Restore Template',
      loadTemplateFailed: 'Failed to load the template.',
      duplicateHeadingLevel: (level: number) => `Heading level ${level} is duplicated. Please adjust it before saving.`,
      abstractRangeInvalid: 'The abstract word-count range is invalid. The minimum cannot be greater than the maximum.',
      keywordsRangeInvalid: 'The keyword-count range is invalid. The minimum cannot be greater than the maximum.',
      saveCreateSuccess: 'Template saved.',
      saveEditSuccess: 'Template updated.',
      saveFailed: 'Failed to save the template.',
    }
  : {
      defaultTemplateName: TEMPLATE_NAME_DEFAULT,
      pageTitleCreate: '规则配置',
      pageTitleEdit: '编辑模板',
      templateName: '模板名称',
      templateDescription: '模板说明',
      templateNamePlaceholder: '例如：地大本科毕业论文模板',
      templateDescriptionPlaceholder: '说明这套规则适用的论文类型',
      sectionPage: '页面与页眉页码',
      sectionBody: '正文格式',
      sectionStructure: '结构与章节',
      sectionHeading: '标题层级',
      sectionAbstract: '摘要与关键词',
      sectionReference: '参考文献、图表题注与目录',
      paperSize: '纸张规格',
      margin: '页边距',
      headerPreset: '页眉方案',
      oddHeader: '奇数页页眉',
      evenHeader: '偶数页页眉',
      headerStyle: '页眉文字样式',
      pageNumberRule: '页码要求',
      pageNumberPosition: '页码位置',
      pageNumberAlignment: '页码对齐',
      pageNumberStyle: '页码样式',
      footerStyle: '页脚文字样式',
      bodyFont: '正文字体',
      bodySize: '正文字号',
      lineHeight: '行距',
      spacing: '段前段后',
      indent: '首行缩进',
      coverItems: '封面字段',
      coverItemsPlaceholder: '选择或补充需要检查的封面字段',
      requiredSections: '必需章节',
      requiredSectionsPlaceholder: '选择或补充必需章节',
      addHeading: '添加标题层级',
      addHeadingHint: '可继续添加 4 级、5 级等标题规则',
      headingLevelTitle: '标题层级',
      delete: '删除',
      level: '级别',
      abstractTitle: '摘要标题',
      abstractTitleStyle: '标题字形',
      abstractBody: '摘要正文',
      abstractLength: '字数范围',
      keywords: '关键词',
      keywordSeparator: '分隔符',
      keywordLabelStyle: '关键词标题样式',
      keywordCount: '关键词数量',
      referenceFormat: '参考文献格式',
      figureCaption: '图题注',
      tableCaption: '表题注',
      toc: '目录',
      tocTitle: '目录标题',
      tocChapter: '各章目录',
      tocSection: '一级节标题目录',
      tocSubsection: '二级节标题目录',
      checkMode: '检查方式',
      font: '字体',
      size: '字号',
      alignment: '对齐方式',
      position: '位置',
      fixedValue: '固定值',
      multiple: '倍数',
      noRequirement: '无要求',
      commonFonts: '常用字体',
      commonSizes: '常用字号',
      custom: '自定义',
      customFontPlaceholder: '输入字体名称',
      before: '段前',
      after: '段后',
      character: '字符',
      left: '居左',
      center: '居中',
      right: '居右',
      justify: '两端对齐',
      top: '顶部',
      bottom: '底部',
      arabic: '阿拉伯数字',
      romanLower: '小写罗马数字',
      romanUpper: '大写罗马数字',
      chineseNumber: '中文数字',
      semicolon: '分号',
      comma: '逗号',
      dunhao: '顿号',
      bold: '加粗',
      normal: '常规',
      customHeader: '自定义页眉',
      geoscienceDefault: '地大成教默认页眉',
      sameSchoolName: '奇偶页都显示学校名称',
      leftAlign: '居左',
      centerAlign: '居中',
      rightAlign: '居右',
      customReferencePlaceholder: '输入参考文献规范名称',
      currentNone: '当前为无要求',
      currentPreset: '已选择常用规范',
      saveCreate: '保存为模板',
      saveEdit: '保存修改',
      resetCreate: '恢复默认值',
      resetEdit: '恢复当前模板',
      loadTemplateFailed: '加载模板失败',
      duplicateHeadingLevel: (level: number) => `标题层级 ${level} 重复了，请调整后再保存`,
      abstractRangeInvalid: '摘要字数范围设置有误，最少字数不能大于最多字数',
      keywordsRangeInvalid: '关键词数量范围设置有误，最少数量不能大于最多数量',
      saveCreateSuccess: '模板保存成功',
      saveEditSuccess: '模板更新成功',
      saveFailed: '模板保存失败',
    };

type RulesCopy = ReturnType<typeof getRulesCopy>;

const toNamePathArray = (name: NamePath | string | number): Array<string | number> =>
  Array.isArray(name) ? name : [name];

const toFieldDomId = (name: NamePath | string | number, suffix?: string): string =>
  ['rule', ...toNamePathArray(name).map((segment) => String(segment)), suffix]
    .filter(Boolean)
    .join('-')
    .replace(/[^a-zA-Z0-9_-]/g, '-');

const getDisplayLabel = (
  value: string,
  isEnglish: boolean,
  displayMap: Record<string, string>
): string => (isEnglish ? displayMap[value] ?? value : value);

const getHeaderPresetLabel = (value: HeaderPreset, copy: RulesCopy): string => {
  switch (value) {
    case 'none':
      return copy.noRequirement;
    case 'geoscienceDefault':
      return copy.geoscienceDefault;
    case 'sameSchoolName':
      return copy.sameSchoolName;
    case 'custom':
      return copy.customHeader;
    default:
      return value;
  }
};

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

const createParagraphStyle = (options?: Partial<ParagraphStyleFormValue>): ParagraphStyleFormValue => ({
  font: options?.font ?? noRequirementFontChoice(),
  size: options?.size ?? noRequirementSizeChoice(),
  alignment: options?.alignment ?? 'none',
  lineHeight: options?.lineHeight ?? noRequirementLineHeight(),
  spacing: options?.spacing ?? noRequirementSpacing(),
  indent: options?.indent ?? noRequirementIndent(),
});

const createCaptionRule = (
  position: 'above' | 'below',
  options?: Partial<Omit<CaptionFormValue, 'mode' | 'position'>>
): CaptionFormValue => ({
  mode: 'custom',
  position,
  ...createParagraphStyle(options),
});

const defaultRules: PaperRuleConfig = {
  pageSize: 'A4',
  margin: '上3cm，下3cm，左3cm，右3cm',
  headerRule: '奇数页：地大高等学历继续教育；偶数页：学生姓名：论文题目',
  coverItems: '论文题目; 教学点名称; 学号; 学生姓名; 学科专业; 指导教师; 评阅教师; 完成时间',
  requiredSections: '毕业论文原创性声明; 目录; 致谢; 指导教师指导意见表; 评阅教师评阅意见表',
  bodyFont: '宋体',
  bodyFontSize: '小四',
  lineHeight: '20pt',
  paragraphSpacing: '段前 0pt，段后 0pt',
  firstLineIndent: '2字符',
  headingFormats: 'Level 1: 黑体 三号; Level 2: 黑体 四号; Level 3: 黑体 小四',
  pageNumberRule: '底部居中，阿拉伯数字',
  abstractFormat: '摘要标题|字体=黑体|字号=小二|字形=加粗|对齐=居中|行距=1倍|段前=0pt|段后=0pt；正文|字体=宋体|字号=小四|行距=20pt|段前=0pt|段后=0pt；300-500字',
  keywordFormat: '关键词三字加粗；宋体小四；3-5个，词间用分号分隔',
  referenceFormat: 'GB/T 7714-2005',
  figureCaptionRule: '图题注|位置=下方|对齐=居中|字体=宋体|字号=五号|行距=无要求|段前=0pt|段后=0pt|首行缩进=无要求',
  tableCaptionRule: '表题注|位置=上方|对齐=居中|字体=宋体|字号=五号|行距=无要求|段前=0pt|段后=0pt|首行缩进=无要求',
  tocRule: '目录标题|字体=黑体|字号=三号|对齐=居中|行距=1倍|段前=无要求|段后=无要求|首行缩进=无要求；各章目录|字体=宋体|字号=四号|对齐=两端对齐|行距=20pt|段前=0pt|段后=0pt|首行缩进=无要求；一级节标题目录|字体=宋体|字号=小四|对齐=两端对齐|行距=20pt|段前=0pt|段后=0pt|首行缩进=1字符；二级节标题目录|字体=宋体|字号=小四|对齐=两端对齐|行距=20pt|段前=0pt|段后=0pt|首行缩进=2字符',
};

const defaultFormValues = (templateNameDefault = TEMPLATE_NAME_DEFAULT): RuleFormValues => ({
  templateName: templateNameDefault,
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
    style: createParagraphStyle(),
  },
  pageNumber: {
    mode: 'custom',
    position: 'bottom',
    alignment: 'center',
    style: 'arabic',
    textStyle: createParagraphStyle(),
  },
  body: {
    font: defaultFontChoice('宋体'),
    fontSize: defaultSizeChoice('小四'),
    lineHeight: defaultLineHeight(),
    spacing: defaultSpacing(),
    indent: defaultIndent(),
  },
  coverItems: [...COVER_ITEM_OPTIONS],
  requiredSections: ['毕业论文原创性声明', '目录', '致谢', '指导教师指导意见表', '评阅教师评阅意见表'],
  headingRules: [
    createHeadingRule(1, '三号'),
    createHeadingRule(2, '四号'),
    createHeadingRule(3, '小四'),
  ],
  abstract: {
    titleFont: defaultFontChoice('黑体'),
    titleSize: defaultSizeChoice('小二'),
    titleBold: 'bold',
    titleAlignment: 'center',
    titleLineHeight: {
      mode: 'multiple',
      value: 1,
      unit: '倍',
    },
    titleSpacing: defaultSpacing(),
    bodyFont: defaultFontChoice('宋体'),
    bodySize: defaultSizeChoice('小四'),
    lineHeight: {
      mode: 'fixed',
      value: 20,
      unit: '磅',
    },
    bodySpacing: defaultSpacing(),
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
  figureCaption: createCaptionRule('below', {
    font: defaultFontChoice('宋体'),
    size: defaultSizeChoice('五号'),
    alignment: 'center',
    spacing: defaultSpacing(),
  }),
  tableCaption: createCaptionRule('above', {
    font: defaultFontChoice('宋体'),
    size: defaultSizeChoice('五号'),
    alignment: 'center',
    spacing: defaultSpacing(),
  }),
  toc: {
    mode: 'custom',
    title: createParagraphStyle({
      font: defaultFontChoice('黑体'),
      size: defaultSizeChoice('三号'),
      alignment: 'center',
      lineHeight: {
        mode: 'multiple',
        value: 1,
        unit: '倍',
      },
    }),
    chapter: createParagraphStyle({
      font: defaultFontChoice('宋体'),
      size: defaultSizeChoice('四号'),
      alignment: 'justify',
      lineHeight: defaultLineHeight(),
      spacing: defaultSpacing(),
    }),
    section: createParagraphStyle({
      font: defaultFontChoice('宋体'),
      size: defaultSizeChoice('小四'),
      alignment: 'justify',
      lineHeight: defaultLineHeight(),
      spacing: defaultSpacing(),
      indent: {
        mode: 'custom',
        value: 1,
        unit: '字符',
      },
    }),
    subsection: createParagraphStyle({
      font: defaultFontChoice('宋体'),
      size: defaultSizeChoice('小四'),
      alignment: 'justify',
      lineHeight: defaultLineHeight(),
      spacing: defaultSpacing(),
      indent: {
        mode: 'custom',
        value: 2,
        unit: '字符',
      },
    }),
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
const hasNoRequirement = (value?: string | null): boolean => !value || value.trim() === '' || value.trim() === NO_REQUIREMENT;
const includesNoRequirement = (value?: string | null): boolean => !value || value.includes(NO_REQUIREMENT);

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

  return `${formatNumber(value.value)}倍`;
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
  if (includesNoRequirement(resolved)) {
    return noRequirementFontChoice();
  }

  return COMMON_FONTS.includes(resolved)
    ? { mode: 'preset', preset: resolved, custom: '' }
    : { mode: 'custom', preset: fallback, custom: resolved };
};

const parseSizeChoice = (value: string | undefined, fallback: string): SizeChoiceValue => {
  const resolved = value?.trim() || fallback;
  if (includesNoRequirement(resolved)) {
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
  if (includesNoRequirement(resolved)) {
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
  if (includesNoRequirement(resolved)) {
    return noRequirementSpacing();
  }

  const beforeMatch = resolved.match(/(?:Before|段前)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(pt|磅)?/i);
  const afterMatch = resolved.match(/(?:After|段后)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(pt|磅)?/i);

  return {
    mode: 'custom',
    before: beforeMatch ? Number.parseFloat(beforeMatch[1]) : fallback.before,
    after: afterMatch ? Number.parseFloat(afterMatch[1]) : fallback.after,
    unit: beforeMatch?.[2] === '磅' || afterMatch?.[2] === '磅' ? '磅' : fallback.unit,
  };
};

const parseIndent = (value: string | undefined, fallback: IndentValue): IndentValue => {
  const resolved = value ?? '';
  if (includesNoRequirement(resolved)) {
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
  if (includesNoRequirement(resolved)) {
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
    return { preset: 'none', oddText: '', evenText: '', style: fallback.style };
  }

  const segments = splitTokens(value);
  const oddSegment = segments.find((item) => item.includes('奇数页')) ?? value ?? '';
  const evenSegment = segments.find((item) => item.includes('偶数页')) ?? value ?? '';
  const styleSegment = segments.find((item) => item.includes('页眉样式'));
  const oddText = oddSegment.match(/奇数页[:：]\s*(.+)$/)?.[1]?.trim() ?? fallback.oddText;
  const evenText = evenSegment.match(/偶数页[:：]\s*(.+)$/)?.[1]?.trim() ?? fallback.evenText;
  const preset = HEADER_PRESET_OPTIONS.find((item) => item.oddText === oddText && item.evenText === evenText)?.value ?? 'custom';

  return {
    preset,
    oddText,
    evenText,
    style: parseParagraphStyle(styleSegment, fallback.style),
  };
};

const parsePageNumber = (value: string | undefined, fallback: RuleFormValues['pageNumber']): RuleFormValues['pageNumber'] => {
  if (hasNoRequirement(value)) {
    return { ...fallback, mode: 'none', alignment: 'none', style: 'none' };
  }

  const segments = splitTokens(value);
  const descriptorSegment = segments.find((item) => !item.includes('页脚样式')) ?? value ?? '';
  const styleSegment = segments.find((item) => item.includes('页脚样式'));
  return {
    mode: 'custom',
    position: descriptorSegment.includes('顶部') ? 'top' : fallback.position,
    alignment: descriptorSegment.includes('居左') || descriptorSegment.includes('左对齐')
      ? 'left'
      : descriptorSegment.includes('居右') || descriptorSegment.includes('右对齐')
        ? 'right'
        : 'center',
    style: descriptorSegment.includes('大写罗马')
      ? 'romanUpper'
      : descriptorSegment.includes('小写罗马')
        ? 'romanLower'
        : descriptorSegment.includes('中文')
          ? 'chinese'
          : 'arabic',
    textStyle: parseParagraphStyle(styleSegment, fallback.textStyle),
  };
};

const parseAlignmentOption = (value: string | undefined): AlignmentOption => {
  const resolved = value ?? '';
  if (hasNoRequirement(resolved)) {
    return 'none';
  }

  if (resolved.includes('两端对齐') || /\b(?:both|justify|justified)\b/i.test(resolved)) {
    return 'justify';
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
  const titleSegment = segments.find((item) => item.includes('摘要标题') || item.includes('标题')) ?? '';
  const bodySegment = segments.find((item) => item.includes('摘要正文') || item.includes('正文')) ?? '';
  const lengthSegment = segments.find((item) => item.includes('字')) ?? '';
  const lengthMatch = lengthSegment.match(/(\d+)\s*[-~至]\s*(\d+)/);
  const titleStyle = parseParagraphStyle(titleSegment, createParagraphStyle({
    font: fallback.titleFont,
    size: fallback.titleSize,
    alignment: fallback.titleAlignment,
    lineHeight: fallback.titleLineHeight,
    spacing: fallback.titleSpacing,
  }));
  const bodyStyle = parseParagraphStyle(bodySegment, createParagraphStyle({
    font: fallback.bodyFont,
    size: fallback.bodySize,
    lineHeight: fallback.lineHeight,
    spacing: fallback.bodySpacing,
  }));

  return {
    titleFont: titleStyle.font,
    titleSize: titleStyle.size,
    titleBold: titleSegment.includes('加粗') || /\bbold\b/i.test(titleSegment)
      ? 'bold'
      : titleSegment.includes('常规') || /\bnormal\b/i.test(titleSegment)
        ? 'normal'
        : fallback.titleBold,
    titleAlignment: titleStyle.alignment,
    titleLineHeight: titleStyle.lineHeight,
    titleSpacing: titleStyle.spacing,
    bodyFont: bodyStyle.font,
    bodySize: bodyStyle.size,
    lineHeight: bodyStyle.lineHeight,
    bodySpacing: bodyStyle.spacing,
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

const parseParagraphStyle = (value: string | undefined, fallback: ParagraphStyleFormValue): ParagraphStyleFormValue => {
  const resolved = value ?? '';
  const parts = resolved.split('|').map((item) => item.trim());
  const spacingSegment = parts.find((item) => item.includes('段前') || item.includes('段后')) ?? resolved;
  const lineHeightSegment = parts.find((item) => item.includes('行距') || item.includes('固定值') || item.includes('单倍') || item.includes('倍'));
  const indentSegment = parts.find((item) => item.includes('首行缩进')) ?? resolved;
  const alignmentSegment = parts.find((item) => item.includes('对齐') || item.includes('居中') || item.includes('居左') || item.includes('居右')) ?? resolved;
  const fontSegment = parts.find((item) => item.includes('字体=')) ?? resolved;
  const sizeSegment = parts.find((item) => item.includes('字号=')) ?? resolved;
  const font = COMMON_FONTS.find((item) => fontSegment.includes(item));

  return {
    font: parseFontChoice(font ?? (fontSegment.includes(NO_REQUIREMENT) ? NO_REQUIREMENT : fallback.font.preset), fallback.font.preset),
    size: parseSizeChoice(sizeSegment.includes('字号=') ? sizeSegment.split('字号=').slice(1).join('字号=') : sizeSegment, fallback.size.named),
    alignment: parseAlignmentOption(alignmentSegment),
    lineHeight: parseLineHeight(lineHeightSegment, fallback.lineHeight),
    spacing: parseSpacing(spacingSegment, fallback.spacing),
    indent: parseIndent(indentSegment, fallback.indent),
  };
};

const parseCaption = (value: string | undefined, fallback: CaptionFormValue): CaptionFormValue => {
  if (hasNoRequirement(value)) {
    return {
      ...fallback,
      mode: 'none',
    };
  }

  return {
    mode: 'custom',
    ...parseParagraphStyle(value, fallback),
    position: value?.includes('上方') ? 'above' : value?.includes('下方') ? 'below' : fallback.position,
  };
};

const parseToc = (value: string | undefined, fallback: TocFormValue): TocFormValue => {
  if (hasNoRequirement(value)) {
    return {
      ...fallback,
      mode: 'none',
    };
  }

  const segments = splitTokens(value);
  const titleSegment = segments.find((item) => item.includes('目录标题') || /^标题(?:\||[:：=]|$)/.test(item)) ?? '';
  const legacyBodySegment = segments.find((item) => item.includes('目录正文') || item.includes('正文')) ?? '';
  const chapterSegment = segments.find((item) => item.includes('各章目录') || item.includes('章目录')) ?? legacyBodySegment;
  const sectionSegment = segments.find((item) => item.includes('一级节标题目录')) ?? legacyBodySegment;
  const subsectionSegment = segments.find((item) => item.includes('二级节标题目录')) ?? legacyBodySegment;

  return {
    mode: 'custom',
    title: parseParagraphStyle(titleSegment, fallback.title),
    chapter: parseParagraphStyle(chapterSegment, fallback.chapter),
    section: parseParagraphStyle(sectionSegment, fallback.section),
    subsection: parseParagraphStyle(subsectionSegment, fallback.subsection),
  };
};

const buildFormValues = (
  config: PaperRuleConfig,
  template?: Pick<RuleTemplate, 'name' | 'description'>,
  templateNameDefault = TEMPLATE_NAME_DEFAULT,
): RuleFormValues => {
  const fallback = defaultFormValues(templateNameDefault);
  const headingRules = parseHeadingRules(config.headingFormats);

  return {
    ...fallback,
    templateName: template?.name ?? templateNameDefault,
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
    figureCaption: parseCaption(config.figureCaptionRule, fallback.figureCaption),
    tableCaption: parseCaption(config.tableCaptionRule, fallback.tableCaption),
    toc: parseToc(config.tocRule, fallback.toc),
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
    parts.push(`对齐=${formatAlignmentRule(item.alignment)}`);
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

const formatAlignmentRule = (value: AlignmentOption): string => {
  if (value === 'none') {
    return NO_REQUIREMENT;
  }

  if (value === 'justify') {
    return '两端对齐';
  }

  return value === 'left' ? '居左' : value === 'right' ? '居右' : '居中';
};

const buildPageNumberRule = (value: RuleFormValues['pageNumber']): string => {
  if (value.mode === 'none') {
    return NO_REQUIREMENT;
  }

  const positionText = value.position === 'top' ? '顶部' : '底部';
  const alignmentText = formatAlignmentRule(value.alignment);
  const styleText = value.style === 'romanLower'
    ? '小写罗马数字'
    : value.style === 'romanUpper'
      ? '大写罗马数字'
      : value.style === 'chinese'
        ? '中文数字'
        : value.style === 'arabic'
          ? '阿拉伯数字'
          : NO_REQUIREMENT;
  const footerStyleParts = buildParagraphStyleSegments(value.textStyle, '宋体', '五号');
  const segments = [`${positionText}${alignmentText}，${styleText}`];
  if (footerStyleParts.length > 0) {
    segments.push(['页脚样式', ...footerStyleParts].join('|'));
  }

  return segments.join('；');
};

const buildNamedParagraphStyleSegment = (
  label: string,
  value: ParagraphStyleFormValue,
  fallbackFont: string,
  fallbackSize: string
): string => {
  const parts = buildParagraphStyleSegments(value, fallbackFont, fallbackSize);
  return parts.length > 0 ? [label, ...parts].join('|') : `${label}${NO_REQUIREMENT}`;
};

const buildHeaderRule = (value: RuleFormValues['header']): string => {
  if (value.preset === 'none') {
    return NO_REQUIREMENT;
  }

  const segments = [
    `奇数页：${value.oddText.trim() || '地大高等学历继续教育'}`,
    `偶数页：${value.evenText.trim() || '学生姓名：论文题目'}`,
  ];
  const headerStyleParts = buildParagraphStyleSegments(value.style, '宋体', '五号');
  if (headerStyleParts.length > 0) {
    segments.push(['页眉样式', ...headerStyleParts].join('|'));
  }

  return segments.join('；');
};

const buildParagraphStyleSegments = (value: ParagraphStyleFormValue, fallbackFont: string, fallbackSize: string): string[] => {
  const parts: string[] = [];
  const font = resolveFontChoice(value.font, fallbackFont);
  const size = resolveSizeChoice(value.size, fallbackSize);
  const lineHeight = resolveLineHeight(value.lineHeight);
  const spacing = resolveSpacing(value.spacing);
  const indent = resolveIndent(value.indent);

  if (!hasNoRequirement(font)) {
    parts.push(`字体=${font}`);
  }

  if (!hasNoRequirement(size)) {
    parts.push(`字号=${size}`);
  }

  if (value.alignment !== 'none') {
    parts.push(`对齐=${formatAlignmentRule(value.alignment)}`);
  }

  if (!hasNoRequirement(lineHeight)) {
    parts.push(`行距=${lineHeight}`);
  }

  if (!hasNoRequirement(spacing)) {
    parts.push(`段前=${formatNumber(value.spacing.before)}${value.spacing.unit}`);
    parts.push(`段后=${formatNumber(value.spacing.after)}${value.spacing.unit}`);
  }

  if (!hasNoRequirement(indent)) {
    parts.push(`首行缩进=${indent}`);
  }

  return parts;
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

  const abstractTitleSegment = buildNamedParagraphStyleSegment('摘要标题', createParagraphStyle({
    font: values.abstract.titleFont,
    size: values.abstract.titleSize,
    alignment: values.abstract.titleAlignment,
    lineHeight: values.abstract.titleLineHeight,
    spacing: values.abstract.titleSpacing,
  }), '黑体', '小二');
  const abstractTitleStyleSegment = values.abstract.titleBold === 'bold'
    ? abstractTitleSegment.replace('摘要标题|', '摘要标题|字形=加粗|')
    : values.abstract.titleBold === 'normal'
      ? abstractTitleSegment.replace('摘要标题|', '摘要标题|字形=常规|')
      : abstractTitleSegment;
  const abstractBodySegment = buildNamedParagraphStyleSegment('正文', createParagraphStyle({
    font: values.abstract.bodyFont,
    size: values.abstract.bodySize,
    lineHeight: values.abstract.lineHeight,
    spacing: values.abstract.bodySpacing,
  }), '宋体', '小四');
  const abstractSegments = [
    abstractTitleStyleSegment,
    abstractBodySegment,
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
  const figureCaptionParts = buildParagraphStyleSegments(values.figureCaption, '宋体', '五号');
  const tableCaptionParts = buildParagraphStyleSegments(values.tableCaption, '宋体', '五号');
  const tocTitleParts = buildParagraphStyleSegments(values.toc.title, '黑体', '三号');
  const tocChapterParts = buildParagraphStyleSegments(values.toc.chapter, '宋体', '四号');
  const tocSectionParts = buildParagraphStyleSegments(values.toc.section, '宋体', '小四');
  const tocSubsectionParts = buildParagraphStyleSegments(values.toc.subsection, '宋体', '小四');

  return {
    pageSize: values.pageSize === 'none' ? NO_REQUIREMENT : values.pageSize,
    margin: values.margin.mode === 'none'
      ? NO_REQUIREMENT
      : `上${formatNumber(values.margin.top)}${values.margin.unit}，下${formatNumber(values.margin.bottom)}${values.margin.unit}，左${formatNumber(values.margin.left)}${values.margin.unit}，右${formatNumber(values.margin.right)}${values.margin.unit}`,
    headerRule: buildHeaderRule(values.header),
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
      : ['图题注', `位置=${values.figureCaption.position === 'above' ? '上方' : '下方'}`, ...figureCaptionParts].join('|'),
    tableCaptionRule: values.tableCaption.mode === 'none'
      ? NO_REQUIREMENT
      : ['表题注', `位置=${values.tableCaption.position === 'above' ? '上方' : '下方'}`, ...tableCaptionParts].join('|'),
    tocRule: values.toc.mode === 'none'
      ? NO_REQUIREMENT
      : [
        ['目录标题', ...tocTitleParts].join('|'),
        ['各章目录', ...tocChapterParts].join('|'),
        ['一级节标题目录', ...tocSectionParts].join('|'),
        ['二级节标题目录', ...tocSubsectionParts].join('|'),
      ].join('；'),
  };
};

const FontChoiceField: React.FC<{
  form: FormInstance<RuleFormValues>;
  label: string;
  name: NamePath;
  watchName?: NamePath;
  copy: RulesCopy;
  isEnglish: boolean;
}> = ({ form, label, name, watchName, copy, isEnglish }) => {
  const mode = Form.useWatch([...(watchName ?? name), 'mode'], form) as FontMode | undefined;
  const modeId = toFieldDomId(name, 'mode');
  const valueId = toFieldDomId(name, mode === 'custom' ? 'custom' : 'preset');

  return (
    <Form.Item label={label}>
      <Space.Compact block>
        <Form.Item name={[...name, 'mode']} noStyle>
          <Select
            id={modeId}
            style={{ width: 120 }}
            aria-label={`${label} ${isEnglish ? 'mode' : '模式'}`}
            options={[
              { label: copy.noRequirement, value: 'none' },
              { label: copy.commonFonts, value: 'preset' },
              { label: copy.custom, value: 'custom' },
            ]}
          />
        </Form.Item>
        {mode === 'custom' ? (
          <Form.Item name={[...name, 'custom']} noStyle>
            <Input id={valueId} aria-label={`${label} ${isEnglish ? 'custom font' : '自定义字体'}`} placeholder={copy.customFontPlaceholder} />
          </Form.Item>
        ) : (
          <Form.Item name={[...name, 'preset']} noStyle>
            <Select
              id={valueId}
              disabled={mode === 'none'}
              aria-label={`${label} ${isEnglish ? 'font' : '字体'}`}
              options={COMMON_FONTS.map((item) => ({ label: getDisplayLabel(item, isEnglish, FONT_DISPLAY_LABELS), value: item }))}
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
  watchName?: NamePath;
  copy: RulesCopy;
  isEnglish: boolean;
}> = ({ form, label, name, watchName, copy, isEnglish }) => {
  const mode = Form.useWatch([...(watchName ?? name), 'mode'], form) as SizeMode | undefined;
  const modeId = toFieldDomId(name, 'mode');
  const valueId = toFieldDomId(name, mode === 'custom' ? 'value' : 'named');
  const unitId = toFieldDomId(name, 'unit');

  return (
    <Form.Item label={label}>
      <Space.Compact block>
        <Form.Item name={[...name, 'mode']} noStyle>
          <Select
            id={modeId}
            style={{ width: 120 }}
            aria-label={`${label} ${isEnglish ? 'mode' : '模式'}`}
            options={[
              { label: copy.noRequirement, value: 'none' },
              { label: copy.commonSizes, value: 'named' },
              { label: copy.custom, value: 'custom' },
            ]}
          />
        </Form.Item>
        {mode === 'custom' ? (
          <>
            <Form.Item name={[...name, 'value']} noStyle>
              <InputNumber<number> id={valueId} style={{ width: '100%' }} min={5} max={72} step={0.5} precision={1} parser={toHalfStep} aria-label={`${label} ${isEnglish ? 'value' : '值'}`} />
            </Form.Item>
            <Form.Item name={[...name, 'unit']} noStyle>
              <Select id={unitId} style={{ width: 90 }} aria-label={`${label} ${isEnglish ? 'unit' : '单位'}`} options={[{ label: 'pt', value: 'pt' }, { label: isEnglish ? 'point (磅)' : '磅', value: '磅' }]} />
            </Form.Item>
          </>
        ) : (
          <Form.Item name={[...name, 'named']} noStyle>
            <Select
              id={valueId}
              disabled={mode === 'none'}
              aria-label={`${label} ${isEnglish ? 'font size' : '字号'}`}
              options={NAMED_FONT_SIZES.map((item) => ({ label: getDisplayLabel(item, isEnglish, NAMED_SIZE_DISPLAY_LABELS), value: item }))}
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
  watchName?: NamePath;
  copy: RulesCopy;
  isEnglish: boolean;
}> = ({ form, label, name, watchName, copy, isEnglish }) => {
  const mode = Form.useWatch([...(watchName ?? name), 'mode'], form) as LineHeightMode | undefined;
  const modeId = toFieldDomId(name, 'mode');
  const valueId = toFieldDomId(name, 'value');
  const unitId = toFieldDomId(name, 'unit');

  return (
    <Form.Item label={label}>
      <Space.Compact block>
        <Form.Item name={[...name, 'mode']} noStyle>
          <Select
            id={modeId}
            style={{ width: 120 }}
            aria-label={`${label} ${isEnglish ? 'mode' : '模式'}`}
            options={[
              { label: copy.noRequirement, value: 'none' },
              { label: copy.fixedValue, value: 'fixed' },
              { label: copy.multiple, value: 'multiple' },
            ]}
          />
        </Form.Item>
        <Form.Item name={[...name, 'value']} noStyle>
          <InputNumber<number>
            id={valueId}
            style={{ width: '100%' }}
            disabled={mode === 'none'}
            min={mode === 'multiple' ? 1 : 10}
            max={mode === 'multiple' ? 5 : 72}
            step={0.5}
            precision={1}
            parser={toHalfStep}
            aria-label={`${label} ${isEnglish ? 'value' : '值'}`}
          />
        </Form.Item>
        <Form.Item name={[...name, 'unit']} noStyle>
          <Select
            id={unitId}
            style={{ width: 100 }}
            disabled={mode === 'none'}
            aria-label={`${label} ${isEnglish ? 'unit' : '单位'}`}
            options={mode === 'multiple'
              ? [{ label: isEnglish ? 'x' : '倍', value: '倍' }]
              : [{ label: 'pt', value: 'pt' }, { label: isEnglish ? 'point (磅)' : '磅', value: '磅' }]}
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
  watchName?: NamePath;
  copy: RulesCopy;
  isEnglish: boolean;
}> = ({ form, label, name, watchName, copy, isEnglish }) => {
  const mode = Form.useWatch([...(watchName ?? name), 'mode'], form) as SpacingMode | undefined;
  const modeId = toFieldDomId(name, 'mode');
  const beforeId = toFieldDomId(name, 'before');
  const afterId = toFieldDomId(name, 'after');
  const unitId = toFieldDomId(name, 'unit');

  return (
    <Form.Item label={label}>
      <Space.Compact block>
        <Form.Item name={[...name, 'mode']} noStyle>
          <Select
            id={modeId}
            style={{ width: 120 }}
            aria-label={`${label} ${isEnglish ? 'mode' : '模式'}`}
            options={[
              { label: copy.noRequirement, value: 'none' },
              { label: copy.custom, value: 'custom' },
            ]}
          />
        </Form.Item>
        <Form.Item name={[...name, 'before']} noStyle>
          <InputNumber<number>
            id={beforeId}
            style={{ width: '100%' }}
            disabled={mode === 'none'}
            min={0}
            max={72}
            step={0.5}
            precision={1}
            parser={toHalfStep}
            aria-label={`${label} ${isEnglish ? 'before spacing' : '段前'}`}
            placeholder={copy.before}
          />
        </Form.Item>
        <Form.Item name={[...name, 'after']} noStyle>
          <InputNumber<number>
            id={afterId}
            style={{ width: '100%' }}
            disabled={mode === 'none'}
            min={0}
            max={72}
            step={0.5}
            precision={1}
            parser={toHalfStep}
            aria-label={`${label} ${isEnglish ? 'after spacing' : '段后'}`}
            placeholder={copy.after}
          />
        </Form.Item>
        <Form.Item name={[...name, 'unit']} noStyle>
          <Select
            id={unitId}
            style={{ width: 90 }}
            disabled={mode === 'none'}
            aria-label={`${label} ${isEnglish ? 'unit' : '单位'}`}
            options={[{ label: 'pt', value: 'pt' }, { label: isEnglish ? 'point (磅)' : '磅', value: '磅' }]}
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
  watchName?: NamePath;
  copy: RulesCopy;
}> = ({ form, label, name, watchName, copy }) => {
  const mode = Form.useWatch([...(watchName ?? name), 'mode'], form) as IndentMode | undefined;
  const modeId = toFieldDomId(name, 'mode');
  const valueId = toFieldDomId(name, 'value');
  const unitId = toFieldDomId(name, 'unit');

  return (
    <Form.Item label={label}>
      <Space.Compact block>
        <Form.Item name={[...name, 'mode']} noStyle>
          <Select
            id={modeId}
            style={{ width: 120 }}
            aria-label={`${label} 模式`}
            options={[
              { label: copy.noRequirement, value: 'none' },
              { label: copy.custom, value: 'custom' },
            ]}
          />
        </Form.Item>
        <Form.Item name={[...name, 'value']} noStyle>
          <InputNumber<number>
            id={valueId}
            style={{ width: '100%' }}
            disabled={mode === 'none'}
            min={0}
            max={10}
            step={1}
            precision={0}
            parser={toInteger}
            aria-label={`${label} 值`}
          />
        </Form.Item>
        <Form.Item name={[...name, 'unit']} noStyle>
          <Select id={unitId} style={{ width: 90 }} disabled aria-label={`${label} 单位`} options={[{ label: copy.character, value: '字符' }]} />
        </Form.Item>
      </Space.Compact>
    </Form.Item>
  );
};

const AlignmentField: React.FC<{
  label: string;
  name: NamePath;
  copy: RulesCopy;
}> = ({ label, name, copy }) => (
  <Form.Item name={name} label={label}>
    <Select
      id={toFieldDomId(name)}
      aria-label={label}
      options={[
        { label: copy.noRequirement, value: 'none' },
        { label: copy.left, value: 'left' },
        { label: copy.center, value: 'center' },
        { label: copy.right, value: 'right' },
        { label: copy.justify, value: 'justify' },
      ]}
    />
  </Form.Item>
);

const ParagraphStyleFields: React.FC<{
  form: FormInstance<RuleFormValues>;
  baseName: NamePath;
  fontLabel?: string;
  sizeLabel?: string;
  alignmentLabel?: string;
  lineHeightLabel?: string;
  spacingLabel?: string;
  indentLabel?: string;
  copy: RulesCopy;
  isEnglish: boolean;
}> = ({
  form,
  baseName,
  copy,
  isEnglish,
  fontLabel = copy.font,
  sizeLabel = copy.size,
  alignmentLabel = copy.alignment,
  lineHeightLabel = copy.lineHeight,
  spacingLabel = copy.spacing,
  indentLabel = copy.indent,
}) => (
  <Row gutter={16}>
    <Col span={8}>
      <FontChoiceField form={form} label={fontLabel} name={[...baseName, 'font']} copy={copy} isEnglish={isEnglish} />
    </Col>
    <Col span={8}>
      <SizeChoiceField form={form} label={sizeLabel} name={[...baseName, 'size']} copy={copy} isEnglish={isEnglish} />
    </Col>
    <Col span={8}>
      <AlignmentField label={alignmentLabel} name={[...baseName, 'alignment']} copy={copy} />
    </Col>
    <Col span={8}>
      <LineHeightField form={form} label={lineHeightLabel} name={[...baseName, 'lineHeight']} copy={copy} isEnglish={isEnglish} />
    </Col>
    <Col span={8}>
      <SpacingField form={form} label={spacingLabel} name={[...baseName, 'spacing']} copy={copy} isEnglish={isEnglish} />
    </Col>
    <Col span={8}>
      <IndentField form={form} label={indentLabel} name={[...baseName, 'indent']} copy={copy} />
    </Col>
  </Row>
);

const HeadingRuleCard: React.FC<{
  form: FormInstance<RuleFormValues>;
  name: number;
  remove: (index: number) => void;
  copy: RulesCopy;
  isEnglish: boolean;
}> = ({ form, name, remove, copy, isEnglish }) => {
  const level = Form.useWatch(['headingRules', name, 'level'], form) as number | undefined;

  return (
    <Card
      size="small"
      title={`${copy.headingLevelTitle} ${level ?? ''}`}
      extra={
        <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)}>
          {copy.delete}
        </Button>
      }
    >
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name={[name, 'level']} label={copy.level}>
            <InputNumber<number> style={{ width: '100%' }} min={1} max={9} step={1} precision={0} parser={toInteger} aria-label={`${copy.level} ${level ?? ''}`.trim()} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <FontChoiceField form={form} label={copy.font} name={[name, 'font']} watchName={['headingRules', name, 'font']} copy={copy} isEnglish={isEnglish} />
        </Col>
        <Col span={8}>
          <SizeChoiceField form={form} label={copy.size} name={[name, 'size']} watchName={['headingRules', name, 'size']} copy={copy} isEnglish={isEnglish} />
        </Col>
        <Col span={8}>
                    <AlignmentField label={copy.alignment} name={[name, 'alignment']} copy={copy} />
        </Col>
        <Col span={8}>
          <LineHeightField form={form} label={copy.lineHeight} name={[name, 'lineHeight']} watchName={['headingRules', name, 'lineHeight']} copy={copy} isEnglish={isEnglish} />
        </Col>
        <Col span={8}>
          <SpacingField form={form} label={copy.spacing} name={[name, 'spacing']} watchName={['headingRules', name, 'spacing']} copy={copy} isEnglish={isEnglish} />
        </Col>
        <Col span={8}>
          <IndentField form={form} label={copy.indent} name={[name, 'indent']} watchName={['headingRules', name, 'indent']} copy={copy} />
        </Col>
      </Row>
    </Card>
  );
};

const RulesConfig: React.FC = () => {
  const { isEnglish } = useI18n();
  const { message } = AntdApp.useApp();
  const copy = useMemo(() => getRulesCopy(isEnglish), [isEnglish]);
  const [form] = Form.useForm<RuleFormValues>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<RuleTemplate | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId');
  const referencePreset = Form.useWatch(['reference', 'preset'], form);
  const headingRulesValue = Form.useWatch('headingRules', form) as unknown;
  const marginMode = Form.useWatch(['margin', 'mode'], form) as RuleFormValues['margin']['mode'] | undefined;
  const headerPresetMode = Form.useWatch(['header', 'preset'], form) as HeaderPreset | undefined;
  const pageNumberMode = Form.useWatch(['pageNumber', 'mode'], form) as PageNumberMode | undefined;
  const abstractLengthMode = Form.useWatch(['abstract', 'lengthMode'], form) as RuleFormValues['abstract']['lengthMode'] | undefined;
  const keywordsCountMode = Form.useWatch(['keywords', 'countMode'], form) as RuleFormValues['keywords']['countMode'] | undefined;
  const figureCaptionMode = Form.useWatch(['figureCaption', 'mode'], form) as CaptionMode | undefined;
  const tableCaptionMode = Form.useWatch(['tableCaption', 'mode'], form) as CaptionMode | undefined;
  const headingRules = ensureHeadingRuleArray(headingRulesValue);

  const nextHeadingLevel = useMemo(() => {
    const levels = headingRules.map((item) => item.level).filter((value) => Number.isFinite(value));
    return levels.length > 0 ? Math.max(...levels) + 1 : 1;
  }, [headingRules]);

  useEffect(() => {
    if (!templateId) {
      setCurrentTemplate(null);
      form.setFieldsValue(defaultFormValues(copy.defaultTemplateName));
      return;
    }

    const loadTemplate = async () => {
      setLoading(true);
      try {
        const template = await api.getTemplate(templateId);
        setCurrentTemplate(template);
        form.setFieldsValue(buildFormValues({ ...defaultRules, ...template.config }, template, copy.defaultTemplateName));
      } catch (error) {
        if (isUnauthorizedError(error)) {
          return;
        }

        message.error(copy.loadTemplateFailed);
      } finally {
        setLoading(false);
      }
    };

    void loadTemplate();
  }, [copy.defaultTemplateName, copy.loadTemplateFailed, form, templateId]);

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
        message.error(copy.duplicateHeadingLevel(item.level));
        return;
      }

      levelSet.add(item.level);
    }

    if (values.abstract.lengthMode === 'custom' && values.abstract.minLength > values.abstract.maxLength) {
      message.error(copy.abstractRangeInvalid);
      return;
    }

    if (values.keywords.countMode === 'custom' && values.keywords.minCount > values.keywords.maxCount) {
      message.error(copy.keywordsRangeInvalid);
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
      message.success(currentTemplate ? copy.saveEditSuccess : copy.saveCreateSuccess);
      navigate('/templates');
    } catch (error) {
      if (isUnauthorizedError(error)) {
        return;
      }

      message.error(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (currentTemplate) {
      form.setFieldsValue(buildFormValues({ ...defaultRules, ...currentTemplate.config }, currentTemplate, copy.defaultTemplateName));
      return;
    }

    form.setFieldsValue(defaultFormValues(copy.defaultTemplateName));
  };

  return (
    <div data-testid="page-rules" style={{ maxWidth: 1220, margin: '0 auto' }}>
      <Card variant="borderless" title={<span style={{ fontSize: 20 }}>{currentTemplate ? copy.pageTitleEdit : copy.pageTitleCreate}</span>}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 16 }} />
        ) : (
          <>
            <Form
              form={form}
              layout="vertical"
              initialValues={defaultFormValues(copy.defaultTemplateName)}
              onValuesChange={handleValuesChange}
              onFinish={handleSave}
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name="templateName" label={copy.templateName} rules={[{ required: true, message: copy.templateName }]}>
                    <Input data-testid="template-name-input" placeholder={copy.templateNamePlaceholder} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="description" label={copy.templateDescription}>
                    <Input data-testid="template-description-input" placeholder={copy.templateDescriptionPlaceholder} />
                  </Form.Item>
                </Col>
              </Row>

              <Tabs
                type="card"
                items={[
                  {
                    key: 'page',
                    label: copy.sectionPage,
                    children: (
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="pageSize" label={copy.paperSize}>
                    <Select
                      id={toFieldDomId('pageSize')}
                      aria-label={copy.paperSize}
                      options={[
                        { label: copy.noRequirement, value: 'none' },
                        { label: 'A4（210 × 297 mm）', value: 'A4' },
                        { label: 'B5（176 × 250 mm）', value: 'B5' },
                        { label: 'A3（297 × 420 mm）', value: 'A3' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item label={copy.margin}>
                    <Space.Compact block>
                      <Form.Item name={['margin', 'mode']} noStyle>
                        <Select
                          id={toFieldDomId(['margin', 'mode'])}
                          aria-label={`${copy.margin} ${isEnglish ? 'Mode' : '模式'}`}
                          style={{ width: 120 }}
                          options={[
                            { label: copy.noRequirement, value: 'none' },
                            { label: copy.custom, value: 'custom' },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item name={['margin', 'top']} noStyle>
                        <InputNumber<number> id={toFieldDomId(['margin', 'top'])} aria-label={`${copy.margin} ${isEnglish ? 'Top' : '上'}`} style={{ width: '100%' }} min={0} max={10} step={0.5} precision={1} parser={toHalfStep} placeholder={isEnglish ? 'Top' : '上'} disabled={marginMode === 'none'} />
                      </Form.Item>
                      <Form.Item name={['margin', 'bottom']} noStyle>
                        <InputNumber<number> id={toFieldDomId(['margin', 'bottom'])} aria-label={`${copy.margin} ${isEnglish ? 'Bottom' : '下'}`} style={{ width: '100%' }} min={0} max={10} step={0.5} precision={1} parser={toHalfStep} placeholder={isEnglish ? 'Bottom' : '下'} disabled={marginMode === 'none'} />
                      </Form.Item>
                      <Form.Item name={['margin', 'left']} noStyle>
                        <InputNumber<number> id={toFieldDomId(['margin', 'left'])} aria-label={`${copy.margin} ${isEnglish ? 'Left' : '左'}`} style={{ width: '100%' }} min={0} max={10} step={0.5} precision={1} parser={toHalfStep} placeholder={isEnglish ? 'Left' : '左'} disabled={marginMode === 'none'} />
                      </Form.Item>
                      <Form.Item name={['margin', 'right']} noStyle>
                        <InputNumber<number> id={toFieldDomId(['margin', 'right'])} aria-label={`${copy.margin} ${isEnglish ? 'Right' : '右'}`} style={{ width: '100%' }} min={0} max={10} step={0.5} precision={1} parser={toHalfStep} placeholder={isEnglish ? 'Right' : '右'} disabled={marginMode === 'none'} />
                      </Form.Item>
                      <Form.Item name={['margin', 'unit']} noStyle>
                        <Select id={toFieldDomId(['margin', 'unit'])} aria-label={`${copy.margin} ${isEnglish ? 'Unit' : '单位'}`} style={{ width: 100 }} disabled={marginMode === 'none'} options={[{ label: 'cm', value: 'cm' }, { label: 'mm', value: 'mm' }]} />
                      </Form.Item>
                    </Space.Compact>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['header', 'preset']} label={copy.headerPreset}>
                    <Select id={toFieldDomId(['header', 'preset'])} aria-label={copy.headerPreset} options={HEADER_PRESET_OPTIONS.map((item) => ({ label: getHeaderPresetLabel(item.value, copy), value: item.value }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['header', 'oddText']} label={copy.oddHeader}>
                    <Input placeholder={copy.oddHeader} disabled={headerPresetMode === 'none'} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['header', 'evenText']} label={copy.evenHeader}>
                    <Input placeholder={copy.evenHeader} disabled={headerPresetMode === 'none'} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['pageNumber', 'mode']} label={copy.pageNumberRule}>
                    <Select id={toFieldDomId(['pageNumber', 'mode'])} aria-label={copy.pageNumberRule} options={[{ label: copy.noRequirement, value: 'none' }, { label: copy.custom, value: 'custom' }]} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['pageNumber', 'position']} label={copy.pageNumberPosition}>
                    <Select id={toFieldDomId(['pageNumber', 'position'])} aria-label={copy.pageNumberPosition} disabled={pageNumberMode === 'none'} options={[{ label: copy.top, value: 'top' }, { label: copy.bottom, value: 'bottom' }]} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['pageNumber', 'alignment']} label={copy.pageNumberAlignment}>
                    <Select
                      id={toFieldDomId(['pageNumber', 'alignment'])}
                      aria-label={copy.pageNumberAlignment}
                      disabled={pageNumberMode === 'none'}
                      options={[
                        { label: copy.noRequirement, value: 'none' },
                        { label: copy.left, value: 'left' },
                        { label: copy.center, value: 'center' },
                        { label: copy.right, value: 'right' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['pageNumber', 'style']} label={copy.pageNumberStyle}>
                    <Select
                      id={toFieldDomId(['pageNumber', 'style'])}
                      aria-label={copy.pageNumberStyle}
                      disabled={pageNumberMode === 'none'}
                      options={[
                        { label: copy.noRequirement, value: 'none' },
                        { label: copy.arabic, value: 'arabic' },
                        { label: copy.romanLower, value: 'romanLower' },
                        { label: copy.romanUpper, value: 'romanUpper' },
                        { label: copy.chineseNumber, value: 'chinese' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Card size="small" title={copy.headerStyle}>
                    <ParagraphStyleFields
                      form={form}
                      baseName={['header', 'style']}
                      copy={copy}
                      isEnglish={isEnglish}
                      indentLabel={copy.indent}
                    />
                  </Card>
                </Col>
                <Col span={24}>
                  <Card size="small" title={copy.footerStyle}>
                    <ParagraphStyleFields
                      form={form}
                      baseName={['pageNumber', 'textStyle']}
                      copy={copy}
                      isEnglish={isEnglish}
                      indentLabel={copy.indent}
                    />
                  </Card>
                </Col>
              </Row>
                    ),
                  },
                  {
                    key: 'body',
                    label: copy.sectionBody,
                    children: (
              <Row gutter={24}>
                <Col span={12}>
                  <FontChoiceField form={form} label={copy.bodyFont} name={['body', 'font']} copy={copy} isEnglish={isEnglish} />
                </Col>
                <Col span={12}>
                  <SizeChoiceField form={form} label={copy.bodySize} name={['body', 'fontSize']} copy={copy} isEnglish={isEnglish} />
                </Col>
                <Col span={12}>
                  <LineHeightField form={form} label={copy.lineHeight} name={['body', 'lineHeight']} copy={copy} isEnglish={isEnglish} />
                </Col>
                <Col span={12}>
                  <SpacingField form={form} label={copy.spacing} name={['body', 'spacing']} copy={copy} isEnglish={isEnglish} />
                </Col>
                <Col span={12}>
                  <IndentField form={form} label={copy.indent} name={['body', 'indent']} copy={copy} />
                </Col>
              </Row>
                    ),
                  },
                  {
                    key: 'structure',
                    label: copy.sectionStructure,
                    children: (
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item label={copy.coverItems}>
                    <Form.Item name="coverItems" noStyle>
                      <Select
                        id={toFieldDomId('coverItems')}
                        aria-label={copy.coverItems}
                        mode="tags"
                        tokenSeparators={[';', '；', ',']}
                        options={[NO_REQUIREMENT, ...COVER_ITEM_OPTIONS].map((item) => ({
                          label: item === NO_REQUIREMENT ? copy.noRequirement : getDisplayLabel(item, isEnglish, COVER_ITEM_DISPLAY_LABELS),
                          value: item,
                        }))}
                        placeholder={copy.coverItemsPlaceholder}
                      />
                    </Form.Item>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={copy.requiredSections}>
                    <Form.Item name="requiredSections" noStyle>
                      <Select
                        id={toFieldDomId('requiredSections')}
                        aria-label={copy.requiredSections}
                        mode="tags"
                        tokenSeparators={[';', '；', ',']}
                        options={[NO_REQUIREMENT, ...REQUIRED_SECTION_OPTIONS].map((item) => ({
                          label: item === NO_REQUIREMENT ? copy.noRequirement : getDisplayLabel(item, isEnglish, REQUIRED_SECTION_DISPLAY_LABELS),
                          value: item,
                        }))}
                        placeholder={copy.requiredSectionsPlaceholder}
                      />
                    </Form.Item>
                  </Form.Item>
                </Col>
              </Row>
                    ),
                  },
                  {
                    key: 'heading',
                    label: copy.sectionHeading,
                    children: (
              <Form.List name="headingRules">
                {(fields, { add, remove }) => (
                  <>
                    <Space style={{ marginBottom: 16 }}>
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => add(createHeadingRule(nextHeadingLevel))}
                      >
                        {copy.addHeading}
                      </Button>
                      <span>{copy.addHeadingHint}</span>
                    </Space>
                    <Row gutter={[16, 16]}>
                      {fields.map((field) => (
                        <Col span={24} key={field.key}>
                          <HeadingRuleCard form={form} name={field.name} remove={remove} copy={copy} isEnglish={isEnglish} />
                        </Col>
                      ))}
                    </Row>
                  </>
                )}
              </Form.List>
                    ),
                  },
                  {
                    key: 'abstract',
                    label: copy.sectionAbstract,
                    children: (
              <Row gutter={24} align="stretch">
                <Col xs={24} lg={8}>
                  <Card size="small" title={copy.abstractTitle} style={{ height: '100%' }}>
                    <FontChoiceField form={form} label={copy.font} name={['abstract', 'titleFont']} copy={copy} isEnglish={isEnglish} />
                    <SizeChoiceField form={form} label={copy.size} name={['abstract', 'titleSize']} copy={copy} isEnglish={isEnglish} />
                    <Form.Item name={['abstract', 'titleBold']} label={copy.abstractTitleStyle}>
                      <Select
                        id={toFieldDomId(['abstract', 'titleBold'])}
                        aria-label={copy.abstractTitleStyle}
                        options={[
                          { label: copy.noRequirement, value: 'none' },
                          { label: copy.bold, value: 'bold' },
                          { label: copy.normal, value: 'normal' },
                        ]}
                      />
                    </Form.Item>
                    <AlignmentField label={copy.alignment} name={['abstract', 'titleAlignment']} copy={copy} />
                    <LineHeightField form={form} label={copy.lineHeight} name={['abstract', 'titleLineHeight']} copy={copy} isEnglish={isEnglish} />
                    <SpacingField form={form} label={copy.spacing} name={['abstract', 'titleSpacing']} copy={copy} isEnglish={isEnglish} />
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card size="small" title={copy.abstractBody} style={{ height: '100%' }}>
                    <FontChoiceField form={form} label={copy.font} name={['abstract', 'bodyFont']} copy={copy} isEnglish={isEnglish} />
                    <SizeChoiceField form={form} label={copy.size} name={['abstract', 'bodySize']} copy={copy} isEnglish={isEnglish} />
                    <LineHeightField form={form} label={copy.lineHeight} name={['abstract', 'lineHeight']} copy={copy} isEnglish={isEnglish} />
                    <SpacingField form={form} label={copy.spacing} name={['abstract', 'bodySpacing']} copy={copy} isEnglish={isEnglish} />
                    <Form.Item label={copy.abstractLength}>
                      <Space.Compact block>
                        <Form.Item name={['abstract', 'lengthMode']} noStyle>
                          <Select
                            id={toFieldDomId(['abstract', 'lengthMode'])}
                            aria-label={`${copy.abstractLength} ${isEnglish ? 'Mode' : '模式'}`}
                            style={{ width: 120 }}
                            options={[
                              { label: copy.noRequirement, value: 'none' },
                              { label: copy.custom, value: 'custom' },
                            ]}
                          />
                        </Form.Item>
                        <Form.Item name={['abstract', 'minLength']} noStyle>
                          <InputNumber<number>
                            id={toFieldDomId(['abstract', 'minLength'])}
                            aria-label={`${copy.abstractLength} ${isEnglish ? 'Min' : '最小值'}`}
                            style={{ width: '100%' }}
                            min={0}
                            max={10000}
                            step={1}
                            precision={0}
                            parser={toInteger}
                            disabled={abstractLengthMode === 'none'}
                            placeholder={isEnglish ? 'Min' : '最少'}
                          />
                        </Form.Item>
                        <Form.Item name={['abstract', 'maxLength']} noStyle>
                          <InputNumber<number>
                            id={toFieldDomId(['abstract', 'maxLength'])}
                            aria-label={`${copy.abstractLength} ${isEnglish ? 'Max' : '最大值'}`}
                            style={{ width: '100%' }}
                            min={0}
                            max={10000}
                            step={1}
                            precision={0}
                            parser={toInteger}
                            disabled={abstractLengthMode === 'none'}
                            placeholder={isEnglish ? 'Max' : '最多'}
                          />
                        </Form.Item>
                        <Button disabled style={{ width: 80 }}>
                          {isEnglish ? 'words' : '字'}
                        </Button>
                      </Space.Compact>
                    </Form.Item>
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card size="small" title={copy.keywords} style={{ height: '100%' }}>
                    <FontChoiceField form={form} label={copy.font} name={['keywords', 'font']} copy={copy} isEnglish={isEnglish} />
                    <SizeChoiceField form={form} label={copy.size} name={['keywords', 'size']} copy={copy} isEnglish={isEnglish} />
                    <Form.Item name={['keywords', 'separator']} label={copy.keywordSeparator}>
                      <Select
                        id={toFieldDomId(['keywords', 'separator'])}
                        aria-label={copy.keywordSeparator}
                        options={[
                          { label: copy.noRequirement, value: 'none' },
                          { label: copy.semicolon, value: 'semicolon' },
                          { label: copy.comma, value: 'comma' },
                          { label: copy.dunhao, value: 'dunhao' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name={['keywords', 'labelBold']} label={copy.keywordLabelStyle}>
                      <Select
                        id={toFieldDomId(['keywords', 'labelBold'])}
                        aria-label={copy.keywordLabelStyle}
                        options={[
                          { label: copy.noRequirement, value: 'none' },
                          { label: copy.bold, value: 'bold' },
                          { label: copy.normal, value: 'normal' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item label={copy.keywordCount}>
                      <Space.Compact block>
                        <Form.Item name={['keywords', 'countMode']} noStyle>
                          <Select
                            id={toFieldDomId(['keywords', 'countMode'])}
                            aria-label={`${copy.keywordCount} ${isEnglish ? 'Mode' : '模式'}`}
                            style={{ width: 120 }}
                            options={[
                              { label: copy.noRequirement, value: 'none' },
                              { label: copy.custom, value: 'custom' },
                            ]}
                          />
                        </Form.Item>
                        <Form.Item name={['keywords', 'minCount']} noStyle>
                          <InputNumber<number>
                            id={toFieldDomId(['keywords', 'minCount'])}
                            aria-label={`${copy.keywordCount} ${isEnglish ? 'Min' : '最小值'}`}
                            style={{ width: '100%' }}
                            min={1}
                            max={20}
                            step={1}
                            precision={0}
                            parser={toInteger}
                            disabled={keywordsCountMode === 'none'}
                            placeholder={isEnglish ? 'Min' : '最少'}
                          />
                        </Form.Item>
                        <Form.Item name={['keywords', 'maxCount']} noStyle>
                          <InputNumber<number>
                            id={toFieldDomId(['keywords', 'maxCount'])}
                            aria-label={`${copy.keywordCount} ${isEnglish ? 'Max' : '最大值'}`}
                            style={{ width: '100%' }}
                            min={1}
                            max={20}
                            step={1}
                            precision={0}
                            parser={toInteger}
                            disabled={keywordsCountMode === 'none'}
                            placeholder={isEnglish ? 'Max' : '最多'}
                          />
                        </Form.Item>
                        <Button disabled style={{ width: 80 }}>
                          {isEnglish ? 'items' : '个'}
                        </Button>
                      </Space.Compact>
                    </Form.Item>
                  </Card>
                </Col>
              </Row>
                    ),
                  },
                  {
                    key: 'reference',
                    label: copy.sectionReference,
                    children: (
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item label={copy.referenceFormat}>
                    <Space.Compact block>
                      <Form.Item name={['reference', 'preset']} noStyle>
                        <Select
                          id={toFieldDomId(['reference', 'preset'])}
                          aria-label={`${copy.referenceFormat} ${isEnglish ? 'Mode' : '模式'}`}
                          style={{ width: 160 }}
                          options={[
                            { label: copy.noRequirement, value: '__none__' },
                            ...REFERENCE_OPTIONS.map((item) => ({ label: item, value: item })),
                            { label: copy.custom, value: '__custom__' },
                          ]}
                        />
                      </Form.Item>
                      {referencePreset === '__custom__' ? (
                        <Form.Item name={['reference', 'custom']} noStyle>
                          <Input id={toFieldDomId(['reference', 'custom'])} aria-label={copy.referenceFormat} placeholder={copy.customReferencePlaceholder} />
                        </Form.Item>
                      ) : (
                        <Input id={toFieldDomId(['reference', 'display'])} aria-label={copy.referenceFormat} disabled value={referencePreset === '__none__' ? copy.currentNone : copy.currentPreset} />
                      )}
                    </Space.Compact>
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Card size="small" title={copy.figureCaption}>
                    <Form.Item label={copy.checkMode}>
                      <Space.Compact block>
                        <Form.Item name={['figureCaption', 'mode']} noStyle>
                          <Select id={toFieldDomId(['figureCaption', 'mode'])} aria-label={`${copy.figureCaption} ${copy.checkMode}`} style={{ width: 120 }} options={[{ label: copy.noRequirement, value: 'none' }, { label: copy.custom, value: 'custom' }]} />
                        </Form.Item>
                        <Form.Item name={['figureCaption', 'position']} noStyle>
                          <Select
                            id={toFieldDomId(['figureCaption', 'position'])}
                            aria-label={`${copy.figureCaption} ${copy.position}`}
                            disabled={figureCaptionMode === 'none'}
                            options={[
                              { label: isEnglish ? 'Above Figure' : '图上方', value: 'above' },
                              { label: isEnglish ? 'Below Figure' : '图下方', value: 'below' },
                            ]}
                          />
                        </Form.Item>
                      </Space.Compact>
                    </Form.Item>
                    <ParagraphStyleFields form={form} baseName={['figureCaption']} copy={copy} isEnglish={isEnglish} />
                  </Card>
                </Col>
                <Col span={24}>
                  <Card size="small" title={copy.tableCaption}>
                    <Form.Item label={copy.checkMode}>
                      <Space.Compact block>
                        <Form.Item name={['tableCaption', 'mode']} noStyle>
                          <Select id={toFieldDomId(['tableCaption', 'mode'])} aria-label={`${copy.tableCaption} ${copy.checkMode}`} style={{ width: 120 }} options={[{ label: copy.noRequirement, value: 'none' }, { label: copy.custom, value: 'custom' }]} />
                        </Form.Item>
                        <Form.Item name={['tableCaption', 'position']} noStyle>
                          <Select
                            id={toFieldDomId(['tableCaption', 'position'])}
                            aria-label={`${copy.tableCaption} ${copy.position}`}
                            disabled={tableCaptionMode === 'none'}
                            options={[
                              { label: isEnglish ? 'Above Table' : '表上方', value: 'above' },
                              { label: isEnglish ? 'Below Table' : '表下方', value: 'below' },
                            ]}
                          />
                        </Form.Item>
                      </Space.Compact>
                    </Form.Item>
                    <ParagraphStyleFields form={form} baseName={['tableCaption']} copy={copy} isEnglish={isEnglish} />
                  </Card>
                </Col>
                <Col span={24}>
                  <Card size="small" title={copy.toc}>
                    <Form.Item label={copy.checkMode}>
                      <Form.Item name={['toc', 'mode']} noStyle>
                        <Select
                          id={toFieldDomId(['toc', 'mode'])}
                          aria-label={`${copy.toc} ${copy.checkMode}`}
                          style={{ width: 160 }}
                          options={[{ label: copy.noRequirement, value: 'none' }, { label: copy.custom, value: 'custom' }]}
                        />
                      </Form.Item>
                    </Form.Item>
                    <Row gutter={24}>
                      <Col span={24}>
                        <Card size="small" title={copy.tocTitle} style={{ marginBottom: 16 }}>
                          <ParagraphStyleFields form={form} baseName={['toc', 'title']} copy={copy} isEnglish={isEnglish} />
                        </Card>
                      </Col>
                      <Col span={24}>
                        <Card size="small" title={copy.tocChapter} style={{ marginBottom: 16 }}>
                          <ParagraphStyleFields form={form} baseName={['toc', 'chapter']} copy={copy} isEnglish={isEnglish} />
                        </Card>
                      </Col>
                      <Col span={24}>
                        <Card size="small" title={copy.tocSection} style={{ marginBottom: 16 }}>
                          <ParagraphStyleFields form={form} baseName={['toc', 'section']} copy={copy} isEnglish={isEnglish} />
                        </Card>
                      </Col>
                      <Col span={24}>
                        <Card size="small" title={copy.tocSubsection}>
                          <ParagraphStyleFields form={form} baseName={['toc', 'subsection']} copy={copy} isEnglish={isEnglish} />
                        </Card>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
                    ),
                  },
                ].map((item) => ({
                  ...item,
                  forceRender: true,
                }))}
              />

              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Button data-testid="save-template-button" type="primary" htmlType="submit" size="large" loading={saving} style={{ width: 160 }}>
                  {currentTemplate ? copy.saveEdit : copy.saveCreate}
                </Button>
                <Button data-testid="reset-template-button" size="large" style={{ marginLeft: 16 }} onClick={handleReset}>
                  {currentTemplate ? copy.resetEdit : copy.resetCreate}
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
