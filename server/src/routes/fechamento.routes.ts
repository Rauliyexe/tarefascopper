import { Router } from 'express';
import { fechamentoController } from '../controllers/fechamento.controller.js';

export const fechamentoRoutes = Router();

fechamentoRoutes.get('/', (req, res, next) => fechamentoController.list(req, res, next));
fechamentoRoutes.post('/', (req, res, next) => fechamentoController.create(req, res, next));
fechamentoRoutes.post('/gerar-sintese-individual', (req, res, next) =>
  fechamentoController.previewIndividualSynthesis(req, res, next)
);
fechamentoRoutes.post('/enviar-email', (req, res, next) => fechamentoController.sendEmail(req, res, next));
fechamentoRoutes.get('/diario-notas', (req, res, next) => fechamentoController.getDailyNote(req, res, next));
fechamentoRoutes.get('/diario-notas-periodo', (req, res, next) => fechamentoController.listDailyNotes(req, res, next));
fechamentoRoutes.put('/diario-notas', (req, res, next) => fechamentoController.saveDailyNote(req, res, next));

