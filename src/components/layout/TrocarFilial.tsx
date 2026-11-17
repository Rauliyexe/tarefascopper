import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import { soundEngine } from '../../services/soundEngine';

export const TrocarFilial: React.FC = () => {
  const { currentCompany, activeBranch, setIsCompanySelectorOpen } = useCopperOS();

  if (!currentCompany) return null;

  const filialName = activeBranch ? activeBranch.name : 'Matriz Principal';

  return (
    <button
      type="button"
      onClick={() => {
        soundEngine.playSwoosh();
        setIsCompanySelectorOpen(true);
      }}
      aria-label={`Trocar de filial ou empresa — atual: ${currentCompany.tradeName}, ${filialName}`}
      title="Clique para alternar Empresa ou Filial"
      className="flex items-center gap-2.5 max-w-[360px] min-w-0 pl-1.5 pr-3 py-1 rounded-xl border border-gray-200 dark:border-night-800 bg-gray-50/90 dark:bg-night-850 hover:bg-emerald-50/70 dark:hover:bg-night-800 hover:border-emerald-500/50 transition-colors shadow-2xs cursor-pointer group"
    >
      <span className="w-7 h-7 rounded-lg bg-emerald-600/15 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-black text-emerald-700 dark:text-emerald-300 text-xs shrink-0">
        {currentCompany.monogram || currentCompany.tradeName.slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[9px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-400 leading-tight">
          Empresa & Filial
        </span>
        <span className="block text-xs font-bold text-gray-900 dark:text-white truncate leading-tight">
          {currentCompany.tradeName}
          <span className="font-medium text-gray-500 dark:text-gray-400"> · {filialName.split('(')[0].trim()}</span>
        </span>
      </span>
      <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0 ml-0.5" />
    </button>
  );
};

