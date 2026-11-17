import { Router } from 'express';
import { questionnaireController } from '../controllers/questionnaire.controller.js';
import { requireAuth, requireCeo } from '../middleware/auth.js';

export const questionnaireRoutes = Router();

// Todas as rotas de questionários exigem autenticação real no backend
questionnaireRoutes.use(requireAuth);

questionnaireRoutes.get('/departments', (req, res, next) =>
  questionnaireController.listDepartments(req, res, next)
);
questionnaireRoutes.get('/my', (req, res, next) =>
  questionnaireController.getMyQuestionnaire(req, res, next)
);
questionnaireRoutes.get('/department/:departmentId', (req, res, next) =>
  questionnaireController.getByDepartment(req, res, next)
);

// Criação, edição e reordenação restritas exclusivamente ao André (CEO) no backend
questionnaireRoutes.post('/department/:departmentId/questions', requireCeo, (req, res, next) =>
  questionnaireController.createQuestion(req, res, next)
);
questionnaireRoutes.patch('/questions/:id', requireCeo, (req, res, next) =>
  questionnaireController.updateQuestion(req, res, next)
);
questionnaireRoutes.patch('/department/:departmentId/reorder', requireCeo, (req, res, next) =>
  questionnaireController.reorderQuestions(req, res, next)
);
