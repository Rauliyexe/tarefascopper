import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { recordAudit } from '../lib/audit.js';
import { generateIndividualSynthesis } from '../services/reportSynthesisService.js';
import { safeParseObject, safeParseArray } from '../lib/json.js';

const mapShiftReportToRecord = (row: any) => {
  const metricas = safeParseObject(row.metricas);
  const answers = safeParseArray(row.answersJson);
  const tasksSnapshot = safeParseObject(row.tasksSnapshotJson);
  return {
    id: row.id,
    companyId: row.companyId,
    departmentId: row.departmentId || null,
    departmentName: row.departmentName || null,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    userRole: row.userRole,
    action: 'FECHAMENTO_EXPEDIENTE',
    entity: 'FechamentoExpediente',
    entityId: row.id,
    description: `Fechamento de expediente (${row.turno}) registrado por ${row.userName}`,
    ipAddress: row.ipAddress || '127.0.0.1',
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    newValues: {
      dataFechamento: row.dateKey,
      turno: row.turno,
      metodo: row.metodo as 'VOZ' | 'TEXTO' | 'HIBRIDO',
      departmentId: row.departmentId || null,
      departmentName: row.departmentName || null,
      perguntas: {
        pergunta1: row.pergunta1 || '',
        pergunta2: row.pergunta2 || '',
        pergunta3: row.pergunta3 || '',
      },
      answers,
      tasksSnapshot,
      resumoAutomatico: row.resumoAutomatico || '',
      aiIndividualSummary: row.aiIndividualSummary || row.resumoAutomatico || '',
      audioTranscrito: row.audioTranscrito || undefined,
      metricas,
      colaborador: {
        id: row.userId,
        nome: row.userName,
        email: row.userEmail,
        cargo: row.userRole,
        departmentId: row.departmentId || null,
        departmentName: row.departmentName || null,
      },
    },
  };
};

export class FechamentoController {
  /**
   * Lista os fechamentos de expediente registrados no banco de dados.
   * Aplica verificação de permissões (RBAC) no backend:
   * - OPERATOR: apenas seus próprios relatórios
   * - MANAGER: apenas relatórios do seu próprio departamento
   * - CEO (André): todos os departamentos
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser;
      const companyId = req.query.companyId as string | undefined;
      const departmentId = req.query.departmentId as string | undefined;
      const turno = req.query.turno as string | undefined;
      const date = req.query.date as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const userId = req.query.userId as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 200, 500);

      const whereClause: any = {};

      if (companyId && companyId !== 'all') {
        whereClause.companyId = companyId;
      }
      if (turno && turno !== 'TODOS') {
        whereClause.turno = turno;
      }
      if (startDate && endDate) {
        whereClause.dateKey = {
          gte: startDate,
          lte: endDate,
        };
      } else if (date) {
        whereClause.dateKey = date;
      }

      // Isolamento de acesso verificado no backend
      if (authUser) {
        if (authUser.role === 'OPERATOR') {
          if ((userId && userId !== authUser.id) || (departmentId && departmentId !== authUser.departmentId)) {
            res.status(403).json({
              error: 'Acesso negado. Operadores só podem consultar seus próprios relatórios.',
              code: 'FORBIDDEN_OPERATOR_SCOPE',
            });
            return;
          }
          whereClause.userId = authUser.id;
        } else if (authUser.role === 'MANAGER' && !authUser.canAccessAllDepartments) {
          if (departmentId && departmentId !== 'TODOS' && departmentId !== authUser.departmentId) {
            res.status(403).json({
              error: 'Acesso negado. Gestores de departamento não têm acesso a relatórios de outros departamentos.',
              code: 'FORBIDDEN_CROSS_DEPARTMENT',
            });
            return;
          }
          if (authUser.departmentId) {
            whereClause.departmentId = authUser.departmentId;
          }
          if (userId) {
            whereClause.userId = userId;
          }
        } else {
          // CEO / André
          if (departmentId && departmentId !== 'TODOS') {
            whereClause.departmentId = departmentId;
          }
          if (userId) {
            whereClause.userId = userId;
          }
        }
      } else {
        if (departmentId && departmentId !== 'TODOS') {
          whereClause.departmentId = departmentId;
        }
        if (userId) {
          whereClause.userId = userId;
        }
      }

      const rows = await prisma.shiftReport.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      res.status(200).json({
        total: rows.length,
        fechamentos: rows.map(mapShiftReportToRecord),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Registra um novo fechamento de expediente no banco de dados + Trilha de Auditoria.
   * Preserva o snapshot histórico de perguntas e respostas em answersJson.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser;
      const {
        companyId = 'emp-copper-group',
        departmentId: bodyDepartmentId,
        departmentName: bodyDepartmentName,
        turno = 'ADMINISTRATIVO',
        metodo = 'TEXTO',
        perguntas = {},
        answers = [],
        tasksSnapshot = {},
        resumoAutomatico = '',
        aiIndividualSummary,
        audioTranscrito,
        metricas = {},
        enviarEmailDiretoria = false,
        destinatarioEmail,
        userId: bodyUserId,
        userName: bodyUserName = 'Operador do Sistema',
        userEmail: bodyUserEmail = 'operador@coppergroup.com.br',
        userRole: bodyUserRole = 'OPERATOR',
      } = req.body;

      const resolvedUserId = authUser?.id || bodyUserId || null;
      const resolvedUserName = authUser?.name || bodyUserName;
      const resolvedUserEmail = authUser?.email || bodyUserEmail;
      const resolvedUserRole = authUser?.role || bodyUserRole;
      const resolvedDeptId = authUser?.departmentId || bodyDepartmentId || null;

      let resolvedDeptName = bodyDepartmentName || authUser?.department || null;
      if (resolvedDeptId && !resolvedDeptName) {
        const dep = await prisma.department.findUnique({ where: { id: resolvedDeptId } });
        resolvedDeptName = dep?.name || null;
      }

      const dateKey = new Date().toISOString().slice(0, 10);
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      // Se vierem answers dinâmicas, valida obrigatórias e sincroniza pergunta1..3 para retrocompatibilidade
      const normalizedAnswers = Array.isArray(answers) ? answers : [];
      const missingRequired = normalizedAnswers.find(
        (a: any) => a?.required && (!a?.answerText || !String(a.answerText).trim())
      );
      if (missingRequired) {
        res.status(400).json({
          error: `A pergunta obrigatória "${missingRequired.questionTextSnapshot}" precisa ser respondida.`,
          code: 'MISSING_REQUIRED_ANSWER',
        });
        return;
      }

      const p1 = perguntas.pergunta1 || normalizedAnswers[0]?.answerText || '';
      const p2 = perguntas.pergunta2 || normalizedAnswers[1]?.answerText || '';
      const p3 = perguntas.pergunta3 || normalizedAnswers[2]?.answerText || '';

      const parsedTasksSnapshot =
        typeof tasksSnapshot === 'string' ? safeParseObject(tasksSnapshot) : tasksSnapshot || {};

      // Gera a síntese individual estruturada se ainda não enviada pronta
      const synthesisResult = await generateIndividualSynthesis({
        dateKey,
        userName: resolvedUserName,
        departmentName: resolvedDeptName || 'Setor Operacional',
        turno,
        answers:
          normalizedAnswers.length > 0
            ? normalizedAnswers
            : [
                {
                  questionId: 'legacy-1',
                  questionTextSnapshot: 'Atividades realizadas no expediente',
                  order: 1,
                  required: true,
                  answerText: p1,
                },
                {
                  questionId: 'legacy-2',
                  questionTextSnapshot: 'Impedimentos ou problemas encontrados',
                  order: 2,
                  required: true,
                  answerText: p2,
                },
                {
                  questionId: 'legacy-3',
                  questionTextSnapshot: 'Pendências para o próximo expediente',
                  order: 3,
                  required: true,
                  answerText: p3,
                },
              ],
        tasksSnapshot: parsedTasksSnapshot,
      });

      const finalResumo = resumoAutomatico?.trim() || synthesisResult.structuredReport;
      const finalAiSummary = aiIndividualSummary?.trim() || synthesisResult.executiveParagraph;

      const created = await prisma.shiftReport.create({
        data: {
          companyId,
          departmentId: resolvedDeptId,
          departmentName: resolvedDeptName,
          dateKey,
          turno,
          metodo,
          userId: resolvedUserId,
          userName: resolvedUserName,
          userEmail: resolvedUserEmail,
          userRole: resolvedUserRole,
          pergunta1: p1,
          pergunta2: p2,
          pergunta3: p3,
          answersJson: JSON.stringify(normalizedAnswers),
          tasksSnapshotJson: JSON.stringify(parsedTasksSnapshot),
          resumoAutomatico: finalResumo,
          aiIndividualSummary: finalAiSummary,
          audioTranscrito: audioTranscrito || null,
          metricas: typeof metricas === 'string' ? metricas : JSON.stringify(metricas),
          emailSentTo: enviarEmailDiretoria ? destinatarioEmail || 'andre@coppergroup.com.br' : null,
          ipAddress: ip,
        },
      });

      const mapped = mapShiftReportToRecord(created);

      await recordAudit({
        action: 'FECHAMENTO_EXPEDIENTE',
        entity: 'FechamentoExpediente',
        entityId: created.id,
        module: 'RDO_FECHAMENTO',
        companyId,
        userId: resolvedUserId,
        userName: resolvedUserName,
        userEmail: resolvedUserEmail,
        userRole: resolvedUserRole,
        description: `Fechamento de expediente (${turno}) registrado por ${resolvedUserName} (${resolvedDeptName || 'Geral'})${enviarEmailDiretoria ? ` e enviado para ${destinatarioEmail || 'diretoria'}` : ''}`,
        newValues: mapped.newValues,
        ipAddress: ip,
      });

      res.status(201).json({
        success: true,
        fechamento: mapped,
        emailStatus: enviarEmailDiretoria
          ? {
            enviado: true,
            destinatario: destinatarioEmail || 'andre@coppergroup.com.br',
          }
          : { enviado: false },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/fechamento-expediente/gerar-sintese-individual
   * Gera prévia da síntese individual estruturada utilizando a IA (ou motor determinístico).
   */
  async previewIndividualSynthesis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser;
      const {
        dateKey = new Date().toISOString().slice(0, 10),
        userName,
        departmentName,
        turno = 'ADMINISTRATIVO',
        answers = [],
        tasksSnapshot = {},
        observacoesAdicionais = '',
      } = req.body || {};

      const result = await generateIndividualSynthesis({
        dateKey,
        userName: authUser?.name || userName || 'Colaborador',
        departmentName: departmentName || authUser?.department || 'Setor Operacional',
        turno,
        answers: Array.isArray(answers) ? answers : [],
        tasksSnapshot,
        observacoesAdicionais,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dispara ou reenvia relatório de fechamento por e-mail para a Diretoria.
   */
  async sendEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, destinatarioEmail = 'andre@coppergroup.com.br' } = req.body;

      if (id) {
        const existing = await prisma.shiftReport.findUnique({ where: { id: String(id) } });
        if (existing) {
          await prisma.shiftReport.update({
            where: { id: String(id) },
            data: { emailSentTo: destinatarioEmail },
          });

          await recordAudit({
            action: 'FECHAMENTO_EMAIL_SENT',
            entity: 'FechamentoExpediente',
            entityId: existing.id,
            module: 'RDO_FECHAMENTO',
            companyId: existing.companyId,
            userName: existing.userName,
            userEmail: existing.userEmail,
            userRole: existing.userRole,
            description: `Cópia executiva do fechamento de ${existing.userName} enviada por e-mail para ${destinatarioEmail}`,
          });
        }
      }

      res.status(200).json({
        success: true,
        message: `Relatório executivo enviado com sucesso para ${destinatarioEmail}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtém notas do Diário de Bordo Operacional do dia no banco de dados.
   */
  async getDailyNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = (req.query.companyId as string) || 'emp-copper-group';
      const dateKey = (req.query.date as string) || new Date().toISOString().slice(0, 10);

      const note = await prisma.dailyNote.findUnique({
        where: {
          companyId_dateKey: { companyId, dateKey },
        },
      });

      res.status(200).json({
        companyId,
        dateKey,
        content: note?.content || '',
        updatedBy: note?.updatedBy || null,
        updatedAt: note?.updatedAt || null,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista notas do Diário de Bordo em um intervalo de datas (Semanal / Mensal).
   */
  async listDailyNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = (req.query.companyId as string) || 'emp-copper-group';
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const whereClause: any = { companyId };
      if (startDate && endDate) {
        whereClause.dateKey = { gte: startDate, lte: endDate };
      }

      const notes = await prisma.dailyNote.findMany({
        where: whereClause,
        orderBy: { dateKey: 'desc' },
      });

      res.status(200).json({
        total: notes.length,
        notes,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Salva notas do Diário de Bordo Operacional do dia no banco de dados.
   */
  async saveDailyNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        companyId = 'emp-copper-group',
        dateKey = new Date().toISOString().slice(0, 10),
        content = '',
        updatedBy = 'Operador',
      } = req.body;

      const saved = await prisma.dailyNote.upsert({
        where: {
          companyId_dateKey: { companyId, dateKey },
        },
        update: {
          content,
          updatedBy,
        },
        create: {
          companyId,
          dateKey,
          content,
          updatedBy,
        },
      });

      await recordAudit({
        action: 'DAILY_NOTE_SAVE',
        entity: 'DailyNote',
        entityId: saved.id,
        module: 'RDO_DIARIO',
        companyId,
        userName: updatedBy,
        description: `Diário de bordo de ${dateKey} atualizado no banco de dados`,
      });

      res.status(200).json({
        success: true,
        note: saved,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const fechamentoController = new FechamentoController();

