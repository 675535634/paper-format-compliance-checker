
import { RouterProvider } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import { router } from './router';
import { I18nProvider, useI18n } from './i18n';

const AppShell: React.FC = () => {
  const { antdLocale } = useI18n();

  return (
    <ConfigProvider locale={antdLocale} theme={{
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 6,
        colorBgContainer: '#ffffff',
      }
    }}>
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
};

function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}

export default App;
