import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckSquare,
  Users,
  LayoutGrid,
  FolderKanban,
  Calendar,
  Repeat,
  ClipboardList,
  Scale,
  Mic,
  X,
  ChevronRight,
  Sparkles,
  Settings,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import { useTasks } from '../../context/TasksContext';
import { soundEngine } from '../../services/soundEngine';
import { TarefaTab } from '../../pages/tarefas/taskModel';
import { dateKey } from '../../domain/recurrence';

interface SidebarItem {
  id: string;
  tab: TarefaTab;
  label: string;
  icon: React.ElementType;
  description?: string;
  badge?: string;
  badgeTone?: 'danger' | 'warning' | 'neutral' | 'success' | string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as TarefaTab) || 'Minhas tarefas';

  const {
    setIsFechamentoModalOpen,
    setIsCompanySelectorOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    logoutSession,
    user,
    currentCompany,
  } = useCopperOS();

  const isSettingsActive = isSettingsOpen || currentTab === 'Configurações';
  const { tasks } = useTasks();
  const today = useMemo(() => dateKey(new Date()), []);

  const myTasks = useMemo(() => {
    const uName = user.name?.trim().toLowerCase();
    const uEmail = user.email?.trim().toLowerCase();
    return tasks.filter(
      t =>
        !t.isDaily &&
        (t.assignee?.trim().toLowerCase() === uName ||
          t.assignee?.trim().toLowerCase() === uEmail)
    );
  }, [tasks, user]);

  const myOverdueCount = useMemo(
    () => myTasks.filter(t => t.status !== 'Concluída' && t.dueDate < today).length,
    [myTasks, today]
  );
  const myPendingCount = useMemo(
    () => myTasks.filter(t => t.status !== 'Concluída').length,
    [myTasks]
  );
  const teamPendingCount = useMemo(
    () => tasks.filter(t => !t.isDaily && t.status !== 'Concluída').length,
    [tasks]
  );

  const navigateToTab = (tab: TarefaTab) => {
    soundEngine.playTab();
    setIsSettingsOpen(tab === 'Configurações');
    setSearchParams({ tab });
    onClose();
  };

  const isManagerOrCeo = user.role === 'CEO' || user.role === 'MANAGER' || user.role === 'ADMIN';
  const isTiRole = user.role === 'ADMIN' || user.role === 'SUPERADMIN' || user.role === 'CEO';
  const isHigherRole = user.role === 'ADMIN' || user.role === 'CEO' || user.role === 'MANAGER';

  const tarefasItems: SidebarItem[] = [
    ...(isManagerOrCeo
      ? [
        {
          id: 'briefing-5min',
          tab: 'Briefing 5 Min' as TarefaTab,
          label: 'Briefing 5 Min',
          icon: Sparkles,
          badge: 'Executivo',
        },
      ]
      : []),
    {
      id: 'minhas',
      tab: 'Minhas tarefas',
      label: 'Minhas Tarefas',
      icon: CheckSquare,
      badge:
        myOverdueCount > 0
          ? `${myOverdueCount} atrasada${myOverdueCount > 1 ? 's' : ''}`
          : myPendingCount > 0
            ? String(myPendingCount)
            : undefined,
      badgeTone: myOverdueCount > 0 ? 'danger' : 'neutral',
    },
    ...(isManagerOrCeo
      ? [
        {
          id: 'equipe',
          tab: 'Equipe' as TarefaTab,
          label: 'Equipe',
          icon: Users,
          badge: teamPendingCount > 0 ? String(teamPendingCount) : undefined,
          badgeTone: 'neutral',
        },
      ]
      : []),
    {
      id: 'kanban',
      tab: 'Kanban',
      label: 'Quadro Kanban',
      icon: LayoutGrid,
    },
    {
      id: 'projetos',
      tab: 'Projetos',
      label: 'Projetos',
      icon: FolderKanban,
    },
    {
      id: 'calendario',
      tab: 'Calendário',
      label: 'Calendário',
      icon: Calendar,
    },
  ];

  const rotinasItems: SidebarItem[] = [
    {
      id: 'rotinas',
      tab: 'Rotinas Diárias',
      label: 'Rotinas Diárias',
      icon: Repeat,
    },
    {
      id: 'relatorio-diario',
      tab: 'Relatório Diário',
      label: 'Relatório Diário (RDO)',
      icon: ClipboardList,
    },
    {
      id: 'calibracao',
      tab: 'Calibração',
      label: 'Calibração de Balanças',
      icon: Scale,
    },
  ];

  const renderItem = (item: SidebarItem) => {
    const isActive = !isSettingsActive && currentTab === item.tab;
    const Icon = item.icon;

    const badgeClass =
      item.badgeTone === 'danger'
        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold'
        : item.badgeTone === 'neutral'
          ? 'bg-gray-100 dark:bg-night-800 text-gray-700 dark:text-gray-300 font-mono font-semibold'
          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold';

    return (
      <button
        key={item.id}
        onClick={() => navigateToTab(item.tab)}
        className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${isActive
          ? 'bg-emerald-600 text-white font-semibold shadow-sm shadow-emerald-600/25 dark:bg-emerald-500 dark:text-night-950'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-night-850 hover:text-gray-900 dark:hover:text-white'
          }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon
            className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${isActive
              ? 'text-white dark:text-night-950'
              : 'text-gray-400 dark:text-gray-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
              }`}
          />
          <span className="text-xs truncate font-medium">{item.label}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.badge && !isActive && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] tracking-tight ${badgeClass}`}>
              {item.badge}
            </span>
          )}
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-night-950 shrink-0" />
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      {/* Backdrop para mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Barra Lateral (Sidebar) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white dark:bg-night-900 border-r border-gray-200/80 dark:border-night-800 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
      >
        {/* Cabeçalho da Sidebar: Empresa e Filial clicável */}
        <div className="p-4 border-b border-gray-100 dark:border-night-800">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                soundEngine.playSwoosh();
                setIsCompanySelectorOpen(true);
              }}
              title="Clique para alternar Empresa e Filial"
              className="flex items-center gap-3 text-left group cursor-pointer p-1 -m-1 rounded-xl hover:bg-gray-50 dark:hover:bg-night-850 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/25 font-bold text-base group-hover:scale-105 transition-transform">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-gray-900 dark:text-white">
                    CopperOS
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Tarefas
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-400 truncate max-w-[155px] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-0.5">
                  <span className="truncate">{currentCompany.tradeName}</span>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                </p>
              </div>
            </button>

            {/* Fechar botão no mobile */}
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-night-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lista de Navegação dos Submódulos */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {/* Seção 1: Tarefas */}
          <div>
            <div className="px-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
                Gestão de Tarefas
              </span>
            </div>
            <div className="space-y-1">{tarefasItems.map(renderItem)}</div>
          </div>

          {/* Seção 2: Rotinas e Operações Industriais */}
          <div>
            <div className="px-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
                Chão de Fábrica & Rotinas
              </span>
            </div>
            <div className="space-y-1">{rotinasItems.map(renderItem)}</div>
          </div>

          {/* Botão de Fechamento de Expediente */}
          <div className="pt-1">
            <button
              onClick={() => {
                soundEngine.playClick();
                setIsFechamentoModalOpen(true);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent hover:from-emerald-500/25 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Registrar fechamento de expediente por voz ou texto"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Fechamento de Turno</span>
              </div>
              <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </button>
          </div>

          {/* Ações Globais do Sistema: TI & Configurações (Apenas para Cargos Superiores) */}
          {(isTiRole || isHigherRole) && (
            <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-night-800">
              {isTiRole && (
                <button
                  onClick={() => {
                    soundEngine.playTab();
                    setIsSettingsOpen(true);
                    setSearchParams({ tab: 'Configurações', section: 'ti-usuarios' });
                    onClose();
                  }}
                  SW className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${isSettingsActive && searchParams.get('section') === 'ti-usuarios'
                    ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/25'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-night-850 hover:text-gray-900 dark:hover:text-white font-medium'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShieldCheck
                      className={`w-4 h-4 shrink-0 ${isSettingsActive && searchParams.get('section') === 'ti-usuarios'
                        ? 'text-white'
                        : 'text-indigo-500'
                        }`}
                    />
                    <span className="text-xs truncate">Painel TI · Usuários</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    TI
                  </span>
                </button>
              )}

              {isHigherRole && (
                <button
                  onClick={() => navigateToTab('Configurações')}
                  className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer ${isSettingsActive && searchParams.get('section') !== 'ti-usuarios'
                    ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-600/25 dark:bg-emerald-500 dark:text-night-950 dark:shadow-emerald-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-night-850 hover:text-gray-900 dark:hover:text-white font-medium'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Settings
                      className={`w-4 h-4 shrink-0 ${isSettingsActive && searchParams.get('section') !== 'ti-usuarios'
                        ? 'text-white dark:text-night-950'
                        : 'text-gray-400'
                        }`}
                    />
                    <span className="text-xs truncate">Configurações</span>
                  </div>
                  {isSettingsActive && searchParams.get('section') !== 'ti-usuarios' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-night-950 shrink-0" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Rodapé da Sidebar: Usuário Ativo com Logout */}
        <div className="p-3 border-t border-gray-100 dark:border-night-800">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {user.name}
                </p>
                <p className="text-[10px] text-gray-400 truncate">{user.jobTitle || user.role}</p>
              </div>
            </div>

            <button
              onClick={() => {
                soundEngine.playSwitch();
                logoutSession();
              }}
              title="Sair / Encerrar Sessão"
              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
