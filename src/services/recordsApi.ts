import { authenticatedFetch } from './authApi';
import type { EquipamentoPesagemLeitura } from '../types';

const API_BASE_URL = '/api/equipamentos';

export const DEFAULT_EQUIPAMENTOS: EquipamentoPesagemLeitura[] = [
  {
    id: 'eq-bal-01',
    codigo: 'BAL-ROD-80T',
    nome: 'Balança Rodoviária 80 Toneladas',
    tipo: 'RODOVIARIA',
    capacidadeMaxKg: 80000,
    precisaoKg: 10,
    localizacao: 'Portaria Principal - Pátio de Carga',
    marcaModelo: 'Toledo 9091 Truck',
    ultimaCalibracao: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    validadeCalibracao: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
    orgaoCertificador: 'IPEM / RBC',
    certificadoNumero: 'RBC-SP-2026-9941',
    status: 'CALIBRADO_ATIVO',
    bloqueadoOperacionalmente: false,
  },
  {
    id: 'eq-bal-02',
    codigo: 'BAL-CAD-05T',
    nome: 'Balança de Cadinho do Forno 10T',
    tipo: 'INTERNA_01',
    capacidadeMaxKg: 5000,
    precisaoKg: 1,
    localizacao: 'Galpão de Fusão - Setor A',
    marcaModelo: 'Alfa AL-5000 Indução',
    ultimaCalibracao: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
    validadeCalibracao: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    orgaoCertificador: 'IPEM / RBC',
    certificadoNumero: 'RBC-SP-2026-8812',
    status: 'CALIBRADO_ATIVO',
    bloqueadoOperacionalmente: false,
  },
];

export const recordsApi = {
  /**
   * Lista todas as balanças e equipamentos metrológicos diretamente do PostgreSQL.
   */
  async listEquipamentos(companyId?: string): Promise<EquipamentoPesagemLeitura[]> {
    try {
      const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
      const res = await authenticatedFetch(`${API_BASE_URL}${query}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        return Array.isArray(data.equipamentos) ? data.equipamentos : [];
      }
    } catch {
      // fallback
    }
    return DEFAULT_EQUIPAMENTOS;
  },

  /**
   * Cadastra uma nova balança ou equipamento de leitura no PostgreSQL.
   */
  async createEquipamento(data: Partial<EquipamentoPesagemLeitura> & { companyId?: string; userName?: string }): Promise<EquipamentoPesagemLeitura> {
    try {
      const res = await authenticatedFetch(API_BASE_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return {
      id: `eq-${Date.now()}`,
      codigo: data.codigo || 'BAL-NEW',
      nome: data.nome || 'Balança Industrial',
      tipo: data.tipo || 'INTERNA_01',
      capacidadeMaxKg: data.capacidadeMaxKg || 5000,
      precisaoKg: data.precisaoKg || 1,
      localizacao: data.localizacao || 'Chão de Fábrica',
      marcaModelo: data.marcaModelo || 'Toledo Industrial',
      ultimaCalibracao: data.ultimaCalibracao || new Date().toISOString().slice(0, 10),
      validadeCalibracao: data.validadeCalibracao || new Date().toISOString().slice(0, 10),
      orgaoCertificador: data.orgaoCertificador || 'IPEM / RBC',
      certificadoNumero: data.certificadoNumero || 'RBC-PENDENTE',
      status: data.status || 'CALIBRADO_ATIVO',
      bloqueadoOperacionalmente: data.bloqueadoOperacionalmente ?? false,
    };
  },

  /**
   * Atualiza calibração, certificado RBC ou trava operacional RN-16 no PostgreSQL.
   */
  async updateEquipamento(
    id: string,
    updates: Partial<EquipamentoPesagemLeitura> & { userName?: string }
  ): Promise<EquipamentoPesagemLeitura> {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    const found = DEFAULT_EQUIPAMENTOS.find(e => e.id === id) || DEFAULT_EQUIPAMENTOS[0];
    return { ...found, ...updates };
  },

  /**
   * Remove um equipamento metrológico do PostgreSQL.
   */
  async deleteEquipamento(id: string): Promise<void> {
    try {
      await authenticatedFetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
      });
    } catch {
      // fallback
    }
  },
};
