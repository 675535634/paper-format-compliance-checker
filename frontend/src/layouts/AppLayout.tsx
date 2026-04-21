import { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  DashboardOutlined, 
  FileSearchOutlined, 
  SettingOutlined, 
  ProfileOutlined, 
  FileDoneOutlined 
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedMenuKey = location.pathname.startsWith('/result') ? '/result' : location.pathname;

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/check',
      icon: <FileSearchOutlined />,
      label: '论文检测',
    },
    {
      key: '/rules',
      icon: <SettingOutlined />,
      label: '格式要求',
    },
    {
      key: '/templates',
      icon: <ProfileOutlined />,
      label: '模板管理',
    },
    {
      key: '/result',
      icon: <FileDoneOutlined />,
      label: '检测结果',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={(value) => setCollapsed(value)}
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: collapsed ? 14 : 18, color: '#1677ff', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {collapsed ? 'PFCC' : 'Paper Checker'}
        </div>
        <Menu 
          theme="light" 
          selectedKeys={[selectedMenuKey]} 
          mode="inline" 
          items={menuItems} 
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0', paddingLeft: 24, paddingRight: 24, justifyContent: 'flex-end' }}>
          <div style={{ fontWeight: 500 }}>欢迎, Admin</div>
        </Header>
        <Content style={{ margin: '24px', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              flex: 1
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};
