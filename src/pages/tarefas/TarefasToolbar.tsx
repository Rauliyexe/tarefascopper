import React from 'react';
import { Filter, Search, X } from 'lucide-react';
import {
  PRIORITY_FILTERS,
  PriorityFilter,
  STATUS_FILTERS,
  StatusFilter,
} from './taskModel';

const CHIP_BASE = 'px-3 py-1 rounded-xl border font-medium transition-colors cursor-pointer';
const CHIP_ON = 'bg-emerald-600 border-emerald-600 text-white font-semibold';
const CHIP_OFF =
  'bg-white dark:bg-night-900 border-gray-200 dark:border-night-800 text-gray-600 dark:text-gray-300 hover:border-emerald-500';

interface TarefasToolbarProps {
  search: string;
  onSearchChange: (term: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  priorityFilter: PriorityFilter;
  onPriorityFilterChange: (priority: PriorityFilter) => void;
  isFilterOpen: boolean;
  onToggleFilters: () => void;
  onClearFilters: () => void;
}

export const TarefasToolbar: React.FC<TarefasToolbarProps> = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  isFilterOpen,
  onToggleFilters,
  onClearFilters,
}) => {
  const hasActiveFilter = statusFilter !== 'Todos' || priorityFilter !== 'Todas' || isFilterOpen;

  return (
    <>
      <div className="px-4 py-3 border-b border-gray-200/80 dark:border-night-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar tarefa, projeto ou responsável..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50/70 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <button
          onClick={onToggleFilters}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border transition-colors cursor-pointer ${hasActiveFilter
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 font-semibold'
              : 'border-gray-200/80 dark:border-night-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-800'
            }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Filtros</span>
          {(statusFilter !== 'Todos' || priorityFilter !== 'Todas') && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </button>
      </div>

      {isFilterOpen && (
        <div className="px-4 py-3 border-b border-gray-200/80 dark:border-night-800 bg-gray-50/60 dark:bg-night-850/50 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-600 dark:text-gray-400 font-medium">Status:</span>
          {STATUS_FILTERS.map(status => (
            <button
              key={status}
              onClick={() => onStatusFilterChange(status)}
              className={`${CHIP_BASE} ${statusFilter === status ? CHIP_ON : CHIP_OFF}`}
            >
              {status}
            </button>
          ))}

          <span className="text-gray-600 dark:text-gray-400 font-medium ml-3">Prioridade:</span>
          {PRIORITY_FILTERS.map(priority => (
            <button
              key={priority}
              onClick={() => onPriorityFilterChange(priority)}
              className={`${CHIP_BASE} ${priorityFilter === priority ? CHIP_ON : CHIP_OFF}`}
            >
              {priority}
            </button>
          ))}

          <button
            onClick={onClearFilters}
            className="ml-auto inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpar filtros</span>
          </button>
        </div>
      )}
    </>
  );
};
