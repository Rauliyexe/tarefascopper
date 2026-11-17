import React from 'react';
import { FolderKanban } from 'lucide-react';
import { TarefaItem } from '../../types';
import { TaskCheckbox } from './TaskCheckbox';
import { formatDate, isOverdue } from './taskModel';
import { TarefasController } from './useTarefas';

/** Quantas tarefas o card do projeto lista antes de resumir o resto. */
const PREVIEW_LIMIT = 4;

const ProjectCard: React.FC<{
  project: string;
  tasks: TarefaItem[];
  onToggleComplete: (task: TarefaItem) => void;
  onOpenDetail: (task: TarefaItem) => void;
}> = ({ project, tasks, onToggleComplete, onOpenDetail }) => {
  const done = tasks.filter(t => t.status === 'Concluída').length;
  const overdue = tasks.filter(isOverdue).length;
  const progress = Math.round((done / tasks.length) * 100);

  return (
    <div className="p-4 rounded-2xl border border-gray-200 dark:border-night-800 bg-white dark:bg-night-950/60">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-gray-900 dark:text-white">{project}</div>
        <span className="text-xs font-semibold text-brand-700 dark:text-brand-400">{progress}%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-night-800 overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="text-micro text-gray-500 dark:text-gray-400 mt-1.5">
        {done} de {tasks.length} concluída(s)
        {overdue > 0 && <span className="text-rose-500 font-semibold"> • {overdue} atrasada(s)</span>}
      </div>

      <ul className="mt-3 space-y-1.5">
        {tasks.slice(0, PREVIEW_LIMIT).map(task => (
          <li key={task.id} className="flex items-center gap-2 text-xs">
            <TaskCheckbox task={task} onToggle={onToggleComplete} size="sm" />
            <button
              type="button"
              onClick={() => onOpenDetail(task)}
              className={`flex-1 truncate text-left hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors text-gray-700 dark:text-gray-300 ${
                task.status === 'Concluída' ? 'line-through text-gray-500' : ''
              }`}
            >
              {task.title}
            </button>
            <span className="font-mono text-micro text-gray-500 dark:text-gray-400">{formatDate(task.dueDate)}</span>
          </li>
        ))}
        {tasks.length > PREVIEW_LIMIT && (
          <li className="text-micro text-gray-500 dark:text-gray-400">
            +{tasks.length - PREVIEW_LIMIT} tarefa(s)
          </li>
        )}
      </ul>
    </div>
  );
};

/** Aba "Projetos": progresso por projeto, com prévia das tarefas. */
export const ProjetosTab: React.FC<{ controller: TarefasController }> = ({ controller }) => {
  const { groupedByProject, toggleComplete, openTaskDetail } = controller;

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {groupedByProject.length === 0 && (
        <div className="col-span-full py-14 text-center rounded-2xl border border-dashed border-gray-200 dark:border-night-800 bg-gray-50/50 dark:bg-night-900/40">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2.5">
            <FolderKanban className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Nenhum projeto encontrado
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Não há tarefas vinculadas a projetos com os filtros aplicados.
          </p>
        </div>
      )}

      {groupedByProject.map(([project, projectTasks]) => (
        <ProjectCard
          key={project}
          project={project}
          tasks={projectTasks}
          onToggleComplete={toggleComplete}
          onOpenDetail={openTaskDetail}
        />
      ))}
    </div>
  );
};
