import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { recordAudit } from '../lib/audit.js';
import { safeParseJson } from '../lib/json.js';

export class AuditController {
  /**
   * Lista trilhas de auditoria registradas no banco de dados.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.query.companyId as string | undefined;
      const entity = req.query.entity as string | undefined;
      const action = req.query.action as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 100, 500);

      const whereClause: any = {};

      if (companyId && companyId !== 'all') {
        whereClause.companyId = companyId;
      }
      if (entity && entity !== 'all') {
        whereClause.entity = entity;
      }
      if (action && action !== 'all') {
        whereClause.action = action;
      }

      const logs = await prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { occurredAt: 'desc' },
        take: limit,
      });

      const parsedLogs = logs.map(l => ({
        ...l,
        oldValues: safeParseJson(l.oldValues, null),
        newValues: safeParseJson(l.newValues, null),
      }));

      res.status(200).json({
        total: parsedLogs.length,
        logs: parsedLogs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Registra um evento de auditoria manual via API.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        action,
        entity,
        entityId,
        description,
        module,
        companyId,
        userId,
        userName,
        userEmail,
        userRole,
        oldValues,
        newValues,
      } = req.body;

      if (!action || !entity || !description) {
        res.status(400).json({ message: 'action, entity e description são obrigatórios' });
        return;
      }

      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      const log = await recordAudit({
        action,
        entity,
        entityId,
        description,
        module: module || 'TAREFAS',
        companyId,
        userId,
        userName,
        userEmail,
        userRole,
        oldValues,
        newValues,
        ipAddress: ip,
      });

      res.status(201).json({ success: true, log });
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();

