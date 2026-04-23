import { useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Col, Form, Input, Row, Tabs, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api, extractApiErrorMessage } from '../../api';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';

const { Title, Paragraph } = Typography;

const AuthPage: React.FC = () => {
  const { isEnglish } = useI18n();
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const setSession = useAppStore((state) => state.setSession);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleLogin = async (values: { identifier: string; password: string }) => {
    setLoading(true);
    try {
      const session = await api.login(values);
      setSession(session.token, session.user);
      message.success(isEnglish ? 'Signed in successfully.' : '登录成功。');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const text = extractApiErrorMessage(error);
      message.error(text ?? (isEnglish ? 'Failed to sign in.' : '登录失败。'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: {
    username: string;
    displayName?: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    setLoading(true);
    try {
      const session = await api.register({
        username: values.username,
        displayName: values.displayName,
        email: values.email,
        password: values.password,
      });
      setSession(session.token, session.user);
      message.success(isEnglish ? 'Account created.' : '注册成功。');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const text = extractApiErrorMessage(error);
      message.error(text ?? (isEnglish ? 'Failed to register.' : '注册失败。'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f6f8fb 0%, #eef3ff 100%)', padding: '48px 24px' }}>
      <Row justify="center" align="middle">
        <Col xs={24} sm={20} md={16} lg={10} xl={8}>
          <Card variant="borderless" style={{ boxShadow: '0 18px 45px rgba(22, 119, 255, 0.08)' }}>
            <Title level={2} style={{ marginBottom: 8 }}>
              {isEnglish ? 'Paper Format Checker' : '论文格式合规检查器'}
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
              {isEnglish
                ? 'Sign in to manage your private templates, publish shared templates, and save your checking history.'
                : '登录后即可管理自己的私有模板、发布共享模板，并保存检查记录。'}
            </Paragraph>

            <Tabs
              defaultActiveKey="login"
              items={[
                {
                  key: 'login',
                  label: isEnglish ? 'Sign In' : '登录',
                  children: (
                    <Form layout="vertical" onFinish={handleLogin}>
                      <Form.Item
                        name="identifier"
                        label={isEnglish ? 'Username or Email' : '用户名或邮箱'}
                        rules={[{ required: true, message: isEnglish ? 'Enter your username or email.' : '请输入用户名或邮箱。' }]}
                      >
                        <Input autoComplete="username" />
                      </Form.Item>
                      <Form.Item
                        name="password"
                        label={isEnglish ? 'Password' : '密码'}
                        rules={[{ required: true, message: isEnglish ? 'Enter your password.' : '请输入密码。' }]}
                      >
                        <Input.Password autoComplete="current-password" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" block loading={loading}>
                        {isEnglish ? 'Sign In' : '登录'}
                      </Button>
                    </Form>
                  ),
                },
                {
                  key: 'register',
                  label: isEnglish ? 'Register' : '注册',
                  children: (
                    <Form layout="vertical" onFinish={handleRegister}>
                      <Form.Item
                        name="username"
                        label={isEnglish ? 'Username' : '用户名'}
                        rules={[{ required: true, message: isEnglish ? 'Enter a username.' : '请输入用户名。' }]}
                      >
                        <Input autoComplete="username" />
                      </Form.Item>
                      <Form.Item name="displayName" label={isEnglish ? 'Display Name' : '显示名称'}>
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                          { required: true, message: isEnglish ? 'Enter your email.' : '请输入邮箱。' },
                          { type: 'email', message: isEnglish ? 'Enter a valid email.' : '请输入有效邮箱。' },
                        ]}
                      >
                        <Input autoComplete="email" />
                      </Form.Item>
                      <Form.Item
                        name="password"
                        label={isEnglish ? 'Password' : '密码'}
                        rules={[
                          { required: true, message: isEnglish ? 'Enter a password.' : '请输入密码。' },
                          { min: 6, message: isEnglish ? 'Use at least 6 characters.' : '密码至少 6 位。' },
                        ]}
                      >
                        <Input.Password autoComplete="new-password" />
                      </Form.Item>
                      <Form.Item
                        name="confirmPassword"
                        label={isEnglish ? 'Confirm Password' : '确认密码'}
                        dependencies={['password']}
                        rules={[
                          { required: true, message: isEnglish ? 'Confirm your password.' : '请确认密码。' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('password') === value) {
                                return Promise.resolve();
                              }

                              return Promise.reject(new Error(isEnglish ? 'Passwords do not match.' : '两次输入的密码不一致。'));
                            },
                          }),
                        ]}
                      >
                        <Input.Password autoComplete="new-password" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" block loading={loading}>
                        {isEnglish ? 'Create Account' : '创建账号'}
                      </Button>
                    </Form>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AuthPage;
