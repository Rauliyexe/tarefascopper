import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { recordAudit } from '../lib/audit.js';
import { canAccessDepartment } from '../middleware/auth.js';

export class QuestionnaireController {
  /**
   * GET /api/questionnaires/departments
   * Lista departamentos do banco de dados com contagem de perguntas ativas/totais.
   */
  async listDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser!;
      const companyId = (req.query.companyId as string) || 'emp-copper-group';

      const [departments, questions, users] = await Promise.all([
        prisma.department.findMany({
          where: { companyId },
          orderBy: { code: 'asc' },
        }),
        prisma.departmentQuestion.findMany({
          where: { companyId },
        }),
        prisma.userProfile.findMany(),
      ]);

      const enriched = departments.map(dep => {
        const depQuestions = questions.filter(q => q.departmentId === dep.id);
        const activeQuestions = depQuestions.filter(q => q.active);
        const depUsers = users.filter(u => u.departmentId === dep.id);
        const manager = users.find(u => u.id === dep.managerUserId);

        return {
          ...dep,
          managerName: manager?.name || null,
          totalQuestionsCount: depQuestions.length,
          activeQuestionsCount: activeQuestions.length,
          employeesCount: depUsers.length,
          canAccessReports: canAccessDepartment(authUser, dep.id),
          canEditQuestionnaire: authUser.role === 'CEO',
        };
      });

      res.status(200).json({
        departments: enriched,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/questionnaires/my
   * Carrega o questionário ativo do funcionário autenticado + tarefas vinculadas ao período.
   */
  async getMyQuestionnaire(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser!;
      const companyId = (req.query.companyId as string) || 'emp-copper-group';
      const todayKey = new Date().toISOString().slice(0, 10);
      const dateKey = (req.query.date as string) || todayKey;

      // CEO pode pré-visualizar o questionário de qualquer departamento passando ?departmentId=
      const requestedDeptId = req.query.departmentId as string | undefined;
      const targetDepartmentId =
        authUser.role === 'CEO' && requestedDeptId
          ? requestedDeptId
          : authUser.departmentId || 'dep-cg-producao';

      const [department, questions, userTasks] = await Promise.all([
        prisma.department.findUnique({ where: { id: targetDepartmentId } }),
        prisma.departmentQuestion.findMany({
          where: {
            departmentId: targetDepartmentId,
            active: true,
          },
          orderBy: { order: 'asc' },
        }),
        prisma.task.findMany({
          where: {
            companyId,
            isDaily: false,
            OR: [
              { assigneeId: authUser.id },
              { assignee: authUser.name },
              { assignee: authUser.email },
              ...(authUser.departmentId ? [{ targetDepartmentId: authUser.departmentId }] : []),
            ],
          },
          orderBy: { dueDate: 'asc' },
        }),
      ]);

      // Separa tarefas por status real registrado no sistema (sem assumir conclusão automática)
      const completedTasks = userTasks.filter(t => t.status === 'Concluída');
      const inProgressTasks = userTasks.filter(t => t.status === 'Em andamento');
      const pendingTasks = userTasks.filter(t => t.status === 'Pendente');

      res.status(200).json({
        user: {
          id: authUser.id,
          name: authUser.name,
          email: authUser.email,
          role: authUser.role,
          departmentId: targetDepartmentId,
          departmentName: department?.name || authUser.department || 'Setor Operacional',
        },
        department: department || {
          id: targetDepartmentId,
          companyId,
          code: 'DEP-0000',
          name: authUser.department || 'Setor Operacional',
        },
        dateKey,
        questions,
        tasksContext: {
          totalAssigned: userTasks.length,
          completedCount: completedTasks.length,
          inProgressCount: inProgressTasks.length,
          pendingCount: pendingTasks.length,
          completed: completedTasks.map(t => ({
            id: t.id,
            title: t.title,
            project: t.project,
            priority: t.priority,
            dueDate: t.dueDate,
            status: t.status,
          })),
          inProgress: inProgressTasks.map(t => ({
            id: t.id,
            title: t.title,
            project: t.project,
            priority: t.priority,
            dueDate: t.dueDate,
            status: t.status,
          })),
          pending: pendingTasks.map(t => ({
            id: t.id,
            title: t.title,
            project: t.project,
            priority: t.priority,
            dueDate: t.dueDate,
            status: t.status,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/questionnaires/department/:departmentId
   * Consulta as perguntas de um departamento.
   * - CEO: acessa qualquer departamento (ativas e inativas).
   * - MANAGER / OPERATOR: apenas do seu próprio departamento (403 se tentar outro).
   */
  async getByDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser!;
      const { departmentId } = req.params;
      const includeInactive = req.query.includeInactive === 'true' && authUser.role === 'CEO';

      const isOwnDepartment = authUser.departmentId === departmentId;
      if (authUser.role !== 'CEO' && !isOwnDepartment) {
        res.status(403).json({
          error: 'Acesso negado. Você não possui permissão para consultar o questionário de outro departamento.',
          code: 'FORBIDDEN_CROSS_DEPARTMENT',
        });
        return;
      }

      const [department, questions] = await Promise.all([
        prisma.department.findUnique({ where: { id: departmentId } }),
        prisma.departmentQuestion.findMany({
          where: {
            departmentId,
            ...(includeInactive ? {} : { active: true }),
          },
          orderBy: { order: 'asc' },
        }),
      ]);

      if (!department) {
        res.status(404).json({ error: 'Departamento não encontrado.' });
        return;
      }

      res.status(200).json({
        department,
        questions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/questionnaires/department/:departmentId/questions
   * Cria nova pergunta para um departamento (Exclusivo André / CEO).
   */
  async createQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser!;
      const { departmentId } = req.params;
      const { prompt, required = true, active = true, order } = req.body || {};

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'O texto da pergunta (prompt) é obrigatório.' });
        return;
      }

      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department) {
        res.status(404).json({ error: 'Departamento não encontrado.' });
        return;
      }

      // Determina a próxima ordem se não informada
      let nextOrder = typeof order === 'number' ? order : 1;
      if (typeof order !== 'number') {
        const lastQuestion = await prisma.departmentQuestion.findFirst({
          where: { departmentId },
          orderBy: { order: 'desc' },
        });
        nextOrder = (lastQuestion?.order || 0) + 1;
      }

      const created = await prisma.departmentQuestion.create({
        data: {
          companyId: department.companyId,
          departmentId,
          prompt: prompt.trim(),
          order: nextOrder,
          required: Boolean(required),
          active: Boolean(active),
          createdByUserId: authUser.id,
        },
      });

      await recordAudit({
        action: 'QUESTIONNAIRE_QUESTION_CREATE',
        entity: 'DepartmentQuestion',
        entityId: created.id,
        module: 'QUESTIONARIOS',
        companyId: department.companyId,
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        newValues: created,
        description: `Pergunta #${created.order} adicionada ao departamento "${department.name}": "${created.prompt}"`,
      });

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/questionnaires/questions/:id
   * Edita texto, obrigatoriedade, status ativo/inativo ou ordem de uma pergunta (Exclusivo André / CEO).
   * Nota: relatórios já enviados preservam questionTextSnapshot em answersJson.
   */
  async updateQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser!;
      const { id } = req.params;
      const { prompt, required, active, order } = req.body || {};

      const existing = await prisma.departmentQuestion.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Pergunta não encontrada.' });
        return;
      }

      const dataToUpdate: Record<string, any> = {};
      if (typeof prompt === 'string' && prompt.trim()) {
        dataToUpdate.prompt = prompt.trim();
      }
      if (typeof required === 'boolean') {
        dataToUpdate.required = required;
      }
      if (typeof active === 'boolean') {
        dataToUpdate.active = active;
      }
      if (typeof order === 'number' && Number.isFinite(order)) {
        dataToUpdate.order = order;
      }

      const updated = await prisma.departmentQuestion.update({
        where: { id },
        data: dataToUpdate,
      });

      await recordAudit({
        action: 'QUESTIONNAIRE_QUESTION_UPDATE',
        entity: 'DepartmentQuestion',
        entityId: updated.id,
        module: 'QUESTIONARIOS',
        companyId: updated.companyId,
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        oldValues: existing,
        newValues: updated,
        description: `Pergunta "${updated.prompt}" atualizada (ativa=${updated.active}, obrigatória=${updated.required}, ordem=${updated.order})`,
      });

      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/questionnaires/department/:departmentId/reorder
   * Reordena as perguntas de um departamento (Exclusivo André / CEO).
   * Espera `{ orderedIds: string[] }` no body.
   */
  async reorderQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser!;
      const { departmentId } = req.params;
      const { orderedIds } = req.body || {};

      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        res.status(400).json({ error: 'Envie orderedIds como um array não vazio de IDs.' });
        return;
      }

      const existingQuestions = await prisma.departmentQuestion.findMany({
        where: { departmentId },
      });
      const validIds = new Set(existingQuestions.map(q => q.id));

      await prisma.$transaction(
        orderedIds
          .filter(id => validIds.has(id))
          .map((id, idx) =>
            prisma.departmentQuestion.update({
              where: { id },
              data: { order: idx + 1 },
            })
          )
      );

      const updatedQuestions = await prisma.departmentQuestion.findMany({
        where: { departmentId },
        orderBy: { order: 'asc' },
      });

      await recordAudit({
        action: 'QUESTIONNAIRE_REORDER',
        entity: 'DepartmentQuestion',
        entityId: departmentId,
        module: 'QUESTIONARIOS',
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        newValues: { orderedIds },
        description: `Ordem das perguntas do departamento ${departmentId} atualizada por ${authUser.name}`,
      });

      res.status(200).json({ questions: updatedQuestions });
    } catch (error) {
      next(error);
    }
  }
}

export const questionnaireController = new QuestionnaireController();
