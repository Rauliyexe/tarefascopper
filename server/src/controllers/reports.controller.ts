import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { recordAudit } from '../lib/audit.js';
import { canAccessDepartment } from '../middleware/auth.js';
import { consolidateDepartmentPeriod, generateExecutiveAnalytics } from '../services/reportSynthesisService.js';
import { dispatchCorporateEmail } from '../services/emailService.js';
import { safeParseJson } from '../lib/json.js';

export class ReportsController {
  /**
   * GET /api/reports/overview
   * Motor único de consulta e análise por intervalo (Diário, Semanal, Mensal e Personalizado).
   * Verifica permissões estritas no backend:
   * - OPERATOR: vê apenas seus próprios relatórios.
   * - MANAGER: vê apenas os relatórios e aderência do seu próprio departamento (403 se tentar outro).
   * - CEO (André): acesso completo a qualquer departamento ou visão consolidada.
   */
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser!;
      const companyId = (req.query.companyId as string) || 'emp-copper-group';
      const requestedDeptId = req.query.departmentId as string | undefined;
      const requestedUserId = req.query.userId as string | undefined;
      const todayKey = new Date().toISOString().slice(0, 10);
      const startDate = (req.query.startDate as string) || todayKey;
      const endDate = (req.query.endDate as string) || startDate;
      const periodType = ((req.query.periodType as string) || 'DIARIO').toUpperCase();

      // 1. Verificação de Permissões no Backend
      if (authUser.role === 'OPERATOR') {
        if (
          (requestedUserId && requestedUserId !== 'TODOS' && requestedUserId !== authUser.id) ||
          (requestedDeptId && requestedDeptId !== 'TODOS' && requestedDeptId !== authUser.departmentId)
        ) {
          res.status(403).json({
            error: 'Acesso negado. Funcionários só podem consultar seus próprios relatórios.',
            code: 'FORBIDDEN_OPERATOR_SCOPE',
          });
          return;
        }
      }

      if (authUser.role === 'MANAGER' && !authUser.canAccessAllDepartments) {
        if (
          requestedDeptId &&
          requestedDeptId !== 'TODOS' &&
          requestedDeptId !== authUser.departmentId
        ) {
          res.status(403).json({
            error:
              'Acesso negado. Gestores de departamento não possuem acesso aos relatórios de outros departamentos.',
            code: 'FORBIDDEN_CROSS_DEPARTMENT',
          });
          return;
        }
      }

      const effectiveDepartmentId =
        authUser.role === 'CEO' || authUser.canAccessAllDepartments
          ? requestedDeptId && requestedDeptId !== 'TODOS'
            ? requestedDeptId
            : undefined
          : authUser.departmentId || undefined;

      const effectiveUserId =
        authUser.role === 'OPERATOR'
          ? authUser.id
          : requestedUserId && requestedUserId !== 'TODOS'
            ? requestedUserId
            : undefined;

      // 2. Busca departamento(s), colaboradores do setor, relatórios do período e tarefas no PostgreSQL
      const [department, departmentUsers, reports, departmentTasks, savedConsolidations] =
        await Promise.all([
          effectiveDepartmentId
            ? prisma.department.findUnique({ where: { id: effectiveDepartmentId } })
            : Promise.resolve(null),
          prisma.userProfile.findMany({
            where: {
              ...(effectiveDepartmentId ? { departmentId: effectiveDepartmentId } : {}),
              ...(effectiveUserId ? { id: effectiveUserId } : {}),
            },
            orderBy: { name: 'asc' },
          }),
          prisma.shiftReport.findMany({
            where: {
              companyId,
              dateKey: {
                gte: startDate,
                lte: endDate,
              },
              ...(effectiveDepartmentId ? { departmentId: effectiveDepartmentId } : {}),
              ...(effectiveUserId ? { userId: effectiveUserId } : {}),
            },
            orderBy: [{ dateKey: 'desc' }, { createdAt: 'desc' }],
          }),
          prisma.task.findMany({
            where: {
              companyId,
              isDaily: false,
              ...(effectiveDepartmentId
                ? {
                    OR: [
                      { departmentId: effectiveDepartmentId },
                      { targetDepartmentId: effectiveDepartmentId },
                    ],
                  }
                : {}),
            },
          }),
          prisma.reportConsolidation.findMany({
            where: {
              companyId,
              ...(effectiveDepartmentId ? { departmentId: effectiveDepartmentId } : {}),
              startDate: { gte: startDate },
              endDate: { lte: endDate },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
        ]);

      const deptName =
        department?.name ||
        (effectiveDepartmentId ? 'Departamento Selecionado' : 'Todos os Departamentos (Consolidado)');

      const consolidated = await consolidateDepartmentPeriod({
        companyId,
        departmentId: effectiveDepartmentId || 'ALL',
        departmentName: deptName,
        userId: effectiveUserId || null,
        startDate,
        endDate,
        periodType,
        requesterRole: authUser.role,
        reports,
        departmentUsers,
        departmentTasks,
      });

      res.status(200).json({
        period: {
          periodType,
          startDate,
          endDate,
        },
        department: department || {
          id: effectiveDepartmentId || 'TODOS',
          name: deptName,
          code: 'ALL',
        },
        employees: departmentUsers.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          jobTitle: u.jobTitle,
          departmentId: u.departmentId,
          department: u.department,
        })),
        compliance: {
          totalEmployees: departmentUsers.length,
          submittedCount: consolidated.highlights.submittedEmployees.length,
          missingCount: consolidated.highlights.missingEmployees.length,
          submittedEmployees: consolidated.highlights.submittedEmployees,
          missingEmployees: consolidated.highlights.missingEmployees,
          policyNote:
            'A ausência de envio de relatório é registrada estritamente como ausência de informação no período, e não como ausência de trabalho.',
        },
        highlights: consolidated.highlights,
        liveSynthesisPreview: consolidated.summaryText,
        sources: consolidated.sources,
        reports: reports.map(r => ({
          id: r.id,
          companyId: r.companyId,
          departmentId: r.departmentId,
          departmentName: r.departmentName,
          dateKey: r.dateKey,
          turno: r.turno,
          metodo: r.metodo,
          userId: r.userId,
          userName: r.userName,
          userEmail: r.userEmail,
          userRole: r.userRole,
          pergunta1: r.pergunta1,
          pergunta2: r.pergunta2,
          pergunta3: r.pergunta3,
          answers: safeParseJson(r.answersJson, []),
          tasksSnapshot: safeParseJson(r.tasksSnapshotJson, {}),
          resumoAutomatico: r.resumoAutomatico,
          aiIndividualSummary: r.aiIndividualSummary || r.resumoAutomatico,
          metricas: safeParseJson(r.metricas, {}),
          emailSentTo: r.emailSentTo,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        })),
        savedConsolidations: savedConsolidations.map(c => ({
          ...c,
          highlights: safeParseJson(c.highlightsJson, {}),
          sourceReportIds: safeParseJson(c.sourceReportIdsJson, []),
          createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/reports/consolidate
   * Gera e armazena no PostgreSQL uma Síntese Departamental (Diária, Semanal, Mensal ou Personalizada).
   * Restrita ao Gestor do próprio departamento ou ao André (CEO).
   */
  async generateDepartmentSynthesis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser!;
      const {
        companyId = 'emp-copper-group',
        departmentId: bodyDeptId,
        userId: bodyUserId,
        startDate = new Date().toISOString().slice(0, 10),
        endDate = startDate,
        periodType = 'DIARIO',
      } = req.body || {};

      if (
        authUser.role !== 'CEO' &&
        !authUser.canAccessAllDepartments &&
        bodyDeptId &&
        bodyDeptId !== 'TODOS' &&
        bodyDeptId !== authUser.departmentId
      ) {
        res.status(403).json({
          error:
            'Acesso negado. Você não tem autorização para gerar síntese de outro departamento.',
          code: 'FORBIDDEN_CROSS_DEPARTMENT',
        });
        return;
      }

      const targetDeptId =
        authUser.role === 'CEO' || authUser.canAccessAllDepartments
          ? bodyDeptId && bodyDeptId !== 'TODOS'
            ? bodyDeptId
            : authUser.departmentId
          : authUser.departmentId;

      if (!targetDeptId || !canAccessDepartment(authUser, targetDeptId)) {
        res.status(403).json({
          error:
            'Acesso negado. Você não tem autorização para gerar síntese de outro departamento.',
          code: 'FORBIDDEN_CROSS_DEPARTMENT',
        });
        return;
      }

      const [department, departmentUsers, reports, departmentTasks] = await Promise.all([
        prisma.department.findUnique({ where: { id: targetDeptId } }),
        prisma.userProfile.findMany({
          where: {
            departmentId: targetDeptId,
            ...(bodyUserId && bodyUserId !== 'TODOS' ? { id: bodyUserId } : {}),
          },
          orderBy: { name: 'asc' },
        }),
        prisma.shiftReport.findMany({
          where: {
            companyId,
            departmentId: targetDeptId,
            dateKey: {
              gte: startDate,
              lte: endDate,
            },
            ...(bodyUserId && bodyUserId !== 'TODOS' ? { userId: bodyUserId } : {}),
          },
          orderBy: [{ dateKey: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.task.findMany({
          where: {
            companyId,
            isDaily: false,
            OR: [{ departmentId: targetDeptId }, { targetDepartmentId: targetDeptId }],
          },
        }),
      ]);

      const deptName = department?.name || authUser.department || 'Departamento';

      const result = await consolidateDepartmentPeriod({
        companyId,
        departmentId: targetDeptId,
        departmentName: deptName,
        userId: bodyUserId && bodyUserId !== 'TODOS' ? bodyUserId : null,
        startDate,
        endDate,
        periodType,
        requesterRole: authUser.role,
        reports,
        departmentUsers,
        departmentTasks,
      });

      const saved = await prisma.reportConsolidation.create({
        data: {
          companyId,
          scope: 'DEPARTMENT',
          periodType: String(periodType).toUpperCase(),
          departmentId: targetDeptId,
          departmentName: deptName,
          startDate,
          endDate,
          generatedByUserId: authUser.id,
          generatedByUserName: authUser.name,
          summaryText: result.summaryText,
          highlightsJson: JSON.stringify(result.highlights),
          sourceReportIdsJson: JSON.stringify(result.sources.map(s => s.reportId)),
        },
      });

      await recordAudit({
        action: 'DEPARTMENT_SYNTHESIS_CREATE',
        entity: 'ReportConsolidation',
        entityId: saved.id,
        module: 'RELATORIOS_IA',
        companyId,
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        newValues: {
          departmentId: targetDeptId,
          departmentName: deptName,
          periodType,
          startDate,
          endDate,
          reportsCount: reports.length,
        },
        description: `Síntese departamental (${periodType}: ${startDate} a ${endDate}) gerada para "${deptName}" por ${authUser.name}`,
      });

      res.status(201).json({
        consolidation: {
          ...saved,
          highlights: result.highlights,
          sources: result.sources,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/reports/executive/ask
   * Camada de Síntese Executiva e Consultas Analíticas exclusivas para o André (CEO — Nível 3).
   * Restrita no backend via requireCeo e verificação explícita de role === 'CEO'.
   */
  async executiveAsk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser!;
      if (authUser.role !== 'CEO') {
        res.status(403).json({
          error: 'Acesso negado: A IA Executiva consolidada da empresa é restrita exclusivamente ao André (CEO — Nível 3).',
        });
        return;
      }

      const companyId = req.body.companyId || 'emp-copper-group';
      const query: string = (req.body.query || '').trim();
      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);

      let periodType: string = req.body.periodType || 'MONTHLY';
      let startDate: string = req.body.startDate || '';
      let endDate: string = req.body.endDate || todayKey;

      const qLower = query.toLowerCase();
      if (!req.body.startDate) {
        if (qLower.includes('ontem')) {
          const y = new Date(today);
          y.setDate(y.getDate() - 1);
          const yKey = y.toISOString().slice(0, 10);
          startDate = yKey;
          endDate = yKey;
          periodType = 'DAILY';
        } else if (qLower.includes('semana') || periodType === 'WEEKLY') {
          const w = new Date(today);
          w.setDate(w.getDate() - 6);
          startDate = w.toISOString().slice(0, 10);
          endDate = todayKey;
          periodType = 'WEEKLY';
        } else {
          const m = new Date(today);
          m.setDate(m.getDate() - 29);
          startDate = m.toISOString().slice(0, 10);
          endDate = todayKey;
          periodType = 'MONTHLY';
        }
      }

      // Calcula período anterior equivalente para comparação automática
      const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
      const endMs = new Date(`${endDate}T00:00:00Z`).getTime();
      const spanDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);

      const prevEnd = new Date(`${startDate}T00:00:00Z`);
      prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setUTCDate(prevStart.getUTCDate() - (spanDays - 1));

      const compareStartDate: string = req.body.compareStartDate || prevStart.toISOString().slice(0, 10);
      const compareEndDate: string = req.body.compareEndDate || prevEnd.toISOString().slice(0, 10);

      const companyFilter = companyId === 'emp-copper-group' ? undefined : companyId;

      const [departments, allUsers, currentReports, previousReports, allTasks] = await Promise.all([
        prisma.department.findMany({
          where: {
            active: true,
            ...(companyFilter ? { companyId: companyFilter } : {}),
          },
          orderBy: { name: 'asc' },
        }),
        prisma.userProfile.findMany({
          orderBy: { name: 'asc' },
        }),
        prisma.shiftReport.findMany({
          where: {
            ...(companyFilter ? { companyId: companyFilter } : {}),
            dateKey: { gte: startDate, lte: endDate },
          },
          orderBy: [{ dateKey: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.shiftReport.findMany({
          where: {
            ...(companyFilter ? { companyId: companyFilter } : {}),
            dateKey: { gte: compareStartDate, lte: compareEndDate },
          },
          orderBy: [{ dateKey: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.task.findMany({
          where: {
            ...(companyFilter ? { companyId: companyFilter } : {}),
          },
        }),
      ]);

      const analysis = await generateExecutiveAnalytics({
        companyId,
        query,
        startDate,
        endDate,
        compareStartDate,
        compareEndDate,
        periodType,
        departments: departments.map(d => ({ id: d.id, code: d.code, name: d.name })),
        allUsers: allUsers.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          departmentId: u.departmentId,
          department: u.department,
        })),
        currentReports,
        previousReports,
        allTasks: allTasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          departmentId: t.departmentId,
          targetDepartmentId: t.targetDepartmentId,
        })),
      });

      const savedConsolidation = await prisma.reportConsolidation.create({
        data: {
          companyId,
          scope: 'EXECUTIVE',
          periodType: String(periodType).toUpperCase(),
          departmentId: null,
          departmentName: 'Consolidado Corporativo (Todos os Departamentos)',
          startDate,
          endDate,
          generatedByUserId: authUser.id,
          generatedByUserName: authUser.name,
          summaryText: analysis.answerMarkdown,
          highlightsJson: JSON.stringify({
            queryAnswered: analysis.queryAnswered,
            departmentComparison: analysis.departmentComparison,
            periodComparison: analysis.periodComparison,
            recurringPatterns: analysis.recurringPatterns,
            informationGaps: analysis.informationGaps,
            topProblems: analysis.topProblems,
            topPendingItems: analysis.topPendingItems,
          }),
          sourceReportIdsJson: JSON.stringify(analysis.sources.map(s => s.reportId)),
        },
      });

      let emailDispatch = null;
      if (req.body.sendEmail) {
        const recipient = req.body.recipientEmail || authUser.email || 'andre@coppergroup.com.br';
        emailDispatch = await dispatchCorporateEmail({
          to: recipient,
          subject: `[CopperOS • Síntese Executiva] ${analysis.queryAnswered} (${startDate} a ${endDate})`,
          textBody: analysis.answerMarkdown,
          companyId,
          userId: authUser.id,
          userName: authUser.name,
          userEmail: authUser.email,
          userRole: authUser.role,
          entity: 'ReportConsolidation',
          entityId: savedConsolidation.id,
        });

        await prisma.reportConsolidation.update({
          where: { id: savedConsolidation.id },
          data: { emailSentTo: recipient },
        });
      }

      await recordAudit({
        action: 'EXECUTIVE_SYNTHESIS_QUERY',
        entity: 'ReportConsolidation',
        entityId: savedConsolidation.id,
        module: 'IA_EXECUTIVA_CEO',
        companyId,
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        newValues: {
          query: analysis.queryAnswered,
          startDate,
          endDate,
          compareStartDate,
          compareEndDate,
          sourcesCount: analysis.sources.length,
        },
        description: `Consulta analítica executiva realizada por ${authUser.name}: "${analysis.queryAnswered}"`,
      });

      res.json({
        consolidationId: savedConsolidation.id,
        analysis,
        emailDispatch,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/reports/send-email
   * Dispara relatório individual, síntese departamental ou síntese executiva por e-mail
   * e registra auditoria e destinatário no banco PostgreSQL.
   */
  async sendConsolidationEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser!;
      const {
        consolidationId,
        shiftReportId,
        recipientEmail,
        subject,
        content,
        companyId = 'emp-copper-group',
      } = req.body;

      const targetEmail = (recipientEmail || 'andre@coppergroup.com.br').trim();
      let emailSubject = subject || `[CopperOS] Relatório Operacional — ${new Date().toLocaleDateString('pt-BR')}`;
      let emailBody = content || '';
      let entity = 'ReportEmail';
      let entityId: string | null = null;

      if (consolidationId) {
        const consolidation = await prisma.reportConsolidation.findUnique({
          where: { id: consolidationId },
        });
        if (!consolidation) {
          res.status(404).json({ error: 'Consolidação não encontrada.' });
          return;
        }
        if (
          authUser.role !== 'CEO' &&
          consolidation.departmentId &&
          !canAccessDepartment(authUser, consolidation.departmentId)
        ) {
          res.status(403).json({ error: 'Sem permissão para enviar síntese de outro departamento.' });
          return;
        }
        emailSubject =
          subject ||
          `[CopperOS • ${consolidation.scope === 'EXECUTIVE' ? 'Síntese Executiva' : 'Síntese Departamental'}] ${consolidation.departmentName || 'Empresa'} (${consolidation.startDate} a ${consolidation.endDate})`;
        emailBody = content || consolidation.summaryText;
        entity = 'ReportConsolidation';
        entityId = consolidation.id;

        await prisma.reportConsolidation.update({
          where: { id: consolidation.id },
          data: { emailSentTo: targetEmail },
        });
      } else if (shiftReportId) {
        const report = await prisma.shiftReport.findUnique({
          where: { id: shiftReportId },
        });
        if (!report) {
          res.status(404).json({ error: 'Relatório individual não encontrado.' });
          return;
        }
        if (
          authUser.role === 'OPERATOR' &&
          report.userId !== authUser.id
        ) {
          res.status(403).json({ error: 'Sem permissão para enviar relatório de outro funcionário.' });
          return;
        }
        emailSubject =
          subject ||
          `[CopperOS • Relatório Individual] ${report.userName} (${report.department}) — ${report.dateKey}`;
        emailBody = content || report.aiIndividualSummary || report.summary;
        entity = 'ShiftReport';
        entityId = report.id;

        await prisma.shiftReport.update({
          where: { id: report.id },
          data: { emailSentTo: targetEmail },
        });
      }

      if (!emailBody) {
        res.status(400).json({ error: 'Conteúdo do relatório para envio por e-mail está vazio.' });
        return;
      }

      const dispatch = await dispatchCorporateEmail({
        to: targetEmail,
        subject: emailSubject,
        textBody: emailBody,
        companyId,
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        entity,
        entityId,
      });

      res.json({
        success: true,
        dispatch,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reportsController = new ReportsController();
