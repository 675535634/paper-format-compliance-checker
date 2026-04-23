import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Tag, Skeleton, Empty, Space } from 'antd';
import {
  FileDoneOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { api } from '../../api';
import type { RecentCheckItem } from '../../api';
import type { DashboardStats } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';

const { Title, Paragraph } = Typography;

const Dashboard: React.FC = () => {
  const { isEnglish } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentChecks, setRecentChecks] = useState<RecentCheckItem[]>([]);
  const [loading, setLoading] = useState(true);
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

    void fetchDashboardData();
  }, []);

  return (
    <div data-testid="page-dashboard">
      <Typography>
        <Title level={2}>{isEnglish ? 'Overview' : '系统概览'}</Title>
        <Paragraph>
          {isEnglish
            ? 'Review template totals, recent checks, and pending issues here, then jump back into the latest result when needed.'
            : '在这里可以查看模板数量、最近检测记录和待处理问题，也可以从最近一次检测快速进入结果页继续核对。'}
        </Paragraph>
      </Typography>

      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card variant="borderless" hoverable>
              <Statistic
                title={isEnglish ? 'Templates' : '模板总数'}
                value={stats?.totalTemplates ?? 0}
                prefix={<FileDoneOutlined style={{ color: '#1677ff' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card variant="borderless" hoverable>
              <Statistic
                title={isEnglish ? 'Recent Checks' : '最近检测次数'}
                value={stats?.recentCheckCount ?? 0}
                prefix={<HistoryOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card variant="borderless" hoverable>
              <Statistic
                title={isEnglish ? 'Pending Issues' : '待修正问题'}
                value={stats?.pendingFixIssues ?? 0}
                prefix={<WarningOutlined style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card variant="borderless" hoverable>
              <Statistic
                title={isEnglish ? 'Last Check Date' : '最近一次检测日期'}
                value={stats?.lastCheckTime ? stats.lastCheckTime.replace('T', ' ').split(' ')[0] : '-'}
                prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />}
                styles={{ content: { fontSize: 18, marginTop: 8 } }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Title level={4} style={{ marginTop: 40, marginBottom: 16 }}>
        {isEnglish ? 'Recent Checks' : '最近检测记录'}
      </Title>
      <Card variant="borderless">
        {recentChecks.length === 0 ? (
          <Empty description={isEnglish ? 'No checks yet' : '暂时还没有检测记录'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            {recentChecks.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '16px 0',
                  borderBottom: index === recentChecks.length - 1 ? 'none' : '1px solid #f0f0f0',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>{item.name}</div>
                  <div style={{ color: '#8c8c8c' }}>{`${isEnglish ? 'Checked at' : '检测时间'}：${item.time}`}</div>
                </div>
                <Space size={12} wrap>
                  <Tag color={item.status === 'completed' ? 'success' : 'processing'}>
                    {item.status === 'completed'
                      ? isEnglish ? 'Completed' : '已完成'
                      : isEnglish ? 'Checking' : '检测中'}
                  </Tag>
                  {item.issues > 0 && (
                    <span style={{ color: '#faad14' }}>
                      {isEnglish ? `${item.issues} issues found` : `发现 ${item.issues} 处问题`}
                    </span>
                  )}
                  <a onClick={() => navigate(`/result/${item.id}`)}>{isEnglish ? 'View Result' : '查看结果'}</a>
                </Space>
              </div>
            ))}
          </Space>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
