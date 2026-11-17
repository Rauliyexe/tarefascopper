import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  LayoutGrid,
  List,
  AlertCircle,
} from 'lucide-react';
import { RowActions } from '../../components/common/RowActions';
import { dateKey, parseDateKey, startOfDay } from '../../domain/recurrence';
import { TaskCheckbox } from './TaskCheckbox';
import { statusBadgeClass, isOverdue } from './taskModel';
import { buildTaskRowActions } from './taskRowActions';
import { TarefasController } from './useTarefas';
import { TarefaItem } from '../../types';
import { soundEngine } from '../../services/soundEngine';

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const WEEKDAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const CalendarioTab: React.FC<{ controller: TarefasController }> = ({ controller }) => {
  const { filteredTasks, toggleComplete, openCreate, changeStatus } = controller;

  // Data de referência para navegação do calendário (ano/mês)
  const [viewDate, setViewDate] = useState(() => new Date());
  const todayKey = dateKey(new Date());

  // Data selecionada pelo usuário para ver a agenda detalhada
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'agenda'>('month');

  // Ano e mês atual da visão
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Navegação
  const handlePrevMonth = () => {
    soundEngine.playClick();
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    soundEngine.playClick();
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    soundEngine.playClick();
    const now = new Date();
    setViewDate(now);
    setSelectedDateKey(dateKey(now));
  };

  // Mapeamento de tarefas por data YYYY-MM-DD
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TarefaItem[]>();
    for (const task of filteredTasks) {
      const list = map.get(task.dueDate) || [];
      list.push(task);
      map.set(task.dueDate, list);
    }
    return map;
  }, [filteredTasks]);

  // Cálculo dos dias do mês na grade (Segunda a Domingo)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Ajuste para semana começando na Segunda-feira (0 = Segunda, 6 = Domingo)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: {
      date: Date;
      key: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      tasks: TarefaItem[];
    }[] = [];

    // Dias do mês anterior para preencher a primeira semana
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const d = new Date(year, month - 1, dayNum);
      const key = dateKey(d);
      days.push({
        date: d,
        key,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: key === todayKey,
        tasks: tasksByDate.get(key) || [],
      });
    }

    // Dias do mês atual
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const d = new Date(year, month, dayNum);
      const key = dateKey(d);
      days.push({
        date: d,
        key,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: key === todayKey,
        tasks: tasksByDate.get(key) || [],
      });
    }

    // Dias do próximo mês para completar a grade de 35 ou 42 células
    const remaining = (7 - (days.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const d = new Date(year, month + 1, dayNum);
      const key = dateKey(d);
      days.push({
        date: d,
        key,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: key === todayKey,
        tasks: tasksByDate.get(key) || [],
      });
    }

    return days;
  }, [year, month, todayKey, tasksByDate]);

  // Tarefas do dia selecionado
  const selectedDayTasks = useMemo(() => {
    return tasksByDate.get(selectedDateKey) || [];
  }, [selectedDateKey, tasksByDate]);

  const selectedDateObj = useMemo(() => {
    try {
      return parseDateKey(selectedDateKey);
    } catch {
      return new Date();
    }
  }, [selectedDateKey]);

  return (
    <div className="p-4 space-y-4">
      {/* ── Barra de Navegação do Calendário ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100 dark:border-night-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              title="Mês anterior"
              className="p-2 rounded-xl border border-gray-200 dark:border-night-800 hover:border-emerald-500 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              title="Próximo mês"
              className="p-2 rounded-xl border border-gray-200 dark:border-night-800 hover:border-emerald-500 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-800 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <span>
              {MONTH_NAMES[month]} de {year}
            </span>
          </h2>

          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer shadow-xs"
          >
            Hoje
          </button>
        </div>

        {/* Alternador de Modo de Visão */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 rounded-xl p-0.5 text-xs">
            <button
              onClick={() => {
                soundEngine.playClick();
                setCalendarViewMode('month');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                calendarViewMode === 'month'
                  ? 'bg-white dark:bg-night-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Mês</span>
            </button>
            <button
              onClick={() => {
                soundEngine.playClick();
                setCalendarViewMode('agenda');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                calendarViewMode === 'agenda'
                  ? 'bg-white dark:bg-night-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </button>
          </div>

          <button
            onClick={() => {
              soundEngine.playSwoosh();
              openCreate();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Tarefa</span>
          </button>
        </div>
      </div>

      {calendarViewMode === 'month' ? (
        /* ── Grade Visual do Mês com Split Panel de Agenda ── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Grade Mensal 7x5 (8 colunas em desktop) */}
          <div className="lg:col-span-8 bg-white dark:bg-night-900 rounded-2xl border border-gray-200/80 dark:border-night-800 overflow-hidden shadow-xs">
            {/* Cabeçalho dos Dias da Semana */}
            <div className="grid grid-cols-7 bg-gray-50/80 dark:bg-night-850/80 border-b border-gray-200/80 dark:border-night-800 text-center py-2.5 text-micro font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {WEEKDAYS_SHORT.map((wd, i) => (
                <div key={wd} className={i >= 5 ? 'text-rose-500/80' : ''}>
                  {wd}
                </div>
              ))}
            </div>

            {/* Células dos Dias */}
            <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 dark:divide-night-800 border-b border-gray-100 dark:border-night-800">
              {calendarDays.map((day, index) => {
                const isSelected = day.key === selectedDateKey;
                const overdueTasks = day.tasks.filter(isOverdue);
                const hasDaily = day.tasks.some(t => t.isDaily);

                return (
                  <div
                    key={day.key + index}
                    onClick={() => {
                      soundEngine.playClick();
                      setSelectedDateKey(day.key);
                    }}
                    className={`min-h-[85px] sm:min-h-[105px] p-1.5 sm:p-2 transition-all cursor-pointer flex flex-col justify-between group ${
                      !day.isCurrentMonth
                        ? 'bg-gray-50/30 dark:bg-night-950/20 text-gray-300 dark:text-gray-600'
                        : isSelected
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/30 ring-2 ring-emerald-500/50 inset-0 z-10'
                        : 'hover:bg-gray-50/80 dark:hover:bg-night-850/50'
                    }`}
                  >
                    {/* Topo da Célula: Número do Dia & Indicadores */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                          day.isToday
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : isSelected
                            ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                            : day.isCurrentMonth
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      {day.tasks.length > 0 && (
                        <div className="flex items-center gap-1">
                          {hasDaily && (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Possui rotina diária" />
                          )}
                          {overdueTasks.length > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" title="Tarefa atrasada" />
                          )}
                          <span className="font-mono text-[10px] font-bold text-gray-500 dark:text-gray-400">
                            {day.tasks.length}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Chips de Tarefas no Dia */}
                    <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                      {day.tasks.slice(0, 2).map(task => {
                        const isDone = task.status === 'Concluída';
                        const isLate = isOverdue(task);

                        return (
                          <div
                            key={task.id}
                            className={`px-1.5 py-0.5 rounded text-[10px] truncate leading-tight font-medium flex items-center gap-1 ${
                              isDone
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 line-through opacity-70'
                                : isLate
                                ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 font-bold'
                                : task.priority === 'Urgente'
                                ? 'bg-fuchsia-100 dark:bg-fuchsia-950/90 text-fuchsia-800 dark:text-fuchsia-200 font-bold'
                                : task.priority === 'Alta'
                                ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                                : 'bg-gray-100 dark:bg-night-800 text-gray-700 dark:text-gray-300'
                            }`}
                            title={`${task.title} (${task.assignee})`}
                          >
                            <span
                              className={`w-1 h-1 rounded-full shrink-0 ${
                                isDone ? 'bg-blue-500' : isLate ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                            />
                            <span className="truncate">{task.title}</span>
                          </div>
                        );
                      })}

                      {day.tasks.length > 2 && (
                        <div className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold px-1">
                          +{day.tasks.length - 2} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Painel Lateral de Agenda do Dia Selecionado ── */}
          <div className="lg:col-span-4 bg-white dark:bg-night-900 rounded-2xl border border-gray-200/80 dark:border-night-800 p-4 shadow-xs flex flex-col justify-between">
            <div>
              {/* Cabeçalho do Dia */}
              <div className="pb-3 border-b border-gray-100 dark:border-night-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Agenda do Dia
                  </span>
                  <h3 className="text-sm font-extrabold text-gray-900 dark:text-white capitalize mt-0.5">
                    {selectedDateObj.toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                    })}
                  </h3>
                </div>

                <span className="font-mono text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-night-800 rounded-lg text-gray-700 dark:text-gray-300">
                  {selectedDayTasks.length} {selectedDayTasks.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {/* Lista de Tarefas do Dia */}
              <div className="mt-3 space-y-2.5 max-h-[52vh] overflow-y-auto pr-1">
                {selectedDayTasks.map(task => {
                  const overdue = isOverdue(task);

                  return (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl bg-gray-50/80 dark:bg-night-850/80 border border-gray-200/60 dark:border-night-800 hover:border-emerald-500/60 transition-colors text-xs space-y-2 group"
                    >
                      <div className="flex items-start gap-2.5">
                        <TaskCheckbox task={task} onToggle={toggleComplete} />
                        <div className="flex-1 min-w-0">
                          <h4
                            onClick={() => controller.openTaskDetail(task)}
                            className={`font-bold leading-snug text-gray-900 dark:text-white cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors ${
                              task.status === 'Concluída' ? 'line-through text-gray-400' : ''
                            }`}
                          >
                            {task.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-micro text-gray-500 dark:text-gray-400 font-mono">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                              {task.project}
                            </span>
                            <span>• {task.assignee}</span>
                            {task.isDaily && (
                              <span className="text-purple-600 dark:text-purple-400 font-bold">
                                • {task.dailyTime || 'Rotina'}
                              </span>
                            )}
                          </div>
                        </div>

                        <RowActions actions={buildTaskRowActions(task, controller)} />
                      </div>

                      <div className="flex items-center justify-between text-micro pt-1 border-t border-gray-200/40 dark:border-night-700/40">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold ${statusBadgeClass(
                            task.status
                          )}`}
                        >
                          {task.status}
                        </span>

                        {overdue && (
                          <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Atrasada
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {selectedDayTasks.length === 0 && (
                  <div className="py-10 px-4 text-center rounded-xl border border-dashed border-gray-200 dark:border-night-800 bg-gray-50/50 dark:bg-night-900/40">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2.5">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Nenhuma tarefa agendada
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      Dia livre de entregas operacionais ou rotinas para este filtro.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Botão para Lançar Tarefa nesta Data */}
            <div className="pt-3 border-t border-gray-100 dark:border-night-800 mt-3">
              <button
                onClick={() => {
                  soundEngine.playSwoosh();
                  openCreate();
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Tarefa para este dia</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Modo Agenda por Data Agrupada ── */
        <div className="space-y-4">
          {controller.groupedByDate.map(([date, dateTasks]) => (
            <div
              key={date}
              className="rounded-2xl border border-gray-200 dark:border-night-800 overflow-hidden shadow-xs"
            >
              <div
                className={`px-4 py-2.5 flex items-center justify-between text-xs font-semibold ${
                  parseDateKey(date) < startOfDay(new Date())
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    : date === todayKey
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                    : 'bg-gray-50 dark:bg-night-850 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span>
                  {parseDateKey(date).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}
                  {date === todayKey && ' • hoje'}
                </span>
                <span className="font-mono">{dateTasks.length} tarefa(s)</span>
              </div>

              <ul className="divide-y divide-gray-100 dark:divide-night-800/60 bg-white dark:bg-night-900">
                {dateTasks.map(task => (
                  <li key={task.id} className="px-4 py-3 flex items-center gap-3 text-xs">
                    <TaskCheckbox task={task} onToggle={toggleComplete} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => controller.openTaskDetail(task)}
                          className={`font-semibold text-left hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer text-gray-900 dark:text-white truncate ${
                            task.status === 'Concluída'
                              ? 'line-through text-gray-400 dark:text-gray-500'
                              : ''
                          }`}
                        >
                          {task.title}
                        </button>
                        {task.isDaily && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Diária
                          </span>
                        )}
                      </div>
                      <div className="text-micro text-gray-500 dark:text-gray-400">
                        {task.project} • {task.assignee} • prioridade {task.priority.toLowerCase()}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-micro font-semibold border ${statusBadgeClass(
                        task.status
                      )}`}
                    >
                      {task.status}
                    </span>
                    <RowActions actions={buildTaskRowActions(task, controller)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {controller.groupedByDate.length === 0 && (
            <div className="py-14 text-center rounded-2xl border border-dashed border-gray-200 dark:border-night-800 bg-gray-50/50 dark:bg-night-900/40">
              <CalendarIcon className="w-8 h-8 mx-auto text-emerald-500/40 mb-2" />
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Nenhuma tarefa localizada para o período
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                Altere os filtros acima para visualizar tarefas de outras datas.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
