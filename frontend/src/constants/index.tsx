import React from 'react';
import { ExclamationCircleOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';

export const CATEGORY_MAP: Record<string, string> = {
  page: '页面设置',
  body: '正文格式',
  heading: '标题格式',
  reference: '参考文献',
  other: '其他',
};

export const SEVERITY_MAP: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  high: { color: 'error', icon: <ExclamationCircleOutlined />, text: '高风险' },
  medium: { color: 'warning', icon: <WarningOutlined />, text: '需关注' },
  low: { color: 'processing', icon: <InfoCircleOutlined />, text: '建议调整' },
};
