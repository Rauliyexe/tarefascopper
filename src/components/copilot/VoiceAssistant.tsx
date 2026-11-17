import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Settings,
} from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import { useTasks } from '../../context/TasksContext';
import { soundEngine } from '../../services/soundEngine';
import { voiceEngine } from '../../services/speechService';
import { aiCopilotService, CopilotAction, CopilotContext } from '../../services/aiCopilotService';
import { PlasmaRing } from './PlasmaRing';

type Phase = 'off' | 'standby' | 'listening' | 'thinking' | 'speaking' | 'error';

const FOLLOW_UP_WINDOW_MS = 14000;
const REPLIES_STORAGE_KEY = 'copper_voice_replies';

/**
 * Modelos de saudações ricas e variadas quando o usuário diz "Ei Copper" / "Ok Copper".
 */
const WAKE_GREETING_TEMPLATES = [
  (name: string, _time: string) => `Como vai, ${name}? Como posso te ajudar?`,
  (name: string, time: string) => `${time}, ${name}! Pronto para operar. O que você precisa?`,
  (name: string, _time: string) => `Ouvindo, ${name}. Qual é o comando agora?`,
  (name: string, _time: string) => `Às ordens, ${name}! O que deseja consultar ou abrir?`,
  (name: string, _time: string) => `Fala, ${name}! Como posso acelerar suas tarefas hoje?`,
  (name: string, time: string) => `${time}, ${name}! Sistema a postos. Pode falar.`,
  (name: string, _time: string) => `Estou aqui, ${name}. Qual é a prioridade da fábrica agora?`,
  (name: string, _time: string) => `Copper ativo, ${name}. Em que posso te ajudar?`,
  (name: string, _time: string) => `Pronto, ${name}! Diga o que precisa conferir.`,
];

function getRandomWakeGreeting(name: string): string {
  const h = new Date().getHours();
  const time = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const generator = WAKE_GREETING_TEMPLATES[Math.floor(Math.random() * WAKE_GREETING_TEMPLATES.length)];
  return generator(name, time);
}

export const VoiceAssistant: React.FC = () => {
  const ctx = useCopperOS();
  const { tasks, createTask } = useTasks();
  const {
    user,
    isAuthenticated,
    isCopilotVoiceOpen,
    setIsCopilotVoiceOpen,
    isWakeWordListening,
    setIsWakeWordListening,
    setIsSettingsOpen,
    setIsCompanySelectorOpen,
    setIsFechamentoModalOpen,
    toggleTheme,
    soundEnabled,
  } = ctx;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'Minhas tarefas';

  const [phase, setPhase] = useState<Phase>('off');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [hint, setHint] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [repliesOn, setRepliesOn] = useState(() => {
    try {
      return localStorage.getItem(REPLIES_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  const phaseRef = useRef<Phase>('off');
  const setPhaseSafe = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const isActive = (p: Phase) =>
    p === 'listening' || p === 'thinking' || p === 'speaking' || p === 'error';

  // Mantém refs atualizadas para que listeners enxerguem estado recente
  const latest = useRef({
    ctx,
    tasks,
    createTask,
    currentTab,
    soundEnabled,
    repliesOn,
    isWakeWordListening,
    isCopilotVoiceOpen,
  });
  latest.current = {
    ctx,
    tasks,
    createTask,
    currentTab,
    soundEnabled,
    repliesOn,
    isWakeWordListening,
    isCopilotVoiceOpen,
  };

  const collapse = useCallback(() => {
    voiceEngine.standby();
    voiceEngine.setSuppressed(false);
    aiCopilotService.stopSpeaking();
    setTranscript('');
    setReply('');
    setHint('');
    setManualInput('');
    setIsCopilotVoiceOpen(false);
    if (soundEnabled) soundEngine.playStandby();

    if (latest.current.isWakeWordListening) {
      setPhaseSafe('standby');
    } else {
      voiceEngine.stop();
      setPhaseSafe('off');
    }
  }, [setIsCopilotVoiceOpen, soundEnabled]);

  const executeAction = useCallback(
    (action: CopilotAction) => {
      const c = latest.current.ctx;
      switch (action.type) {
        case 'NAVIGATE_TAB':
          if (action.payload?.tab) {
            setIsSettingsOpen(false);
            setSearchParams({ tab: action.payload.tab });
          }
          break;
        case 'SWITCH_COMPANY':
          if (action.payload?.companyId) {
            c.setCurrentCompanyId(action.payload.companyId);
            if (action.payload.branchId) {
              c.setActiveBranchId(action.payload.branchId);
            }
          }
          break;
        case 'SWITCH_BRANCH':
          if (action.payload?.branchId) {
            if (action.payload.companyId) {
              c.setCurrentCompanyId(action.payload.companyId);
            }
            c.setActiveBranchId(action.payload.branchId);
          }
          break;
        case 'OPEN_CREATE_TASK':
          window.dispatchEvent(new CustomEvent('copperos:copilot-task-action', { detail: { isDaily: false } }));
          break;
        case 'OPEN_CREATE_ROUTINE':
          window.dispatchEvent(new CustomEvent('copperos:copilot-task-action', { detail: { isDaily: true } }));
          break;
        case 'CREATE_TASK_NOW':
          if (action.payload?.taskTitle) {
            const today = new Date().toISOString().split('T')[0];
            latest.current
              .createTask({
                title: action.payload.taskTitle,
                project: 'Operações',
                assignee: c.user.name || 'Você',
                dueDate: today,
                priority: 'Média',
                status: 'Pendente',
                companyId: c.currentCompanyId,
                assignedBy: `${c.user.name} (via Ei Copper)`,
              })
              .catch(err => console.error('[VoiceAssistant] Erro ao criar tarefa:', err));
          }
          break;
        case 'SWITCH_USER':
          if (action.payload?.userId) {
            c.switchUser(action.payload.userId);
          }
          break;
        case 'OPEN_SETTINGS':
          setIsSettingsOpen(true);
          setSearchParams({ tab: 'Configurações' });
          break;
        case 'OPEN_COMPANY_SELECTOR':
          setIsCompanySelectorOpen(true);
          break;
        case 'OPEN_FECHAMENTO_MODAL':
          setIsFechamentoModalOpen(true);
          if (action.payload?.startVoiceWizard) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('copperos:start-voice-report-wizard'));
            }, 900);
          }
          break;
        case 'TOGGLE_THEME':
          toggleTheme();
          break;
        default:
          break;
      }
    },
    [setSearchParams, setIsSettingsOpen, setIsCompanySelectorOpen, setIsFechamentoModalOpen, toggleTheme]
  );

  const enterFollowUp = useCallback(() => {
    if (!isActive(phaseRef.current)) return;
    setPhaseSafe('listening');
    setTranscript('');
    setHint('Estou ouvindo... (pode falar outro comando ou perguntar algo)');
    voiceEngine.activate(FOLLOW_UP_WINDOW_MS);
  }, []);

  /** Permite interromper a fala do Copper clicando no globo e já começar a falar imediatamente */
  const interruptAndListen = useCallback(() => {
    aiCopilotService.stopSpeaking();
    voiceEngine.setSuppressed(false);
    setPhaseSafe('listening');
    setTranscript('');
    setHint('Estou ouvindo... (pode falar seu comando)');
    voiceEngine.activate(FOLLOW_UP_WINDOW_MS);
  }, []);

  const handleCommand = useCallback(
    async (text: string) => {
      const {
        ctx: c,
        tasks: currentTasks,
        currentTab: tab,
        soundEnabled: snd,
        repliesOn: speak,
      } = latest.current;

      setTranscript(text);
      setHint('');
      setPhaseSafe('thinking');

      const copilotCtx: CopilotContext = {
        user: c.user,
        currentCompany: c.currentCompany,
        activeBranch: c.activeBranch,
        companies: c.companies,
        tasks: currentTasks,
        activeTab: tab,
      };

      const response = aiCopilotService.processQuery(text, copilotCtx);

      if (response.executedAction) {
        executeAction(response.executedAction);
        if (snd) soundEngine.playSuccess();
      }

      const spokenText = response.replyText.replace(/[*_#`]/g, '');
      setReply(spokenText);
      setPhaseSafe('speaking');

      // Se for ação que abre modal ou muda de tela diretamente, fecha o assistente suavemente após responder
      const isExitAction =
        response.executedAction?.type === 'NAVIGATE_TAB' ||
        response.executedAction?.type === 'SWITCH_COMPANY' ||
        response.executedAction?.type === 'SWITCH_BRANCH' ||
        response.executedAction?.type === 'OPEN_CREATE_TASK' ||
        response.executedAction?.type === 'OPEN_CREATE_ROUTINE' ||
        response.executedAction?.type === 'OPEN_COMPANY_SELECTOR' ||
        response.executedAction?.type === 'OPEN_SETTINGS' ||
        response.executedAction?.type === 'OPEN_FECHAMENTO_MODAL';

      if (speak && snd) {
        voiceEngine.setSuppressed(true);
        aiCopilotService.speakText(spokenText, () => {
          voiceEngine.setSuppressed(false);
          if (isExitAction) {
            setTimeout(collapse, 600);
          } else {
            enterFollowUp();
          }
        });
      } else {
        setTimeout(() => {
          if (isExitAction) {
            collapse();
          } else {
            enterFollowUp();
          }
        }, 2200);
      }
    },
    [executeAction, enterFollowUp, collapse]
  );

  // Conecta os eventos do motor de voz contínuo
  useEffect(() => {
    voiceEngine.setHandlers({
      onWake: (immediateCommand?: string) => {
        aiCopilotService.stopSpeaking();
        if (latest.current.soundEnabled) soundEngine.playWake();
        setTranscript('');
        setIsCopilotVoiceOpen(true);

        // Se o usuário já falou o comando na mesma frase (ex: "Ei Copper, me leva ao Kanban"):
        if (immediateCommand && immediateCommand.trim().length > 1) {
          handleCommand(immediateCommand.trim());
          return;
        }

        // Se falou apenas a palavra de ativação:
        const currentName = latest.current.ctx.user?.name;
        const namePart = currentName
          ? currentName.toLowerCase().includes('andre')
            ? 'André'
            : currentName.split(' ')[0]
          : 'você';
        const greeting = getRandomWakeGreeting(namePart);
        setReply(greeting);
        setPhaseSafe('speaking');

        if (latest.current.repliesOn && latest.current.soundEnabled) {
          voiceEngine.setSuppressed(true);
          aiCopilotService.speakText(greeting, () => {
            voiceEngine.setSuppressed(false);
            if (phaseRef.current === 'speaking') {
              setPhaseSafe('listening');
              setHint('Estou ouvindo... (pode falar seu comando)');
              voiceEngine.activate(FOLLOW_UP_WINDOW_MS);
            }
          });
        } else {
          setTimeout(() => {
            if (phaseRef.current === 'speaking') {
              setPhaseSafe('listening');
              setHint('Estou ouvindo... (pode falar seu comando)');
              voiceEngine.activate(FOLLOW_UP_WINDOW_MS);
            }
          }, 1500);
        }
      },
      onInterim: (text) => {
        aiCopilotService.stopSpeaking();
        setTranscript(text);
        setHint('');
        if (phaseRef.current !== 'listening') setPhaseSafe('listening');
      },
      onCommand: (text) => {
        aiCopilotService.stopSpeaking();
        if (latest.current.soundEnabled) soundEngine.playThinking();
        handleCommand(text);
      },
      onTimeout: () => {
        if (phaseRef.current === 'thinking' || phaseRef.current === 'speaking') return;
        collapse();
      },
      onError: (kind, message) => {
        setReply(message);
        setTranscript('');
        setHint(kind === 'permission' ? 'Microfone bloqueado no navegador' : 'Voz indisponível');
        setPhaseSafe('error');
        setIsCopilotVoiceOpen(true);
        setTimeout(() => {
          if (phaseRef.current === 'error') {
            setIsCopilotVoiceOpen(false);
            if (kind === 'permission') {
              setIsWakeWordListening(false);
              setPhaseSafe('off');
            } else {
              setPhaseSafe('standby');
            }
          }
        }, 5000);
      },
    });
  }, [handleCommand, collapse, setIsCopilotVoiceOpen, setIsWakeWordListening]);

  // Escuta contínua: inicia ou pausa o microfone conforme configuração
  useEffect(() => {
    if (isAuthenticated && isWakeWordListening) {
      if (voiceEngine.start() && !isActive(phaseRef.current)) {
        setPhaseSafe('standby');
      }
    } else if (!isActive(phaseRef.current)) {
      voiceEngine.stop();
      setPhaseSafe('off');
    }
  }, [isAuthenticated, isWakeWordListening]);

  // Desliga se deslogar
  useEffect(() => {
    if (!isAuthenticated) {
      voiceEngine.stop();
      aiCopilotService.stopSpeaking();
      setPhaseSafe('off');
    }
    return () => {
      voiceEngine.stop();
    };
  }, [isAuthenticated]);

  // Ativação manual (clique no pill ou atalho de teclado)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isCopilotVoiceOpen && !isActive(phaseRef.current)) {
      aiCopilotService.stopSpeaking();
      setTranscript('');
      const currentName = latest.current.ctx.user?.name;
      const namePart = currentName
        ? currentName.toLowerCase().includes('andre')
          ? 'André'
          : currentName.split(' ')[0]
        : 'você';
      const greeting = getRandomWakeGreeting(namePart);
      setReply(greeting);
      setPhaseSafe('speaking');
      if (soundEnabled) soundEngine.playPop();

      if (latest.current.repliesOn && latest.current.soundEnabled) {
        voiceEngine.setSuppressed(true);
        aiCopilotService.speakText(greeting, () => {
          voiceEngine.setSuppressed(false);
          if (phaseRef.current === 'speaking') {
            setPhaseSafe('listening');
            setHint('Estou ouvindo... (pode falar ou perguntar algo)');
            voiceEngine.activate(FOLLOW_UP_WINDOW_MS);
          }
        });
      } else {
        setTimeout(() => {
          if (phaseRef.current === 'speaking') {
            setPhaseSafe('listening');
            setHint('Estou ouvindo... (pode falar ou perguntar algo)');
            voiceEngine.activate(FOLLOW_UP_WINDOW_MS);
          }
        }, 1500);
      }
    } else if (!isCopilotVoiceOpen && isActive(phaseRef.current)) {
      collapse();
    }
  }, [isCopilotVoiceOpen, isAuthenticated, collapse, soundEnabled]);

  // Tecla Escape para fechar
  useEffect(() => {
    if (!isActive(phase)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') collapse();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, collapse]);

  if (!isAuthenticated) return null;

  // ── ESTADO 1: Desligado / Escuta Pausada (Botão flutuante discreto no canto inferior direito) ──
  if (phase === 'off' && !isCopilotVoiceOpen) {
    return (
      <div className="fixed bottom-5 right-5 sm:right-6 z-40 print:hidden select-none">
        <button
          type="button"
          onClick={async () => {
            const ok = await voiceEngine.requestPermission();
            if (ok) {
              if (soundEnabled) soundEngine.playWake();
              setIsWakeWordListening(true);
            } else {
              if (soundEnabled) soundEngine.playError();
              alert(
                'Acesso ao microfone bloqueado no navegador. Permita o microfone no ícone de configurações ao lado do endereço do site.'
              );
            }
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900/80 dark:bg-night-950/80 backdrop-blur-md border border-slate-700/50 dark:border-white/10 text-slate-300 hover:text-white hover:border-emerald-500/50 transition-all shadow-lg cursor-pointer group"
          title="Clique para ativar a detecção da voz 'Ei Copper'"
        >
          <span className="w-2 h-2 rounded-full bg-slate-500 group-hover:bg-emerald-400 transition-colors" />
          <span className="text-xs font-semibold">“Ei Copper”</span>
          <Mic className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
        </button>
      </div>
    );
  }

  // ── ESTADO 2: Em Espera (Pílula discreta no canto inferior direito) ──
  if (phase === 'standby') {
    return (
      <div className="fixed bottom-5 right-5 sm:right-6 z-40 print:hidden select-none group">
        <div className="flex items-center gap-2 pl-3.5 pr-1.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-night-950/90 backdrop-blur-md border border-emerald-500/30 dark:border-emerald-500/25 text-slate-200 shadow-xl transition-all hover:border-emerald-500">
          <button
            type="button"
            onClick={() => setIsCopilotVoiceOpen(true)}
            className="flex items-center gap-2 text-xs font-semibold tracking-wide hover:text-white cursor-pointer shrink-0"
            title="Ouvindo a palavra de ativação 'Ei Copper'. Clique para falar agora."
          >
            <span className="relative flex w-2.5 h-2.5 shrink-0">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </span>
            <span>“Ei Copper”</span>
          </button>

          <button
            type="button"
            onClick={() => setIsWakeWordListening(false)}
            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
            title="Desligar escuta contínua"
          >
            <MicOff className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  // ── ESTADO 3: Ativo (Globo 3D/Canvas Flutuante + Transcrição + Resposta) ──
  const isSpeaking = phase === 'speaking';
  const isListening = phase === 'listening';
  const isThinking = phase === 'thinking';
  const isError = phase === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 sm:bottom-6 z-50 pointer-events-none flex flex-col items-center justify-end px-2 sm:px-4 pb-4 select-none"
    >
      {/* Backdrop transparente/escurecido para foco limpo */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-300"
        onClick={collapse}
      />

      {/* Conteúdo Flutuante que Emerge de Baixo */}
      <div className="relative z-10 pointer-events-auto flex flex-col items-center text-center max-w-2xl w-full px-2 animate-voice-rise my-auto sm:my-0">
        {/* Globo PlasmaRing Flutuante (clique interrompe a fala e escuta imediatamente) */}
        <div
          onClick={() => {
            if (isSpeaking || isError) interruptAndListen();
          }}
          title={isSpeaking ? 'Clique para interromper e falar agora' : 'Copper Assistente'}
          className="animate-float-levitate relative flex items-center justify-center cursor-pointer mb-2 shrink-0"
        >
          <div className="w-[170px] h-[170px] sm:w-[220px] sm:h-[220px] aspect-square transition-all duration-300 relative flex items-center justify-center">
            <PlasmaRing
              phase={phase}
              isSpeaking={isSpeaking}
              speed={isSpeaking ? 1.4 : isThinking ? 1.8 : 0.9}
              interactive={true}
              width="100%"
              height="100%"
            />
          </div>
        </div>

        {/* Status Indicador */}
        <div className="flex items-center justify-center mb-1.5 shrink-0">
          {isSpeaking && (
            <button
              type="button"
              onClick={interruptAndListen}
              className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-cyan-400 hover:text-emerald-400 uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] cursor-pointer transition-colors"
              title="Clique para pular a fala e falar seu comando"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Copper Respondendo · <span className="underline underline-offset-2 text-[10px] opacity-85">Falar agora</span>
            </button>
          )}
          {isThinking && (
            <span className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-amber-400 uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Processando Comando
            </span>
          )}
          {isListening && (
            <span className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-emerald-400 uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Ouvindo {user.name ? user.name.split(' ')[0] : 'Você'}
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-rose-400 uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Não Compreendido
            </span>
          )}
        </div>

        {/* Transcrição e Resposta da IA */}
        <div className="flex flex-col items-center justify-center max-w-xl px-2 shrink-0">
          {isSpeaking ? (
            <>
              <p className="text-base sm:text-xl font-medium text-white tracking-wide leading-relaxed drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] max-h-[22vh] overflow-y-auto">
                {reply}
              </p>
              {transcript && (
                <p className="text-xs sm:text-sm text-slate-300/80 italic mt-1.5 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] max-w-md line-clamp-2">
                  “{transcript}”
                </p>
              )}
            </>
          ) : isThinking ? (
            <>
              <p className="text-sm sm:text-lg font-medium text-slate-200 tracking-wide italic drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
                “{transcript || 'Interpretando intenção...'}”
              </p>
              <p className="text-xs text-slate-400/90 mt-1 tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                Consultando banco de dados de tarefas e rotinas...
              </p>
            </>
          ) : isListening ? (
            <>
              <p className="text-base sm:text-xl font-medium text-white tracking-wide leading-relaxed drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] max-h-[20vh] overflow-y-auto">
                {transcript || (hint || 'Pode falar... Estou ouvindo.')}
              </p>
              {!transcript && (
                <p className="text-xs text-slate-300/70 mt-1.5 tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                  Fale algo como “abrir Kanban”, “como estão as tarefas?”, “calibração de balanças” ou “mudar filial”
                </p>
              )}
            </>
          ) : (
            <p className="text-sm sm:text-base font-medium text-slate-300 drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
              {reply || 'Não foi possível processar. Tente falar novamente.'}
            </p>
          )}
        </div>

        {/* Barra de Opções Minimalista */}
        <div className="flex items-center justify-center gap-2 mt-4 p-1 rounded-full bg-night-950/80 backdrop-blur-lg border border-white/10 shadow-lg text-slate-400 shrink-0">
          {/* Voz / Mudo */}
          <button
            type="button"
            onClick={() => {
              if (repliesOn) aiCopilotService.stopSpeaking();
              const next = !repliesOn;
              setRepliesOn(next);
              try {
                localStorage.setItem(REPLIES_STORAGE_KEY, String(next));
              } catch {
                // noop
              }
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${repliesOn
                ? 'text-emerald-400 hover:bg-emerald-500/15'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/10'
              }`}
            title={repliesOn ? 'Respostas por voz ativas' : 'Voz silenciada'}
          >
            {repliesOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Escuta Contínua */}
          <button
            type="button"
            onClick={() => {
              const next = !isWakeWordListening;
              setIsWakeWordListening(next);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${isWakeWordListening
                ? 'text-emerald-400 hover:bg-emerald-500/15'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/10'
              }`}
            title={isWakeWordListening ? 'Escuta ativa ("Ei Copper")' : 'Escuta contínua pausada'}
          >
            {isWakeWordListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Configurações */}
          <button
            type="button"
            onClick={() => {
              collapse();
              setIsSettingsOpen(true);
              setSearchParams({ tab: 'Configurações' });
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-amber-400 hover:bg-white/10 transition-all cursor-pointer"
            title="Abrir Configurações"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Fechar */}
          <button
            type="button"
            onClick={collapse}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
            title="Fechar assistente (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

