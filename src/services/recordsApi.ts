import { authenticatedFetch } from './authApi';
import type { EquipamentoPesagemLeitura } from '../types';

const API_BASE_URL = '/api/equipamentos';

export const recordsApi = {
  /**
   * Lista todas as balanças e equipamentos metrológicos diretamente do PostgreSQL.
   */
  async listEquipamentos(companyId?: string): Promise<EquipamentoPesagemLeitura[]> {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const res = await authenticatedFetch(`${API_BASE_URL}${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Falha ao carregar equipamentos no PostgreSQL (HTTP ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data.equipamentos) ? data.equipamentos : [];
  },

  /**
   * Cadastra uma nova balança ou equipamento de leitura no PostgreSQL.
   */
  async createEquipamento(data: Partial<EquipamentoPesagemLeitura> & { companyId?: string; userName?: string }): Promise<EquipamentoPesagemLeitura> {
    const res = await authenticatedFetch(API_BASE_URL, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Falha ao cadastrar equipamento no PostgreSQL');
    }

    return res.json();
  },

  /**
   * Atualiza calibração, certificado RBC ou trava operacional RN-16 no PostgreSQL.
   */
  async updateEquipamento(
    id: string,
    updates: Partial<EquipamentoPesagemLeitura> & { userName?: string }
  ): Promise<EquipamentoPesagemLeitura> {
    const res = await authenticatedFetch(`${API_BASE_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Falha ao atualizar equipamento no PostgreSQL');
    }

    return res.json();
  },

  /**
   * Remove um equipamento metrológico do PostgreSQL.
   */
  async deleteEquipamento(id: string): Promise<void> {
    const res = await authenticatedFetch(`${API_BASE_URL}/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Falha ao excluir equipamento no PostgreSQL');
    }
  },
};
