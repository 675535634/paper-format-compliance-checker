import { useEffect, useMemo, useState } from 'react';
import {
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
  message,
  Row,
  Col,
  Pagination,
} from 'antd';
import { DownloadOutlined, ExclamationCircleOutlined, FileSearchOutlined, ToolOutlined } from '@ant-design/icons';
import { api } from '../../api';
import { useAppStore } from '../../store';
import { useNavigate, useParams } from 'react-router-dom';
import type { CheckIssue } from '../../types';
import { CATEGORY_MAP, SEVERITY_MAP } from '../../constants';

const { Text } = Typography;
const CARD_PAGE_SIZE = 12;

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
      } catch {
        setLoadError('加载检测结果失败，请稍后重试。');
      } finally {
        setLoading(false);
      }
    };

    void loadCheckResult();
  }, [checkId, setCurrentPaper, setCurrentResult, storedPaper, storedResult]);

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
      message.success('解析日志已开始下载');
    } catch {
      message.error('解析日志下载失败');
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
      message.success('修正版文档已开始下载');
    } catch {
      message.error('修正版文档导出失败');
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
            title="结果加载失败"
            subTitle={loadError}
            extra={[
              <Button key="back" onClick={() => navigate('/dashboard')}>返回概览</Button>,
              <Button type="primary" key="retry" onClick={() => navigate(0)}>重新加载</Button>,
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
          <Empty data-testid="empty-result-state" description="暂无检测结果" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={() => navigate('/check')}>
              去检测论文
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  const columns = [
    {
      title: '序号',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (_text: string, _record: unknown, index: number) => index + 1,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (severity: string) => (
        <Tag color={SEVERITY_MAP[severity].color} icon={SEVERITY_MAP[severity].icon}>
          {SEVERITY_MAP[severity].text}
        </Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => CATEGORY_MAP[category],
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      width: 180,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '问题描述',
      key: 'description',
      render: (_: unknown, record: CheckIssue) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            <Text type="secondary">当前值：</Text>
            {record.currentValue}
          </div>
          <div style={{ marginBottom: 4 }}>
            <Text type="secondary">期望值：</Text>
            <Text type="success">{record.expectedValue}</Text>
          </div>
          <div>
            <Text type="secondary">原因：</Text>
            <Text type="danger">{record.reason}</Text>
          </div>
        </div>
      ),
    },
    {
      title: '修改建议',
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
          title="当前结果来自本地恢复的最近上下文"
          description={`已从本地恢复论文“${currentPaper.filename}”及其最近检测结果。你可以继续查看，也可以清除本地记录后重新开始。`}
          action={(
            <Button size="small" onClick={handleClearCurrentContext}>
              清除本地记录
            </Button>
          )}
        />
      )}

      <Card variant="borderless" style={{ marginBottom: 24 }}>
        <Result
          status={result.totalIssues === 0 ? 'success' : 'warning'}
          title={result.totalIssues === 0 ? '未发现格式问题' : `检测完成，共发现 ${result.totalIssues} 处问题`}
          subTitle={`文档名称：${currentPaper.filename} | 检测时间：${result.createdAt.replace('T', ' ').slice(0, 19)}`}
          extra={[
            <Button key="recheck" icon={<FileSearchOutlined />} onClick={() => navigate('/check')}>
              重新检测
            </Button>,
            <Button key="log" icon={<DownloadOutlined />} loading={logDownloading} onClick={() => void handleDownloadLog()}>
              下载解析日志
            </Button>,
            <Button
              type="primary"
              key="fix"
              icon={<ToolOutlined />}
              loading={fixDownloading}
              onClick={() => void handleDownloadFixedDocx()}
            >
              一键修复并下载
            </Button>,
          ]}
        />
      </Card>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        title="修复导出说明"
        description="一键修复会优先处理页边距、页眉页码、正文基础格式、关键词标签、缺失章节占位以及图表题注占位等高置信度问题；对需要人工补充内容的位置会写入占位文本，方便继续修改。"
      />

      {result.totalIssues > 0 && (
        <Card
          variant="borderless"
          title={<span style={{ fontSize: 18 }}>问题明细</span>}
          extra={
            <Radio.Group value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
              <Radio.Button value="table">表格视图</Radio.Button>
              <Radio.Button value="card">卡片视图</Radio.Button>
            </Radio.Group>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <Space wrap>
              <Select value={categoryFilter} onChange={setCategoryFilter} style={{ width: 160 }}>
                <Select.Option value="all">全部分类</Select.Option>
                <Select.Option value="page">页面设置</Select.Option>
                <Select.Option value="body">正文格式</Select.Option>
                <Select.Option value="heading">标题格式</Select.Option>
                <Select.Option value="reference">参考文献</Select.Option>
                <Select.Option value="other">其他</Select.Option>
              </Select>
              <Select value={severityFilter} onChange={setSeverityFilter} style={{ width: 160 }}>
                <Select.Option value="all">全部严重程度</Select.Option>
                <Select.Option value="high">高风险</Select.Option>
                <Select.Option value="medium">需关注</Select.Option>
                <Select.Option value="low">建议调整</Select.Option>
              </Select>
            </Space>
          </div>

          {filteredIssues.length === 0 ? (
            <Empty description="当前筛选条件下没有问题项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                      title={`${CATEGORY_MAP[item.category]} - ${item.location}`}
                      size="small"
                      extra={(
                        <Tag color={SEVERITY_MAP[item.severity].color} icon={SEVERITY_MAP[item.severity].icon}>
                          {SEVERITY_MAP[item.severity].text}
                        </Tag>
                      )}
                    >
                      <div style={{ marginBottom: 12 }}>
                        <div>
                          <Text type="secondary">当前值：</Text>
                          {item.currentValue}
                        </div>
                        <div>
                          <Text type="secondary">期望值：</Text>
                          <Text type="success">{item.expectedValue}</Text>
                        </div>
                        <div>
                          <Text type="secondary">原因：</Text>
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
