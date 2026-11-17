import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Sparkles,
  Printer,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  Mail,
  Send,
  Volume2,
  VolumeX,
  Eye,
  ArrowLeft,
  ArrowRight,
  ListTodo,
  History,
  Building2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { useCopperOS } from '../../context/CopperOSContext';
import {
  fechamentoApi,
  FechamentoAnswerSnapshot,
  FechamentoExpedienteRecord,
} from '../../services/fechamentoApi';
import {
  DepartmentQuestionItem,
  MyQuestionnaireResponse,
  questionnaireApi,
} from '../../services/questionnaireApi';
import { soundEngine } from '../../services/soundEngine';
import { voiceEngine } from '../../services/speechService';
import { voiceTtsService } from '../../services/voiceTtsService';
import { TarefasController } from './useTarefas';
import { printHtmlDocument } from '../../utils/exportFile';

interface FechamentoExpedienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  controller?: TarefasController;
  onSuccess?: (record: FechamentoExpedienteRecord) => void;
}

type TurnoType = 'TURNO_A' | 'TURNO_B' | 'TURNO_C' | 'ADMINISTRATIVO';
type ModalTab = 'RELATORIO_HOJE' | 'MEUS_RELATORIOS';
type FormStep = 'FILL' | 'REVIEW' | 'SUBMITTED';

const FIELD_BASE =
  'w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed';

export const FechamentoExpedienteModal: React.FC<FechamentoExpedienteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentCompany, user } = useCopperOS();

  const [modalTab, setModalTab] = useState<ModalTab>('RELATORIO_HOJE');
  const [step, setStep] = useState<FormStep>('FILL');

  // Dados carregados de /api/questionnaires/my
  const [loadingQuestionnaire, setLoadingQuestionnaire] = useState<boolean>(false);
  const [questionnaireData, setQuestionnaireData] = useState<MyQuestionnaireResponse | null>(null);
  const [questions, setQuestions] = useState<DepartmentQuestionItem[]>([]);
  const [answersMap, setAnswersMap] = useState<Record<string, string>>({});
  const [inputMethodsMap, setInputMethodsMap] = useState<Record<string, 'text' | 'voice'>>({});
  const [observacoesAdicionais, setObservacoesAdicionais] = useState<string>('');

  // Campos de metadados do expediente
  const [turno, setTurno] = useState<TurnoType>('ADMINISTRATIVO');
  const [statusGeral, setStatusGeral] = useState<'REGULAR' | 'ATENCAO' | 'CRITICO'>('REGULAR');
  const [showTasksPanel, setShowTasksPanel] = useState<boolean>(true);

  // Síntese IA Individual e Revisão
  const [structuredSynthesis, setStructuredSynthesis] = useState<string>('');
  const [executiveParagraph, setExecutiveParagraph] = useState<string>('');
  const [isGeneratingSynthesis, setIsGeneratingSynthesis] = useState<boolean>(false);

  // Estados de Voz (Por Pergunta + Modo Conversacional Guiado)
  const [voiceSupported, setVoiceSupported] = useState<boolean>(true);
  const [activeMicQuestionId, setActiveMicQuestionId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [recordedNoticeQuestionId, setRecordedNoticeQuestionId] = useState<string | null>(null);

  // Modo Guiado por Voz Passo a Passo ("Quero fazer meu relatório de hoje")
  const [isGuidedVoiceActive, setIsGuidedVoiceActive] = useState<boolean>(false);
  const [guidedQuestionIndex, setGuidedQuestionIndex] = useState<number>(0);
  const [isSpeakingTts, setIsSpeakingTts] = useState<boolean>(false);

  // Envio e E-mail
  const [enviarEmailDiretoria, setEnviarEmailDiretoria] = useState<boolean>(() => {
    try {
      return localStorage.getItem('copperos_cfg_rdo_auto_email') !== 'false';
    } catch {
      return true;
    }
  });
  const [destinatarioEmail, setDestinatarioEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('copperos_cfg_director_email') || 'andre@coppergroup.com.br';
    } catch {
      return 'andre@coppergroup.com.br';
    }
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isReenviandoEmail, setIsReenviandoEmail] = useState<boolean>(false);
  const [savedRecord, setSavedRecord] = useState<FechamentoExpedienteRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);

  // Histórico de relatórios anteriores do próprio funcionário
  const [myPreviousReports, setMyPreviousReports] = useState<FechamentoExpedienteRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Refs para Web Speech API
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const activeQuestionIdRef = useRef<string | null>(null);
  const baseTextBeforeMicRef = useRef<string>('');
  const latestSpokenRef = useRef<string>('');
  const isFinishingRef = useRef<boolean>(false);
  const guidedModeRef = useRef<boolean>(false);
  const guidedIdxRef = useRef<number>(0);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
    }
  }, []);

  // Carrega questionário dinâmico do departamento + tarefas do período ao abrir
  const loadMyQuestionnaire = async () => {
    setLoadingQuestionnaire(true);
    setErrorMessage(null);
    try {
      const data = await questionnaireApi.getMyQuestionnaire({
        companyId: currentCompany?.id || 'emp-copper-group',
      });
      setQuestionnaireData(data);
      const activeQs = data.questions || [];
      setQuestions(activeQs);
      setAnswersMap(prev => {
        const next: Record<string, string> = {};
        for (const q of activeQs) {
          next[q.id] = prev[q.id] || '';
        }
        return next;
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Não foi possível carregar o questionário do seu departamento.');
    } finally {
      setLoadingQuestionnaire(false);
    }
  };

  const loadMyHistory = async () => {
    setLoadingHistory(true);
    try {
      const list = await fechamentoApi.list({
        companyId: currentCompany?.id || 'emp-copper-group',
        userId: user.id,
        limit: 50,
      });
      setMyPreviousReports(list);
    } catch {
      setMyPreviousReports([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setModalTab('RELATORIO_HOJE');
      setStep('FILL');
      setSavedRecord(null);
      setErrorMessage(null);
      setEmailNotice(null);
      loadMyQuestionnaire();
      loadMyHistory();
    } else {
      stopAllVoiceActivities();
    }
  }, [isOpen, user.id, user.departmentId, currentCompany?.id]);

  // Escuta evento disparado pelo comando de voz "Quero fazer meu relatório de hoje"
  useEffect(() => {
    const handleStartVoiceWizard = () => {
      if (isOpen && questions.length > 0) {
        startGuidedVoiceFlow(0);
      }
    };
    window.addEventListener('copperos:start-voice-report-wizard', handleStartVoiceWizard);
    return () =>
      window.removeEventListener('copperos:start-voice-report-wizard', handleStartVoiceWizard);
  }, [isOpen, questions]);

  const stopAllVoiceActivities = () => {
    guidedModeRef.current = false;
    setIsGuidedVoiceActive(false);
    setIsSpeakingTts(false);
    try {
      voiceTtsService.stop();
    } catch {}
    stopMicSession(false);
    try {
      voiceEngine.setSuppressed(false);
    } catch {}
  };

  const stopMicSession = (advanceGuidedIfActive = false) => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const qId = activeQuestionIdRef.current;
    const spoken = latestSpokenRef.current.trim();
    const base = baseTextBeforeMicRef.current.trim();

    if (qId && spoken) {
      const cleanSpoken = spoken.charAt(0).toUpperCase() + spoken.slice(1);
      const lastChar = base.slice(-1);
      const sep = base ? (!['.', '!', '?', ';', ':', ','].includes(lastChar) ? '. ' : ' ') : '';
      const finalText = base ? `${base}${sep}${cleanSpoken}` : cleanSpoken;

      setAnswersMap(prev => ({ ...prev, [qId]: finalText }));
      setInputMethodsMap(prev => ({ ...prev, [qId]: 'voice' }));
      setRecordedNoticeQuestionId(qId);
      soundEngine.playSuccess();
      setTimeout(() => {
        setRecordedNoticeQuestionId(prev => (prev === qId ? null : prev));
      }, 2500);
    }

    latestSpokenRef.current = '';
    activeQuestionIdRef.current = null;
    setActiveMicQuestionId(null);
    setIsListening(false);
    setInterimTranscript('');

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.onend = null;
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {}
      }
    }

    // Se estiver no modo guiado por voz e capturou fala, avança para a próxima pergunta
    if (advanceGuidedIfActive && guidedModeRef.current && spoken) {
      const nextIdx = guidedIdxRef.current + 1;
      setTimeout(() => {
        if (!guidedModeRef.current) return;
        if (nextIdx < questions.length) {
          startGuidedVoiceFlow(nextIdx);
        } else {
          finishGuidedVoiceAndPreview();
        }
      }, 500);
    }
  };

  const startVoiceForQuestion = (questionId: string, isFromGuidedWizard = false) => {
    if (isListening && activeMicQuestionId === questionId) {
      soundEngine.playClick();
      stopMicSession(isFromGuidedWizard);
      return;
    }

    if (isListening) {
      stopMicSession(false);
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage('Reconhecimento de voz não disponível neste navegador.');
      return;
    }

    try {
      voiceTtsService.stop();
      if (voiceEngine.isRunning) {
        voiceEngine.stop();
      }
      voiceEngine.setSuppressed(true);
    } catch {}

    isFinishingRef.current = false;
    activeQuestionIdRef.current = questionId;
    baseTextBeforeMicRef.current = (answersMap[questionId] || '').trim();
    latestSpokenRef.current = '';

    setActiveMicQuestionId(questionId);
    setIsListening(true);
    setInterimTranscript('');
    setErrorMessage(null);
    soundEngine.playClick();

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        if (isFinishingRef.current) return;
        let sessionFinal = '';
        let sessionInterim = '';

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) sessionFinal += text + ' ';
          else sessionInterim += text;
        }

        const combined = (sessionFinal + ' ' + sessionInterim).trim();
        if (combined) {
          latestSpokenRef.current = combined;
          setInterimTranscript(combined);

          const qId = activeQuestionIdRef.current;
          const base = baseTextBeforeMicRef.current;
          if (qId) {
            const cleanSpoken = combined.charAt(0).toUpperCase() + combined.slice(1);
            const lastChar = base.slice(-1);
            const sep = base ? (!['.', '!', '?', ';', ':', ','].includes(lastChar) ? '. ' : ' ') : '';
            setAnswersMap(prev => ({
              ...prev,
              [qId]: base ? `${base}${sep}${cleanSpoken}` : cleanSpoken,
            }));
            setInputMethodsMap(prev => ({ ...prev, [qId]: 'voice' }));
          }

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            stopMicSession(guidedModeRef.current);
          }, 1600);
        }
      };

      rec.onerror = () => {
        stopMicSession(false);
      };

      rec.onend = () => {
        if (!isFinishingRef.current) {
          stopMicSession(guidedModeRef.current);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
      setActiveMicQuestionId(null);
    }
  };

  /**
   * Inicia o preenchimento conversacional guiado por voz (Seção 6):
   * Lê a pergunta em voz alta (TTS) e abre o microfone (STT) em seguida.
   */
  const startGuidedVoiceFlow = (index = 0) => {
    if (questions.length === 0) return;
    const targetQuestion = questions[index];
    if (!targetQuestion) return;

    guidedModeRef.current = true;
    guidedIdxRef.current = index;
    setIsGuidedVoiceActive(true);
    setGuidedQuestionIndex(index);
    setStep('FILL');

    try {
      voiceEngine.setSuppressed(true);
      if (voiceEngine.isRunning) voiceEngine.stop();
    } catch {}

    const introPrefix =
      index === 0
        ? `Olá ${user.name.split(' ')[0]}. Questionário de ${questionnaireData?.department?.name || user.department || 'hoje'}. `
        : '';
    const ttsPrompt = `${introPrefix}Pergunta ${index + 1} de ${questions.length}: ${targetQuestion.prompt}`;

    setIsSpeakingTts(true);
    voiceTtsService.speak(ttsPrompt, () => {
      setIsSpeakingTts(false);
      if (guidedModeRef.current) {
        startVoiceForQuestion(targetQuestion.id, true);
      }
    });
  };

  const finishGuidedVoiceAndPreview = async () => {
    guidedModeRef.current = false;
    setIsGuidedVoiceActive(false);
    await handleProceedToReview(true);
  };

  /**
   * Monta o snapshot imutável das respostas atuais.
   */
  const buildAnswersSnapshot = (): FechamentoAnswerSnapshot[] => {
    return questions.map((q, idx) => ({
      questionId: q.id,
      questionTextSnapshot: q.prompt,
      order: q.order || idx + 1,
      required: q.required,
      answerText: (answersMap[q.id] || '').trim(),
      inputMethod: inputMethodsMap[q.id] || 'text',
    }));
  };

  /**
   * Insere referência rápida de uma tarefa do sistema na primeira pergunta (ou pergunta em foco)
   * sem alterar o status da tarefa no banco.
   */
  const handleInsertTaskReference = (taskTitle: string, taskStatus: string) => {
    if (questions.length === 0) return;
    const targetQ = questions[0];
    const currentText = (answersMap[targetQ.id] || '').trim();
    const snippet = `[Tarefa ${taskStatus}: ${taskTitle}]`;
    const nextText = currentText ? `${currentText}; ${snippet}` : snippet;
    setAnswersMap(prev => ({ ...prev, [targetQ.id]: nextText }));
    soundEngine.playClick();
  };

  /**
   * Passo de Revisão (Prévia das Respostas + Geração da Síntese Individual IA).
   */
  const handleProceedToReview = async (speakPreview = false) => {
    stopMicSession(false);
    setErrorMessage(null);

    const snapshot = buildAnswersSnapshot();
    const missingReq = snapshot.find(a => a.required && !a.answerText);
    if (missingReq) {
      setErrorMessage(`Por favor, responda à pergunta obrigatória: "${missingReq.questionTextSnapshot}"`);
      return;
    }

    setIsGeneratingSynthesis(true);
    try {
      const preview = await fechamentoApi.previewIndividualSynthesis({
        dateKey: questionnaireData?.dateKey || new Date().toISOString().slice(0, 10),
        userName: user.name,
        departmentName:
          questionnaireData?.department?.name || user.department || 'Setor Operacional',
        turno,
        answers: snapshot,
        tasksSnapshot: questionnaireData?.tasksContext || {},
        observacoesAdicionais,
      });

      setStructuredSynthesis(preview.structuredReport);
      setExecutiveParagraph(preview.executiveParagraph);
      if (preview.detectedIssues && statusGeral === 'REGULAR') {
        setStatusGeral('ATENCAO');
      }
      setStep('REVIEW');
      soundEngine.playSuccess();

      if (speakPreview) {
        voiceTtsService.speak(
          `Questionário concluído. Revise a prévia das suas respostas e clique em Confirmar e Enviar Relatório.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao gerar prévia da síntese individual.');
    } finally {
      setIsGeneratingSynthesis(false);
    }
  };

  /**
   * Confirmação final e gravação no PostgreSQL.
   */
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const snapshot = buildAnswersSnapshot();
    const usedVoice = snapshot.some(a => a.inputMethod === 'voice');
    const usedText = snapshot.some(a => a.inputMethod === 'text');
    const metodo: 'VOZ' | 'TEXTO' | 'HIBRIDO' =
      usedVoice && usedText ? 'HIBRIDO' : usedVoice ? 'VOZ' : 'TEXTO';

    const p1 = snapshot[0]?.answerText || '';
    const p2 = snapshot[1]?.answerText || '';
    const p3 = snapshot[2]?.answerText || observacoesAdicionais || '';

    try {
      const resp = await fechamentoApi.create({
        companyId: currentCompany?.id || 'emp-copper-group',
        departmentId: questionnaireData?.department?.id || user.departmentId,
        departmentName: questionnaireData?.department?.name || user.department,
        turno,
        metodo,
        perguntas: {
          pergunta1: p1,
          pergunta2: p2,
          pergunta3: p3,
        },
        answers: snapshot,
        tasksSnapshot: questionnaireData?.tasksContext || {},
        resumoAutomatico: structuredSynthesis,
        aiIndividualSummary: executiveParagraph,
        metricas: {
          tarefasConcluidas: questionnaireData?.tasksContext?.completedCount || 0,
          totalTarefas: questionnaireData?.tasksContext?.totalAssigned || 0,
          statusGeral,
        },
        enviarEmailDiretoria,
        destinatarioEmail: destinatarioEmail.trim() || undefined,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
      });

      soundEngine.playSuccess();
      setSavedRecord(resp.fechamento);
      setStep('SUBMITTED');
      loadMyHistory();

      if (resp.emailStatus?.enviado) {
        setEmailNotice(`Relatório enviado para ${resp.emailStatus.destinatario}!`);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('copperos_fechamento_saved', { detail: resp.fechamento })
        );
      }
      if (onSuccess) onSuccess(resp.fechamento);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao salvar relatório de expediente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyResumo = () => {
    navigator.clipboard.writeText(structuredSynthesis || executiveParagraph);
    soundEngine.playSuccess();
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  const handleSendWhatsApp = () => {
    soundEngine.playClick();
    const snapshot = buildAnswersSnapshot();
    const answersFormatted = snapshot
      .map((a, i) => `${i + 1}️⃣ *${a.questionTextSnapshot}*\n${a.answerText || '—'}`)
      .join('\n\n');

    const textoFormatado = encodeURIComponent(
      `🏭 *CopperOS | Relatório Individual de Expediente*\n` +
        `*Funcionário:* ${user.name}\n` +
        `*Departamento:* ${questionnaireData?.department?.name || user.department || 'Operacional'}\n` +
        `*Data:* ${new Date().toLocaleDateString('pt-BR')} (${turno})\n\n` +
        `${answersFormatted}\n\n` +
        `🤖 *Síntese IA:* ${executiveParagraph}`
    );

    window.open(`https://api.whatsapp.com/send?text=${textoFormatado}`, '_blank');
  };

  const handleReenviarEmail = async () => {
    if (!savedRecord) return;
    try {
      setIsReenviandoEmail(true);
      await fechamentoApi.sendEmail({
        id: savedRecord.id,
        destinatarioEmail: destinatarioEmail.trim() || undefined,
      });
      soundEngine.playSuccess();
      setEmailNotice(`Relatório reenviado para ${destinatarioEmail}!`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao reenviar e-mail.');
    } finally {
      setIsReenviandoEmail(false);
    }
  };

  const handlePrint = () => {
    soundEngine.playClick();
    const snapshot = buildAnswersSnapshot();
    const compName = currentCompany?.tradeName || 'CopperOS';
    const deptName = questionnaireData?.department?.name || user.department || 'Operacional';

    const questionsHtml = snapshot
      .map(
        (a, i) => `
        <div style="margin-bottom: 12px;">
          <h4 style="font-size: 12px; margin: 0 0 4px; color: #0f172a;">${i + 1}. ${a.questionTextSnapshot}</h4>
          <p style="font-size: 12px; line-height: 1.5; background: #f8fafc; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; margin: 0;">${a.answerText || '—'}</p>
        </div>`
      )
      .join('');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0f172a; max-width: 760px; margin: 0 auto;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 16px;">
          <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">Relatório Individual de Expediente</h2>
          <p style="margin: 4px 0 0; font-size: 11px; color: #475569;">${compName} • Departamento: ${deptName}</p>
        </div>
        ${questionsHtml}
        <div style="margin-top: 16px;">
          <h4 style="font-size: 12px; margin: 0 0 4px;">Síntese Estruturada (IA CopperOS):</h4>
          <pre style="font-size: 11px; background: #0f172a; color: #fff; padding: 12px; border-radius: 6px; white-space: pre-wrap;">${structuredSynthesis}</pre>
        </div>
      </div>
    `;

    printHtmlDocument(`Relatorio_${user.name}`, html);
  };

  const tasksCtx = questionnaireData?.tasksContext;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Relatório de Expediente do Colaborador"
      subtitle={`Questionário personalizado • ${questionnaireData?.department?.name || user.department || 'Setor Operacional'}`}
      maxWidth="2xl"
    >
      <div className="space-y-4 text-xs">
        {/* Abas Superiores: Fazer Relatório de Hoje vs Meus Relatórios Anteriores */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-night-800 pb-2.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setModalTab('RELATORIO_HOJE')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                modalTab === 'RELATORIO_HOJE'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-gray-100 dark:bg-night-850 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Relatório de Hoje</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopAllVoiceActivities();
                setModalTab('MEUS_RELATORIOS');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                modalTab === 'MEUS_RELATORIOS'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-gray-100 dark:bg-night-850 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Meus Relatórios Anteriores ({myPreviousReports.length})</span>
            </button>
          </div>

          {/* Botão de Preenchimento Conversacional por Voz ("Quero fazer meu relatório de hoje") */}
          {modalTab === 'RELATORIO_HOJE' && step === 'FILL' && voiceSupported && (
            <button
              type="button"
              onClick={() => {
                if (isGuidedVoiceActive) {
                  stopAllVoiceActivities();
                } else {
                  startGuidedVoiceFlow(0);
                }
              }}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isGuidedVoiceActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              }`}
              title="O Copiloto lê cada pergunta em voz alta e transcreve suas respostas"
            >
              {isGuidedVoiceActive ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Parar Voz Guiada ({guidedQuestionIndex + 1}/{questions.length})</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Preencher Guiado por Voz</span>
                </>
              )}
            </button>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── ABA 2: HISTÓRICO DE RELATÓRIOS ANTERIORES DO FUNCIONÁRIO ── */}
        {modalTab === 'MEUS_RELATORIOS' && (
          <div className="space-y-3 max-h-[62vh] overflow-y-auto pr-1">
            {loadingHistory ? (
              <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Carregando seus relatórios anteriores...</span>
              </div>
            ) : myPreviousReports.length === 0 ? (
              <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-night-900 rounded-xl border border-gray-200 dark:border-night-800">
                Você ainda não possui relatórios enviados neste período.
              </div>
            ) : (
              myPreviousReports.map(rep => {
                const isExpanded = expandedHistoryId === rep.id;
                const savedAnswers = rep.newValues?.answers || [];
                return (
                  <div
                    key={rep.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 space-y-2"
                  >
                    <div
                      onClick={() => setExpandedHistoryId(isExpanded ? null : rep.id)}
                      className="flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {rep.newValues.dataFechamento}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-night-800 text-[10px] font-bold">
                            {rep.newValues.turno}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                            {rep.newValues.metodo}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                          {rep.newValues.aiIndividualSummary || rep.newValues.resumoAutomatico}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                    </div>

                    {isExpanded && (
                      <div className="pt-3 border-t border-gray-100 dark:border-night-800 space-y-2.5">
                        {savedAnswers.length > 0 ? (
                          savedAnswers.map((ans, idx) => (
                            <div
                              key={`${rep.id}-ans-${idx}`}
                              className="p-2.5 rounded-lg bg-gray-50 dark:bg-night-950 border border-gray-200/70 dark:border-night-800"
                            >
                              <p className="font-bold text-gray-800 dark:text-gray-200 text-[11px]">
                                {idx + 1}. {ans.questionTextSnapshot}
                              </p>
                              <p className="text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                                {ans.answerText}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="space-y-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                            <p>
                              <strong>1. Realizado:</strong> {rep.newValues.perguntas?.pergunta1}
                            </p>
                            <p>
                              <strong>2. Problemas:</strong> {rep.newValues.perguntas?.pergunta2}
                            </p>
                            <p>
                              <strong>3. Pendências:</strong> {rep.newValues.perguntas?.pergunta3}
                            </p>
                          </div>
                        )}

                        <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] whitespace-pre-wrap font-mono overflow-x-auto">
                          {rep.newValues.resumoAutomatico}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── ABA 1: PREENCHIMENTO E REVISÃO DO RELATÓRIO DE HOJE ── */}
        {modalTab === 'RELATORIO_HOJE' && (
          <>
            {/* Cabeçalho do Colaborador, Departamento, Turno e Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-0.5">
                  Funcionário & Setor
                </label>
                <div className="font-bold text-gray-900 dark:text-white truncate">
                  {user.name}
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 truncate">
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {questionnaireData?.department?.name || user.department || 'Operacional'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                  Turno do Expediente
                </label>
                <select
                  value={turno}
                  disabled={step !== 'FILL'}
                  onChange={e => setTurno(e.target.value as TurnoType)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 text-gray-800 dark:text-gray-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="ADMINISTRATIVO">Administrativo / Comercial</option>
                  <option value="TURNO_A">1º Turno (06h - 14h)</option>
                  <option value="TURNO_B">2º Turno (14h - 22h)</option>
                  <option value="TURNO_C">3º Turno (22h - 06h)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                  Status do Expediente
                </label>
                <div className="flex gap-1.5">
                  {(['REGULAR', 'ATENCAO', 'CRITICO'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      disabled={step !== 'FILL'}
                      onClick={() => setStatusGeral(st)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        statusGeral === st
                          ? st === 'REGULAR'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                            : st === 'ATENCAO'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
                          : 'bg-white dark:bg-night-900 border-gray-200 dark:border-night-800 text-gray-500'
                      }`}
                    >
                      {st === 'REGULAR' ? 'Regular' : st === 'ATENCAO' ? 'Atenção' : 'Crítico'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Painel de Tarefas Vinculadas ao Período (Seção 7 — Contextualização sem conclusão automática) */}
            {tasksCtx && step === 'FILL' && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-950/20 p-3 space-y-2">
                <div
                  onClick={() => setShowTasksPanel(prev => !prev)}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-bold text-gray-900 dark:text-white">
                      Suas Tarefas Registradas no CopperOS ({tasksCtx.totalAssigned})
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      {tasksCtx.completedCount} concluídas • {tasksCtx.inProgressCount} em andamento •{' '}
                      {tasksCtx.pendingCount} pendentes
                    </span>
                  </div>
                  {showTasksPanel ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {showTasksPanel && (
                  <div className="space-y-2 pt-1 border-t border-emerald-500/15">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Clique em uma tarefa se quiser citá-la na sua resposta. O status no sistema e o seu relato permanecem separados para auditoria.
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {[
                        ...(tasksCtx.completed || []),
                        ...(tasksCtx.inProgress || []),
                        ...(tasksCtx.pending || []),
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleInsertTaskReference(t.title, t.status)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            t.status === 'Concluída'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                              : t.status === 'Em andamento'
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300'
                                : 'bg-white dark:bg-night-900 border-gray-200 dark:border-night-800 text-gray-700 dark:text-gray-300'
                          }`}
                          title="Clique para citar esta tarefa na resposta"
                        >
                          <span className="font-bold">[{t.status}]</span>
                          <span className="truncate max-w-[230px]">{t.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ETAPA A: PREENCHIMENTO DAS PERGUNTAS DINÂMICAS DO DEPARTAMENTO ── */}
            {step === 'FILL' && (
              <div className="space-y-3">
                {isGuidedVoiceActive && (
                  <div className="p-3 rounded-xl bg-emerald-600 text-white flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <Volume2 className="w-4 h-4 animate-bounce shrink-0" />
                      <div>
                        <p className="font-bold text-xs">
                          Modo Conversacional Ativo — Pergunta {guidedQuestionIndex + 1} de{' '}
                          {questions.length}
                        </p>
                        <p className="text-[11px] text-emerald-100">
                          {isSpeakingTts
                            ? 'Ouvindo pergunta do Copiloto...'
                            : 'Responda agora pelo microfone (pausa automática avança para a próxima).'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {guidedQuestionIndex + 1 < questions.length ? (
                        <button
                          type="button"
                          onClick={() => startGuidedVoiceFlow(guidedQuestionIndex + 1)}
                          className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Próxima →
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => finishGuidedVoiceAndPreview()}
                          className="px-2.5 py-1 rounded-lg bg-white text-emerald-800 text-[11px] font-bold cursor-pointer"
                        >
                          Revisar Respostas →
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {loadingQuestionnaire ? (
                  <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    <span>Carregando questionário do seu departamento...</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
                    {questions.map((q, idx) => {
                      const isThisListening = isListening && activeMicQuestionId === q.id;
                      const isGuidedHighlight =
                        isGuidedVoiceActive && guidedQuestionIndex === idx;

                      return (
                        <div
                          key={q.id}
                          className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                            isGuidedHighlight
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/40'
                              : 'bg-white dark:bg-night-900 border-gray-200/90 dark:border-night-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <label className="font-bold text-gray-900 dark:text-white flex items-start gap-2 text-xs sm:text-sm">
                              <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span>
                                {q.prompt}
                                {q.required ? (
                                  <span className="text-rose-500 ml-1" title="Pergunta obrigatória">
                                    *
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-normal text-gray-400 ml-1.5">
                                    (Opcional)
                                  </span>
                                )}
                              </span>
                            </label>

                            {voiceSupported && (
                              <button
                                type="button"
                                onClick={() => startVoiceForQuestion(q.id, false)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                                  isThisListening
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs animate-pulse'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                }`}
                                title="Responder esta pergunta por voz"
                              >
                                {isThisListening ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Concluir Fala</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>Por Voz</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          <textarea
                            rows={2}
                            value={answersMap[q.id] || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setAnswersMap(prev => ({ ...prev, [q.id]: val }));
                              setInputMethodsMap(prev => ({
                                ...prev,
                                [q.id]: prev[q.id] === 'voice' ? 'voice' : 'text',
                              }));
                            }}
                            placeholder="Digite sua resposta ou clique em 'Por Voz' para falar..."
                            className={FIELD_BASE}
                          />

                          {isThisListening && (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px]">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                              <span className="font-bold shrink-0">Ouvindo:</span>
                              <span className="truncate italic">
                                {interimTranscript || 'Pode falar sua resposta...'}
                              </span>
                            </div>
                          )}

                          {recordedNoticeQuestionId === q.id && !isThisListening && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Transcrição registrada!</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Observações adicionais livres */}
                    <div className="p-3 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 space-y-1.5">
                      <label className="block font-bold text-gray-700 dark:text-gray-300 text-xs">
                        Observações adicionais (Opcional)
                      </label>
                      <input
                        type="text"
                        value={observacoesAdicionais}
                        onChange={e => setObservacoesAdicionais(e.target.value)}
                        placeholder="Alguma observação extra ou recado para o gestor?"
                        className={FIELD_BASE}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200 dark:border-night-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-night-800 text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-night-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingSynthesis || loadingQuestionnaire}
                    onClick={() => handleProceedToReview(false)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingSynthesis ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando Prévia e Síntese IA...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>Revisar Respostas e Gerar Síntese IA</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── ETAPA B: REVISÃO DAS RESPOSTAS E SÍNTESE INDIVIDUAL ANTES DO ENVIO ── */}
            {step === 'REVIEW' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-bold">
                      Confira suas respostas e a síntese gerada pela IA antes de confirmar o envio
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('FILL')}
                    className="px-3 py-1 rounded-lg bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 text-gray-700 dark:text-gray-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer hover:border-emerald-500"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Editar Respostas</span>
                  </button>
                </div>

                {/* Respostas que serão gravadas */}
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {buildAnswersSnapshot().map((a, i) => (
                    <div
                      key={a.questionId}
                      className="p-3 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {i + 1}. {a.questionTextSnapshot}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-night-800 text-gray-500 font-semibold uppercase">
                          {a.inputMethod === 'voice' ? 'Voz' : 'Texto'}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                        {a.answerText || '—'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Síntese Individual Estruturada (Seção 8) */}
                <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Síntese Individual Estruturada (IA CopperOS)
                    </span>
                  </div>
                  <textarea
                    rows={7}
                    value={structuredSynthesis}
                    onChange={e => setStructuredSynthesis(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-slate-100 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Configuração de Envio por E-mail */}
                <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/70 dark:border-teal-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-gray-800 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={enviarEmailDiretoria}
                      onChange={e => setEnviarEmailDiretoria(e.target.checked)}
                      className="w-4 h-4 rounded accent-emerald-600"
                    />
                    <Mail className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Enviar cópia por e-mail ao gestor / diretoria</span>
                  </label>

                  {enviarEmailDiretoria && (
                    <input
                      type="email"
                      value={destinatarioEmail}
                      onChange={e => setDestinatarioEmail(e.target.value)}
                      placeholder="andre@coppergroup.com.br"
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 text-xs text-gray-800 dark:text-gray-200 sm:w-64"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200 dark:border-night-800">
                  <button
                    type="button"
                    onClick={() => setStep('FILL')}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-night-800 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-night-800 cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Voltar e Editar</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmSubmit}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvando no PostgreSQL...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmar e Enviar Relatório do Expediente</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── ETAPA C: RELATÓRIO ENVIADO COM SUCESSO ── */}
            {step === 'SUBMITTED' && savedRecord && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-3 text-emerald-800 dark:text-emerald-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <p className="font-extrabold text-sm">
                          Relatório Individual Enviado e Auditado no PostgreSQL!
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                          Disponibilizado automaticamente para o gestor do setor{' '}
                          {questionnaireData?.department?.name || user.department}.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleCopyResumo}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-night-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        {copiedNotice ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedNotice ? 'Copiado' : 'Copiar'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3 h-3" /> PDF
                      </button>
                      <button
                        type="button"
                        onClick={handleSendWhatsApp}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3 h-3" /> WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={handleReenviarEmail}
                        disabled={isReenviandoEmail}
                        className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isReenviandoEmail ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Mail className="w-3 h-3" />
                        )}
                        <span>Reenviar E-mail</span>
                      </button>
                    </div>
                  </div>

                  {emailNotice && (
                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[11px] flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold">{emailNotice}</span>
                    </div>
                  )}
                </div>

                <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {structuredSynthesis}
                </pre>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold cursor-pointer"
                  >
                    Concluir e Fechar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
