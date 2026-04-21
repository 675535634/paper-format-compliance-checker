import type { DashboardStats, RuleTemplate, CheckResult, CheckIssue } from '../types';

export const mockDashboardStats: DashboardStats = {
  totalTemplates: 5,
  recentCheckCount: 24,
  lastCheckTime: '2026-04-21 14:30:00',
  pendingFixIssues: 12
};

export const mockTemplates: RuleTemplate[] = [
  {
    id: 't1',
    name: '本科毕业论文默认模板',
    description: '适用于2026届本科生毕业论文的格式标准',
    config: {
      pageSize: 'A4',
      margin: '上 2.5cm, 下 2.5cm, 左 3cm, 右 2.5cm',
      bodyFont: '宋体',
      bodyFontSize: '小四',
      lineHeight: 1.5,
      paragraphSpacing: '段前0行, 段后0行',
      firstLineIndent: '2字符',
      headingFormats: '一级标题 黑体三号; 二级标题 黑体四号',
      pageNumberRule: '底部居中，阿拉伯数字',
      abstractFormat: '黑体小四，行距1.5',
      keywordFormat: '黑体小四',
      referenceFormat: 'GB/T 7714-2015'
    },
    updatedAt: '2026-04-20 10:00:00',
    isDefault: true
  },
  {
    id: 't2',
    name: '硕士学位论文模板',
    description: '硕士研究生学位论文格式要求',
    config: {
      pageSize: 'A4',
      margin: '上 3cm, 下 2.5cm, 左 3cm, 右 2.5cm',
      bodyFont: '宋体',
      bodyFontSize: '小四',
      lineHeight: 20, // 固定值20磅
      paragraphSpacing: '段前0.5行, 段后0.5行',
      firstLineIndent: '2字符',
      headingFormats: '一级 黑体三号; 二级 黑体四号; 三级 黑体小四',
      pageNumberRule: '底部居中',
      abstractFormat: '黑体小四',
      keywordFormat: '黑体小四',
      referenceFormat: 'GB/T 7714-2015'
    },
    updatedAt: '2026-04-15 14:20:00',
    isDefault: false
  }
];

export const mockIssues: CheckIssue[] = [
  {
    id: 'i1',
    category: 'page',
    location: '全局页面设置',
    currentValue: '左边距 2.5cm',
    expectedValue: '左边距 3cm',
    reason: '未满足装订线要求',
    suggestion: '在页面设置中将左边距修改为 3cm',
    severity: 'high'
  },
  {
    id: 'i2',
    category: 'body',
    location: '第 3 页第 2 段',
    currentValue: '行距 1.15倍',
    expectedValue: '行距 1.5倍',
    reason: '正文行距过密',
    suggestion: '选中文段，段落设置行距为 1.5倍',
    severity: 'medium'
  },
  {
    id: 'i3',
    category: 'heading',
    location: '一级标题 "2 相关技术介绍"',
    currentValue: '宋体 三号',
    expectedValue: '黑体 三号',
    reason: '一级标题字体错误',
    suggestion: '修改标题字体为黑体',
    severity: 'high'
  },
  {
    id: 'i4',
    category: 'reference',
    location: '参考文献 [1]',
    currentValue: '作者名后缺少年份',
    expectedValue: '作者. 文章名[J]. 期刊名, 年份.',
    reason: '不符合 GB/T 7714-2015 标准',
    suggestion: '补充年份信息',
    severity: 'low'
  }
];

export const mockCheckResult: CheckResult = {
  id: 'r1',
  paperId: 'p1',
  templateId: 't1',
  status: 'completed',
  totalIssues: mockIssues.length,
  issues: mockIssues,
  createdAt: '2026-04-21 15:00:00'
};
