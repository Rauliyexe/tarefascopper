import { standaloneStore } from './standaloneStore';

export interface AuditLogItem {
  id: string;
  schemaVersion: string;
  occurredAt: string;
  recordedAt: string;
  companyId: string | null;
  userId: string | null;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  entity: string;
  entityId: string | null;
  module: string;
  description: string;
  oldValues: any;
  newValues: any;
  ipAddress: string | null;
}

const API_BASE_URL = '/api/audit';

export const auditApi = {
  /**
   * Lista eventos da trilha de auditoria gravados no banco de dados.
   */
  async list(params: { companyId?: string; entity?: string; action?: string; limit?: number } = {}): Promise<AuditLogItem[]> {
    try {
      const query = new URLSearchParams();
      if (params.companyId) query.set('companyId', params.companyId);
      if (params.entity) query.set('entity', params.entity);
      if (params.action) query.set('action', params.action);
      if (params.limit) query.set('limit', String(params.limit));

      const url = `${API_BASE_URL}${query.toString() ? `?${query.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch {
      // ignore
    }

    return standaloneStore.getAuditLogs();
  },

  /**
   * Registra um evento de auditoria manual a partir do frontend.
   */
  async record(event: Partial<AuditLogItem>): Promise<any> {
    try {
      const res = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(event),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // ignore
    }

    standaloneStore.recordAudit(event);
    return { success: true };
  },
};

