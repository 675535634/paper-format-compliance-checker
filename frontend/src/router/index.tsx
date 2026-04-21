import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import Dashboard from '../pages/dashboard';
import CheckPaper from '../pages/check';
import RulesConfig from '../pages/rules';
import TemplatesManage from '../pages/templates';
import CheckResultPage from '../pages/result';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
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
