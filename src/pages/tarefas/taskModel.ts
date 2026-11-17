import { RoutineTargetMode, TarefaItem, TaskPriority, TaskStatus, TaskChecklistItem, TaskAttachment, TaskComment } from '../../types';
import { DEFAULT_ROUTINE_TIME, dateKey, parseDateKey, startOfDay } from '../../domain/recurrence';

export type TarefaTab =
  | 'Briefing 5 Min'
  | 'Minhas tarefas'
  | 'Equipe'
  | 'Kanban'
  | 'Rotinas Diárias'
  | 'Relatório Diário'
  | 'Projetos'
  | 'Calendário'
  | 'Calibração'
  | 'Configurações';

export const TAREFA_TABS: readonly TarefaTab[] = [
  'Briefing 5 Min',
  'Minhas tarefas',
  'Equipe',
  'Kanban',
  'Rotinas Diárias',
  'Relatório Diário',
  'Projetos',
  'Calendário',
  'Calibração',
  'Configurações',
];

export const PAGE_SIZE = 8;

export type StatusFilter = 'Todos' | TaskStatus;
export type PriorityFilter = 'Todas' | TaskPriority;

export const STATUS_FILTERS: readonly StatusFilter[] = ['Todos', 'Pendente', 'Em andamento', 'Concluída'];
export const PRIORITY_FILTERS: readonly PriorityFilter[] = ['Todas', 'Urgente', 'Alta', 'Média', 'Baixa'];

export const formatDate = (iso: string) => parseDateKey(iso).toLocaleDateString('pt-BR');

export const isOverdue = (task: TarefaItem) =>
  task.status !== 'Concluída' && parseDateKey(task.dueDate) < startOfDay(new Date());

export const statusBadgeClass = (status: TaskStatus) =>
  status === 'Em andamento'
    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-brand-700 dark:text-brand-400 border-emerald-100/60 dark:border-emerald-800/40'
    : status === 'Concluída'
      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-100/60 dark:border-blue-800/40'
      : 'bg-gray-100 dark:bg-night-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-night-800';

/** Estado do formulário de tarefa/rotina. */
export interface TaskFormState {
  title: string;
  project: string;
  assignee: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  isDaily: boolean;
  dailyTime: string;
  dailyWeekdaysOnly: boolean;
  assignedBy: string;
  dailyActive: boolean;
  routineDescription: string;
  routineTargetMode: RoutineTargetMode;
  targetDepartmentId: string;
  checklists: TaskChecklistItem[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
}

export const emptyForm: TaskFormState = {
  title: '',
  project: 'Operações',
  assignee: 'Você',
  dueDate: dateKey(new Date()),
  priority: 'Média',
  status: 'Pendente',
  isDaily: false,
  dailyTime: DEFAULT_ROUTINE_TIME,
  dailyWeekdaysOnly: true,
  assignedBy: 'Gestão de Operações',
  dailyActive: true,
  routineDescription: '',
  routineTargetMode: 'DEPARTMENT',
  targetDepartmentId: '',
  checklists: [],
  attachments: [],
  comments: [],
};
