import { Router } from 'express';
import { systemController } from '../controllers/system.controller.js';

export const systemRoutes = Router();

systemRoutes.get('/bootstrap', (req, res, next) => systemController.bootstrap(req, res, next));
systemRoutes.post('/companies', (req, res, next) => systemController.upsertCompany(req, res, next));
systemRoutes.put('/companies/:id', (req, res, next) => systemController.upsertCompany(req, res, next));
systemRoutes.post('/users', (req, res, next) => systemController.upsertUser(req, res, next));
systemRoutes.put('/users/:id', (req, res, next) => systemController.upsertUser(req, res, next));
systemRoutes.delete('/users/:id', (req, res, next) => systemController.deleteUser(req, res, next));
systemRoutes.put('/settings', (req, res, next) => systemController.saveSettings(req, res, next));

