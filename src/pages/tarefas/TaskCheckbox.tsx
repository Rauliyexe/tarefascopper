import React from 'react';
import { TarefaItem } from '../../types';

const CHECKBOX_SIZES = {
  md: 'w-4 h-4 rounded text-brand-600 dark:text-brand-400 border-gray-300 focus:ring-emerald-500 cursor-pointer',
  sm: 'w-3.5 h-3.5 rounded text-brand-600 border-gray-300 cursor-pointer',
};

/** Caixa de conclusão da tarefa — a mesma em tabela, calendário e projetos. */
export const TaskCheckbox: React.FC<{
  task: TarefaItem;
  onToggle: (task: TarefaItem) => void;
  size?: keyof typeof CHECKBOX_SIZES;
}> = ({ task, onToggle, size = 'md' }) => (
  <input
    type="checkbox"
    checked={task.status === 'Concluída'}
    onChange={() => onToggle(task)}
    aria-label={`Concluir ${task.title}`}
    className={CHECKBOX_SIZES[size]}
  />
);
