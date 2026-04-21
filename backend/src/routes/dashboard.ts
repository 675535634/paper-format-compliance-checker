import { Router } from 'express';
import { getDashboardStats, getRecentChecks } from '../services/dashboard-service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', async (_request, response) => {
  response.json(await getDashboardStats());
});

dashboardRouter.get('/recent-checks', async (_request, response) => {
  response.json(await getRecentChecks());
});
