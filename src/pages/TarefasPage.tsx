import React, { useState } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ToastStack } from '../components/common/Toast';
import { CalendarioTab } from './tarefas/CalendarioTab';
import { KanbanTab } from './tarefas/KanbanTab';
import { ProjetosTab } from './tarefas/ProjetosTab';
import { ReassignModal } from './tarefas/ReassignModal';
import { RotinasTab } from './tarefas/RotinasTab';
import {
  CheckSquare,
  Download,
  Repeat,
  Plus,
  SlidersHorizontal,
  HardHat,
} from 'lucide-react';
import { TarefasToolbar } from './tarefas/TarefasToolbar';
import { TaskFormModal } from './tarefas/TaskFormModal';
import { TaskDetailDrawer } from './tarefas/TaskDetailDrawer';
import { ConcluirTarefaModal } from './tarefas/ConcluirTarefaModal';
import { FeedbackModal } from './tarefas/FeedbackModal';
import { TaskTableTab } from './tarefas/TaskTableTab';
import { TarefasCompanionPanel } from './tarefas/TarefasCompanionPanel';
import { CalibracaoTab } from './tarefas/CalibracaoTab';
import { RelatorioDiarioTab } from './tarefas/RelatorioDiarioTab';
import { FiveMinuteBriefingDashboard } from '../components/reports/FiveMinuteBriefingDashboard';
import { useCopperOS } from '../context/CopperOSContext';
import { soundEngine } from '../services/soundEngine';
import { useTarefas } from './tarefas/useTarefas';
import { useFloorMode } from '../hooks/useFloorMode';

export const TarefasPage: React.FC = () => {
  const controller = useTarefas();
  const { user, setIsFechamentoModalOpen, bootstrapError } = useCopperOS();
  const { floorMode, toggleFloorMode } = useFloorMode();
  const [showCompanion, setShowCompanion] = useState<boolean>(false);

  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'CEO' || user.role === 'MANAGER';

  const renderActiveTab = () => {
    let content: React.ReactNode;
    if (controller.isLoading) {
      content = (
        <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-night-800">
            <div className="h-6 w-44 skeleton rounded-lg" />
            <div className="h-8 w-28 skeleton rounded-xl" />
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <div className="w-4 h-4 skeleton rounded" />
              <div className="h-4 flex-1 skeleton rounded" />
              <div className="h-4 w-28 skeleton rounded hidden sm:block" />
              <div className="h-4 w-20 skeleton rounded hidden md:block" />
              <div className="h-6 w-20 skeleton rounded-full" />
            </div>
          ))}
        </div>
      );
    } else {
      switch (controller.activeTab) {
        case 'Briefing 5 Min':
          content = <FiveMinuteBriefingDashboard />;
          break;
        case 'Rotinas Diárias':
          content = <RotinasTab controller={controller} />;
          break;
        case 'Calendário':
          content = <CalendarioTab controller={controller} />;
          break;
        case 'Projetos':
          content = <ProjetosTab controller={controller} />;
          break;
        case 'Kanban':
          content = <KanbanTab controller={controller} />;
          break;
        case 'Calibração':
          content = <CalibracaoTab />;
          break;
        case 'Relatório Diário':
          content = <RelatorioDiarioTab controller={controller} />;
          break;
        default:
          content = <TaskTableTab controller={controller} />;
          break;
      }
    }

    return (
      <div key={controller.activeTab} className="animate-fade-in w-full">
        {content}
      </div>
    );
  };

  const isFullWidthView =
    controller.activeTab === 'Briefing 5 Min' ||
    controller.activeTab === 'Kanban' ||
    controller.activeTab === 'Calendário' ||
    controller.activeTab === 'Calibração' ||
    controller.activeTab === 'Relatório Diário' ||
    controller.activeTab === 'Projetos';

  return (
    <div className="space-y-5 font-sans pb-12 w-full">
      {/* Alerta de Modo Chão de Fábrica */}
      {floorMode && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-medium flex items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <HardHat className="w-4 h-4" />
            </div>
            <span className="truncate">
              <strong>Modo Chão de Fábrica Ativo:</strong> Interface com botões de 44px e tipografia ampliada para operação móvel / luvas.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playSwitch();
              toggleFloorMode();
            }}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer shrink-0 transition-colors shadow-2xs"
          >
            Voltar ao normal
          </button>
        </div>
      )}


      {/* ── Cabeçalho Enxuto de Tarefas (Oculto em Relatórios e Briefing) ── */}
      {controller.activeTab !== 'Relatório Diário' && controller.activeTab !== 'Briefing 5 Min' && (
        <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl px-5 py-3.5 shadow-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h1 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                {controller.activeTab === 'Minhas tarefas' ? 'Minhas Tarefas' : controller.activeTab}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                {controller.filteredTasks.length} {controller.filteredTasks.length === 1 ? 'tarefa' : 'tarefas'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {isManagerOrAdmin && (
              <button
                onClick={controller.exportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-night-850 border border-gray-200 dark:border-night-800 hover:border-emerald-500 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors shadow-xs cursor-pointer"
                title="Exportar tarefas para CSV"
              >
                <Download className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                <span>CSV</span>
              </button>
            )}

            {isManagerOrAdmin && (
              <button
                onClick={() => setShowCompanion(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  showCompanion
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-white dark:bg-night-850 border-gray-200 dark:border-night-800 text-gray-700 dark:text-gray-300 hover:border-emerald-500'
                }`}
                title="Alternar painel lateral de métricas"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Insights</span>
              </button>
            )}

            {isManagerOrAdmin && (
              <button
                onClick={() => controller.openCreate(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="Criar rotina diária recorrente"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>+ Rotina</span>
              </button>
            )}

            <button
              onClick={() => controller.openCreate(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Tarefa</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Área Principal dos Submódulos (100% Widescreen para Kanban e Telas Cheias) ── */}
      {isFullWidthView && !showCompanion ? (
        // Visão Ampla 100% da Largura (Kanban, Calendário, etc. com espaço total para respirar)
        <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl shadow-xs overflow-hidden transition-colors w-full">
          {controller.activeTab === 'Kanban' && (
            <TarefasToolbar
              search={controller.search}
              onSearchChange={controller.changeSearch}
              statusFilter={controller.statusFilter}
              onStatusFilterChange={controller.changeStatusFilter}
              priorityFilter={controller.priorityFilter}
              onPriorityFilterChange={controller.changePriorityFilter}
              isFilterOpen={controller.isFilterOpen}
              onToggleFilters={() => controller.setIsFilterOpen(prev => !prev)}
              onClearFilters={controller.clearFilters}
            />
          )}
          <div className="p-4 sm:p-5">{renderActiveTab()}</div>
        </div>
      ) : (
        // Grid com Coluna Lateral Contextual (quando o usuário ativa Insights ou na Tabela)
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start w-full">
          <div className={showCompanion ? 'xl:col-span-8 space-y-6' : 'xl:col-span-12 space-y-6'}>
            <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl shadow-xs overflow-hidden transition-colors">
              <TarefasToolbar
                search={controller.search}
                onSearchChange={controller.changeSearch}
                statusFilter={controller.statusFilter}
                onStatusFilterChange={controller.changeStatusFilter}
                priorityFilter={controller.priorityFilter}
                onPriorityFilterChange={controller.changePriorityFilter}
                isFilterOpen={controller.isFilterOpen}
                onToggleFilters={() => controller.setIsFilterOpen(prev => !prev)}
                onClearFilters={controller.clearFilters}
              />
              {renderActiveTab()}
            </div>
          </div>

          {/* Painel Lateral Contextual de Apoio */}
          {showCompanion && (
            <div className="xl:col-span-4">
              <TarefasCompanionPanel controller={controller} />
            </div>
          )}
        </div>
      )}

      {/* Drawer Lateral de Detalhes e Modais de Ação */}
      <TaskDetailDrawer controller={controller} />
      <TaskFormModal controller={controller} />
      <ReassignModal controller={controller} />

      <ConcluirTarefaModal
        task={controller.completingTask}
        isOpen={!!controller.completingTask}
        onClose={controller.closeCompleteModal}
        onConfirm={controller.confirmComplete}
      />

      <FeedbackModal
        task={controller.feedbackTask}
        isOpen={!!controller.feedbackTask}
        onClose={controller.closeFeedback}
        onAddComment={controller.submitFeedback}
      />

      <ConfirmDialog
        isOpen={!!controller.pendingDelete}
        title="Excluir tarefa"
        message={
          <>
            A tarefa <strong>{controller.pendingDelete?.title}</strong> ({controller.pendingDelete?.project}) será
            removida do quadro. Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        onConfirm={controller.confirmDelete}
        onCancel={() => controller.setPendingDelete(null)}
      />

      <ToastStack toasts={controller.toasts} onDismiss={controller.dismissToast} />
    </div>
  );
};

export default TarefasPage;
