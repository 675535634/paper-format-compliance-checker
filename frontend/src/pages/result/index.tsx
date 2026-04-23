import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  App as AntdApp,
  Card,
  Result,
  Button,
  Table,
  Tag,
  Typography,
  Space,
  Select,
  Empty,
  Alert,
  Radio,
  Skeleton,
  Row,
  Col,
  Pagination,
} from 'antd';
import { DownloadOutlined, ExclamationCircleOutlined, FileSearchOutlined, ToolOutlined } from '@ant-design/icons';
import { api, extractApiErrorMessage, isUnauthorizedError } from '../../api';
import { useAppStore } from '../../store';
import { useNavigate, useParams } from 'react-router-dom';
import type { CheckIssue } from '../../types';
import { useI18n } from '../../i18n';

const { Text } = Typography;
const CARD_PAGE_SIZE = 12;

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
  const [cardPage, setCardPage] = useState(1);
  const categoryMap = useMemo(() => getCategoryMap(isEnglish), [isEnglish]);
  const severityMap = useMemo(() => getSeverityMap(isEnglish), [isEnglish]);

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

  const handleDownloadFixedDocx = async () => {
    if (!checkId) {
      return;
    }

    setFixDownloading(true);
    try {
      const { blob, filename } = await api.downloadFixedDocx(checkId);
      downloadBlob(blob, filename);
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

  const result = checkId && storedResult?.id !== checkId ? null : storedResult;
  const currentPaper = checkId && storedResult?.id !== checkId ? null : storedPaper;
  const showRestoredNotice = Boolean(result && currentPaper && (restoredPaperNoticeVisible || restoredResultNoticeVisible));

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
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: isEnglish ? 'Issue Details' : '问题描述',
      key: 'description',
      render: (_: unknown, record: CheckIssue) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            <Text type="secondary">{isEnglish ? 'Current:' : '当前值：'}</Text>
            {record.currentValue}
          </div>
          <div style={{ marginBottom: 4 }}>
            <Text type="secondary">{isEnglish ? 'Expected:' : '期望值：'}</Text>
            <Text type="success">{record.expectedValue}</Text>
          </div>
          <div>
            <Text type="secondary">{isEnglish ? 'Reason:' : '原因：'}</Text>
            <Text type="danger">{record.reason}</Text>
          </div>
        </div>
      ),
    },
    {
      title: isEnglish ? 'Suggestion' : '修改建议',
      dataIndex: 'suggestion',
      key: 'suggestion',
      render: (text: string) => <Alert title={text} type="info" showIcon />,
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
              onClick={() => void handleDownloadFixedDocx()}
            >
              {isEnglish ? 'Repair and Download' : '一键修复并下载'}
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
          ? 'Repair export focuses on high-confidence fixes such as page margins, headers and page numbers, baseline body formatting, keyword labels, missing section placeholders, and figure or table caption placeholders. It writes placeholder text where manual completion is still required.'
          : '一键修复会优先处理页边距、页眉页码、正文基础格式、关键词标签、缺失章节占位以及图表题注占位等高置信度问题；对需要人工补充内容的位置会写入占位文本，方便继续修改。'}
      />

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
                {pagedIssues.map((item) => (
                  <Col xs={24} sm={24} md={12} lg={12} xl={8} xxl={8} key={item.id}>
                    <Card
                      title={`${categoryMap[item.category]} - ${item.location}`}
                      size="small"
                      extra={(
                        <Tag color={severityMap[item.severity].color} icon={severityMap[item.severity].icon}>
                          {severityMap[item.severity].text}
                        </Tag>
                      )}
                    >
                      <div style={{ marginBottom: 12 }}>
                        <div>
                          <Text type="secondary">{isEnglish ? 'Current:' : '当前值：'}</Text>
                          {item.currentValue}
                        </div>
                        <div>
                          <Text type="secondary">{isEnglish ? 'Expected:' : '期望值：'}</Text>
                          <Text type="success">{item.expectedValue}</Text>
                        </div>
                        <div>
                          <Text type="secondary">{isEnglish ? 'Reason:' : '原因：'}</Text>
                          <Text type="danger">{item.reason}</Text>
                        </div>
                      </div>
                      <Alert title={item.suggestion} type="info" showIcon />
                    </Card>
                  </Col>
                ))}
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
