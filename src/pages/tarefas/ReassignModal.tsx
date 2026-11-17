import React from 'react';
import { Modal } from '../../components/common/Modal';
import { TarefasController } from './useTarefas';

/** Modal de delegação: troca o responsável de uma tarefa. */
export const ReassignModal: React.FC<{ controller: TarefasController }> = ({ controller }) => {
  const { reassignTarget, reassignTo, setReassignTo, closeReassign, submitReassign } = controller;

  if (!reassignTarget) return null;

  return (
    <Modal
      isOpen={!!reassignTarget}
      onClose={closeReassign}
      title="Delegar Tarefa"
      subtitle={reassignTarget.title}
      maxWidth="sm"
    >
      <form onSubmit={submitReassign} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Novo responsável *</label>
          <input
            type="text"
            required
            autoFocus
            list="reassign-employees-list"
            value={reassignTo}
            onChange={e => setReassignTo(e.target.value)}
            placeholder="Digite ou escolha da equipe..."
            className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white"
          />
          <datalist id="reassign-employees-list">
            {controller.companyEmployees.map(emp => (
              <option key={emp.id} value={emp.name}>
                {emp.name} ({emp.role || 'Equipe'})
              </option>
            ))}
          </datalist>

          {controller.companyEmployees.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Equipe:</span>
              {controller.companyEmployees.slice(0, 4).map(emp => (
                <button
                  type="button"
                  key={emp.id}
                  onClick={() => setReassignTo(emp.name)}
                  className="px-2 py-0.5 rounded-lg text-[11px] bg-gray-100 dark:bg-night-800 text-gray-700 dark:text-gray-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 transition-colors"
                >
                  {emp.name.split(' ')[0]}
                </button>
              ))}
            </div>
          )}

          <p className="text-micro text-gray-500 dark:text-gray-400 mt-1.5">
            Atualmente atribuída a <strong>{reassignTarget.assignee}</strong>.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeReassign}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-night-800 text-gray-600 dark:text-gray-400 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold cursor-pointer"
          >
            Delegar
          </button>
        </div>
      </form>
    </Modal>
  );
};
