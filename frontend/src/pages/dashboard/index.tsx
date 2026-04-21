import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, List, Tag, Skeleton } from 'antd';
import { 
  FileDoneOutlined, 
  HistoryOutlined, 
  ClockCircleOutlined, 
  WarningOutlined 
} from '@ant-design/icons';
import { api } from '../../api';
import type { RecentCheckItem } from '../../api';
import type { DashboardStats } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';

const { Title, Paragraph } = Typography;

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentChecks, setRecentChecks] = useState<RecentCheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const setCurrentPaper = useAppStore(state => state.setCurrentPaper);
  const setCurrentResult = useAppStore(state => state.setCurrentResult);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsData, recentChecksData] = await Promise.all([
          api.getDashboardStats(),
          api.getRecentChecks(),
        ]);
        setStats(statsData);
        setRecentChecks(recentChecksData);
      } catch (error) {
        console.error('Failed to fetch dashboard stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const handleViewResult = async (checkId: string) => {
    try {
      const [check, result] = await Promise.all([
        api.getCheck(checkId),
        api.getCheckResult(checkId),
      ]);
      const paper = await api.getUploadedPaper(check.paperId);
      setCurrentPaper(paper);
      setCurrentResult(result);
      navigate('/result');
    } catch (error) {
      console.error('Failed to load check result', error);
    }
  };

  return (
    <div>
      <Typography>
        <Title level={2}>系统概览</Title>
        <Paragraph>
          欢迎使用论文格式合规检查系统。在这里您可以快速了解格式规范并检测您的论文格式。
        </Paragraph>
      </Typography>

      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} hoverable>
              <Statistic 
                title="模板总数" 
                value={stats?.totalTemplates} 
                prefix={<FileDoneOutlined style={{ color: '#1677ff' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} hoverable>
              <Statistic 
                title="最近检测次数" 
                value={stats?.recentCheckCount} 
                prefix={<HistoryOutlined style={{ color: '#52c41a' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} hoverable>
              <Statistic 
                title="待修正问题" 
                value={stats?.pendingFixIssues} 
                prefix={<WarningOutlined style={{ color: '#faad14' }} />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} hoverable>
              <Statistic 
                title="最近一次检测时间" 
                value={stats?.lastCheckTime?.replace('T', ' ').split(' ')[0]} 
                prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />} 
                valueStyle={{ fontSize: 18, marginTop: 8 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Title level={4} style={{ marginTop: 40, marginBottom: 16 }}>最近检测记录</Title>
      <Card bordered={false}>
        <List
          itemLayout="horizontal"
          locale={{ emptyText: 'No recent checks yet' }}
          dataSource={recentChecks}
          renderItem={(item) => (
            <List.Item
              actions={[<a key="view" onClick={() => handleViewResult(item.id)}>查看结果</a>]}
            >
              <List.Item.Meta
                title={item.name}
                description={`检测时间: ${item.time}`}
              />
              <div style={{ marginRight: 32 }}>
                <Tag color={item.status === 'completed' ? 'success' : 'processing'}>
                  {item.status === 'completed' ? '已完成' : '检测中'}
                </Tag>
                {item.issues > 0 && <span style={{ color: '#faad14', marginLeft: 16 }}>发现 {item.issues} 处问题</span>}
              </div>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
