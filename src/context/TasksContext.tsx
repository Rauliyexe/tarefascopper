import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { TarefaItem, TaskAttachment } from '../types';
import { tasksApi } from '../services/tasksApi';
import { sweepRoutines, buildRoutineTasks } from '../domain/routineDispatch';
import { dateKey } from '../domain/recurrence';
import { useCopperOS } from './CopperOSContext';

const ROUTINE_SWEEP_INTERVAL_MS = 60_000;

export interface TasksContextType {
  tasks: TarefaItem[];
  setTasks: React.Dispatch<React.SetStateAction<TarefaItem[]>>;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  lastRoutineSweepAt: Date | null;
  refreshTasks: () => Promise<void>;
  createTask: (payload: Partial<TarefaItem>) => Promise<TarefaItem>;
  updateTask: (id: string, updates: Partial<TarefaItem>) => Promise<TarefaItem>;
  deleteTask: (id: string) => Promise<void>;
  dispatchRoutineNow: (routineId: string) => Promise<number>;
  toggleChecklistItem: (taskId: string, itemId: string) => Promise<TarefaItem | undefined>;
  addComment: (
    taskId: string,
    comment: {
      author: string;
      authorRole?: string;
      authorEmail?: string;
      content: string;
      type?: 'FEEDBACK' | 'CONCLUSAO';
      attachments?: TaskAttachment[];
    }
  ) => Promise<TarefaItem | undefined>;
  completeTaskWithDetails: (
    taskId: string,
    details: {
      notes?: string;
      attachments?: TaskAttachment[];
      completedChecklistIds?: string[];
      authorName?: string;
      authorRole?: string;
      authorEmail?: string;
    }
  ) => Promise<TarefaItem | undefined>;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export const TasksProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentCompanyId } = useCopperOS();

  // Sem mock ou cache localStorage: 100% carregado do PostgreSQL
  const [tasks, setTasks] = useState<TarefaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRoutineSweepAt, setLastRoutineSweepAt] = useState<Date | null>(null);

  const companyIdRef = useRef(currentCompanyId);
  useEffect(() => {
    companyIdRef.current = currentCompanyId;
  }, [currentCompanyId]);

  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Limpa eventual cache legado de tarefas no localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('copperos_tasks_v1');
    } catch {
      // noop
    }
  }, []);

  /**
   * Recarrega tarefas diretamente do PostgreSQL através da API.
   */
  const refreshTasks = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const apiTasks = await tasksApi.list({ companyId: companyIdRef.current || undefined });
      setTasks(Array.isArray(apiTasks) ? apiTasks : []);
    } catch (err: any) {
      const msg = err?.message || 'Falha ao sincronizar tarefas com o banco de dados PostgreSQL.';
      console.error('[TasksContext] Erro ao carregar tarefas do PostgreSQL:', msg);
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Busca inicial e recarregamento automático ao alternar a empresa ativa
  useEffect(() => {
    refreshTasks();
  }, [refreshTasks, currentCompanyId]);

  // Varredura automática periódica de rotinas diárias vencidas (sincronizada no PostgreSQL)
  const runRoutineSweep = useCallback(async () => {
    const now = new Date();
    setLastRoutineSweepAt(now);

    const currentTasks = tasksRef.current;
    if (!currentTasks || currentTasks.length === 0) return;

    const { created, lastRunByRoutine } = sweepRoutines(currentTasks, now, companyIdRef.current);
    const routineEntries = Object.entries(lastRunByRoutine);

    if (created.length === 0 && routineEntries.length === 0) return;

    try {
      await tasksApi.batch({
        tasks: created,
        updateRoutines: routineEntries.map(([id, lastDispatchedDate]) => ({
          id,
          lastDispatchedDate,
        })),
      });
      await refreshTasks();
    } catch (err: any) {
      const msg = err?.message || 'Erro ao sincronizar disparo de rotinas no PostgreSQL.';
      console.error('[TasksContext] Falha na varredura de rotinas:', msg);
      setError(msg);
    }
  }, [refreshTasks]);

  useEffect(() => {
    const initialTimer = setTimeout(runRoutineSweep, 1_500);
    const interval = setInterval(runRoutineSweep, ROUTINE_SWEEP_INTERVAL_MS);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [runRoutineSweep, currentCompanyId]);

  /**
   * Criação de tarefa ou rotina diretamente no PostgreSQL (sem fallback em memória).
   */
  const createTask = useCallback(
    async (payload: Partial<TarefaItem>): Promise<TarefaItem> => {
      setError(null);
      try {
        const created = await tasksApi.create({
          ...payload,
          companyId: payload.companyId || companyIdRef.current,
        });
        setTasks(prev => [created, ...prev]);
        return created;
      } catch (err: any) {
        const msg = err?.message || 'Erro ao criar tarefa no PostgreSQL.';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Atualização de tarefa existente no PostgreSQL (reverte e confirma erro se falhar).
   */
  const updateTask = useCallback(
    async (id: string, updates: Partial<TarefaItem>): Promise<TarefaItem> => {
      setError(null);
      try {
        const persisted = await tasksApi.update(id, updates);
        setTasks(prev => prev.map(t => (t.id === id ? persisted : t)));
        return persisted;
      } catch (err: any) {
        const msg = err?.message || 'Erro ao atualizar tarefa no PostgreSQL.';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Exclusão de tarefa no PostgreSQL.
   */
  const deleteTask = useCallback(
    async (id: string): Promise<void> => {
      setError(null);
      try {
        await tasksApi.delete(id);
        setTasks(prev => prev.filter(t => t.id !== id));
      } catch (err: any) {
        const msg = err?.message || 'Erro ao excluir tarefa no PostgreSQL.';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Alterna item de checklist persistindo no PostgreSQL.
   */
  const toggleChecklistItem = useCallback(
    async (taskId: string, itemId: string): Promise<TarefaItem | undefined> => {
      setError(null);
      const current = tasksRef.current.find(t => t.id === taskId);
      if (!current) return undefined;

      const updatedChecklists = (current.checklists || []).map(item => {
        if (item.id === itemId) {
          const nowDone = !item.completed;
          return {
            ...item,
            completed: nowDone,
            completedAt: nowDone ? new Date().toISOString() : undefined,
          };
        }
        return item;
      });

      try {
        const persisted = await tasksApi.update(taskId, { checklists: updatedChecklists });
        setTasks(prev => prev.map(t => (t.id === taskId ? persisted : t)));
        return persisted;
      } catch (err: any) {
        const msg = err?.message || 'Erro ao atualizar checklist no PostgreSQL.';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Adiciona comentário persistindo no PostgreSQL.
   */
  const addComment = useCallback(
    async (
      taskId: string,
      comment: {
        author: string;
        authorRole?: string;
        authorEmail?: string;
        content: string;
        type?: 'FEEDBACK' | 'CONCLUSAO';
        attachments?: TaskAttachment[];
      }
    ): Promise<TarefaItem | undefined> => {
      setError(null);
      try {
        const persisted = await tasksApi.addComment(taskId, comment);
        setTasks(prev => prev.map(t => (t.id === taskId ? persisted : t)));
        return persisted;
      } catch (err: any) {
        const msg = err?.message || 'Erro ao registrar comentário no PostgreSQL.';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Conclui tarefa com detalhes e evidências persistindo no PostgreSQL.
   */
  const completeTaskWithDetails = useCallback(
    async (
      taskId: string,
      details: {
        notes?: string;
        attachments?: TaskAttachment[];
        completedChecklistIds?: string[];
        authorName?: string;
        authorRole?: string;
        authorEmail?: string;
      }
    ): Promise<TarefaItem | undefined> => {
      setError(null);
      const current = tasksRef.current.find(t => t.id === taskId);
      if (!current) return undefined;

      const completedSet = new Set(details.completedChecklistIds || []);
      const updatedChecklists = (current.checklists || []).map(item => ({
        ...item,
        completed: item.completed || completedSet.has(item.id),
      }));

      const updatedAttachments = [
        ...(current.attachments || []),
        ...(details.attachments || []),
      ];

      try {
        if (details.notes?.trim()) {
          await tasksApi.addComment(taskId, {
            author: details.authorName || 'Operador',
            authorRole: details.authorRole || 'Executor',
            content: details.notes.trim(),
            type: 'CONCLUSAO',
            attachments: details.attachments || [],
          });
        }

        const persisted = await tasksApi.update(taskId, {
          status: 'Concluída',
          checklists: updatedChecklists,
          attachments: updatedAttachments,
        });
        setTasks(prev => prev.map(t => (t.id === taskId ? persisted : t)));
        return persisted;
      } catch (err: any) {
        const msg = err?.message || 'Erro ao concluir tarefa no PostgreSQL.';
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Disparo imediato de rotina persistido no PostgreSQL.
   */
  const dispatchRoutineNow = useCallback(
    async (routineId: string): Promise<number> => {
      setError(null);
      const routine = tasks.find(t => t.id === routineId && t.isDaily);
      if (!routine) return 0;

      const companyId = routine.companyId || companyIdRef.current;
      const todayKey = dateKey(new Date());

      const existingIds = new Set(tasks.map(t => t.id));
      const generated = buildRoutineTasks(routine, todayKey, companyId).filter(
        t => !existingIds.has(t.id)
      );
      if (generated.length === 0) return 0;

      try {
        await tasksApi.batch({
          tasks: generated,
          updateRoutines: [{ id: routine.id, lastDispatchedDate: todayKey }],
        });
        await refreshTasks();
        setLastRoutineSweepAt(new Date());
        return generated.length;
      } catch (err: any) {
        const msg = err?.message || 'Erro ao disparar rotina no PostgreSQL.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [tasks, refreshTasks]
  );

  const value = {
    tasks,
    setTasks,
    isLoading,
    isSyncing,
    error,
    lastRoutineSweepAt,
    refreshTasks,
    createTask,
    updateTask,
    deleteTask,
    dispatchRoutineNow,
    toggleChecklistItem,
    addComment,
    completeTaskWithDetails,
  };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
};

export function useTasks(): TasksContextType {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks deve ser utilizado dentro de um TasksProvider');
  }
  return context;
}
