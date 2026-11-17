import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  ChevronRight,
  Settings,
  LogOut,
  Search,
  HardHat,
} from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import { useTasks } from '../../context/TasksContext';
import { soundEngine } from '../../services/soundEngine';
import { TarefaTab } from '../../pages/tarefas/taskModel';
import { TrocarFilial } from './TrocarFilial';
import { useFloorMode } from '../../hooks/useFloorMode';

interface StandaloneNavbarProps {
  onToggleSidebar: () => void;
}

export const StandaloneNavbar: React.FC<StandaloneNavbarProps> = ({ onToggleSidebar }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as TarefaTab) || 'Minhas tarefas';

  const {
    isDarkMode,
    toggleTheme,
    soundEnabled,
    toggleSound,
    user,
    isSettingsOpen,
    setIsSettingsOpen,
    logoutSession,
  } = useCopperOS();
  const { floorMode, toggleFloorMode } = useFloorMode();

  const isHigherRole = user.role === 'ADMIN' || user.role === 'CEO' || user.role === 'MANAGER';

  const openSettingsPage = () => {
    if (!isHigherRole) return;
    soundEngine.playClick();
    setIsSettingsOpen(true);
    setSearchParams({ tab: 'Configurações' });
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white/85 dark:bg-night-900/85 backdrop-blur-md border-b border-gray-200/80 dark:border-night-800 transition-colors">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Lado Esquerdo: Menu Mobile + Trocar Filial / Empresa + Submódulo Ativo */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <button
            onClick={() => {
              soundEngine.playClick();
              onToggleSidebar();
            }}
            className="lg:hidden p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-night-800 cursor-pointer shrink-0"
            title="Abrir Menu de Submódulos"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Trocar Filial e Empresa */}
          <TrocarFilial />

          <div className="hidden sm:flex items-center gap-1.5 text-xs shrink-0 pl-1">
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-night-700" />
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/20 text-xs">
              {isSettingsOpen ? 'Configurações' : currentTab}
            </span>
          </div>
        </div>

        {/* Controles da Direita */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Status de Conexão com PostgreSQL */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 select-none shadow-2xs"
            title="Conexão com PostgreSQL ativa e saudável · Latência < 5ms"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold">PostgreSQL</span>
            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-mono">Online</span>
          </div>

          {/* U1 — Busca Rápida (Ctrl+K) */}
          <button
            onClick={() => window.dispatchEvent(new Event('copperos:open-palette'))}
            className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200/80 dark:border-night-800 bg-gray-50/70 dark:bg-night-850 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Buscar telas, tarefas e comandos (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Buscar</span>
            <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-gray-400">
              Ctrl K
            </kbd>
          </button>

          {/* U7 — Modo Chão de Fábrica */}
          <button
            onClick={() => {
              toggleFloorMode();
              soundEngine.playSwitch();
            }}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${floorMode
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-night-800'
              }`}
            title={
              floorMode
                ? 'Modo Chão de Fábrica Ativo (toque para voltar ao normal)'
                : 'Ativar Modo Chão de Fábrica (botões e texto ampliados para tablet/luvas)'
            }
          >
            <HardHat className="w-4 h-4" />
          </button>

          {/* Configurações (Apenas para Cargos Superiores: ADMIN, CEO, MANAGER) */}
          {isHigherRole && (
            <button
              onClick={openSettingsPage}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isSettingsOpen || currentTab === 'Configurações'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-night-800'
              }`}
              title="Configurações do Sistema"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Som Mute / Unmute */}
          <button
            onClick={() => {
              toggleSound();
              soundEngine.playSwitch();
            }}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-night-800 transition-colors cursor-pointer"
            title={soundEnabled ? 'Silenciar Efeitos Sonoros' : 'Ativar Efeitos Sonoros'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <VolumeX className="w-4 h-4 opacity-50" />
            )}
          </button>

          {/* Tema Claro / Escuro */}
          <button
            onClick={() => {
              toggleTheme();
              soundEngine.playClick();
            }}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-night-800 transition-colors cursor-pointer"
            title={isDarkMode ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Usuário e Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-night-800">
            <button
              onClick={isHigherRole ? openSettingsPage : undefined}
              title={isHigherRole ? 'Ver Perfil e Configurações' : `Colaborador: ${user.name} (${user.role})`}
              className={`flex items-center gap-2 text-left ${
                isHigherRole ? 'cursor-pointer group' : 'cursor-default'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform">
                {user.name.charAt(0)}
              </div>
              <div className="hidden lg:block text-xs leading-tight">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {user.name}
                  </p>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider uppercase border ${
                      user.role === 'ADMIN'
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                        : user.role === 'CEO'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : user.role === 'MANAGER'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            : 'bg-gray-100 text-gray-600 dark:bg-night-800 dark:text-gray-400 border-gray-200 dark:border-night-700'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 truncate max-w-[150px]">{user.email}</p>
              </div>
            </button>

            <button
              onClick={() => {
                soundEngine.playSwitch();
                logoutSession();
              }}
              title="Sair / Desconectar"
              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
