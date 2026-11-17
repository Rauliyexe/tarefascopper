import React from 'react';
import { Bell, Check, CheckCircle2, Clock, Pencil, Plus, Repeat, Send, ShieldCheck, Trash2, UserCheck, X } from 'lucide-react';
import { TarefaItem } from '../../types';
import { describeNextRun, routineTime } from '../../domain/recurrence';
import { TarefasController } from './useTarefas';

interface RoutineCardProps {
  routine: TarefaItem;
  targetLabel?: string;
  progress?: { total: number; done: number };
  now: Date;
  controller: TarefasController;
}

const RoutineCard: React.FC<RoutineCardProps> = ({ routine, targetLabel, progress, now, controller }) => {
  const { toggleDailyActive, dispatchRoutine, openEdit, setPendingDelete } = controller;
  const isDepartmentRoutine = routine.routineTargetMode === 'DEPARTMENT';
  const isActive = routine.dailyActive !== false;

  return (
    <div
      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
        isActive
          ? 'border-emerald-500/30 bg-white dark:bg-night-850 shadow-xs'
          : 'border-gray-200 dark:border-night-800 bg-gray-50/50 dark:bg-night-900/50 opacity-70'
      }`}
    >
      <div>
        {/* Header do Card da Rotina */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-gray-900 dark:text-white">{routine.title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {routine.project}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                <Clock className="w-3.5 h-3.5" />
                {routineTime(routine)}
              </span>
              <span>•</span>
              <span>{routine.dailyWeekdaysOnly ? 'Dias úteis (Seg-Sex)' : 'Todos os dias'}</span>
            </div>
          </div>

          {/* Toggle Ativa / Pausada */}
          <button
            onClick={() => toggleDailyActive(routine)}
            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
              isActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-gray-200 dark:bg-night-800 border-gray-300 dark:border-night-700 text-gray-500'
            }`}
            title={isActive ? 'Clique para pausar esta rotina' : 'Clique para ativar esta rotina'}
          >
            {isActive ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Ativa</span>
              </>
            ) : (
              <>
                <X className="w-3.5 h-3.5" />
                <span>Pausada</span>
              </>
            )}
          </button>
        </div>

        {/* Descrição / Instruções do Gestor */}
        {routine.routineDescription && (
          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-night-900 border border-gray-100 dark:border-night-800 text-[11px] text-gray-600 dark:text-gray-300 my-2.5 leading-relaxed">
            💡 <strong>Instrução:</strong> {routine.routineDescription}
          </div>
        )}

        {/* Destinatários, gestor e próximo lançamento */}
        <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-gray-100 dark:border-night-800">
          <div>
            <span className="text-[10px] text-gray-600 dark:text-gray-400 block">
              {isDepartmentRoutine ? 'Departamento (Destinatários):' : 'Colaborador (Destinatário):'}
            </span>
            <div className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white mt-0.5">
              {isDepartmentRoutine ? (
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold flex items-center justify-center shrink-0">
                  {routine.assignee[0]?.toUpperCase() || 'C'}
                </div>
              )}
              <span className="truncate">{routine.assignee}</span>
            </div>
            {isDepartmentRoutine && (
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{targetLabel}</div>
            )}
          </div>

          <div>
            <span className="text-[10px] text-gray-600 dark:text-gray-400 block">Gestor Atribuinte:</span>
            <div className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{routine.assignedBy || 'Gestão'}</span>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
              <Bell className="w-3 h-3" />
              {describeNextRun(routine, now)}
            </div>
          </div>
        </div>
      </div>

      {/* Footer do Card da Rotina */}
      <div className="pt-3 border-t border-gray-100 dark:border-night-800 flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          {!progress ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 dark:bg-night-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-night-700">
              <Clock className="w-3 h-3" />
              <span>Aguardando lançamento</span>
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                progress.done === progress.total
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}
            >
              {progress.done === progress.total ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              <span>
                Hoje: {progress.done}/{progress.total} concluída(s)
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => dispatchRoutine(routine)}
            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
            title="Disparar/Reenviar notificação da tarefa para hoje imediatamente"
          >
            <Send className="w-3 h-3" />
            <span>Disparar Agora</span>
          </button>

          <button
            onClick={() => openEdit(routine)}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-night-800 hover:bg-gray-100 dark:hover:bg-night-800 text-gray-600 dark:text-gray-300 cursor-pointer"
            title="Editar rotina"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setPendingDelete(routine)}
            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 cursor-pointer"
            title="Excluir rotina"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

/** Aba "Rotinas Diárias": central de automação na visão do gestor. */
export const RotinasTab: React.FC<{ controller: TarefasController }> = ({ controller }) => {
  const {
    dailyRoutines,
    summary,
    lastRoutineSweepAt,
    routineProgressToday,
    routineTargetLabels,
    now,
    openCreate,
  } = controller;

  return (
    <div className="p-4 space-y-4">
      {/* Banner explicativo do Gestor */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
            <Repeat className="w-4 h-4" />
            <span>Central de Automação de Tarefas Diárias</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 max-w-2xl">
            Configure rotinas automáticas atribuídas pelo gestor. No horário definido, o sistema lança a tarefa do dia
            para cada colaborador ativo do departamento escolhido.
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {summary.dailyActiveCount} rotina(s) ativa(s) • {summary.dailyLaunchedToday} tarefa(s) lançada(s) hoje
            {lastRoutineSweepAt && (
              <>
                {' '}
                • última verificação às{' '}
                {lastRoutineSweepAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </>
            )}
          </p>
        </div>

        <button
          onClick={() => openCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-night-950 font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Rotina Diária</span>
        </button>
      </div>

      {/* Lista das Rotinas Programadas */}
      {dailyRoutines.length === 0 ? (
        <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-400 space-y-2">
          <Repeat className="w-8 h-8 mx-auto text-emerald-500/40" />
          <p>Nenhuma rotina diária configurada ainda.</p>
          <button
            onClick={() => openCreate(true)}
            className="text-emerald-600 dark:text-emerald-400 font-semibold underline cursor-pointer"
          >
            Clique aqui para criar a primeira rotina diária
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dailyRoutines.map(routine => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              targetLabel={routineTargetLabels.get(routine.id)}
              progress={routineProgressToday.get(routine.id)}
              now={now}
              controller={controller}
            />
          ))}
        </div>
      )}
    </div>
  );
};
