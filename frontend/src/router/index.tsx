import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import Dashboard from '../pages/dashboard';
import CheckPaper from '../pages/check';
import RulesConfig from '../pages/rules';
import TemplatesManage from '../pages/templates';
import CheckResultPage from '../pages/result';
import AuthPage from '../pages/auth';
import PublicGalleryPage from '../pages/public-gallery';
import { useAppStore } from '../store';

const RequireAuth: React.FC<React.PropsWithChildren> = ({ children }) => {
  const currentUser = useAppStore((state) => state.currentUser);
  return currentUser ? <>{children}</> : <Navigate to="/auth" replace />;
};

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthPage />
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: 'dashboard',
        element: <Dashboard />
      },
      {
        path: 'check',
        element: <CheckPaper />
      },
      {
        path: 'rules',
        element: <RulesConfig />
      },
      {
        path: 'templates',
        element: <TemplatesManage />
      },
      {
        path: 'gallery',
        element: <PublicGalleryPage />
      },
      {
        path: 'result',
        element: <CheckResultPage />
      },
      {
        path: 'result/:checkId',
        element: <CheckResultPage />
      }
    ]
  }
]);
