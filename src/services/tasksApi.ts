import { TarefaItem } from '../types';
import { authenticatedFetch } from './authApi';

const API_BASE_URL = '/api/tasks';

export const tasksApi = {
  /**
   * Lista as tarefas diretamente do PostgreSQL com filtros opcionais.
   */
  async list(params: { companyId?: string; status?: string; search?: string } = {}): Promise<TarefaItem[]> {
    const query = new URLSearchParams();
    if (params.companyId) query.set('companyId', params.companyId);
    if (params.status && params.status !== 'Todos') query.set('status', params.status);
    if (params.search) query.set('search', params.search);

    const url = `${API_BASE_URL}${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await authenticatedFetch(url);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Erro ao listar tarefas no PostgreSQL (HTTP ${res.status})`);
    }

    const data = await res.json();
    return data.tasks || [];
  },

  /**
   * Obtém resumo rápido de estatísticas do PostgreSQL.
   */
  async summary(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    done: number;
    overdue: number;
    completionRate: number;
  }> {
    const res = await authenticatedFetch(`${API_BASE_URL}/summary`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Erro ao obter resumo de tarefas (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Cria uma nova tarefa ou rotina no PostgreSQL.
   */
  async create(task: Partial<TarefaItem>): Promise<TarefaItem> {
    const res = await authenticatedFetch(API_BASE_URL, {
      method: 'POST',
      body: JSON.stringify(task),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Falha ao criar tarefa no PostgreSQL');
    }

    return res.json();
  },

  /**
   * Cria ou sincroniza tarefas e rotinas em lote no PostgreSQL.
   */
  async batch(payload: {
    tasks: Partial<TarefaItem>[];
    updateRoutines?: Array<{ id: string; lastDispatchedDate: string }>;
  }): Promise<{ count: number; tasks: TarefaItem[] }> {
    const res = await authenticatedFetch(`${API_BASE_URL}/batch`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Falha ao processar lote de tarefas no PostgreSQL');
    }

    return res.json();
  },

  /**
   * Atualiza dados de uma tarefa existente no PostgreSQL.
   */
  async update(id: string, updates: Partial<TarefaItem>): Promise<TarefaItem> {
    const res = await authenticatedFetch(`${API_BASE_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Falha ao atualizar tarefa no PostgreSQL');
    }

    return res.json();
  },

  /**
   * Adiciona comentário ou nota de conclusão no PostgreSQL.
   */
  async addComment(
    id: string,
    comment: {
      author: string;
      authorRole?: string;
      content: string;
      type?: 'FEEDBACK' | 'CONCLUSAO';
      attachments?: any[];
    }
  ): Promise<TarefaItem> {
    const res = await authenticatedFetch(`${API_BASE_URL}/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(comment),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Falha ao adicionar comentário no PostgreSQL');
    }

    return res.json();
  },

  /**
   * Exclui uma tarefa do PostgreSQL.
   */
  async delete(id: string): Promise<void> {
    const res = await authenticatedFetch(`${API_BASE_URL}/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Falha ao excluir tarefa no PostgreSQL');
    }
  },

  /**
   * Converte arquivo de evidência para DataURL persistível no PostgreSQL.
   */
  async uploadAttachment(
    fileOrBase64: File | string,
    filename: string = 'evidencia.jpg'
  ): Promise<{ url: string; name: string; size: number }> {
    if (typeof fileOrBase64 === 'string') {
      return {
        url: fileOrBase64,
        name: filename,
        size: Math.round((fileOrBase64.length * 3) / 4),
      };
    } else {
      return {
        url: URL.createObjectURL(fileOrBase64),
        name: fileOrBase64.name,
        size: fileOrBase64.size,
      };
    }
  },
};
