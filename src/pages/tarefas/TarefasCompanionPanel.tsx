import React, { useMemo } from 'react';
import {
  CheckSquare,
  Square,
  AlertTriangle,
  Repeat,
  Clock,
  Users,
  ShieldCheck,
  ChevronRight,
  Image as ImageIcon,
} from 'lucide-react';
import type { TarefasController } from './useTarefas';
import { isOverdue, formatDate } from './taskModel';
import { dateKey } from '../../domain/recurrence';
import { soundEngine } from '../../services/soundEngine';

interface TarefasCompanionPanelProps {
  controller: TarefasController;
}

export const TarefasCompanionPanel: React.FC<TarefasCompanionPanelProps> = ({ controller }) => {
  const todayKey = dateKey(new Date());

  // Tarefas urgentes: vencidas ou com prazo para hoje (não concluídas)
  const urgentTasks = useMemo(() => {
    return controller.filteredTasks
      .filter(t => !t.isDaily && t.status !== 'Concluída')
      .filter(t => isOverdue(t) || t.dueDate === todayKey)
      .sort((a, b) => {
        // Priorizar vencidas primeiro, depois por prioridade
        const aOver = isOverdue(a);
        const bOver = isOverdue(b);
        if (aOver && !bOver) return -1;
        if (!aOver && bOver) return 1;
        return a.dueDate.localeCompare(b.dueDate);
      })
      .slice(0, 4);
  }, [controller.filteredTasks, todayKey]);

  // Carga de trabalho por responsável (tarefas abertas)
  const workloadByAssignee = useMemo(() => {
    const map = new Map<string, number>();
    controller.filteredTasks
      .filter(t => !t.isDaily && t.status !== 'Concluída')
      .forEach(t => {
        const name = t.assignee || 'Não atribuído';
        map.set(name, (map.get(name) || 0) + 1);
      });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [controller.filteredTasks]);

  const maxWorkload = workloadByAssignee[0]?.count || 1;

  const totalLaunched = controller.summary.dailyLaunchedToday;
  const totalDone = controller.summary.dailyDoneToday;
  const compliancePercentage = totalLaunched > 0 ? Math.round((totalDone / totalLaunched) * 100) : 100;

  return (
    <aside aria-label="Painel operacional de tarefas" className="space-y-5">
      {/* ── Widget 1: Checklist Rápido de Rotinas de Hoje ── */}
      <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-4 shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-night-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-gray-900 dark:text-white">Rotinas Diárias de Hoje</h3>
              <p className="text-micro text-gray-500">Checklist operacional rápido</p>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-micro font-bold font-mono ${
              compliancePercentage === 100
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
            }`}
          >
            {totalDone}/{totalLaunched} ({compliancePercentage}%)
          </span>
        </div>

        {/* Barra de Progresso de Adesão */}
        <div className="pt-3 pb-1">
          <div className="w-full h-1.5 bg-gray-100 dark:bg-night-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                compliancePercentage === 100
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.max(compliancePercentage, 5)}%` }}
            />
          </div>
        </div>

        {/* Lista de Rotinas Diárias com Checkbox Direto */}
        <div className="pt-2 space-y-2">
          {controller.dailyRoutines.length === 0 ? (
            <div className="py-4 text-center text-micro text-gray-400 font-mono">
              Nenhuma rotina diária cadastrada nesta empresa.
            </div>
          ) : (
            controller.dailyRoutines.slice(0, 4).map(routine => {
              const progress = controller.routineProgressToday.get(routine.id);
              const isDoneToday = progress ? progress.done >= progress.total && progress.total > 0 : routine.status === 'Concluída';
              return (
                <div
                  key={routine.id}
                  onClick={() => {
                    soundEngine.playClick();
                    controller.toggleComplete(routine);
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 group ${
                    isDoneToday
                      ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/40 text-gray-500'
                      : 'bg-gray-50/70 dark:bg-night-850/60 border-gray-200/60 dark:border-night-800 hover:border-emerald-500/50 text-gray-900 dark:text-white'
                  }`}
                >
                  <button
                    type="button"
                    aria-label={`Marcar ${routine.title} como ${isDoneToday ? 'pendente' : 'concluída'}`}
                    className="mt-0.5 text-gray-400 hover:text-emerald-600 transition-colors shrink-0 cursor-pointer"
                  >
                    {isDoneToday ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 group-hover:text-emerald-500" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-semibold truncate ${
                        isDoneToday ? 'line-through text-gray-500 dark:text-gray-400' : ''
                      }`}
                      title={routine.title}
                    >
                      {routine.title}
                    </div>
                    <div className="flex items-center justify-between text-micro text-gray-600 dark:text-gray-400 mt-1">
                      <span className="font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {routine.dailyTime || '08:00'}
                      </span>
                      <span className="truncate max-w-[110px]">{routine.project}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {controller.dailyRoutines.length > 4 && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                controller.changeTab('Rotinas Diárias');
              }}
              className="w-full py-1 text-center text-micro text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer flex items-center justify-center gap-1"
            >
              <span>Ver todas as {controller.dailyRoutines.length} rotinas</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Widget 2: Prazos Críticos & Atrasos ── */}
      <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-4 shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-night-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-gray-900 dark:text-white">Prazos & Urgências</h3>
              <p className="text-micro text-gray-500">Vencidas ou para hoje</p>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-micro font-mono font-bold ${
              controller.summary.overdue > 0
                ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 animate-pulse'
                : 'bg-gray-100 dark:bg-night-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {controller.summary.overdue} vencida(s)
          </span>
        </div>

        <div className="pt-3 space-y-2">
          {urgentTasks.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                Sem Atrasos Operacionais
              </span>
              <span className="text-micro text-emerald-700/80 dark:text-emerald-400">
                Todas as tarefas estão em dia com o cronograma.
              </span>
            </div>
          ) : (
            urgentTasks.map(task => {
              const overdue = isOverdue(task);
              return (
                <div
                  key={task.id}
                  onClick={() => {
                    soundEngine.playSwoosh();
                    controller.openTaskDetail(task);
                  }}
                  className="p-2.5 rounded-xl bg-gray-50/70 dark:bg-night-850/60 border border-gray-200/60 dark:border-night-800 hover:border-amber-400 dark:hover:border-amber-600 cursor-pointer transition-all group text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-micro font-bold uppercase ${
                        overdue
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {overdue ? 'Atrasada' : 'Vence Hoje'}
                    </span>
                    <span className="text-micro font-mono text-gray-600 dark:text-gray-400">
                      {formatDate(task.dueDate)}
                    </span>
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-white truncate mt-1 group-hover:text-emerald-600 transition-colors">
                    {task.title}
                  </div>
                  <div className="flex items-center justify-between text-micro text-gray-600 dark:text-gray-400 mt-1">
                    <span>{task.assignee}</span>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      {task.checklists && task.checklists.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                          <CheckSquare className="w-2.5 h-2.5" />
                          <span>
                            {task.checklists.filter(c => c.completed).length}/{task.checklists.length}
                          </span>
                        </span>
                      )}
                      {task.attachments && task.attachments.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                          <ImageIcon className="w-2.5 h-2.5" />
                          <span>{task.attachments.length}</span>
                        </span>
                      )}
                      <span className="text-gray-600 dark:text-gray-400">{task.project}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Widget 3: Carga de Trabalho por Responsável ── */}
      <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-4 shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-night-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-gray-900 dark:text-white">Carga por Responsável</h3>
              <p className="text-micro text-gray-500">Tarefas em aberto na equipe</p>
            </div>
          </div>
          <span className="text-micro font-mono text-gray-600 dark:text-gray-400">
            {controller.summary.inProgress + controller.summary.pending} abertas
          </span>
        </div>

        <div className="pt-3 space-y-2.5">
          {workloadByAssignee.map(member => {
            const pct = Math.round((member.count / maxWorkload) * 100);
            return (
              <div key={member.name} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[140px]">
                    {member.name}
                  </span>
                  <span className="font-mono text-micro text-gray-500">
                    {member.count} {member.count === 1 ? 'tarefa' : 'tarefas'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-night-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all"
                    style={{ width: `${Math.max(pct, 10)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
