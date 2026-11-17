import React from 'react';
import { Repeat, CheckSquare, Image as ImageIcon, MessageSquare, Flame } from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { RowActions } from '../../components/common/RowActions';
import { TarefaItem, TaskStatus } from '../../types';
import { dateKey, routineTime } from '../../domain/recurrence';
import { TaskCheckbox } from './TaskCheckbox';
import { PAGE_SIZE, formatDate, isOverdue, statusBadgeClass } from './taskModel';
import { buildTaskRowActions } from './taskRowActions';
import { TarefasController } from './useTarefas';

const COLUMNS = ['', 'Tarefa', 'Projeto', 'Responsável', 'Prazo', 'Prioridade', 'Status'];

const priorityClass = (priority: TarefaItem['priority']) =>
  priority === 'Urgente'
    ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/30 font-bold'
    : priority === 'Alta'
      ? 'text-rose-500 font-semibold'
      : priority === 'Média'
        ? 'text-amber-500 font-semibold'
        : 'text-gray-500';

const TaskRow: React.FC<{ task: TarefaItem; controller: TarefasController; selectCell?: React.ReactNode }> = ({ task, controller, selectCell }) => {
  const { toggleComplete, openTaskDetail, changeStatus } = controller;
  const today = dateKey(new Date());

  return (
    <tr className="hover:bg-gray-50/60 dark:hover:bg-night-850/60 transition-colors">
      {selectCell}
      <td className="py-3.5 px-4">
        <TaskCheckbox task={task} onToggle={toggleComplete} />
      </td>
      <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => openTaskDetail(task)}
              className={`text-left hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors ${task.status === 'Concluída' ? 'line-through text-gray-500 dark:text-gray-500' : ''
                }`}
              title="Clique para abrir o painel de detalhes, checklist 1-clique e timeline"
            >
              {task.title}
            </button>
            {task.isDaily && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                title={`Rotina diária enviada às ${routineTime(task)} pelo gestor ${task.assignedBy || ''}`}
              >
                <Repeat className="w-2.5 h-2.5" />
                <span>Diária ({routineTime(task)})</span>
              </span>
            )}
            {task.checklists && task.checklists.length > 0 && (
              <span
                onClick={() => openTaskDetail(task)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer hover:opacity-80 transition-opacity ${
                  task.checklists.every(c => c.completed)
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                }`}
                title="Clique para abrir e marcar itens do checklist com 1 clique"
              >
                <CheckSquare className="w-2.5 h-2.5" />
                <span>
                  Checklist {task.checklists.filter(c => c.completed).length}/{task.checklists.length}
                </span>
              </span>
            )}
            {task.attachments && task.attachments.length > 0 && (
              <span
                onClick={() => openTaskDetail(task)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 cursor-pointer hover:opacity-80 transition-opacity"
                title={`${task.attachments.length} evidência(s) fotográfica(s) anexada(s). Clique para ver no Lightbox.`}
              >
                <ImageIcon className="w-2.5 h-2.5" />
                <span>{task.attachments.length} foto(s)</span>
              </span>
            )}
            {task.comments && task.comments.length > 0 && (
              <button
                type="button"
                onClick={() => openTaskDetail(task)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20 transition-colors"
                title={`${task.comments.length} feedback(s) registrado(s). Clique para ver a timeline.`}
              >
                <MessageSquare className="w-2.5 h-2.5" />
                <span>{task.comments.length} feedback(s)</span>
              </button>
            )}
          </div>
          {task.isDaily && task.assignedBy && (
            <span className="text-[11px] text-gray-400 font-normal">
              Gestor: <strong className="text-gray-600 dark:text-gray-300">{task.assignedBy}</strong>
            </span>
          )}
        </div>
      </td>
      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400">{task.project}</td>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
          <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center">
            {task.assignee[0]?.toUpperCase() || 'U'}
          </div>
          <span>{task.assignee}</span>
        </div>
      </td>
      <td className="py-3.5 px-4 font-mono text-xs">
        <span className={isOverdue(task) ? 'text-rose-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}>
          {task.dueDate === today ? 'Hoje' : formatDate(task.dueDate)}
        </span>
        {isOverdue(task) && <span className="ml-1.5 text-micro font-semibold text-rose-500">atrasada</span>}
      </td>
      <td className="py-3.5 px-4">
        <span className={`text-xs font-medium ${priorityClass(task.priority)}`}>
          {task.priority === 'Urgente' && (
            <span className="relative flex h-2 w-2 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500"></span>
            </span>
          )}
          {task.priority === 'Urgente' && <Flame className="w-3 h-3 text-fuchsia-500 shrink-0" />}
          {task.priority}
        </span>
      </td>
      <td className="py-3.5 px-4">
        <div className="inline-flex items-center gap-1.5">
          {task.status === 'Em andamento' && (
            <span className="relative flex h-2 w-2 shrink-0" title="Em andamento">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
          <select
            value={task.status}
            onChange={e => changeStatus(task, e.target.value as TaskStatus)}
            aria-label={`Status de ${task.title}`}
            className={`px-2 py-1 rounded-full text-micro font-semibold border cursor-pointer focus:outline-none focus:border-emerald-500 ${statusBadgeClass(
              task.status,
            )}`}
          >
            <option value="Pendente">Pendente</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Concluída">Concluída</option>
          </select>
        </div>
      </td>
      <td className="py-3.5 px-4 text-right">
        <RowActions actions={buildTaskRowActions(task, controller)} />
      </td>
    </tr>
  );
};

/** Aba padrão ("Minhas tarefas" e "Equipe"): tabela paginada. */
export const TaskTableTab: React.FC<{ controller: TarefasController }> = ({ controller }) => {
  const { pagedTasks, filteredTasks, currentPage, setPage, selectedIds, setSelectedIds, toggleSelected } = controller;
  const [reassignName, setReassignName] = React.useState('');
  const allPageSelected = pagedTasks.length > 0 && pagedTasks.every(t => selectedIds.has(t.id));
  const hasFilters = controller.search || controller.statusFilter !== 'Todos' || controller.priorityFilter !== 'Todas';

  return (
    <>
      {/* U2 — Barra de ações em lote */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-2.5 border-b border-emerald-500/30 bg-emerald-500/10 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-emerald-800 dark:text-emerald-300">
            {selectedIds.size} selecionada(s)
          </span>
          <button
            onClick={() => controller.bulkChangeStatus('Concluída')}
            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
          >
            Concluir
          </button>
          <button
            onClick={() => controller.bulkChangeStatus('Em andamento')}
            className="px-3 py-1 rounded-lg bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 font-semibold cursor-pointer"
          >
            Em andamento
          </button>
          <input
            list="bulk-employees"
            value={reassignName}
            onChange={e => setReassignName(e.target.value)}
            placeholder="Reatribuir para..."
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 w-44"
          />
          <datalist id="bulk-employees">
            {controller.companyEmployees.map(e => (
              <option key={e.id} value={e.name} />
            ))}
          </datalist>
          <button
            disabled={!reassignName.trim()}
            onClick={() => {
              controller.bulkReassign(reassignName);
              setReassignName('');
            }}
            className="px-3 py-1 rounded-lg bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 font-semibold cursor-pointer disabled:opacity-40"
          >
            Reatribuir
          </button>
          <button
            onClick={controller.clearSelection}
            className="ml-auto text-gray-500 hover:text-gray-900 dark:hover:text-white font-medium cursor-pointer"
          >
            Limpar seleção
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-night-800 text-gray-600 dark:text-gray-400 text-xs font-medium">
              <th className="py-3 pl-4 w-8">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas da página"
                  checked={allPageSelected}
                  onChange={() =>
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      pagedTasks.forEach(t => (allPageSelected ? next.delete(t.id) : next.add(t.id)));
                      return next;
                    })
                  }
                  className="accent-emerald-600 cursor-pointer"
                />
              </th>
              {COLUMNS.map((column, index) => (
                <th key={column || 'check'} className={`py-3 px-4 font-normal ${index === 0 ? 'w-12' : ''}`}>
                  {column}
                </th>
              ))}
              <th className="py-3 px-4 font-normal text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-night-800/60">
            {pagedTasks.map(task => (
              <React.Fragment key={task.id}>
                <TaskRow
                  task={task}
                  controller={controller}
                  selectCell={
                    <td className="py-3.5 pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${task.title}`}
                        checked={selectedIds.has(task.id)}
                        onChange={() => toggleSelected(task.id)}
                        className="accent-emerald-600 cursor-pointer"
                      />
                    </td>
                  }
                />
              </React.Fragment>
            ))}

            {/* U5 — Estado vazio com ação sugerida */}
            {pagedTasks.length === 0 && (
              <tr>
                <td colSpan={9} className="py-14 text-center">
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <CheckSquare className="w-6 h-6 text-emerald-500" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {hasFilters ? 'Nenhuma tarefa com esses filtros' : 'Tudo em dia por aqui!'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {hasFilters ? 'Tente limpar os filtros ou a busca.' : 'Nenhuma tarefa nesta visão no momento.'}
                    </p>
                    {hasFilters ? (
                      <button
                        onClick={controller.clearFilters}
                        className="mt-1 px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-night-700 text-xs font-semibold cursor-pointer hover:border-emerald-500"
                      >
                        Limpar filtros
                      </button>
                    ) : (
                      <button
                        onClick={() => controller.openCreate(false)}
                        className="mt-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                      >
                        + Criar tarefa
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={filteredTasks.length}
        itemLabel="tarefas"
        onPageChange={setPage}
      />
    </>
  );
};
