import { useEffect, useState } from 'react';
import { Card, Result, Button, Table, Tag, Typography, Space, Select, Empty, Alert, Radio, List, Skeleton } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { api } from '../../api';
import { useAppStore } from '../../store';
import { useNavigate, useParams } from 'react-router-dom';
import type { CheckIssue } from '../../types';
import { CATEGORY_MAP, SEVERITY_MAP } from '../../constants';

const { Text } = Typography;
const { Option } = Select;

const CheckResultPage: React.FC = () => {
  const storedResult = useAppStore(state => state.currentResult);
  const storedPaper = useAppStore(state => state.currentPaper);
  const setCurrentResult = useAppStore(state => state.setCurrentResult);
  const setCurrentPaper = useAppStore(state => state.setCurrentPaper);
  const navigate = useNavigate();
  const { checkId } = useParams();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

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
        setLoadError('加载检测结果失败，请稍后重试。');
      } finally {
        setLoading(false);
      }
    };

    void loadCheckResult();
  }, [checkId, setCurrentPaper, setCurrentResult, storedPaper, storedResult]);

  const result = checkId && storedResult?.id !== checkId ? null : storedResult;
  const currentPaper = checkId && storedResult?.id !== checkId ? null : storedPaper;

  if (loading) {
    return (
      <Card bordered={false}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card bordered={false}>
        <Result
          status="error"
          icon={<ExclamationCircleOutlined />}
          title="结果加载失败"
          subTitle={loadError}
          extra={[
            <Button key="back" onClick={() => navigate('/dashboard')}>返回仪表盘</Button>,
            <Button type="primary" key="retry" onClick={() => navigate(0)}>重新加载</Button>,
          ]}
        />
      </Card>
    );
  }

  if (!result || !currentPaper) {
    return (
      <Card bordered={false}>
        <Empty 
          description="暂无检测结果" 
          children={
            <Button type="primary" onClick={() => navigate('/check')}>去检测论文</Button>
          }
        />
      </Card>
    );
  }

  const filteredIssues = result.issues.filter(issue => {
    if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false;
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    return true;
  });

  const columns = [
    {
      title: '编号',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (_text: string, _record: any, index: number) => index + 1
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (sev: string) => (
        <Tag color={SEVERITY_MAP[sev].color} icon={SEVERITY_MAP[sev].icon}>
          {SEVERITY_MAP[sev].text}
        </Tag>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat: string) => CATEGORY_MAP[cat]
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      width: 150,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '问题描述',
      key: 'description',
      render: (_: any, record: CheckIssue) => (
        <div>
          <div style={{ marginBottom: 4 }}><Text type="secondary">当前值：</Text>{record.currentValue}</div>
          <div style={{ marginBottom: 4 }}><Text type="secondary">期望值：</Text><Text type="success">{record.expectedValue}</Text></div>
          <div><Text type="secondary">原因：</Text><Text type="danger">{record.reason}</Text></div>
        </div>
      )
    },
    {
      title: '修改建议',
      dataIndex: 'suggestion',
      key: 'suggestion',
      render: (text: string) => <Alert message={text} type="info" showIcon />
    }
  ];

  return (
    <div>
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Result
          status={result.totalIssues === 0 ? 'success' : 'warning'}
          title={
            result.totalIssues === 0 
              ? '恭喜，未发现格式问题！' 
              : `检测完成，共发现 ${result.totalIssues} 处不合规项`
          }
          subTitle={`文档名称：${currentPaper.filename} | 检测时间：${result.createdAt}`}
          extra={[
            <Button key="recheck" onClick={() => navigate('/check')}>重新检测</Button>,
            <Button type="primary" key="export" disabled>导出报告</Button>,
          ]}
        />
      </Card>

      {result.totalIssues > 0 && (
        <Card 
          bordered={false} 
          title={<span style={{ fontSize: 18 }}>问题列表明细</span>}
          extra={
            <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)}>
              <Radio.Button value="table">表格视图</Radio.Button>
              <Radio.Button value="card">卡片视图</Radio.Button>
            </Radio.Group>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Select value={categoryFilter} onChange={setCategoryFilter} style={{ width: 150 }}>
                <Option value="all">所有分类</Option>
                <Option value="page">页面设置</Option>
                <Option value="body">正文格式</Option>
                <Option value="heading">标题格式</Option>
                <Option value="reference">参考文献</Option>
                <Option value="other">其他</Option>
              </Select>
              <Select value={severityFilter} onChange={setSeverityFilter} style={{ width: 150 }}>
                <Option value="all">所有严重程度</Option>
                <Option value="high">高</Option>
                <Option value="medium">中</Option>
                <Option value="low">低</Option>
              </Select>
            </Space>
          </div>
          
          {viewMode === 'table' ? (
            <Table 
              columns={columns} 
              dataSource={filteredIssues} 
              rowKey="id" 
              pagination={{ pageSize: 10 }}
            />
          ) : (
            <List
              grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
              dataSource={filteredIssues}
              pagination={{ pageSize: 12 }}
              renderItem={item => (
                <List.Item>
                  <Card title={`${CATEGORY_MAP[item.category]} - ${item.location}`} size="small" extra={
                    <Tag color={SEVERITY_MAP[item.severity].color} icon={SEVERITY_MAP[item.severity].icon}>
                      {SEVERITY_MAP[item.severity].text}
                    </Tag>
                  }>
                    <div style={{ marginBottom: 12 }}>
                      <div><Text type="secondary">当前值：</Text>{item.currentValue}</div>
                      <div><Text type="secondary">期望值：</Text><Text type="success">{item.expectedValue}</Text></div>
                      <div><Text type="secondary">原因：</Text><Text type="danger">{item.reason}</Text></div>
                    </div>
                    <Alert message={item.suggestion} type="info" showIcon />
                  </Card>
                </List.Item>
              )}
            />
          )}
        </Card>
      )}
    </div>
  );
};

export default CheckResultPage;
