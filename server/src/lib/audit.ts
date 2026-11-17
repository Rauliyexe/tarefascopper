import { prisma } from './prisma.js';

export interface AuditLogInput {
  action: string;
  entity: string;
  entityId?: string | null;
  description: string;
  module?: string;
  companyId?: string | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
}

export async function recordAudit(input: AuditLogInput) {
  try {
    const safeStringify = (val: any) => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'string') return val;
      return JSON.stringify(val);
    };

    return await prisma.auditLog.create({
      data: {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId || null,
        description: input.description,
        module: input.module || 'TAREFAS',
        companyId: input.companyId || 'emp-copper-group',
        userId: input.userId || 'usr-sistema',
        userName: input.userName || 'Operador do Sistema',
        userEmail: input.userEmail || 'operador@coppergroup.com.br',
        userRole: input.userRole || 'OPERATOR',
        oldValues: safeStringify(input.oldValues),
        newValues: safeStringify(input.newValues),
        ipAddress: input.ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.warn('[Audit Warning] Falha ao gravar trilha de auditoria no PostgreSQL:', err);
    return null;
  }
}

