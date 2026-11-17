import { TarefaItem } from '../types';
import { getActiveEmployeesOfDepartment } from './org';
import { generatedTaskId, pendingRunKeys } from './recurrence';

/** Destinatário resolvido de uma rotina. */
interface RoutineTarget {
  id: string;
  name: string;
}

/**
 * Para quem esta rotina lança tarefas: todos os colaboradores ativos do
 * departamento escolhido, ou o colaborador único informado pelo gestor.
 */
export function resolveRoutineTargets(routine: TarefaItem, fallbackCompanyId?: string | null): RoutineTarget[] {
  const companyId = routine.companyId || fallbackCompanyId;

  if (routine.routineTargetMode === 'DEPARTMENT' && routine.targetDepartmentId) {
    return getActiveEmployeesOfDepartment(companyId, routine.targetDepartmentId).map(employee => ({
      id: employee.id,
      name: employee.name,
    }));
  }

  const name = routine.assignee?.trim();
  if (!name) return [];
  return [{ id: routine.assigneeId || `nome:${name.toLowerCase()}`, name }];
}

/** Tarefas que a rotina gera para um dia — uma por destinatário, com id determinístico. */
export function buildRoutineTasks(
  routine: TarefaItem,
  dateKeyValue: string,
  fallbackCompanyId?: string | null,
): TarefaItem[] {
  return resolveRoutineTargets(routine, fallbackCompanyId).map(target => ({
    id: generatedTaskId(routine.id, dateKeyValue, target.id),
    title: routine.title,
    project: routine.project,
    assignee: target.name,
    assigneeId: target.id,
    dueDate: dateKeyValue,
    priority: routine.priority,
    status: 'Pendente' as const,
    companyId: routine.companyId || fallbackCompanyId || undefined,
    assignedBy: routine.assignedBy,
    routineDescription: routine.routineDescription,
    targetDepartmentId: routine.targetDepartmentId,
    sourceRoutineId: routine.id,
    isDaily: false,
    checklists: routine.checklists ? routine.checklists.map(c => ({ ...c, completed: false, completedAt: undefined })) : [],
    attachments: routine.attachments ? [...routine.attachments] : [],
  }));
}

export interface SweepResult {
  /** Tarefas novas a inserir (já sem duplicatas do que existe). */
  created: TarefaItem[];
  /** Último dia materializado por rotina, para gravar em lastDispatchedDate. */
  lastRunByRoutine: Record<string, string>;
}

/**
 * Varre as rotinas ativas e materializa as tarefas de todos os dias vencidos.
 * Só depende de dados — o efeito colateral (setState) fica na camada de cima.
 */
export function sweepRoutines(tasks: TarefaItem[], now: Date, fallbackCompanyId?: string | null): SweepResult {
  const existingIds = new Set(tasks.map(task => task.id));
  const created: TarefaItem[] = [];
  const lastRunByRoutine: Record<string, string> = {};

  for (const routine of tasks) {
    if (!routine.isDaily) continue;

    const dueKeys = pendingRunKeys(routine, now);
    if (dueKeys.length === 0) continue;

    for (const key of dueKeys) {
      for (const task of buildRoutineTasks(routine, key, fallbackCompanyId)) {
        if (existingIds.has(task.id)) continue;
        existingIds.add(task.id);
        created.push(task);
      }
    }
    lastRunByRoutine[routine.id] = dueKeys[dueKeys.length - 1];
  }

  return { created, lastRunByRoutine };
}

/** Descrição curta do alvo da rotina, para cards e tabelas. */
export function describeRoutineTarget(routine: TarefaItem, fallbackCompanyId?: string | null): string {
  const targets = resolveRoutineTargets(routine, fallbackCompanyId);
  if (routine.routineTargetMode === 'DEPARTMENT') {
    return `${targets.length} colaborador(es) ativo(s)`;
  }
  return routine.assignee || '—';
}

