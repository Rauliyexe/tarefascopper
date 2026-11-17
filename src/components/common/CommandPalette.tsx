import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, CornerDownLeft, CheckSquare, ArrowRight, Mic, Settings, Plus, HardHat, ShieldCheck } from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import { useTasks } from '../../context/TasksContext';
import { useFloorMode } from '../../hooks/useFloorMode';

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  icon: React.ElementType;
  run: () => void;
}

/** U1 — Busca rápida global (Ctrl+K / ⌘K). */
export const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setSearchParams] = useSearchParams();
  const { user, setIsSettingsOpen, setIsFechamentoModalOpen } = useCopperOS();
  const { tasks } = useTasks();
  const { floorMode, toggleFloorMode } = useFloorMode();
  const isManager = user.role === 'CEO' || user.role === 'MANAGER' || user.role === 'ADMIN';
  const isTiRole = user.role === 'ADMIN' || user.role === 'SUPERADMIN' || user.role === 'CEO';
  const isHigherRole = user.role === 'ADMIN' || user.role === 'CEO' || user.role === 'MANAGER';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('copperos:open-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('copperos:open-palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const goTab = (tab: string) => {
    setIsSettingsOpen(tab === 'Configurações');
    setSearchParams({ tab });
  };

  const items = useMemo<PaletteItem[]>(() => {
    const nav: PaletteItem[] = [
      ...(isManager ? [{ id: 'n-brief', label: 'Briefing 5 Min', hint: 'Ir para', icon: ArrowRight, run: () => goTab('Briefing 5 Min') }] : []),
      { id: 'n-minhas', label: 'Minhas Tarefas', hint: 'Ir para', icon: ArrowRight, run: () => goTab('Minhas tarefas') },
      ...(isManager ? [{ id: 'n-equipe', label: 'Equipe', hint: 'Ir para', icon: ArrowRight, run: () => goTab('Equipe') }] : []),
      { id: 'n-kanban', label: 'Quadro Kanban', hint: 'Ir para', icon: ArrowRight, run: () => goTab('Kanban') },
      { id: 'n-proj', label: 'Projetos', hint: 'Ir para', icon: ArrowRight, run: () => goTab('Projetos') },
      { id: 'n-cal', label: 'Calendário', hint: 'Ir para', icon: ArrowRight, run: () => goTab('Calendário') },
      { id: 'n-rot', label: 'Rotinas Diárias', hint: 'Ir para', icon: ArrowRight, run: () => goTab('Rotinas Diárias') },
      { id: 'n-rdo', label: 'Relatório Diário (RDO)', hint: 'Ir para', icon: ArrowRight, run: () => goTab('Relatório Diário') },
      { id: 'n-calib', label: 'Calibração de Balanças', hint: 'Ir para', icon: ArrowRight, run: () => goTab('Calibração') },
      ...(isTiRole ? [{ id: 'n-ti', label: 'Painel TI · Gestão de Colaboradores e Acessos', hint: 'Ir para', icon: ShieldCheck, run: () => { setIsSettingsOpen(true); setSearchParams({ tab: 'Configurações', section: 'ti-usuarios' }); } }] : []),
      { id: 'a-new', label: 'Nova tarefa', hint: 'Ação', icon: Plus, run: () => { goTab('Minhas tarefas'); setTimeout(() => window.dispatchEvent(new CustomEvent('copperos:copilot-task-action', { detail: { isDaily: false } })), 50); } },
      { id: 'a-fech', label: 'Fazer fechamento de turno', hint: 'Ação', icon: Mic, run: () => setIsFechamentoModalOpen(true) },
      { id: 'a-floor', label: floorMode ? 'Sair do modo chão de fábrica' : 'Ativar modo chão de fábrica', hint: 'Ação', icon: HardHat, run: toggleFloorMode },
      ...(isHigherRole ? [{ id: 'n-cfg', label: 'Configurações', hint: 'Ir para', icon: Settings, run: () => goTab('Configurações') }] : []),
    ];
    const taskItems: PaletteItem[] = tasks
      .filter(t => !t.isDaily)
      .map(t => ({
        id: `t-${t.id}`,
        label: t.title,
        hint: `${t.assignee} · ${t.status}`,
        icon: CheckSquare,
        run: () => {
          goTab('Minhas tarefas');
          setTimeout(() => window.dispatchEvent(new CustomEvent('copperos:open-task', { detail: { id: t.id } })), 50);
        },
      }));

    const q = query.trim().toLowerCase();
    if (!q) return nav;
    return [...nav, ...taskItems]
      .filter(i => i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, tasks, isManager, isTiRole, isHigherRole, floorMode]);

  if (!open) return null;

  const run = (item?: PaletteItem) => {
    if (!item) return;
    item.run();
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-start justify-center pt-[12vh] px-4" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-xl bg-white dark:bg-night-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-night-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-night-800">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor(c => Math.min(c + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor(c => Math.max(c - 1, 0));
              } else if (e.key === 'Enter') {
                run(items[cursor]);
              }
            }}
            placeholder="Buscar telas, ações ou tarefas..."
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-night-800 text-gray-500">ESC</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 && <li className="px-3 py-6 text-center text-xs text-gray-400">Nada encontrado.</li>}
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onMouseEnter={() => setCursor(idx)}
                  onClick={() => run(item)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left cursor-pointer ${
                    idx === cursor ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0 opacity-70" />
                    <span className="text-xs font-semibold truncate">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-gray-400 truncate max-w-[160px]">{item.hint}</span>
                    {idx === cursor && <CornerDownLeft className="w-3.5 h-3.5 opacity-60" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
