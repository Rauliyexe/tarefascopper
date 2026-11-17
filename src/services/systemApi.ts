import { authenticatedFetch } from './authApi';
import { Company, User } from '../types';

const API_BASE_URL = '/api/system';

export const systemApi = {
  /**
   * Carrega empresas, filiais, departamentos, usuários RBAC e configurações operacionais diretamente do PostgreSQL.
   */
  async bootstrap(): Promise<{
    companies: Company[];
    departments: Array<{ id: string; companyId: string; code: string; name: string; active?: boolean }>;
    users: User[];
    settings: Record<string, string>;
  }> {
    const res = await authenticatedFetch(`${API_BASE_URL}/bootstrap`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Erro ao carregar bootstrap do PostgreSQL (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Cria ou atualiza uma empresa multi-tenant e suas filiais no PostgreSQL.
   */
  async upsertCompany(company: Company): Promise<Company> {
    const res = await authenticatedFetch(`${API_BASE_URL}/companies/${encodeURIComponent(company.id)}`, {
      method: 'PUT',
      body: JSON.stringify(company),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Erro ao salvar empresa no PostgreSQL');
    }
    return res.json();
  },

  /**
   * Cria ou atualiza um perfil de colaborador (RBAC) no PostgreSQL.
   */
  async upsertUser(user: User): Promise<User> {
    const res = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(user.id)}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Erro ao salvar perfil de colaborador no PostgreSQL');
    }
    return res.json();
  },

  /**
   * Remove ou desativa um perfil de colaborador no PostgreSQL via painel de TI.
   */
  async deleteUser(userId: string): Promise<{ success: boolean; message?: string }> {
    const res = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Erro ao remover colaborador no PostgreSQL');
    }
    return res.json();
  },

  /**
   * Salva configurações operacionais globais no PostgreSQL.
   */
  async saveSettings(settings: Record<string, string | number | boolean>, updatedBy?: string): Promise<void> {
    const res = await authenticatedFetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ settings, updatedBy }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Erro ao salvar configurações no PostgreSQL');
    }
  },
};
