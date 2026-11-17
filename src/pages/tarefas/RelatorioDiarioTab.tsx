import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Printer,
  ChevronLeft,
  ChevronRight,
  Mic,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Save,
  MessageSquare,
  Check,
  Mail,
  Send,
  Loader2,
  Calendar as CalendarIcon,
  Users,
  FolderKanban,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react';
import { TarefasController } from './useTarefas';
import { dateKey, parseDateKey } from '../../domain/recurrence';
import { downloadCsv, printHtmlDocument } from '../../utils/exportFile';
import { soundEngine } from '../../services/soundEngine';
import { voiceEngine } from '../../services/speechService';
import { useCopperOS } from '../../context/CopperOSContext';
import { fechamentoApi, FechamentoExpedienteRecord } from '../../services/fechamentoApi';
import { TaskCheckbox } from './TaskCheckbox';
import { statusBadgeClass } from './taskModel';
import { DepartmentQuestionnaireAdmin } from '../../components/reports/DepartmentQuestionnaireAdmin';
import { DepartmentReportsManagerView } from '../../components/reports/DepartmentReportsManagerView';
import { ExecutiveAnalyticsView } from '../../components/reports/ExecutiveAnalyticsView';
import { FiveMinuteBriefingDashboard } from '../../components/reports/FiveMinuteBriefingDashboard';

interface RelatorioDiarioTabProps {
  controller: TarefasController;
}

type PeriodMode = 'DIARIO' | 'SEMANAL' | 'MENSAL';
type TurnoFilter = 'TODOS' | 'TURNO_A' | 'TURNO_B' | 'TURNO_C' | 'ADMINISTRATIVO';
type SubViewTab =
  | 'briefing-5min'
  | 'sintese-setor'
  | 'ia-executiva'
  | 'cronograma'
  | 'fechamentos'
  | 'tarefas'
  | 'diario'
  | 'questionarios';

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const RelatorioDiarioTab: React.FC<RelatorioDiarioTabProps> = ({ controller }) => {
  const { currentCompany, activeBranch, user, setIsFechamentoModalOpen } = useCopperOS();
  const todayKey = useMemo(() => dateKey(new Date()), []);

  const [periodMode, setPeriodMode] = useState<PeriodMode>('DIARIO');
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [selectedTurno, setSelectedTurno] = useState<TurnoFilter>('TODOS');
  const [activeSubTab, setActiveSubTab] = useState<SubViewTab>(() =>
    user.role === 'CEO' || user.role === 'MANAGER' ? 'briefing-5min' : 'sintese-setor'
  );

  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);
  const [saveNotesNotice, setSaveNotesNotice] = useState<boolean>(false);
  const [fechamentos, setFechamentos] = useState<FechamentoExpedienteRecord[]>([]);
  const [periodNotes, setPeriodNotes] = useState<
    Array<{ id: string; dateKey: string; content: string; updatedBy?: string | null }>
  >([]);
  const [loadingFechamentos, setLoadingFechamentos] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reenvio de e-mail e WhatsApp
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [sendingConsolidatedEmail, setSendingConsolidatedEmail] = useState<boolean>(false);
  const [emailSuccessNotice, setEmailSuccessNotice] = useState<string | null>(null);

  // Notas do Diário de Bordo da data de referência
  const [diarioNotas, setDiarioNotas] = useState<string>('');

  // Cálculo do intervalo [startDate, endDate] conforme o modo Diário, Semanal ou Mensal
  const periodRange = useMemo(() => {
    const base = parseDateKey(selectedDate);

    if (periodMode === 'DIARIO') {
      const label = base.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      return {
        startDate: selectedDate,
        endDate: selectedDate,
        label,
        shortLabel: `Diário (${selectedDate})`,
        days: [selectedDate],
      };
    }

    if (periodMode === 'SEMANAL') {
      // Segunda a Domingo da semana de selectedDate
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      const dayOfWeek = d.getDay(); // 0 = Dom, 1 = Seg...
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diffToMonday);

      const days: string[] = [];
      for (let i = 0; i < 7; i++) {
        const cur = new Date(monday);
        cur.setDate(monday.getDate() + i);
        days.push(dateKey(cur));
      }
      const startDate = days[0];
      const endDate = days[6];
      const startFmt = parseDateKey(startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const endFmt = parseDateKey(endDate).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      return {
        startDate,
        endDate,
        label: `Semana de ${startFmt} a ${endFmt}`,
        shortLabel: `Semanal (${startFmt} - ${endFmt})`,
        days,
      };
    }

    // MENSAL
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: string[] = [];
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(dateKey(new Date(year, month, day)));
    }
    const startDate = days[0];
    const endDate = days[days.length - 1];
    const monthLabel = firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return {
      startDate,
      endDate,
      label: `Mês de ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}`,
      shortLabel: `Mensal (${monthLabel})`,
      days,
    };
  }, [selectedDate, periodMode]);

  const loadPeriodData = async () => {
    const companyId = currentCompany?.id || 'emp-copper-group';
    try {
      setLoadingFechamentos(true);
      const [rdoList, notesList] = await Promise.all([
        fechamentoApi.list({
          companyId,
          startDate: periodRange.startDate,
          endDate: periodRange.endDate,
          turno: selectedTurno !== 'TODOS' ? selectedTurno : undefined,
        }),
        fechamentoApi.listDailyNotes({
          companyId,
          startDate: periodRange.startDate,
          endDate: periodRange.endDate,
        }),
      ]);
      setFechamentos(rdoList);
      setPeriodNotes(notesList.filter(n => n.content && n.content.trim().length > 0));
    } catch (err) {
      console.error('[RelatorioDiarioTab] Erro ao carregar relatórios do PostgreSQL:', err);
    } finally {
      setLoadingFechamentos(false);
    }
  };

  useEffect(() => {
    loadPeriodData();
  }, [periodRange.startDate, periodRange.endDate, selectedTurno, currentCompany?.id, user.id, user.role]);

  // Atualização em tempo real quando qualquer fechamento for registrado no sistema
  useEffect(() => {
    const handleSaved = (e: any) => {
      if (e.detail) {
        setFechamentos(prev => [e.detail, ...prev]);
      } else {
        loadPeriodData();
      }
    };
    window.addEventListener('copperos_fechamento_saved', handleSaved);
    return () => window.removeEventListener('copperos_fechamento_saved', handleSaved);
  }, [periodRange.startDate, periodRange.endDate]);

  useEffect(() => {
    const companyId = currentCompany?.id || 'emp-copper-group';
    fechamentoApi
      .getDailyNote(companyId, selectedDate)
      .then(content => {
        setDiarioNotas(content || '');
      })
      .catch(err => {
        console.error('[RelatorioDiarioTab] Erro ao buscar nota diária no PostgreSQL:', err);
        setDiarioNotas('');
      });
  }, [selectedDate, currentCompany?.id]);

  const handleSaveNotas = async () => {
    soundEngine.playSuccess();
    const companyId = currentCompany?.id || 'emp-copper-group';
    try {
      await fechamentoApi.saveDailyNote({
        companyId,
        dateKey: selectedDate,
        content: diarioNotas,
        updatedBy: user?.name || 'Operador',
      });
      setSaveNotesNotice(true);
      setTimeout(() => setSaveNotesNotice(false), 2500);
      loadPeriodData();
    } catch (err: any) {
      console.error('[RelatorioDiarioTab] Erro ao salvar nota diária no PostgreSQL:', err);
    }
  };

  // Navegação inteligente por Dia, Semana ou Mês
  const handleShiftPeriod = (direction: -1 | 1) => {
    soundEngine.playClick();
    const d = parseDateKey(selectedDate);
    if (periodMode === 'DIARIO') {
      d.setDate(d.getDate() + direction);
    } else if (periodMode === 'SEMANAL') {
      d.setDate(d.getDate() + direction * 7);
    } else {
      d.setMonth(d.getMonth() + direction);
    }
    setSelectedDate(dateKey(d));
  };

  // Rotinas Diárias Ativas (para o Cronograma)
  const activeRoutines = useMemo(() => {
    return controller.tasks.filter(t => t.isDaily && t.dailyActive !== false);
  }, [controller.tasks]);

  // Tarefas reais dentro do intervalo [startDate, endDate]
  const tasksInPeriod = useMemo(() => {
    return controller.tasks
      .filter(t => {
        if (t.isDaily && !t.sourceRoutineId) return false;
        return t.dueDate >= periodRange.startDate && t.dueDate <= periodRange.endDate;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [controller.tasks, periodRange.startDate, periodRange.endDate]);

  // Métricas consolidadas do período (Diário / Semanal / Mensal)
  const metrics = useMemo(() => {
    const total = tasksInPeriod.length;
    const done = tasksInPeriod.filter(t => t.status === 'Concluída').length;
    const inProgress = tasksInPeriod.filter(t => t.status === 'Em andamento').length;
    const pending = tasksInPeriod.filter(t => t.status === 'Pendente').length;
    const overdue = tasksInPeriod.filter(t => t.dueDate < todayKey && t.status !== 'Concluída').length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 100;

    let totalKg = 0;
    let totalHours = 0;
    let hasAttention = false;

    for (const f of fechamentos) {
      const m = f.newValues?.metricas;
      if (m?.pesoProcessadoKg) totalKg += Number(m.pesoProcessadoKg);
      if (m?.horasTrabalhadas) totalHours += Number(m.horasTrabalhadas);
      if (m?.statusGeral === 'ATENCAO' || m?.statusGeral === 'CRITICO') hasAttention = true;
    }

    return {
      total,
      done,
      inProgress,
      pending,
      overdue,
      rate,
      totalKg,
      totalHours,
      hasAttention,
    };
  }, [tasksInPeriod, fechamentos, todayKey]);

  // Produtividade agrupada por Colaborador no período
  const statsByCollaborator = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; done: number; rdoCount: number; kgProcessed: number }
    >();

    for (const t of tasksInPeriod) {
      const name = t.assignee || 'Equipe';
      const entry = map.get(name) || { name, total: 0, done: 0, rdoCount: 0, kgProcessed: 0 };
      entry.total += 1;
      if (t.status === 'Concluída') entry.done += 1;
      map.set(name, entry);
    }

    for (const f of fechamentos) {
      const name = f.userName || 'Operador';
      const entry = map.get(name) || { name, total: 0, done: 0, rdoCount: 0, kgProcessed: 0 };
      entry.rdoCount += 1;
      entry.kgProcessed += Number(f.newValues?.metricas?.pesoProcessadoKg || 0);
      map.set(name, entry);
    }

    return Array.from(map.values()).sort((a, b) => b.done + b.rdoCount - (a.done + a.rdoCount));
  }, [tasksInPeriod, fechamentos]);

  // Produtividade agrupada por Setor / Projeto no período
  const statsByProject = useMemo(() => {
    const map = new Map<string, { project: string; total: number; done: number }>();
    for (const t of tasksInPeriod) {
      const project = t.project || 'Operações';
      const entry = map.get(project) || { project, total: 0, done: 0 };
      entry.total += 1;
      if (t.status === 'Concluída') entry.done += 1;
      map.set(project, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [tasksInPeriod]);

  // Cronograma dia a dia do período (para visão Semanal e Mensal)
  const scheduleByDay = useMemo(() => {
    return periodRange.days.map((dKey, idx) => {
      const dayTasks = tasksInPeriod.filter(t => t.dueDate === dKey);
      const dayRdos = fechamentos.filter(
        f => (f.newValues?.dataFechamento || f.createdAt.slice(0, 10)) === dKey
      );
      const dayNote = periodNotes.find(n => n.dateKey === dKey);
      const dObj = parseDateKey(dKey);
      return {
        dateKey: dKey,
        dayNumber: dObj.getDate(),
        weekdayShort: WEEKDAY_LABELS[idx % 7] || dObj.toLocaleDateString('pt-BR', { weekday: 'short' }),
        formattedShort: dObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        isToday: dKey === todayKey,
        tasks: dayTasks,
        doneCount: dayTasks.filter(t => t.status === 'Concluída').length,
        rdos: dayRdos,
        note: dayNote?.content || '',
      };
    });
  }, [periodRange.days, tasksInPeriod, fechamentos, periodNotes, todayKey]);

  const handleSendEmailFechamento = async (fechamentoId: string, authorName: string) => {
    soundEngine.playClick();
    try {
      setSendingEmailId(fechamentoId);
      const directorEmail =
        localStorage.getItem('copperos_cfg_director_email') || 'andre@coppergroup.com.br';
      await fechamentoApi.sendEmail({ id: fechamentoId, destinatarioEmail: directorEmail });
      soundEngine.playSuccess();
      setEmailSuccessNotice(
        `Relatório de ${authorName} enviado com sucesso para ${directorEmail}!`
      );
      setTimeout(() => setEmailSuccessNotice(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar e-mail.');
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleSendConsolidatedEmail = async () => {
    soundEngine.playClick();
    try {
      setSendingConsolidatedEmail(true);
      const directorEmail =
        localStorage.getItem('copperos_cfg_director_email') || 'andre@coppergroup.com.br';
      await fechamentoApi.sendEmail({
        id: fechamentos[0]?.id,
        destinatarioEmail: directorEmail,
        fechamentoData: {
          periodMode,
          periodLabel: periodRange.label,
          metrics,
          fechamentosCount: fechamentos.length,
          tasksCount: tasksInPeriod.length,
        },
      });
      soundEngine.playSuccess();
      setEmailSuccessNotice(
        `Dossiê Consolidado ${periodRange.shortLabel} enviado para a Diretoria (${directorEmail}) e gravado na auditoria SQLite!`
      );
      setTimeout(() => setEmailSuccessNotice(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar consolidado por e-mail.');
    } finally {
      setSendingConsolidatedEmail(false);
    }
  };

  const handleWhatsAppFechamento = (f: FechamentoExpedienteRecord) => {
    soundEngine.playClick();
    const nv = f.newValues || ({} as any);
    const p = nv.perguntas || {};
    const texto = encodeURIComponent(`🏭 *CopperOS | Fechamento de Expediente (${(nv.turno || 'ADMIN').replace('TURNO_', 'Turno ')})*
*Colaborador:* ${f.userName} (${f.userRole})
*Data:* ${nv.dataFechamento || new Date(f.createdAt).toLocaleDateString('pt-BR')}

1️⃣ *Realizações:*
${p.pergunta1 || 'Sem apontamentos'}

2️⃣ *Impedimentos:*
${p.pergunta2 || 'Nenhum impedimento'}

3️⃣ *Próximo Expediente:*
${p.pergunta3 || 'Rotina regular'}

⚡ *Resumo:* ${nv.resumoAutomatico || 'Fechamento auditado no SQLite.'}`);

    window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank');
  };

  // Suporte a voz no Diário de Bordo
  const [isListeningDiario, setIsListeningDiario] = useState(false);
  const [interimDiario, setInterimDiario] = useState('');
  const [diarioVoiceNotice, setDiarioVoiceNotice] = useState(false);
  const recognitionDiarioRef = useRef<any>(null);
  const silenceDiarioTimerRef = useRef<any>(null);
  const isFinishingDiarioRef = useRef<boolean>(false);
  const baseDiarioTextRef = useRef<string>('');
  const latestDiarioSpokenRef = useRef<string>('');

  const finishVoiceDiario = () => {
    if (isFinishingDiarioRef.current) return;
    isFinishingDiarioRef.current = true;

    if (silenceDiarioTimerRef.current) {
      clearTimeout(silenceDiarioTimerRef.current);
      silenceDiarioTimerRef.current = null;
    }

    const spoken = latestDiarioSpokenRef.current.trim();
    if (spoken) {
      const cleanSpoken = spoken.charAt(0).toUpperCase() + spoken.slice(1);
      const prefix = baseDiarioTextRef.current ? baseDiarioTextRef.current.trim() : '';
      const lastChar = prefix.slice(-1);
      const separator = prefix ? (!['.', '!', '?', ';', ':', ','].includes(lastChar) ? '. ' : ' ') : '';
      const fullText = prefix ? prefix + separator + cleanSpoken : cleanSpoken;

      setDiarioNotas(fullText);
      setDiarioVoiceNotice(true);
      soundEngine.playSuccess();
      setTimeout(() => setDiarioVoiceNotice(false), 2500);
    }

    latestDiarioSpokenRef.current = '';
    setIsListeningDiario(false);
    setInterimDiario('');

    if (recognitionDiarioRef.current) {
      const rec = recognitionDiarioRef.current;
      recognitionDiarioRef.current = null;
      try {
        rec.onend = null;
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch { }
      }
    }
  };

  const startVoiceDiario = () => {
    if (isListeningDiario) {
      soundEngine.playClick();
      finishVoiceDiario();
      return;
    }

    isFinishingDiarioRef.current = false;
    soundEngine.playClick();
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      if (voiceEngine.isRunning) voiceEngine.stop();
    } catch { }

    baseDiarioTextRef.current = diarioNotas ? diarioNotas.trim() : '';
    latestDiarioSpokenRef.current = '';
    setIsListeningDiario(true);
    setInterimDiario('');

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        if (isFinishingDiarioRef.current) return;

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
          latestDiarioSpokenRef.current = combined;
          setInterimDiario(combined);

          const cleanSpoken = combined.charAt(0).toUpperCase() + combined.slice(1);
          const prefix = baseDiarioTextRef.current ? baseDiarioTextRef.current.trim() : '';
          const lastChar = prefix.slice(-1);
          const separator = prefix ? (!['.', '!', '?', ';', ':', ','].includes(lastChar) ? '. ' : ' ') : '';
          setDiarioNotas(prefix ? prefix + separator + cleanSpoken : cleanSpoken);

          if (silenceDiarioTimerRef.current) clearTimeout(silenceDiarioTimerRef.current);
          silenceDiarioTimerRef.current = setTimeout(() => {
            finishVoiceDiario();
          }, 1400);
        }
      };

      rec.onerror = () => {
        if (latestDiarioSpokenRef.current.trim()) finishVoiceDiario();
        else {
          setIsListeningDiario(false);
          setInterimDiario('');
        }
      };

      rec.onend = () => {
        if (!isFinishingDiarioRef.current) {
          finishVoiceDiario();
        }
      };

      recognitionDiarioRef.current = rec;
      rec.start();
    } catch {
      setIsListeningDiario(false);
    }
  };

  // Exportação CSV Consolidada (Diário / Semanal / Mensal)
  const handleExportPeriodCsv = () => {
    soundEngine.playClick();
    const rows: string[][] = [];

    for (const f of fechamentos) {
      const nv = f.newValues || ({} as any);
      rows.push([
        'FECHAMENTO_RDO',
        nv.dataFechamento || f.createdAt.slice(0, 10),
        nv.turno || 'ADMIN',
        f.userName,
        f.userRole,
        'Concluído',
        nv.resumoAutomatico || nv.perguntas?.pergunta1 || '',
        String(nv.metricas?.pesoProcessadoKg || 0),
      ]);
    }

    for (const t of tasksInPeriod) {
      rows.push([
        'TAREFA_OPERACIONAL',
        t.dueDate,
        t.dailyTime || 'Diurno',
        t.assignee,
        t.project,
        t.status,
        t.title,
        '0',
      ]);
    }

    downloadCsv(
      `relatorio-${periodMode.toLowerCase()}-${periodRange.startDate}-a-${periodRange.endDate}.csv`,
      ['Tipo Registro', 'Data', 'Turno/Horário', 'Responsável', 'Setor/Cargo', 'Status', 'Descrição / Resumo', 'Peso Processado (kg)'],
      rows
    );
  };

  // Impressão / Exportação PDF Oficial (Diário, Semanal ou Mensal)
  const handlePrintPdf = () => {
    soundEngine.playClick();
    const compName = currentCompany?.tradeName || currentCompany?.legalName || 'CopperOS';
    const branchName = activeBranch ? `${activeBranch.code} - ${activeBranch.name}` : 'Visão Consolidada Multi-Planta';
    const modeTitle =
      periodMode === 'DIARIO'
        ? 'RELATÓRIO E CRONOGRAMA DIÁRIO DE OPERAÇÕES (RDO)'
        : periodMode === 'SEMANAL'
          ? 'RELATÓRIO E CRONOGRAMA CONSOLIDADO SEMANAL'
          : 'RELATÓRIO E CRONOGRAMA EXECUTIVO MENSAL';

    const collaboratorRows = statsByCollaborator
      .map(
        c => `
      <tr>
        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 600;">${c.name}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${c.done} / ${c.total}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${c.rdoCount}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${c.kgProcessed.toLocaleString('pt-BR')} kg</td>
      </tr>`
      )
      .join('');

    const tasksRows = tasksInPeriod
      .map(
        t => `
      <tr>
        <td style="padding: 6px; border: 1px solid #cbd5e1; font-family: monospace;">${t.dueDate}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${t.title}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${t.project}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${t.assignee}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${t.status}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${t.priority}</td>
      </tr>`
      )
      .join('');

    const fechamentosHtml = fechamentos
      .map(
        f => `
      <div style="margin-bottom: 12px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc;">
        <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px;">
          [${f.newValues?.dataFechamento || f.createdAt.slice(0, 10)}] ${f.userName} (${f.userRole}) • Turno: ${f.newValues?.turno || 'ADMIN'}
          ${f.newValues?.metricas?.pesoProcessadoKg ? ` • Volume: ${Number(f.newValues.metricas.pesoProcessadoKg).toLocaleString('pt-BR')} kg` : ''}
        </div>
        <p style="margin: 3px 0; font-size: 11px;"><strong>1. Realizado:</strong> ${f.newValues?.perguntas?.pergunta1 || '-'}</p>
        <p style="margin: 3px 0; font-size: 11px;"><strong>2. Impedimentos:</strong> ${f.newValues?.perguntas?.pergunta2 || '-'}</p>
        <p style="margin: 3px 0; font-size: 11px;"><strong>3. Próximo Turno:</strong> ${f.newValues?.perguntas?.pergunta3 || '-'}</p>
      </div>`
      )
      .join('');

    const notesHtml = periodNotes
      .map(
        n => `
      <div style="margin-bottom: 8px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11px;">
        <strong>Data ${n.dateKey} (${n.updatedBy || 'Operação'}):</strong> ${n.content}
      </div>`
      )
      .join('');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0f172a; max-width: 860px; margin: 0 auto;">
        <div style="border-bottom: 3px solid #10b981; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h2 style="margin: 0; font-size: 17px; text-transform: uppercase; color: #064e3b;">${modeTitle}</h2>
            <p style="margin: 4px 0 0; font-size: 12px; font-weight: 600;">${compName} — ${branchName}</p>
            <p style="margin: 2px 0 0; font-size: 11px; color: #475569;">Período: ${periodRange.label} (${periodRange.startDate} a ${periodRange.endDate}) • Turno: ${selectedTurno}</p>
          </div>
          <div style="text-align: right; font-size: 10px; color: #64748b; font-family: monospace;">
            <div>EMISSÃO: ${new Date().toLocaleString('pt-BR')}</div>
            <div>AUDITORIA SQLITE: ATIVA</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; font-size: 11px;">
          <div style="padding: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
            <div style="color: #166534; font-weight: bold;">EFICIÊNCIA DO PERÍODO</div>
            <div style="font-size: 18px; font-weight: 800; color: #15803d;">${metrics.rate}%</div>
            <div>${metrics.done} de ${metrics.total} tarefas concluídas</div>
          </div>
          <div style="padding: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;">
            <div style="color: #334155; font-weight: bold;">FECHAMENTOS (RDO)</div>
            <div style="font-size: 18px; font-weight: 800;">${fechamentos.length}</div>
            <div>Turnos reportados no período</div>
          </div>
          <div style="padding: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;">
            <div style="color: #334155; font-weight: bold;">VOLUME PROCESSADO</div>
            <div style="font-size: 18px; font-weight: 800;">${(metrics.totalKg / 1000).toFixed(1)} t</div>
            <div>${metrics.totalKg.toLocaleString('pt-BR')} kg acumulados</div>
          </div>
          <div style="padding: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;">
            <div style="color: #334155; font-weight: bold;">ROTINAS DIÁRIAS</div>
            <div style="font-size: 18px; font-weight: 800;">${activeRoutines.length}</div>
            <div>Templates recorrentes ativos</div>
          </div>
        </div>

        <h3 style="font-size: 13px; text-transform: uppercase; margin: 18px 0 6px; color: #0f172a;">1. Produtividade Consolidada por Colaborador</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 18px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Colaborador</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">Tarefas Concluídas</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">RDOs Enviados</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Volume Apontado</th>
            </tr>
          </thead>
          <tbody>${collaboratorRows || '<tr><td colspan="4" style="padding: 8px; text-align: center;">Sem registros no período.</td></tr>'}</tbody>
        </table>

        <h3 style="font-size: 13px; text-transform: uppercase; margin: 18px 0 6px; color: #0f172a;">2. Fechamentos de Expediente Enviados no Período (${fechamentos.length})</h3>
        ${fechamentosHtml || '<p style="font-size: 11px; color: #64748b;">Nenhum fechamento registrado neste período.</p>'}

        <h3 style="font-size: 13px; text-transform: uppercase; margin: 20px 0 6px; color: #0f172a;">3. Cronograma de Tarefas do Período (${tasksInPeriod.length})</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Data</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Atividade</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Setor / Projeto</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Responsável</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Status</th>
              <th style="padding: 6px; border: 1px solid #cbd5e1;">Prioridade</th>
            </tr>
          </thead>
          <tbody>${tasksRows || '<tr><td colspan="6" style="padding: 8px; text-align: center;">Nenhuma tarefa neste período.</td></tr>'}</tbody>
        </table>

        ${notesHtml ? `<h3 style="font-size: 13px; text-transform: uppercase; margin: 20px 0 6px;">4. Diários de Bordo Registrados</h3>${notesHtml}` : ''}

        <div style="margin-top: 36px; display: flex; justify-content: space-between; font-size: 11px; border-top: 1px solid #cbd5e1; padding-top: 12px;">
          <div>Emitido por: <strong>${user?.name || 'Operador'}</strong> (${user?.role || 'OPERATOR'})</div>
          <div>CopperOS • Dossiê ${periodMode} Auditado no SQLite</div>
        </div>
      </div>
    `;

    printHtmlDocument(`Relatorio_${periodMode}_${periodRange.startDate}_a_${periodRange.endDate}`, html);
  };

  const handleCopySummary = () => {
    soundEngine.playSuccess();
    const text = `🏭 *CopperOS | Relatório Consolidado ${periodRange.shortLabel}*
*Empresa:* ${currentCompany?.tradeName || 'CopperOS'}
*Eficiência do Período:* ${metrics.rate}% (${metrics.done}/${metrics.total} tarefas concluídas)
*Fechamentos Enviados (RDO):* ${fechamentos.length}
*Volume Processado:* ${(metrics.totalKg / 1000).toFixed(1)}t (${metrics.totalKg.toLocaleString('pt-BR')} kg)

📌 *Resumo de Fechamentos Enviados:*
${fechamentos.map(f => `• [${f.newValues?.dataFechamento || f.createdAt.slice(0, 10)}] *${f.userName}* (${f.newValues?.turno || 'Turno'}): ${f.newValues?.resumoAutomatico || f.newValues?.perguntas?.pergunta1 || 'Ok'}`).join('\n') || '• Nenhum fechamento no período.'}

✅ *Tarefas Concluídas por Colaborador:*
${statsByCollaborator.map(c => `• ${c.name}: ${c.done}/${c.total} tarefas (${c.rdoCount} RDOs)`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  const isLegacyView =
    activeSubTab === 'cronograma' ||
    activeSubTab === 'fechamentos' ||
    activeSubTab === 'tarefas' ||
    activeSubTab === 'diario';

  return (
    <div className="space-y-4">
      {/* ── CABEÇALHO ÚNICO E LIMPO DE NAVEGAÇÃO ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-gray-200 dark:border-night-800">
        {/* Abas Principais Enxutas */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(user.role === 'CEO' || user.role === 'MANAGER') && (
            <button
              type="button"
              onClick={() => setActiveSubTab('briefing-5min')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeSubTab === 'briefing-5min'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-night-850 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-night-800'
                }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Briefing 5 Min</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveSubTab('sintese-setor')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeSubTab === 'sintese-setor'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-night-850 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-night-800'
              }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{user.role === 'OPERATOR' ? 'Meus Relatórios' : 'Por Setor'}</span>
          </button>

          {user.role === 'CEO' && (
            <button
              type="button"
              onClick={() => setActiveSubTab('ia-executiva')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeSubTab === 'ia-executiva'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-night-850 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-night-800'
                }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>IA Executiva</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveSubTab('questionarios')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeSubTab === 'questionarios'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-night-850 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-night-800'
              }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Questionários</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('diario')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${isLegacyView
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-night-850 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-night-800'
              }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Diário de Bordo</span>
          </button>
        </div>

        {/* Botão Direto de Preenchimento do Expediente */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setIsFechamentoModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Fazer Meu Relatório de Hoje</span>
          </button>
        </div>
      </div>

      {/* ── BARRA SECUNDÁRIA (EXIBIDA APENAS NO MODO DIÁRIO DE BORDO / CRONOGRAMA) ── */}
      {isLegacyView && (
        <div className="bg-white dark:bg-night-900 border border-gray-200/90 dark:border-night-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center p-1 rounded-xl bg-gray-100 dark:bg-night-850 border border-gray-200/80 dark:border-night-800">
                {(
                  [
                    { id: 'DIARIO', label: 'Diário' },
                    { id: 'SEMANAL', label: 'Semanal' },
                    { id: 'MENSAL', label: 'Mensal' },
                  ] as { id: PeriodMode; label: string }[]
                ).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playSwitch();
                      setPeriodMode(m.id);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${periodMode === m.id
                        ? 'bg-emerald-600 text-white'
                        : 'text-gray-600 dark:text-gray-400'
                      }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleShiftPeriod(-1)}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-night-800 hover:bg-gray-100 dark:hover:bg-night-800 text-gray-600 dark:text-gray-300 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white font-semibold"
                />
                <button
                  onClick={() => handleShiftPeriod(1)}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-night-800 hover:bg-gray-100 dark:hover:bg-night-800 text-gray-600 dark:text-gray-300 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1 border-l border-gray-200 dark:border-night-800 pl-2 text-xs">
                <button
                  onClick={() => setActiveSubTab('diario')}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${activeSubTab === 'diario'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500'
                    }`}
                >
                  Anotações ({periodNotes.length})
                </button>
                <button
                  onClick={() => setActiveSubTab('cronograma')}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${activeSubTab === 'cronograma'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500'
                    }`}
                >
                  Cronograma ({tasksInPeriod.length})
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportPeriodCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-night-800 text-gray-700 dark:text-gray-300 text-xs font-semibold cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                <span>CSV</span>
              </button>
              <button
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {emailSuccessNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{emailSuccessNotice}</span>
        </div>
      )}

      {/* ── 0.0 SUB-ABA PRINCIPAL: BRIEFING RÁPIDO DE 5 MINUTOS (COMEÇO E FIM DO DIA) ── */}
      {activeSubTab === 'briefing-5min' && (
        <FiveMinuteBriefingDashboard onNavigateSubTab={tab => setActiveSubTab(tab)} />
      )}

      {/* ── 0. SUB-ABA: SÍNTESE DO DEPARTAMENTO, ADERÊNCIA E CONSOLIDAÇÃO (ETAPA 3) ── */}
      {activeSubTab === 'sintese-setor' && (
        <DepartmentReportsManagerView
          externalPeriodMode={periodMode}
          externalSelectedDate={selectedDate}
        />
      )}

      {/* ── 0.5 SUB-ABA: IA EXECUTIVA CONSOLIDADA EXCLUSIVA PARA O ANDRÉ (ETAPA 4) ── */}
      {activeSubTab === 'ia-executiva' && <ExecutiveAnalyticsView />}

      {/* ── 1. SUB-ABA: CRONOGRAMA & CONSOLIDADO (DIÁRIO / SEMANAL / MENSAL) ── */}
      {activeSubTab === 'cronograma' && (
        <div className="space-y-4">
          {/* Grade Visual de Cronograma Semanal (7 dias) ou Mensal */}
          {periodMode !== 'DIARIO' && (
            <div className="bg-white dark:bg-night-900 border border-gray-200/90 dark:border-night-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-emerald-500" />
                  <span>
                    {periodMode === 'SEMANAL'
                      ? 'Cronograma Operacional dos 7 Dias da Semana'
                      : 'Mapa de Entregas e Relatórios do Mês'}
                  </span>
                </h3>
                <span className="text-[11px] text-gray-400">
                  Clique em qualquer dia para inspecionar o detalhe diário
                </span>
              </div>

              <div
                className={`grid gap-2.5 ${periodMode === 'SEMANAL'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-7'
                    : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7'
                  }`}
              >
                {scheduleByDay.map(day => {
                  const hasActivity = day.tasks.length > 0 || day.rdos.length > 0;
                  const isSelectedDay = day.dateKey === selectedDate;

                  return (
                    <div
                      key={day.dateKey}
                      onClick={() => {
                        soundEngine.playClick();
                        setSelectedDate(day.dateKey);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[110px] ${isSelectedDay
                          ? 'bg-emerald-500/10 border-emerald-500 shadow-xs'
                          : day.isToday
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/40'
                            : hasActivity
                              ? 'bg-gray-50/70 dark:bg-night-850 border-gray-200 dark:border-night-800 hover:border-emerald-500/40'
                              : 'bg-white dark:bg-night-900 border-gray-100 dark:border-night-800/60 opacity-75 hover:opacity-100'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-gray-400">
                          {day.weekdayShort}
                        </span>
                        <span
                          className={`text-xs font-mono font-extrabold px-1.5 py-0.5 rounded ${day.isToday
                              ? 'bg-emerald-600 text-white'
                              : 'text-gray-700 dark:text-gray-300'
                            }`}
                        >
                          {day.formattedShort}
                        </span>
                      </div>

                      <div className="my-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500">Tarefas:</span>
                          <span className="font-mono font-bold text-gray-900 dark:text-white">
                            {day.doneCount}/{day.tasks.length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500">RDOs:</span>
                          <span
                            className={`font-mono font-bold ${day.rdos.length > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-gray-400'
                              }`}
                          >
                            {day.rdos.length} env.
                          </span>
                        </div>
                      </div>

                      {day.tasks.length > 0 ? (
                        <div className="w-full h-1 rounded-full bg-gray-200 dark:bg-night-700 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{
                              width: `${Math.round((day.doneCount / day.tasks.length) * 100)}%`,
                            }}
                          />
                        </div>
                      ) : (
                        <span className="text-[9px] text-gray-400 truncate">Sem tarefas</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Linha do Tempo de Rotinas Diárias Programadas */}
          <div className="bg-white dark:bg-night-900 border border-gray-200/90 dark:border-night-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                <span>Cronograma Fixo de Rotinas Diárias Recorrentes ({activeRoutines.length})</span>
              </h3>
              <span className="text-[11px] text-gray-400">Disparo automático no início do turno</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeRoutines.map(rot => (
                <div
                  key={rot.id}
                  className="p-3.5 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-black shrink-0">
                      {rot.dailyTime || '06:30'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {rot.title}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {rot.project} • Resp: {rot.assignee}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                    Ativa
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quadro Duplo: Produtividade por Colaborador + Produtividade por Setor/Projeto */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Por Colaborador */}
            <div className="bg-white dark:bg-night-900 border border-gray-200/90 dark:border-night-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <span>Entregas e Relatórios por Colaborador no Período</span>
              </h3>

              <div className="space-y-2">
                {statsByCollaborator.map(c => {
                  const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 100;
                  return (
                    <div
                      key={c.name}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-100 dark:border-night-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white truncate">
                            {c.name}
                          </span>
                          <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            {c.rdoCount} RDO(s)
                          </span>
                        </div>
                        <div className="mt-1.5 w-full h-1.5 rounded-full bg-gray-200 dark:bg-night-700 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {c.done}/{c.total} tarefas
                        </div>
                        {c.kgProcessed > 0 && (
                          <div className="text-[10px] text-gray-400">
                            {(c.kgProcessed / 1000).toFixed(1)}t apontadas
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Por Setor / Projeto */}
            <div className="bg-white dark:bg-night-900 border border-gray-200/90 dark:border-night-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-emerald-500" />
                <span>Desempenho por Setor / Projeto no Período</span>
              </h3>

              <div className="space-y-2">
                {statsByProject.map(p => {
                  const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                  return (
                    <div
                      key={p.project}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-100 dark:border-night-800 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 dark:text-white">{p.project}</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {p.done}/{p.total} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-night-700 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. SUB-ABA: FECHAMENTOS DE EXPEDIENTE ENVIADOS NO PERÍODO ── */}
      {activeSubTab === 'fechamentos' && (
        <div className="space-y-3">
          {loadingFechamentos ? (
            <div className="p-8 text-center text-xs text-gray-400">
              Carregando relatórios de turno do banco SQLite...
            </div>
          ) : fechamentos.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-night-900 border border-gray-200/90 dark:border-night-800 space-y-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Nenhum fechamento registrado em {periodRange.label}.
              </p>
              <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                Todo colaborador encerra o turno respondendo por voz ou texto às 3 perguntas mestras.
              </p>
              <div className="pt-1">
                <button
                  onClick={() => setIsFechamentoModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Registrar Meu Fechamento
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {fechamentos.map(f => {
                const nv = f.newValues || ({} as any);
                const p = nv.perguntas || {};
                const isExpanded = expandedId === f.id;
                const dateStr = nv.dataFechamento || f.createdAt.slice(0, 10);
                const time = new Date(f.createdAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={f.id}
                    className="p-4 rounded-2xl bg-white dark:bg-night-900 border border-gray-200/90 dark:border-night-800 space-y-2.5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center justify-center">
                          {f.userName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-xs text-gray-900 dark:text-white mr-1.5">
                            {f.userName}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            ({f.userRole}) • Data: <strong className="font-mono">{dateStr}</strong> às {time}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {nv.metricas?.pesoProcessadoKg && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {Number(nv.metricas.pesoProcessadoKg).toLocaleString('pt-BR')} kg
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-night-800 text-gray-600 dark:text-gray-400">
                          {nv.turno || 'ADMIN'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {nv.metodo === 'VOZ' ? 'Voz' : nv.metodo === 'HIBRIDO' ? 'Voz + Texto' : 'Texto'}
                        </span>
                      </div>
                    </div>

                    {nv.resumoAutomatico && (
                      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-100 dark:border-night-800 text-xs text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                        {nv.resumoAutomatico}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] pt-1 gap-2 flex-wrap">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : f.id)}
                        className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        <span>{isExpanded ? 'Ocultar detalhes' : 'Ver 3 perguntas mestras'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleSendEmailFechamento(f.id, f.userName)}
                          disabled={sendingEmailId === f.id}
                          className="px-2.5 py-1 rounded-lg border border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                        >
                          {sendingEmailId === f.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Mail className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          )}
                          <span>{sendingEmailId === f.id ? 'Enviando...' : 'Enviar por E-mail'}</span>
                        </button>

                        <button
                          onClick={() => handleWhatsAppFechamento(f)}
                          className="px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        >
                          <Send className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pt-2 border-t border-gray-100 dark:border-night-800 space-y-2 text-xs">
                        <div className="p-2 rounded-lg bg-gray-50/50 dark:bg-night-850/50 border border-gray-100 dark:border-night-800/60">
                          <strong className="text-gray-900 dark:text-white block mb-0.5 text-[11px]">
                            1. Realizado e concluído:
                          </strong>
                          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                            {p.pergunta1 || '-'}
                          </p>
                        </div>

                        <div className="p-2 rounded-lg bg-gray-50/50 dark:bg-night-850/50 border border-gray-100 dark:border-night-800/60">
                          <strong className="text-gray-900 dark:text-white block mb-0.5 text-[11px]">
                            2. Impedimentos ou desvios:
                          </strong>
                          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                            {p.pergunta2 || '-'}
                          </p>
                        </div>

                        <div className="p-2 rounded-lg bg-gray-50/50 dark:bg-night-850/50 border border-gray-100 dark:border-night-800/60">
                          <strong className="text-gray-900 dark:text-white block mb-0.5 text-[11px]">
                            3. Próximo expediente / passagem de turno:
                          </strong>
                          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                            {p.pergunta3 || '-'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 3. SUB-ABA: TAREFAS ENVIADAS E EXECUTADAS NO PERÍODO ── */}
      {activeSubTab === 'tarefas' && (
        <div className="bg-white dark:bg-night-900 border border-gray-200/90 dark:border-night-800 rounded-2xl overflow-hidden shadow-xs">
          {tasksInPeriod.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              Nenhuma atividade registrada em {periodRange.label}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-night-800 text-gray-500 font-semibold bg-gray-50/50 dark:bg-night-850/40">
                    <th className="py-2.5 px-4 w-10"></th>
                    <th className="py-2.5 px-4">Data</th>
                    <th className="py-2.5 px-4">Atividade</th>
                    <th className="py-2.5 px-4">Projeto / Setor</th>
                    <th className="py-2.5 px-4">Responsável</th>
                    <th className="py-2.5 px-4">Prioridade</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-night-800">
                  {tasksInPeriod.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50/60 dark:hover:bg-night-850/60">
                      <td className="py-2.5 px-4">
                        <TaskCheckbox task={t} onToggle={controller.toggleComplete} />
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                        {t.dueDate}
                      </td>
                      <td
                        onClick={() => controller.openTaskDetail(t)}
                        className="py-2.5 px-4 font-semibold text-gray-800 dark:text-gray-200 hover:text-emerald-600 cursor-pointer"
                      >
                        {t.title}
                      </td>
                      <td className="py-2.5 px-4 text-gray-500">{t.project}</td>
                      <td className="py-2.5 px-4 text-gray-600 dark:text-gray-300">{t.assignee}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-[11px] font-bold ${t.priority === 'Urgente' || t.priority === 'Alta'
                              ? 'text-rose-500'
                              : t.priority === 'Média'
                                ? 'text-amber-500'
                                : 'text-gray-500'
                            }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeClass(
                            t.status
                          )}`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 4. SUB-ABA: DIÁRIO DE BORDO & HISTÓRICO DO PERÍODO ── */}
      {activeSubTab === 'diario' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-night-900 border border-gray-200/90 dark:border-night-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                Anotações Técnicas & Ocorrências do Dia ({selectedDate})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startVoiceDiario}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${isListeningDiario
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs font-bold animate-pulse'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    }`}
                >
                  {isListeningDiario ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Concluir Fala</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Ditar por Voz</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleSaveNotas}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>Salvar no SQLite</span>
                </button>
              </div>
            </div>

            <textarea
              value={diarioNotas}
              onChange={e => setDiarioNotas(e.target.value)}
              placeholder="Registre ocorrências da fábrica, observações de equipamentos, passagem de carga..."
              rows={4}
              className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
            />

            {isListeningDiario && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span className="font-semibold shrink-0">Ouvindo:</span>
                <span className="truncate italic">
                  {interimDiario || 'Fale no microfone agora...'}
                </span>
              </div>
            )}

            {diarioVoiceNotice && !isListeningDiario && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Fala transcrita e inserida com sucesso!
              </p>
            )}

            {saveNotesNotice && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Anotação salva no banco de dados SQLite!
              </p>
            )}
          </div>

          {/* Histórico de Diários de Bordo do Período (Semanal / Mensal) */}
          {periodNotes.length > 0 && (
            <div className="bg-white dark:bg-night-900 border border-gray-200/90 dark:border-night-800 rounded-2xl p-4 shadow-xs space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500">
                Diários de Bordo Gravados no Período ({periodNotes.length})
              </h4>
              {periodNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => setSelectedDate(note.dateKey)}
                  className="p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-100 dark:border-night-800 text-xs space-y-1 cursor-pointer hover:border-emerald-500/40"
                >
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {note.dateKey}
                    </span>
                    <span>Atualizado por: {note.updatedBy || 'Operação'}</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUB-ABA 5: QUESTIONÁRIOS DINÂMICOS POR DEPARTAMENTO (ETAPA 1) ── */}
      {activeSubTab === 'questionarios' && <DepartmentQuestionnaireAdmin />}
    </div>
  );
};
