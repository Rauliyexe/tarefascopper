import { TarefaItem } from '../types';
import { authenticatedFetch } from './authApi';
import { standaloneStore } from './standaloneStore';

const API_BASE_URL = '/api/tasks';

export const tasksApi = {
  /**
   * Lista as tarefas diretamente do PostgreSQL com filtros opcionais.
   * Se o backend não responder (ex: Vercel estático), faz fallback para armazenamento local.
   */
  async list(params: { companyId?: string; status?: string; search?: string } = {}): Promise<TarefaItem[]> {
    try {
      const query = new URLSearchParams();
      if (params.companyId) query.set('companyId', params.companyId);
      if (params.status && params.status !== 'Todos') query.set('status', params.status);
      if (params.search) query.set('search', params.search);

      const url = `${API_BASE_URL}${query.toString() ? `?${query.toString()}` : ''}`;
      const res = await authenticatedFetch(url);
      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        return data.tasks || [];
      }
    } catch {
      // Backend inacessível -> fallback standalone
    }

    let tasks = standaloneStore.getTasks();
    if (params.companyId) {
      tasks = tasks.filter(t => t.companyId === params.companyId);
    }
    if (params.status && params.status !== 'Todos') {
      tasks = tasks.filter(t => t.status === params.status);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      tasks = tasks.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.project.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q)
      );
    }
    return tasks;
  },

  /**
   * Obtém resumo rápido de estatísticas.
   */
  async summary(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    done: number;
    overdue: number;
    completionRate: number;
  }> {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/summary`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // ignore
    }

    const tasks = standaloneStore.getTasks().filter(t => !t.isDaily);
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'Pendente').length;
    const inProgress = tasks.filter(t => t.status === 'Em andamento').length;
    const done = tasks.filter(t => t.status === 'Concluída').length;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = tasks.filter(t => t.status !== 'Concluída' && t.dueDate < today).length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, pending, inProgress, done, overdue, completionRate };
  },

  /**
   * Cria uma nova tarefa ou rotina.
   */
  async create(task: Partial<TarefaItem>): Promise<TarefaItem> {
    try {
      const res = await authenticatedFetch(API_BASE_URL, {
        method: 'POST',
        body: JSON.stringify(task),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return standaloneStore.createTask(task);
  },

  /**
   * Cria ou sincroniza tarefas e rotinas em lote.
   */
  async batch(payload: {
    tasks: Partial<TarefaItem>[];
    updateRoutines?: Array<{ id: string; lastDispatchedDate: string }>;
  }): Promise<{ count: number; tasks: TarefaItem[] }> {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/batch`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return standaloneStore.batchTasks(payload);
  },

  /**
   * Atualiza dados de uma tarefa existente.
   */
  async update(id: string, updates: Partial<TarefaItem>): Promise<TarefaItem> {
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
      // ignore
    }
    return standaloneStore.updateTask(id, updates);
  },

  /**
   * Adiciona comentário ou nota de conclusão.
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
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify(comment),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return standaloneStore.addComment(id, comment);
  },

  /**
   * Exclui uma tarefa.
   */
  async delete(id: string): Promise<void> {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) return;
    } catch {
      // ignore
    }
    standaloneStore.deleteTask(id);
  },

  /**
   * Converte arquivo de evidência para DataURL persistível.
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
