import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { recordAudit } from '../lib/audit.js';
import { safeParseArray, safeStringify } from '../lib/json.js';

const mapTaskFromDb = (task: any) => ({
  ...task,
  checklists: safeParseArray(task.checklists),
  attachments: safeParseArray(task.attachments),
  comments: safeParseArray(task.comments),
});

export class TaskController {
  /**
   * Lista tarefas e rotinas com filtros opcionais.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.query.companyId as string | undefined;
      const status = req.query.status as string | undefined;
      const search = (req.query.search as string | undefined)?.trim();

      const whereClause: any = {};

      if (companyId && companyId !== 'all') {
        whereClause.companyId = companyId;
      }

      if (status && status !== 'Todos') {
        whereClause.status = status;
      }

      if (search) {
        whereClause.OR = [
          { title: { contains: search } },
          { project: { contains: search } },
          { assignee: { contains: search } },
        ];
      }

      const rawTasks = await prisma.task.findMany({
        where: whereClause,
        orderBy: [{ isDaily: 'desc' }, { createdAt: 'desc' }],
      });

      const tasks = rawTasks.map(mapTaskFromDb);

      res.status(200).json({
        total: tasks.length,
        tasks,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retorna resumo estatístico rápido.
   */
  async summary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const allTasks = await prisma.task.findMany({
        where: { isDaily: false },
        select: { status: true, priority: true, dueDate: true },
      });

      const today = new Date().toISOString().slice(0, 10);
      const total = allTasks.length;
      const pending = allTasks.filter(t => t.status === 'Pendente').length;
      const inProgress = allTasks.filter(t => t.status === 'Em andamento').length;
      const done = allTasks.filter(t => t.status === 'Concluída').length;
      const overdue = allTasks.filter(t => t.dueDate < today && t.status !== 'Concluída').length;

      res.status(200).json({
        total,
        pending,
        inProgress,
        done,
        overdue,
        completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cria uma nova tarefa ou rotina operacional diária.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        id,
        title,
        project,
        assignee,
        dueDate,
        priority = 'Média',
        status = 'Pendente',
        companyId = 'emp-copper-group',
        isDaily = false,
        dailyTime,
        dailyWeekdaysOnly = false,
        assignedBy = 'Gestão Operacional',
        dailyActive = true,
        routineDescription,
        lastDispatchedDate,
        routineTargetMode,
        targetDepartmentId,
        assigneeId,
        sourceRoutineId,
        checklists,
        attachments,
        comments,
      } = req.body;

      if (!title || !project) {
        res.status(400).json({ message: 'title e project são obrigatórios' });
        return;
      }

      const taskData: any = {
        title: title.trim(),
        project: project.trim(),
        assignee: assignee?.trim() || 'Equipe',
        dueDate: dueDate || new Date().toISOString().slice(0, 10),
        priority,
        status,
        companyId,
        isDaily: Boolean(isDaily),
        dailyTime: dailyTime || null,
        dailyWeekdaysOnly: Boolean(dailyWeekdaysOnly),
        assignedBy: assignedBy?.trim() || 'Gestão Operacional',
        dailyActive: dailyActive !== undefined ? Boolean(dailyActive) : true,
        routineDescription: routineDescription?.trim() || null,
        lastDispatchedDate: lastDispatchedDate || null,
        routineTargetMode: routineTargetMode || null,
        targetDepartmentId: targetDepartmentId || null,
        assigneeId: assigneeId || null,
        sourceRoutineId: sourceRoutineId || null,
        checklists: safeStringify(checklists),
        attachments: safeStringify(attachments),
        comments: safeStringify(comments),
      };

      if (id) {
        taskData.id = id;
      }

      const created = await prisma.task.create({
        data: taskData,
      });

      const mapped = mapTaskFromDb(created);
      const authUser = req.authUser;
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      // Trilha de Auditoria (RN-03 / RN-17 Traceability)
      await recordAudit({
        action: isDaily ? 'ROUTINE_CREATE' : 'TASK_CREATE',
        entity: isDaily ? 'Routine' : 'Task',
        entityId: created.id,
        description: isDaily
          ? `Rotina diária "${created.title}" cadastrada para ${created.assignee} (${created.dailyTime || 'Sem horário'})`
          : `Tarefa "${created.title}" criada para ${created.assignee} (Prioridade: ${created.priority})`,
        companyId: created.companyId,
        userId: authUser?.id || null,
        userName: authUser?.name || assignedBy || 'Gestão Operacional',
        userEmail: authUser?.email || 'operador@coppergroup.com.br',
        userRole: authUser?.role || 'OPERATOR',
        ipAddress: clientIp,
        newValues: mapped,
      });

      res.status(201).json(mapped);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atualização ou criação em lote (rotinas e automações) de forma idempotente.
   */
  async batch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tasks = [], updateRoutines = [] } = req.body;

      const createdTasks: any[] = [];

      for (const t of tasks) {
        const payload = {
          title: t.title,
          project: t.project || 'Operações',
          assignee: t.assignee || 'Equipe',
          dueDate: t.dueDate || new Date().toISOString().slice(0, 10),
          priority: t.priority || 'Média',
          status: t.status || 'Pendente',
          companyId: t.companyId || 'emp-copper-group',
          isDaily: Boolean(t.isDaily),
          dailyTime: t.dailyTime || null,
          dailyWeekdaysOnly: Boolean(t.dailyWeekdaysOnly),
          assignedBy: t.assignedBy || 'Rotina Automatizada',
          dailyActive: t.dailyActive !== undefined ? Boolean(t.dailyActive) : true,
          routineDescription: t.routineDescription || null,
          lastDispatchedDate: t.lastDispatchedDate || null,
          routineTargetMode: t.routineTargetMode || null,
          targetDepartmentId: t.targetDepartmentId || null,
          assigneeId: t.assigneeId || null,
          sourceRoutineId: t.sourceRoutineId || null,
          checklists: safeStringify(t.checklists),
          attachments: safeStringify(t.attachments),
          comments: safeStringify(t.comments),
        };

        const row = t.id
          ? await prisma.task.upsert({
              where: { id: t.id },
              update: {},
              create: { id: t.id, ...payload },
            })
          : await prisma.task.create({
              data: payload,
            });

        createdTasks.push(mapTaskFromDb(row));
      }

      for (const r of updateRoutines) {
        if (r.id) {
          await prisma.task.updateMany({
            where: { id: r.id },
            data: {
              lastDispatchedDate: r.lastDispatchedDate,
            },
          });
        }
      }

      if (createdTasks.length > 0) {
        const authUser = req.authUser;
        const clientIp =
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          req.socket.remoteAddress ||
          req.ip ||
          '127.0.0.1';

        await recordAudit({
          action: 'ROUTINE_SWEEP',
          entity: 'Routine',
          description: `Disparo automático de rotinas: ${createdTasks.length} tarefas geradas para os colaboradores`,
          companyId: createdTasks[0]?.companyId || 'emp-copper-group',
          userId: authUser?.id || null,
          userName: authUser?.name || 'Motor de Rotinas',
          userEmail: authUser?.email || 'sistema@coppergroup.com.br',
          userRole: authUser?.role || 'SYSTEM',
          ipAddress: clientIp,
          newValues: { totalGenerated: createdTasks.length },
        });
      }

      res.status(200).json({
        count: createdTasks.length,
        tasks: createdTasks,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atualiza dados de uma tarefa existente.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const data = { ...req.body };

      const existing = await prisma.task.findUnique({
        where: { id },
      });

      if (!existing) {
        res.status(404).json({ message: 'Tarefa não encontrada' });
        return;
      }

      if (data.checklists !== undefined) {
        data.checklists = safeStringify(data.checklists);
      }
      if (data.attachments !== undefined) {
        data.attachments = safeStringify(data.attachments);
      }
      if (data.comments !== undefined) {
        data.comments = safeStringify(data.comments);
      }

      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;

      const updated = await prisma.task.update({
        where: { id },
        data,
      });

      const oldMapped = mapTaskFromDb(existing);
      const newMapped = mapTaskFromDb(updated);

      // Se mudou o status, registra ação específica de transição de estado
      const isStatusChange = existing.status !== updated.status;
      const authUser = req.authUser;
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      await recordAudit({
        action: isStatusChange ? 'TASK_STATUS_CHANGE' : 'TASK_UPDATE',
        entity: updated.isDaily ? 'Routine' : 'Task',
        entityId: updated.id,
        description: isStatusChange
          ? `Status da tarefa "${updated.title}" alterado de "${existing.status}" para "${updated.status}"`
          : `Tarefa "${updated.title}" atualizada`,
        companyId: updated.companyId,
        userId: authUser?.id || null,
        userName: authUser?.name || 'Operador do Sistema',
        userEmail: authUser?.email || 'operador@coppergroup.com.br',
        userRole: authUser?.role || 'OPERATOR',
        ipAddress: clientIp,
        oldValues: oldMapped,
        newValues: newMapped,
      });

      res.status(200).json(newMapped);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Exclui uma tarefa ou rotina.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      const existing = await prisma.task.findUnique({
        where: { id },
      });

      if (!existing) {
        res.status(404).json({ message: 'Tarefa não encontrada' });
        return;
      }

      await prisma.task.delete({
        where: { id },
      });

      // Rastreabilidade de exclusão
      const authUser = req.authUser;
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      await recordAudit({
        action: 'TASK_DELETE',
        entity: existing.isDaily ? 'Routine' : 'Task',
        entityId: id,
        description: `Tarefa "${existing.title}" excluída permanentemente do sistema`,
        companyId: existing.companyId,
        userId: authUser?.id || null,
        userName: authUser?.name || 'Operador do Sistema',
        userEmail: authUser?.email || 'operador@coppergroup.com.br',
        userRole: authUser?.role || 'OPERATOR',
        ipAddress: clientIp,
        oldValues: mapTaskFromDb(existing),
      });

      res.status(200).json({ message: 'Tarefa excluída com sucesso', id });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Adiciona comentário ou evidência de conclusão em uma tarefa.
   */
  async addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { author, authorRole, content, type = 'FEEDBACK', attachments = [] } = req.body;

      if (!content?.trim()) {
        res.status(400).json({ message: 'Conteúdo do comentário é obrigatório' });
        return;
      }

      const existing = await prisma.task.findUnique({
        where: { id },
      });

      if (!existing) {
        res.status(404).json({ message: 'Tarefa não encontrada' });
        return;
      }

      const comments = safeParse(existing.comments);
      const newComment = {
        id: `cmt-${Date.now()}`,
        author: author || 'Usuário',
        authorRole: authorRole || 'Operador',
        content: content.trim(),
        type,
        createdAt: new Date().toISOString(),
        attachments: attachments || [],
      };

      comments.push(newComment);

      const updated = await prisma.task.update({
        where: { id },
        data: {
          comments: safeStringify(comments),
        },
      });

      const authUser = req.authUser;
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      await recordAudit({
        action: 'TASK_COMMENT_ADD',
        entity: 'Task',
        entityId: updated.id,
        description: `Apontamento (${type}) adicionado por ${authUser?.name || author || 'Operador'} na tarefa "${updated.title}"`,
        companyId: updated.companyId,
        userId: authUser?.id || null,
        userName: authUser?.name || author || 'Operador',
        userEmail: authUser?.email || 'operador@coppergroup.com.br',
        userRole: authUser?.role || authorRole || 'OPERATOR',
        ipAddress: clientIp,
        newValues: newComment,
      });

      res.status(200).json(mapTaskFromDb(updated));
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
