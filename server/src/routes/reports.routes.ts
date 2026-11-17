import { Router } from 'express';
import { reportsController } from '../controllers/reports.controller.js';
import { requireAuth, requireManagerOrCeo, requireCeo } from '../middleware/auth.js';

export const reportsRoutes = Router();

reportsRoutes.use(requireAuth);

reportsRoutes.get('/overview', (req, res, next) =>
  reportsController.getOverview(req, res, next)
);

reportsRoutes.post('/consolidate', requireManagerOrCeo, (req, res, next) =>
  reportsController.generateDepartmentSynthesis(req, res, next)
);

reportsRoutes.post('/executive/ask', requireCeo, (req, res, next) =>
  reportsController.executiveAsk(req, res, next)
);

reportsRoutes.post('/send-email', (req, res, next) =>
  reportsController.sendConsolidationEmail(req, res, next)
);
