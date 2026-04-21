import type { PaperRuleConfig, RuleTemplate } from '../types/index.js';

const now = () => new Date().toISOString();

export const defaultRuleConfig: PaperRuleConfig = {
  pageSize: 'A4',
  margin: 'Top 2.5cm, Bottom 2.5cm, Left 3cm, Right 2.5cm',
  bodyFont: 'Times New Roman',
  bodyFontSize: '12pt',
  lineHeight: '1.5',
  paragraphSpacing: 'Before 0pt, After 0pt',
  firstLineIndent: '2 chars',
  headingFormats: 'Level 1: 黑体 三号; Level 2: 黑体 四号; Level 3: 黑体 小四',
  pageNumberRule: 'Bottom center Arabic numerals',
  abstractFormat: 'Title bold with 12pt body text',
  keywordFormat: 'Keywords line should be present',
  referenceFormat: 'GB/T 7714-2015'
};

export const seedTemplates = (): RuleTemplate[] => {
  const updatedAt = now();

  return [
    {
      id: 'tpl_default_undergraduate',
      name: 'Undergraduate Thesis Default',
      description: 'Baseline formatting template for undergraduate thesis papers.',
      config: defaultRuleConfig,
      updatedAt,
      isDefault: true,
    },
    {
      id: 'tpl_master_research',
      name: 'Master Thesis Research',
      description: 'Stricter thesis template with fixed line spacing and the same reference standard.',
      config: {
        ...defaultRuleConfig,
        margin: 'Top 3cm, Bottom 2.5cm, Left 3cm, Right 2.5cm',
        lineHeight: '20pt',
        paragraphSpacing: 'Before 6pt, After 6pt',
      },
      updatedAt,
      isDefault: false,
    },
  ];
};
