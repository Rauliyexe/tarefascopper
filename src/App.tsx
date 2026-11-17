import React, { useState } from 'react';
import { BrowserRouter, useSearchParams } from 'react-router-dom';
import { CopperOSProvider, useCopperOS } from './context/CopperOSContext';
import { TasksProvider } from './context/TasksContext';
import { Sidebar } from './components/layout/Sidebar';
import { StandaloneNavbar } from './components/layout/StandaloneNavbar';
import { TarefasPage } from './pages/TarefasPage';
import { FechamentoExpedienteModal } from './pages/tarefas/FechamentoExpedienteModal';

// P1 — Carregamento sob demanda (code-splitting) da página pesada de configurações
const ConfiguracoesPage = React.lazy(() => import('./pages/ConfiguracoesPage'));
import { LoginScreen } from './components/auth/LoginScreen';
import { CompanyBranchSelectorModal } from './components/common/CompanyBranchSelectorModal';
import { VoiceAssistant } from './components/copilot/VoiceAssistant';
import { CommandPalette } from './components/common/CommandPalette';
import { ShiftReminderBanner } from './components/common/ShiftReminderBanner';

const AppContent: React.FC = () => {
  const {
    isAuthenticated,
    isFechamentoModalOpen,
    setIsFechamentoModalOpen,
    isSettingsOpen,
  } = useCopperOS();

  const [searchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Se não estiver autenticado, exibe a tela de login
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const showConfiguracoesPage = isSettingsOpen || searchParams.get('tab') === 'Configurações';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-night-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200">
      {/* Barra Lateral com todos os submódulos */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Conteúdo Principal Widescreen */}
      <div className="lg:pl-72 flex flex-col flex-1 min-w-0 transition-all duration-200">
        <StandaloneNavbar onToggleSidebar={() => setIsSidebarOpen(prev => !prev)} />
        <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 py-6">
          <ShiftReminderBanner />
          <React.Suspense fallback={<div className="p-8 skeleton h-96 w-full rounded-2xl" />}>
            {showConfiguracoesPage ? <ConfiguracoesPage /> : <TarefasPage />}
          </React.Suspense>
        </main>
      </div>

      {/* Busca Rápida Global (Ctrl+K) */}
      <CommandPalette />

      {/* Modal de Fechamento de Expediente */}
      <FechamentoExpedienteModal
        isOpen={isFechamentoModalOpen}
        onClose={() => setIsFechamentoModalOpen(false)}
      />

      {/* Modal de Escolha de Empresa e Filiais */}
      <CompanyBranchSelectorModal />

      {/* Assistente de Voz Contínuo "Ei Copper" (retângulo inferior) */}
      <VoiceAssistant />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <CopperOSProvider>
        <TasksProvider>
          <AppContent />
        </TasksProvider>
      </CopperOSProvider>
    </BrowserRouter>
  );
};

export default App;
