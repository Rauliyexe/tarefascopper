import { Router } from 'express';
import { taskController } from '../controllers/task.controller.js';

export const taskRoutes = Router();

// Listar tarefas (filtros: companyId, status, search)
taskRoutes.get('/', (req, res, next) => taskController.list(req, res, next));

// Resumo estatístico
taskRoutes.get('/summary', (req, res, next) => taskController.summary(req, res, next));

// Criar tarefa ou rotina
taskRoutes.post('/', (req, res, next) => taskController.create(req, res, next));

// Criação ou atualização em lote (rotinas e automações)
taskRoutes.post('/batch', (req, res, next) => taskController.batch(req, res, next));

// Atualizar tarefa
taskRoutes.put('/:id', (req, res, next) => taskController.update(req, res, next));

// Adicionar comentário/evidência
taskRoutes.post('/:id/comments', (req, res, next) => taskController.addComment(req, res, next));

// Excluir tarefa
taskRoutes.delete('/:id', (req, res, next) => taskController.delete(req, res, next));

