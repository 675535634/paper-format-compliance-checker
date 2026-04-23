import { Router } from 'express';
import { getDashboardStats, getRecentChecks } from '../services/dashboard-service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', async (request, response) => {
  response.json(await getDashboardStats(request.currentUser!.id));
});

dashboardRouter.get('/recent-checks', async (request, response) => {
  response.json(await getRecentChecks(request.currentUser!.id));
});
