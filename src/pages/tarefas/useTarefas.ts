import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCopperOS } from '../../context/CopperOSContext';
import { useTasks } from '../../context/TasksContext';
import { useToast } from '../../components/common/Toast';
import { soundEngine } from '../../services/soundEngine';
import { downloadCsv, slugify } from '../../utils/exportFile';
import { dateKey, routineTime } from '../../domain/recurrence';
import { describeRoutineTarget } from '../../domain/routineDispatch';
import { paginate } from '../../utils/pagination';
import {
  getActiveEmployeesOfDepartment,
  getDepartmentName,
  getDepartments,
  getEmployees,
} from '../../domain/org';
import { TarefaItem, TaskStatus, TaskPriority, TaskAttachment, TaskChecklistItem } from '../../types';
import {
  PAGE_SIZE,
  PriorityFilter,
  StatusFilter,
  TarefaTab,
  TAREFA_TABS,
  TaskFormState,
  emptyForm,
  formatDate,
  isOverdue,
} from './taskModel';

/** Com que frequência o rótulo de "próximo lançamento" é reavaliado. */
const CLOCK_TICK_MS = 30_000;

/**
 * Estado, dados derivados e ações da tela de Tarefas.
 *
 * A página só monta a UI: todo o estado de banco de dados e rotinas vive no
 * TasksContext; o CopperOSContext fornece apenas a identidade corporativa.
 */
export function useTarefas() {
  const { currentCompany, currentCompanyId, user } = useCopperOS();
  const {
    tasks,
    setTasks,
    isLoading,
    isSyncing,
    error: syncError,
    refreshTasks,
    createTask,
    updateTask,
    deleteTask,
    dispatchRoutineNow,
    toggleChecklistItem,
    addComment,
    completeTaskWithDetails,
    lastRoutineSweepAt,
  } = useTasks();
  const { toasts, showToast, dismissToast } = useToast();

  const departments = getDepartments(currentCompanyId);
  const companyEmployees = getEmployees(currentCompanyId);

  // Mantém "próximo lançamento" fresco sem depender de re-render de outra coisa.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<TarefaTab>(() => {
    const tabFromUrl = searchParams.get('tab') as TarefaTab | null;
    if (tabFromUrl && TAREFA_TABS.includes(tabFromUrl)) return tabFromUrl;
    return user.role === 'CEO' || user.role === 'MANAGER' ? 'Briefing 5 Min' : 'Minhas tarefas';
  });

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TarefaTab | null;
    if (tabFromUrl && TAREFA_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
      setPage(1);
    }
  }, [searchParams]);
  const filterStorageKey = `copperos_filters_${user?.id || 'anon'}`;
  const savedFilters = (() => {
    try {
      return JSON.parse(localStorage.getItem(filterStorageKey) || '{}');
    } catch {
      return {};
    }
  })();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(savedFilters.status || 'Todos');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(savedFilters.priority || 'Todas');

  // U8 — Filtros salvos por usuário
  useEffect(() => {
    try {
      localStorage.setItem(filterStorageKey, JSON.stringify({ status: statusFilter, priority: priorityFilter }));
    } catch {
      // noop
    }
  }, [filterStorageKey, statusFilter, priorityFilter]);

  // U6 — Exclusão com janela de "Desfazer"
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // U2 — Seleção para ações em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Escopo do Quadro Kanban (Individual vs Equipe)
  const isOperator = user?.role === 'OPERATOR';
  const [kanbanScope, setKanbanScope] = useState<'MINE' | 'TEAM'>(() => (isOperator ? 'MINE' : 'MINE'));
  const [kanbanAssigneeFilter, setKanbanAssigneeFilter] = useState<string>('ALL');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [pendingDelete, setPendingDelete] = useState<TarefaItem | null>(null);
  const [reassignTarget, setReassignTarget] = useState<TarefaItem | null>(null);
  const [reassignTo, setReassignTo] = useState('');
  const [completingTask, setCompletingTask] = useState<TarefaItem | null>(null);
  const [feedbackTask, setFeedbackTask] = useState<TarefaItem | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find(t => t.id === selectedTaskId) || null : null),
    [tasks, selectedTaskId]
  );

  /** Colaboradores que a rotina em edição vai atingir — usado no preview do formulário. */
  const formDepartmentTargets = useMemo(
    () =>
      form.routineTargetMode === 'DEPARTMENT'
        ? getActiveEmployeesOfDepartment(currentCompanyId, form.targetDepartmentId)
        : [],
    [currentCompanyId, form.routineTargetMode, form.targetDepartmentId],
  );

  const isMine = (task: TarefaItem) => {
    if (!task.assignee) return false;
    const a = task.assignee.trim().toLowerCase();
    if (a === 'você' || a === 'voce') return true;

    const uName = user?.name?.trim().toLowerCase();
    const uEmail = user?.email?.trim().toLowerCase();

    if (uName && (a === uName || a.includes(uName) || uName.includes(a))) return true;
    if (uEmail && (a === uEmail || a === uEmail.split('@')[0])) return true;
    if (task.assigneeId && user?.id && task.assigneeId === user.id) return true;

    if ((uName?.includes('andré') || uName?.includes('andre')) && (a.includes('andré') || a.includes('andre'))) {
      return true;
    }

    return false;
  };

  /** Trava de segurança: operador só edita o que é dele; ADMIN, CEO e MANAGER podem gerenciar equipe. */
  const canUserEditTask = (task: TarefaItem) => {
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN' || user.role === 'CEO' || user.role === 'MANAGER') {
      return true;
    }
    return isMine(task);
  };

  // Tarefas com rotina diária (os templates configurados pelo gestor)
  const dailyRoutines = useMemo(() => tasks.filter(t => t.isDaily), [tasks]);
  const activeDailyRoutines = useMemo(
    () => dailyRoutines.filter(t => t.dailyActive !== false),
    [dailyRoutines],
  );

  /**
   * Templates de rotina são configuração, não trabalho: as listas mostram só as
   * tarefas reais — inclusive as que a rotina lançou para cada colaborador.
   */
  const workTasks = useMemo(() => tasks.filter(t => !t.isDaily), [tasks]);

  /** Tarefas que cada rotina já lançou para hoje, para medir a adesão do dia. */
  const routineProgressToday = useMemo(() => {
    const today = dateKey(new Date());
    const progress = new Map<string, { total: number; done: number }>();

    for (const task of tasks) {
      if (!task.sourceRoutineId || task.dueDate !== today) continue;
      const entry = progress.get(task.sourceRoutineId) || { total: 0, done: 0 };
      entry.total += 1;
      if (task.status === 'Concluída') entry.done += 1;
      progress.set(task.sourceRoutineId, entry);
    }

    return progress;
  }, [tasks]);

  /** Rótulo de destinatários por rotina — evita refazer a busca no diretório a cada render. */
  const routineTargetLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const routine of dailyRoutines) {
      labels.set(routine.id, describeRoutineTarget(routine, currentCompanyId));
    }
    return labels;
  }, [dailyRoutines, currentCompanyId]);

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    const priorityRank: Record<string, number> = {
      Urgente: 0,
      Alta: 1,
      Média: 2,
      Baixa: 3,
    };

    return workTasks
      .filter(task => {
        if (hiddenIds.has(task.id)) return false;
        const matchSearch =
          !term ||
          task.title.toLowerCase().includes(term) ||
          task.project.toLowerCase().includes(term) ||
          task.assignee.toLowerCase().includes(term) ||
          (task.assignedBy && task.assignedBy.toLowerCase().includes(term));

        const matchStatus = statusFilter === 'Todos' || task.status === statusFilter;
        const matchPriority = priorityFilter === 'Todas' || task.priority === priorityFilter;

        let matchTab = true;
        if (activeTab === 'Minhas tarefas') {
          matchTab = isMine(task);
        } else if (activeTab === 'Equipe') {
          matchTab = !isMine(task);
        } else if (activeTab === 'Kanban') {
          // Para operador, o Kanban é SEMPRE individual!
          if (isOperator || kanbanScope === 'MINE') {
            matchTab = isMine(task);
          } else if (kanbanAssigneeFilter !== 'ALL') {
            matchTab = task.assignee.toLowerCase().includes(kanbanAssigneeFilter.toLowerCase());
          }
        }

        return matchSearch && matchStatus && matchPriority && matchTab;
      })
      .sort((a, b) => {
        const dateCmp = a.dueDate.localeCompare(b.dueDate);
        if (dateCmp !== 0) return dateCmp;
        return (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2);
      });
  }, [
    workTasks,
    search,
    statusFilter,
    priorityFilter,
    activeTab,
    user,
    hiddenIds,
    isOperator,
    kanbanScope,
    kanbanAssigneeFilter,
  ]);

  const { page: currentPage, items: pagedTasks } = useMemo(
    () => paginate(filteredTasks, PAGE_SIZE, page),
    [filteredTasks, page],
  );

  const summary = useMemo(() => {
    const today = dateKey(new Date());
    const generatedToday = workTasks.filter(t => t.sourceRoutineId && t.dueDate === today);

    return {
      pending: workTasks.filter(t => t.status === 'Pendente').length,
      inProgress: workTasks.filter(t => t.status === 'Em andamento').length,
      urgentOpen: workTasks.filter(t => t.status !== 'Concluída' && t.priority === 'Urgente').length,
      highPriorityOpen: workTasks.filter(
        t => t.status !== 'Concluída' && (t.priority === 'Alta' || t.priority === 'Urgente')
      ).length,
      done: workTasks.filter(t => t.status === 'Concluída').length,
      overdue: workTasks.filter(isOverdue).length,
      dailyCount: dailyRoutines.length,
      dailyActiveCount: activeDailyRoutines.length,
      // Adesão do dia: quantas tarefas as rotinas lançaram e quantas já voltaram concluídas.
      dailyLaunchedToday: generatedToday.length,
      dailyPendingToday: generatedToday.filter(t => t.status !== 'Concluída').length,
      dailyDoneToday: generatedToday.filter(t => t.status === 'Concluída').length,
    };
  }, [workTasks, dailyRoutines, activeDailyRoutines]);

  /** Agrupa as tarefas filtradas por uma chave, em ordem alfabética da chave. */
  const groupTasksBy = (pick: (task: TarefaItem) => string) => {
    const groups = new Map<string, TarefaItem[]>();
    filteredTasks.forEach(task => {
      const key = pick(task);
      const list = groups.get(key) || [];
      list.push(task);
      groups.set(key, list);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  const groupedByProject = useMemo(() => groupTasksBy(task => task.project), [filteredTasks]);
  const groupedByDate = useMemo(() => groupTasksBy(task => task.dueDate), [filteredTasks]);

  const resetToFirstPage = () => setPage(1);

  const changeTab = (tab: TarefaTab) => {
    setActiveTab(tab);
    resetToFirstPage();
    setSearchParams({ tab });
  };

  const changeSearch = (term: string) => {
    setSearch(term);
    resetToFirstPage();
  };

  const changeStatusFilter = (next: StatusFilter) => {
    setStatusFilter(next);
    resetToFirstPage();
  };

  const changePriorityFilter = (next: PriorityFilter) => {
    setPriorityFilter(next);
    resetToFirstPage();
  };

  const clearFilters = () => {
    setStatusFilter('Todos');
    setPriorityFilter('Todas');
    setSearch('');
    setIsFilterOpen(false);
    resetToFirstPage();
  };

  /** Atalho dos stat cards: liga o filtro do status e abre a barra de filtros. */
  const filterByStatus = (status: TaskStatus) => {
    setStatusFilter(statusFilter === status ? 'Todos' : status);
    setIsFilterOpen(true);
    resetToFirstPage();
  };

  const openCreate = (isDailyPreset = false) => {
    const savedRoutineHour =
      (typeof localStorage !== 'undefined' && localStorage.getItem('copperos_cfg_routine_hour')) ||
      emptyForm.dailyTime;
    setEditingId(null);
    setForm({
      ...emptyForm,
      dailyTime: savedRoutineHour,
      dueDate: dateKey(new Date()),
      isDaily: isDailyPreset,
      assignedBy: user?.name ? `${user.name} (Gestor)` : 'Gestão de Operações',
      targetDepartmentId: departments[0]?.id || '',
      checklists: [],
      attachments: [],
      comments: [],
    });
    setIsFormOpen(true);
  };

  // Permite que o Copilot / Assistente de Voz abra o modal de Nova Tarefa ou Nova Rotina
  useEffect(() => {
    const handleCopilotAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDaily?: boolean }>;
      openCreate(Boolean(customEvent.detail?.isDaily));
    };
    window.addEventListener('copperos:copilot-task-action', handleCopilotAction);
    return () => window.removeEventListener('copperos:copilot-task-action', handleCopilotAction);
  }, [currentCompanyId, user?.name]);

  // Busca rápida (Ctrl+K) abre o detalhe de uma tarefa específica
  useEffect(() => {
    const handleOpenTask = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) setSelectedTaskId(id);
    };
    window.addEventListener('copperos:open-task', handleOpenTask);
    return () => window.removeEventListener('copperos:open-task', handleOpenTask);
  }, []);

  const openEdit = (task: TarefaItem) => {
    if (!canUserEditTask(task)) {
      soundEngine.playError();
      showToast('Permissão negada: operadores só podem editar suas próprias tarefas.', 'error');
      return;
    }
    setEditingId(task.id);
    setForm({
      title: task.title,
      project: task.project,
      assignee: task.assignee,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
      isDaily: !!task.isDaily,
      dailyTime: routineTime(task),
      dailyWeekdaysOnly: task.dailyWeekdaysOnly ?? true,
      assignedBy: task.assignedBy || 'Gestão de Operações',
      dailyActive: task.dailyActive ?? true,
      routineDescription: task.routineDescription || '',
      routineTargetMode: task.routineTargetMode || 'EMPLOYEE',
      targetDepartmentId: task.targetDepartmentId || departments[0]?.id || '',
      checklists: Array.isArray(task.checklists) ? [...task.checklists] : [],
      attachments: Array.isArray(task.attachments) ? [...task.attachments] : [],
      comments: Array.isArray(task.comments) ? [...task.comments] : [],
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  /** Campos de agendamento derivados do formulário — comuns a criar e editar. */
  const routineFieldsFromForm = () => {
    if (!form.isDaily) {
      return {
        isDaily: false,
        dailyTime: undefined,
        dailyWeekdaysOnly: undefined,
        assignedBy: undefined,
        routineDescription: undefined,
        routineTargetMode: undefined,
        targetDepartmentId: undefined,
      };
    }

    const isDepartmentTarget = form.routineTargetMode === 'DEPARTMENT';
    return {
      isDaily: true,
      dailyTime: form.dailyTime,
      dailyWeekdaysOnly: form.dailyWeekdaysOnly,
      assignedBy: form.assignedBy,
      routineDescription: form.routineDescription,
      routineTargetMode: form.routineTargetMode,
      targetDepartmentId: isDepartmentTarget ? form.targetDepartmentId : undefined,
      // No modo departamento o "responsável" exibido é o próprio departamento.
      assignee: isDepartmentTarget
        ? getDepartmentName(currentCompanyId, form.targetDepartmentId)
        : form.assignee.trim(),
    };
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const routineFields = routineFieldsFromForm();

    if (editingId) {
      const updates = {
        title: form.title.trim(),
        project: form.project.trim() || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
        status: form.status,
        dailyActive: form.isDaily ? form.dailyActive : undefined,
        checklists: form.checklists,
        attachments: form.attachments,
        comments: form.comments,
        ...routineFields,
        assignee: routineFields.assignee || form.assignee.trim() || undefined,
      };

      updateTask(editingId, updates)
        .then(() => {
          showToast(`Tarefa "${form.title.trim()}" atualizada.`);
        })
        .catch(err => {
          console.error('[CopperOS] Erro ao atualizar tarefa:', err);
          showToast('Aviso: erro ao sincronizar tarefa com o banco de dados.', 'error');
        });
    } else {
      const payload: Partial<TarefaItem> = {
        title: form.title.trim(),
        project: form.project.trim() || 'Operações',
        dueDate: form.dueDate || dateKey(new Date()),
        priority: form.priority,
        status: form.status,
        companyId: currentCompanyId || undefined,
        dailyActive: form.isDaily ? true : undefined,
        lastDispatchedDate: undefined,
        checklists: form.checklists,
        attachments: form.attachments,
        comments: form.comments,
        ...routineFields,
        assignee: routineFields.assignee || form.assignee.trim() || 'Você',
      };

      createTask(payload)
        .then(saved => {
          if (saved.isDaily) {
            const targetLabel =
              saved.routineTargetMode === 'DEPARTMENT'
                ? `${getActiveEmployeesOfDepartment(currentCompanyId, saved.targetDepartmentId || '').length} colaborador(es) de ${saved.assignee}`
                : saved.assignee;
            showToast(
              `Rotina diária criada para ${targetLabel}. Lançamento automático às ${saved.dailyTime}.`,
              'success'
            );
          } else {
            showToast(`Tarefa criada para ${saved.assignee}, prazo ${formatDate(saved.dueDate)}.`);
          }
        })
        .catch(err => {
          console.error('[CopperOS] Erro ao salvar tarefa no banco:', err);
          showToast('Aviso: erro ao salvar tarefa no banco.', 'error');
        });

      resetToFirstPage();
    }

    closeForm();
  };

  const openCompleteModal = (task: TarefaItem) => {
    setCompletingTask(task);
  };

  const closeCompleteModal = () => {
    setCompletingTask(null);
  };

  const confirmComplete = async (data: {
    notes: string;
    attachments: TaskAttachment[];
    completedChecklistIds: string[];
  }) => {
    if (!completingTask) return;
    try {
      await completeTaskWithDetails(completingTask.id, {
        notes: data.notes,
        attachments: data.attachments,
        completedChecklistIds: data.completedChecklistIds,
        authorName: user?.name || user?.email?.split('@')[0],
        authorRole: user?.role,
        authorEmail: user?.email,
      });
      showToast(`Tarefa "${completingTask.title}" concluída com registro fotográfico e parecer!`, 'success');
    } catch (err) {
      console.error('[CopperOS] Erro ao concluir tarefa:', err);
      showToast('Erro ao concluir tarefa no banco', 'error');
    } finally {
      setCompletingTask(null);
    }
  };

  const changeStatus = (task: TarefaItem, status: TaskStatus) => {
    if (!canUserEditTask(task)) {
      soundEngine.playError();
      showToast('Permissão negada: você só pode movimentar suas próprias tarefas.', 'error');
      return;
    }
    if (status === 'Concluída') {
      openCompleteModal(task);
      return;
    }
    updateTask(task.id, { status }).catch(err => {
      console.error('[CopperOS] Erro ao salvar status no banco:', err);
    });
    showToast(`"${task.title}" → ${status}.`, 'info');
  };

  const changePriority = (task: TarefaItem, priority: TaskPriority) => {
    if (!canUserEditTask(task)) {
      soundEngine.playError();
      showToast('Permissão negada: você só pode alterar prioridade de suas próprias tarefas.', 'error');
      return;
    }
    updateTask(task.id, { priority }).catch(err => {
      console.error('[CopperOS] Erro ao salvar prioridade no banco:', err);
    });
    showToast(`Prioridade de "${task.title}" alterada para ${priority}.`, 'info');
  };

  const openTaskDetail = (task: TarefaItem) => {
    setSelectedTaskId(task.id);
  };

  const closeTaskDetail = () => {
    setSelectedTaskId(null);
  };

  const addChecklistItemToTask = async (taskId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;

    const newItem: TaskChecklistItem = {
      id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: trimmed,
      completed: false,
    };

    const nextChecklists = [...(target.checklists || []), newItem];
    await updateTask(taskId, { checklists: nextChecklists });
  };

  const removeChecklistItemFromTask = async (taskId: string, itemId: string) => {
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;
    const nextChecklists = (target.checklists || []).filter(item => item.id !== itemId);
    await updateTask(taskId, { checklists: nextChecklists });
  };

  const addAttachmentsToTask = async (taskId: string, newAttachments: TaskAttachment[]) => {
    if (!newAttachments.length) return;
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;
    const nextAttachments = [...(target.attachments || []), ...newAttachments];
    await updateTask(taskId, { attachments: nextAttachments });
    showToast(`${newAttachments.length} evidência(s) fotográfica(s) anexada(s).`, 'success');
  };

  const removeAttachmentFromTask = async (taskId: string, attachmentId: string) => {
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;
    const nextAttachments = (target.attachments || []).filter(a => a.id !== attachmentId);
    await updateTask(taskId, { attachments: nextAttachments });
  };

  const toggleComplete = (task: TarefaItem) => {
    if (!canUserEditTask(task)) {
      soundEngine.playError();
      showToast('Permissão negada: você só pode concluir suas próprias tarefas.', 'error');
      return;
    }
    if (task.status !== 'Concluída') {
      openCompleteModal(task);
    } else {
      changeStatus(task, 'Em andamento');
    }
  };

  const openFeedback = (task: TarefaItem) => {
    setFeedbackTask(task);
  };

  const closeFeedback = () => setFeedbackTask(null);

  const submitFeedback = async (
    taskId: string,
    comment: {
      author: string;
      authorRole?: string;
      authorEmail?: string;
      content: string;
      attachments?: TaskAttachment[];
    }
  ) => {
    try {
      await addComment(taskId, comment);
      showToast('Feedback registrado na tarefa.', 'success');
      setFeedbackTask(prev => {
        if (!prev || prev.id !== taskId) return prev;
        const newC = {
          id: `cmt-${Date.now()}`,
          ...comment,
          type: 'FEEDBACK' as const,
          createdAt: new Date().toISOString(),
        };
        return {
          ...prev,
          comments: [...(prev.comments || []), newC],
        };
      });
    } catch (err) {
      console.error('[CopperOS] Erro ao registrar feedback:', err);
      showToast('Erro ao registrar feedback no banco', 'error');
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    if (selectedTaskId === target.id) {
      setSelectedTaskId(null);
    }
    // Oculta imediatamente e só exclui no banco após 6s (permite desfazer)
    setHiddenIds(prev => new Set(prev).add(target.id));
    const timer = setTimeout(() => {
      deleteTask(target.id)
        .catch(err => {
          console.error('[CopperOS] Erro ao remover tarefa no banco:', err);
          showToast('Falha ao remover tarefa no banco de dados', 'error');
        })
        .finally(() =>
          setHiddenIds(prev => {
            const next = new Set(prev);
            next.delete(target.id);
            return next;
          })
        );
    }, 6000);
    showToast(`Tarefa "${target.title}" excluída.`, 'info', {
      label: 'Desfazer',
      durationMs: 6000,
      onAction: () => {
        clearTimeout(timer);
        setHiddenIds(prev => {
          const next = new Set(prev);
          next.delete(target.id);
          return next;
        });
      },
    });
    setPendingDelete(null);
  };

  // U2 — Ações em lote
  const bulkChangeStatus = async (status: TaskStatus) => {
    const targets = tasks.filter(t => selectedIds.has(t.id));
    await Promise.all(targets.map(t => updateTask(t.id, { status })));
    showToast(`${targets.length} tarefa(s) marcadas como "${status}".`, 'success');
    clearSelection();
  };

  const bulkReassign = async (assignee: string) => {
    const name = assignee.trim();
    if (!name) return;
    const targets = tasks.filter(t => selectedIds.has(t.id));
    await Promise.all(targets.map(t => updateTask(t.id, { assignee: name })));
    showToast(`${targets.length} tarefa(s) reatribuídas para ${name}.`, 'success');
    clearSelection();
  };

  const openReassign = (task: TarefaItem) => {
    setReassignTarget(task);
    setReassignTo(task.assignee);
  };

  const closeReassign = () => setReassignTarget(null);

  const submitReassign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignTarget || !reassignTo.trim()) return;

    const targetId = reassignTarget.id;
    const newAssignee = reassignTo.trim();
    const matched = companyEmployees.find(
      emp => emp.name.toLowerCase() === newAssignee.toLowerCase()
    );

    updateTask(targetId, {
      assignee: newAssignee,
      assigneeId: matched ? matched.id : undefined,
    }).catch(err => {
      console.error('[CopperOS] Erro ao delegar tarefa no banco:', err);
    });

    showToast(`"${reassignTarget.title}" delegada para ${newAssignee}.`);
    setReassignTarget(null);
    setReassignTo('');
  };

  /** Disparo manual imediato da rotina com persistência no PostgreSQL. */
  const dispatchRoutine = async (task: TarefaItem) => {
    try {
      const created = await dispatchRoutineNow(task.id);

      if (created === 0) {
        showToast('As tarefas de hoje desta rotina já foram lançadas no banco.', 'info');
        return;
      }

      showToast(`🔔 ${created} tarefa(s) lançada(s) agora no banco para ${task.assignee}.`, 'success');
    } catch (err) {
      console.error('[CopperOS] Erro ao disparar rotina:', err);
      showToast('Erro ao disparar rotina no banco de dados.', 'error');
    }
  };

  /** Alternar pausa ou ativação da rotina diária no PostgreSQL */
  const toggleDailyActive = (task: TarefaItem) => {
    const nextState = !task.dailyActive;
    updateTask(task.id, { dailyActive: nextState }).catch(err => {
      console.error('[CopperOS] Erro ao alternar rotina no banco:', err);
    });
    showToast(
      `Rotina diária "${task.title}" ${nextState ? 'ativada' : 'pausada temporariamente'}.`,
      nextState ? 'success' : 'info'
    );
  };

  const exportCsv = () => {
    if (filteredTasks.length === 0) {
      showToast('Nada para exportar com os filtros atuais.', 'error');
      return;
    }

    downloadCsv(
      `tarefas-${slugify(currentCompany?.tradeName || 'copperos')}.csv`,
      ['Tarefa', 'Projeto', 'Responsavel', 'Prazo', 'Prioridade', 'Status', 'Rotina Diaria', 'Horario', 'Gestor'],
      filteredTasks.map(t => [
        t.title,
        t.project,
        t.assignee,
        formatDate(t.dueDate),
        t.priority,
        t.status,
        t.isDaily ? 'Sim' : 'Não',
        t.dailyTime || '-',
        t.assignedBy || '-',
      ])
    );
    showToast(`${filteredTasks.length} tarefa(s) exportada(s) em CSV.`);
  };

  return {
    // contexto, status do banco de dados e relógio
    now,
    lastRoutineSweepAt,
    departments,
    companyEmployees,
    tasks,
    isLoading,
    isSyncing,
    syncError,
    refreshTasks,

    // navegação e filtros
    activeTab,
    changeTab,
    search,
    changeSearch,
    statusFilter,
    changeStatusFilter,
    priorityFilter,
    changePriorityFilter,
    isFilterOpen,
    setIsFilterOpen,
    clearFilters,
    filterByStatus,

    // dados derivados
    summary,
    dailyRoutines,
    routineProgressToday,
    routineTargetLabels,
    filteredTasks,
    pagedTasks,
    currentPage,
    setPage,
    groupedByProject,
    groupedByDate,

    // formulário
    isFormOpen,
    editingId,
    form,
    setForm,
    formDepartmentTargets,
    openCreate,
    openEdit,
    closeForm,
    submitForm,

    // ações sobre tarefas
    changeStatus,
    changePriority,
    toggleComplete,
    toggleChecklistItem,
    addChecklistItemToTask,
    removeChecklistItemFromTask,
    addAttachmentsToTask,
    removeAttachmentFromTask,
    dispatchRoutine,
    toggleDailyActive,
    exportCsv,

    // drawer lateral de detalhes da tarefa
    selectedTask,
    openTaskDetail,
    closeTaskDetail,

    // modal de conclusão com parecer e fotos
    completingTask,
    openCompleteModal,
    closeCompleteModal,
    confirmComplete,

    // modal de feedback e histórico de andamento
    feedbackTask,
    openFeedback,
    closeFeedback,
    submitFeedback,

    // exclusão e delegação
    pendingDelete,
    setPendingDelete,
    confirmDelete,
    reassignTarget,
    reassignTo,
    setReassignTo,
    openReassign,
    closeReassign,
    submitReassign,

    // ações em lote
    selectedIds,
    toggleSelected,
    clearSelection,
    setSelectedIds,
    bulkChangeStatus,
    bulkReassign,

    // permissões e kanban individual
    isMine,
    canUserEditTask,
    kanbanScope,
    setKanbanScope,
    kanbanAssigneeFilter,
    setKanbanAssigneeFilter,

    // toasts
    toasts,
    dismissToast,
  };
}

export type TarefasController = ReturnType<typeof useTarefas>;
