import { authenticatedFetch } from './authApi';
import { Company, User } from '../types';
import { DEFAULT_COMPANIES, DEFAULT_DEPARTMENTS, standaloneStore } from './standaloneStore';

const API_BASE_URL = '/api/system';

export const systemApi = {
  /**
   * Carrega empresas, filiais, departamentos, usuários RBAC e configurações operacionais.
   * Em ambiente sem servidor (como Vercel pura), utiliza o store standalone cliente.
   */
  async bootstrap(): Promise<{
    companies: Company[];
    departments: Array<{ id: string; companyId: string; code: string; name: string; active?: boolean }>;
    users: User[];
    settings: Record<string, string>;
  }> {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/bootstrap`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // Backend inacessível -> fallback standalone
    }

    return {
      companies: DEFAULT_COMPANIES,
      departments: DEFAULT_DEPARTMENTS,
      users: standaloneStore.getUsers(),
      settings: {},
    };
  },

  /**
   * Cria ou atualiza uma empresa multi-tenant e suas filiais no PostgreSQL.
   */
  async upsertCompany(company: Company): Promise<Company> {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/companies/${encodeURIComponent(company.id)}`, {
        method: 'PUT',
        body: JSON.stringify(company),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return company;
  },

  /**
   * Cria ou atualiza um perfil de colaborador (RBAC).
   */
  async upsertUser(user: User): Promise<User> {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(user.id)}`, {
        method: 'PUT',
        body: JSON.stringify(user),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return standaloneStore.upsertUser(user);
  },

  /**
   * Remove ou desativa um perfil de colaborador no painel de TI.
   */
  async deleteUser(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    standaloneStore.deleteUser(userId);
    return { success: true };
  },

  /**
   * Salva configurações operacionais globais.
   */
  async saveSettings(settings: Record<string, string | number | boolean>, updatedBy?: string): Promise<void> {
    try {
      await authenticatedFetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        body: JSON.stringify({ settings, updatedBy }),
      });
    } catch {
      // ignore
    }
  },
};
