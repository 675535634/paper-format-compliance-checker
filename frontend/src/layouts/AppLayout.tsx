import { useState } from 'react';
import { Button, Dropdown, Layout, Menu, Select, Space, theme } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  GlobalOutlined,
  ProfileOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { api } from '../api';
import { useI18n } from '../i18n';
import { useAppStore } from '../store';

const { Header, Content, Sider } = Layout;

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { locale, setLocale, isEnglish } = useI18n();
  const currentUser = useAppStore((state) => state.currentUser);
  const clearSession = useAppStore((state) => state.clearSession);
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
      label: isEnglish ? 'Dashboard' : '概览',
    },
    {
      key: '/check',
      icon: <FileSearchOutlined />,
      label: isEnglish ? 'Check Paper' : '文档检查',
    },
    {
      key: '/rules',
      icon: <SettingOutlined />,
      label: isEnglish ? 'Rules' : '规则配置',
    },
    {
      key: '/templates',
      icon: <ProfileOutlined />,
      label: isEnglish ? 'My Templates' : '我的模板',
    },
    {
      key: '/gallery',
      icon: <GlobalOutlined />,
      label: isEnglish ? 'Public Gallery' : '公开模板',
    },
    {
      key: '/result',
      icon: <FileDoneOutlined />,
      label: isEnglish ? 'Results' : '检查结果',
    },
  ];

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network failures and clear the local session anyway.
    }

    clearSession();
    navigate('/auth', { replace: true });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: collapsed ? 14 : 18,
            color: '#1677ff',
            borderBottom: '1px solid #f0f0f0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {collapsed ? 'PFCC' : isEnglish ? 'Paper Format Checker' : '论文格式检查器'}
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
        <Header
          style={{
            padding: 0,
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
            paddingLeft: 24,
            paddingRight: 24,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {isEnglish ? 'Paper Format Compliance Checker' : '论文格式合规检查器'}
          </div>
          <Space size={12}>
            <Select
              data-testid="language-switcher"
              value={locale}
              onChange={setLocale}
              style={{ width: 120 }}
              options={[
                { label: isEnglish ? 'Chinese' : '中文', value: 'zh-CN' },
                { label: 'English', value: 'en-US' },
              ]}
            />
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'user',
                    icon: <UserOutlined />,
                    label: currentUser?.displayName ?? currentUser?.username ?? 'User',
                    disabled: true,
                  },
                  {
                    key: 'logout',
                    label: isEnglish ? 'Sign Out' : '退出登录',
                    onClick: () => void handleLogout(),
                  },
                ],
              }}
            >
              <Button>{currentUser?.displayName ?? currentUser?.username ?? (isEnglish ? 'Account' : '账号')}</Button>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '24px', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              flex: 1,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};
