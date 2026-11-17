import { Router } from 'express';
import { auditController } from '../controllers/audit.controller.js';

export const auditRoutes = Router();

// Listar trilhas de auditoria
auditRoutes.get('/', (req, res, next) => auditController.list(req, res, next));

// Registrar novo evento de auditoria
auditRoutes.post('/', (req, res, next) => auditController.create(req, res, next));

