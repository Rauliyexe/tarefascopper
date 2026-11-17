import React, { useState, useMemo } from 'react';
import {
  Plus,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Repeat,
  Flame,
  Calendar as CalendarIcon,
  GripVertical,
  CheckSquare,
  Image as ImageIcon,
  MessageSquare,
  Lock,
  UserCheck,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { RowActions } from '../../components/common/RowActions';
import { buildTaskRowActions } from './taskRowActions';
import { TarefasController } from './useTarefas';
import { TarefaItem, TaskStatus } from '../../types';
import { formatDate, isOverdue } from './taskModel';
import { soundEngine } from '../../services/soundEngine';
import { useCopperOS } from '../../context/CopperOSContext';

interface KanbanColumnProps {
  title: string;
  status: TaskStatus;
  tasks: TarefaItem[];
  controller: TarefasController;
  colorClass: string;
  badgeBg: string;
  draggedTaskId: string | null;
  setDraggedTaskId: (id: string | null) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  status,
  tasks,
  controller,
  colorClass,
  badgeBg,
  draggedTaskId,
  setDraggedTaskId,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleMove = (task: TarefaItem, targetStatus: TaskStatus) => {
    if (targetStatus === 'Concluída') {
      soundEngine.playSuccess();
    } else {
      soundEngine.playSwitch();
    }
    controller.changeStatus(task, targetStatus);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Evita falsos positivos ao passar sobre elementos filhos
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    const task = controller.filteredTasks.find(t => t.id === taskId);
    if (!task) return;

    if (!controller.canUserEditTask(task)) {
      soundEngine.playError();
      controller.changeStatus(task, status); // O changeStatus vai emitir o toast de bloqueio
      setDraggedTaskId(null);
      return;
    }

    if (task.status !== status) {
      handleMove(task, status);
    }
    setDraggedTaskId(null);
  };

  return (
    <div
      role="region"
      aria-label={`Coluna ${title}, com ${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 min-w-[280px] sm:min-w-[310px] rounded-2xl border flex flex-col max-h-[75vh] transition-all duration-150 ${
        isDragOver
          ? 'bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/40 scale-[1.01]'
          : 'bg-gray-50/70 dark:bg-night-850/50 border-gray-200/80 dark:border-night-800'
      }`}
    >
      {/* Cabeçalho da Coluna */}
      <div className="p-3.5 border-b border-gray-200/60 dark:border-night-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${colorClass}`} aria-hidden="true" />
          <h3 className="font-bold text-xs text-gray-900 dark:text-white uppercase tracking-wider">
            {title}
          </h3>
          <span className={`px-2 py-0.5 rounded-full text-micro font-mono font-bold ${badgeBg}`}>
            {tasks.length}
          </span>
        </div>

        {status === 'Pendente' && (
          <button
            type="button"
            onClick={() => {
              soundEngine.playSwoosh();
              controller.openCreate();
            }}
            aria-label="Adicionar nova tarefa pendente"
            title="Nova tarefa"
            className="p-1 rounded-lg text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-night-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Lista de Cartões com Drag and Drop */}
      <div className="p-3 overflow-y-auto space-y-3 flex-1 min-h-[220px]">
        {tasks.map(task => {
          const overdue = isOverdue(task);
          const isBeingDragged = draggedTaskId === task.id;
          const canMove = controller.canUserEditTask(task);

          return (
            <div
              key={task.id}
              role="article"
              aria-label={`Tarefa: ${task.title}. Responsável: ${task.assignee}. Prioridade: ${task.priority}. Prazo: ${formatDate(task.dueDate)}.`}
              draggable={canMove}
              onDragStart={e => {
                if (!canMove) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData('text/plain', task.id);
                e.dataTransfer.effectAllowed = 'move';
                setDraggedTaskId(task.id);
                soundEngine.playClick();
              }}
              onDragEnd={() => {
                setDraggedTaskId(null);
              }}
              className={`p-3.5 rounded-xl bg-white dark:bg-night-900 border transition-all group relative select-none ${
                canMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-90'
              } ${
                isBeingDragged
                  ? 'opacity-30 scale-95 border-emerald-500 border-dashed shadow-none ring-2 ring-emerald-500/20'
                  : 'border-gray-200/80 dark:border-night-800 hover:border-emerald-400/80 dark:hover:border-emerald-700/80 shadow-xs hover:shadow-md'
              }`}
            >
              {/* Topo do Card: Projeto & Prioridade & Grip Icon */}
              <div className="flex items-center justify-between gap-2 text-micro mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {canMove ? (
                    <GripVertical className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
                  ) : (
                    <span title="Apenas leitura — atribuída a outro colaborador">
                      <Lock className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0" />
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-md font-semibold bg-gray-100 dark:bg-night-800 text-gray-600 dark:text-gray-300 truncate max-w-[130px]">
                    {task.project}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {task.isDaily && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                      <Repeat className="w-2.5 h-2.5" aria-hidden="true" />
                      <span>{task.dailyTime || 'Diária'}</span>
                    </span>
                  )}

                  {task.priority === 'Urgente' && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-fuchsia-600 text-white shadow-xs animate-pulse">
                      <Flame className="w-2.5 h-2.5" aria-hidden="true" />
                      <span>Urgente</span>
                    </span>
                  )}
                  {task.priority === 'Alta' && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
                      <Flame className="w-2.5 h-2.5" aria-hidden="true" />
                      <span>Alta</span>
                    </span>
                  )}
                  {task.priority === 'Média' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                      Média
                    </span>
                  )}
                  {task.priority === 'Baixa' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-night-800 text-gray-500 dark:text-gray-400">
                      Baixa
                    </span>
                  )}
                </div>
              </div>

              {/* Foto de Evidência Anexada (se houver) */}
              {task.attachments && task.attachments.length > 0 && (
                <div
                  onClick={() => controller.openTaskDetail(task)}
                  className="mb-2.5 rounded-lg overflow-hidden border border-gray-100 dark:border-night-800 relative aspect-video cursor-pointer group/img"
                  title="Clique para abrir detalhes e ver anexos no Lightbox"
                >
                  <img
                    src={task.attachments[0].url}
                    alt={task.attachments[0].name}
                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                  />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-night-950/70 text-white text-[9px] font-medium flex items-center gap-1">
                    <ImageIcon className="w-2.5 h-2.5" />
                    <span>{task.attachments.length}</span>
                  </span>
                </div>
              )}

              {/* Título da Tarefa */}
              <h4
                onClick={() => controller.openTaskDetail(task)}
                className={`font-bold text-xs leading-snug text-gray-900 dark:text-white cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors ${
                  task.status === 'Concluída' ? 'line-through text-gray-400 dark:text-gray-500' : ''
                }`}
              >
                {task.title}
              </h4>

              {/* Checklist Operacional (se houver) */}
              {task.checklists && task.checklists.length > 0 && (
                <div
                  onClick={() => controller.openTaskDetail(task)}
                  className="mt-2 p-1.5 rounded-lg bg-gray-50 dark:bg-night-850 border border-gray-200/60 dark:border-night-800/80 cursor-pointer hover:border-emerald-500/40 transition-colors"
                  title="Clique para abrir o Drawer e marcar itens com 1 clique"
                >
                  <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                    <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckSquare className="w-3 h-3" />
                      <span>Checklist</span>
                    </span>
                    <span className="font-mono">
                      {task.checklists.filter(c => c.completed).length}/{task.checklists.length}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-gray-200 dark:bg-night-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round(
                          (task.checklists.filter(c => c.completed).length / task.checklists.length) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Metadados: Responsável e Prazo */}
              <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-night-800/80 flex items-center justify-between text-micro text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center shrink-0" aria-hidden="true">
                    {task.assignee.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate">{task.assignee}</span>
                </div>

                <div className="flex items-center gap-2">
                  {task.comments && task.comments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => controller.openFeedback(task)}
                      className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-mono cursor-pointer bg-indigo-50/70 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/50"
                      title={`${task.comments.length} feedback(s). Clique para ver/adicionar.`}
                    >
                      <MessageSquare className="w-2.5 h-2.5" />
                      <span>{task.comments.length}</span>
                    </button>
                  )}

                  <div
                    className={`flex items-center gap-1 font-mono text-[11px] ${
                      overdue
                        ? 'text-rose-600 dark:text-rose-400 font-bold'
                        : task.status === 'Concluída'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-500'
                    }`}
                    title={overdue ? 'Tarefa atrasada!' : 'Prazo de conclusão'}
                  >
                    <CalendarIcon className="w-3 h-3" aria-hidden="true" />
                    <span>{formatDate(task.dueDate)}</span>
                  </div>
                </div>
              </div>

              {/* Barra de Ações Rápidas de Avanço */}
              <div className="mt-3 flex items-center justify-between gap-1 pt-1">
                {canMove ? (
                  <>
                    {status === 'Pendente' && (
                      <button
                        type="button"
                        onClick={() => handleMove(task, 'Em andamento')}
                        aria-label={`Iniciar tarefa: ${task.title}`}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-micro font-bold transition-colors cursor-pointer"
                      >
                        <span>Iniciar</span>
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </button>
                    )}

                    {status === 'Em andamento' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleMove(task, 'Pendente')}
                          aria-label={`Mover tarefa "${task.title}" de volta para Pendente`}
                          title="Voltar para Pendente"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-night-800 transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(task, 'Concluída')}
                          aria-label={`Marcar tarefa "${task.title}" como Concluída`}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-micro font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Concluir</span>
                        </button>
                      </>
                    )}

                    {status === 'Concluída' && (
                      <button
                        type="button"
                        onClick={() => handleMove(task, 'Em andamento')}
                        aria-label={`Reabrir tarefa "${task.title}" para Em andamento`}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-night-800 hover:bg-gray-50 dark:hover:bg-night-800 text-gray-600 dark:text-gray-300 text-micro font-semibold transition-colors cursor-pointer"
                      >
                        <span>Reabrir Tarefa</span>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center gap-1.5 py-1 text-micro text-gray-400 dark:text-gray-500 italic">
                    <Lock className="w-3 h-3 shrink-0" />
                    <span className="truncate">Atribuída a {task.assignee}</span>
                  </div>
                )}

                <div className="ml-auto">
                  <RowActions actions={buildTaskRowActions(task, controller)} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Indicador visual de destino quando arrastando para esta coluna */}
        {isDragOver && draggedTaskId && !tasks.some(t => t.id === draggedTaskId) && (
          <div className="p-3.5 rounded-xl border-2 border-dashed border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold text-center flex items-center justify-center gap-2 animate-pulse transition-all">
            <span>Solte o cartão aqui para marcar como {title}</span>
          </div>
        )}

        {tasks.length === 0 && !isDragOver && (
          <div className="py-12 px-3 text-center border-2 border-dashed border-gray-200/70 dark:border-night-800 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-400 dark:text-gray-500">
            <span className="text-xs font-semibold">Coluna Vazia</span>
            <span className="text-[11px]">Nenhuma tarefa {title.toLowerCase()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const KanbanTab: React.FC<{ controller: TarefasController }> = ({ controller }) => {
  const { user } = useCopperOS();
  const { filteredTasks } = controller;
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const isOperator = user?.role === 'OPERATOR';

  // Lista de responsáveis únicos para o filtro de equipe
  const assignees = useMemo(() => {
    const set = new Set<string>();
    controller.tasks.forEach(t => {
      if (!t.isDaily && t.assignee) set.add(t.assignee.trim());
    });
    return Array.from(set).sort();
  }, [controller.tasks]);

  const pendingTasks = filteredTasks.filter(t => t.status === 'Pendente');
  const inProgressTasks = filteredTasks.filter(t => t.status === 'Em andamento');
  const doneTasks = filteredTasks.filter(t => t.status === 'Concluída');

  return (
    <div className="space-y-4">
      {/* ── Barra de Escopo do Kanban ── */}
      {isOperator ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs">
          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold">Quadro Kanban Individual:</span>
            <span>Você está visualizando e movimentando exclusivamente suas próprias tarefas ({user.name}).</span>
          </div>
          <span className="self-start sm:self-auto px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-mono">
            {filteredTasks.length} cartão(ões)
          </span>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playTab();
                controller.setKanbanScope('MINE');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                controller.kanbanScope === 'MINE'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-night-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-night-700'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Minhas Tarefas (Individual)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playTab();
                controller.setKanbanScope('TEAM');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                controller.kanbanScope === 'TEAM'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-night-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-night-700'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Quadro Geral da Equipe</span>
            </button>
          </div>

          {controller.kanbanScope === 'TEAM' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 font-medium">Filtrar por Responsável:</span>
              <select
                value={controller.kanbanAssigneeFilter}
                onChange={e => controller.setKanbanAssigneeFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white font-medium"
              >
                <option value="ALL">Todos os Colaboradores</option>
                {assignees.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── Colunas do Kanban ── */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 sm:gap-6 w-full">
          <KanbanColumn
            title="A Fazer / Pendente"
            status="Pendente"
            tasks={pendingTasks}
            controller={controller}
            colorClass="bg-amber-500"
            badgeBg="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300"
            draggedTaskId={draggedTaskId}
            setDraggedTaskId={setDraggedTaskId}
          />

          <KanbanColumn
            title="Em Andamento"
            status="Em andamento"
            tasks={inProgressTasks}
            controller={controller}
            colorClass="bg-emerald-500"
            badgeBg="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
            draggedTaskId={draggedTaskId}
            setDraggedTaskId={setDraggedTaskId}
          />

          <KanbanColumn
            title="Concluídas"
            status="Concluída"
            tasks={doneTasks}
            controller={controller}
            colorClass="bg-blue-500"
            badgeBg="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300"
            draggedTaskId={draggedTaskId}
            setDraggedTaskId={setDraggedTaskId}
          />
        </div>
      </div>
    </div>
  );
};
