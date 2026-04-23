import type { PaperRuleConfig, RuleTemplate } from '../types/index.js';

export const SYSTEM_USER_ID = 'user_system_seed';

const now = () => new Date().toISOString();

export const defaultRuleConfig: PaperRuleConfig = {
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
  headingFormats: 'Level 1: 字体=黑体 | 字号=三号; Level 2: 字体=黑体 | 字号=四号; Level 3: 字体=黑体 | 字号=小四',
  pageNumberRule: '底部居中，阿拉伯数字',
  abstractFormat: '标题黑体小二居中；正文宋体小四，固定值20磅；300-500字',
  keywordFormat: '关键词标题加粗；宋体小四；3-5个；词间用分号分隔',
  referenceFormat: 'GB/T 7714-2005',
  figureCaptionRule: '图题注|位置=下方|对齐=居中|字体=宋体|字号=五号|行距=无要求|段前=0pt|段后=0pt|首行缩进=无要求',
  tableCaptionRule: '表题注|位置=上方|对齐=居中|字体=宋体|字号=五号|行距=无要求|段前=0pt|段后=0pt|首行缩进=无要求',
  tocRule: '目录标题|字体=黑体|字号=小二|对齐=居中|行距=无要求|段前=12pt|段后=12pt|首行缩进=无要求；目录正文|字体=宋体|字号=小四|对齐=无要求|行距=20pt|段前=0pt|段后=0pt|首行缩进=无要求',
};

export const seedTemplates = (): RuleTemplate[] => {
  const updatedAt = now();

  return [
    {
      id: 'tpl_default_undergraduate',
      ownerId: SYSTEM_USER_ID,
      name: '地大成教本科论文默认模板',
      description: '按中国地质大学（武汉）高等学历继续教育本科毕业论文规范整理的默认检查模板。',
      config: defaultRuleConfig,
      updatedAt,
      isDefault: true,
      visibility: 'public',
      publishedAt: updatedAt,
      favoriteCount: 0,
      viewCount: 0,
      useCount: 0,
      hotScore: 0,
    },
    {
      id: 'tpl_master_research',
      ownerId: SYSTEM_USER_ID,
      name: '地大成教本科论文严格模板',
      description: '在默认模板基础上保留学校版式要求，并用于更严格的排版检查。',
      config: {
        ...defaultRuleConfig,
        headingFormats: 'Level 1: 字体=黑体 | 字号=三号 | 对齐=居中; Level 2: 字体=黑体 | 字号=四号; Level 3: 字体=黑体 | 字号=小四',
      },
      updatedAt,
      isDefault: false,
      visibility: 'public',
      publishedAt: updatedAt,
      favoriteCount: 0,
      viewCount: 0,
      useCount: 0,
      hotScore: 0,
    },
  ];
};
