import React, { useState, useEffect, useMemo } from 'react';
import {
  Sun,
  Moon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Volume2,
  VolumeX,
  Mail,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  FileText,
  X,
  CheckSquare,
} from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import { useTasks } from '../../context/TasksContext';
import {
  reportsApi,
  DepartmentOverviewResponse,
  DepartmentOverviewReport,
  ExecutiveAnalysisResponse,
} from '../../services/reportsApi';
import {
  questionnaireApi,
  DepartmentWithQuestionnaireStats,
} from '../../services/questionnaireApi';
import { dateKey, parseDateKey } from '../../domain/recurrence';
import { soundEngine } from '../../services/soundEngine';

interface FiveMinuteBriefingDashboardProps {
  onNavigateSubTab?: (
    tab: 'briefing-5min' | 'sintese-setor' | 'ia-executiva' | 'questionarios' | 'diario'
  ) => void;
}

type DayMoment = 'INICIO_DIA' | 'FINAL_DIA';

export const FiveMinuteBriefingDashboard: React.FC<FiveMinuteBriefingDashboardProps> = ({
  onNavigateSubTab,
}) => {
  const { user, currentCompany } = useCopperOS();
  const { tasks } = useTasks();

  const isCeo = user.role === 'CEO';
  const isManager = user.role === 'MANAGER';

  const todayKey = useMemo(() => dateKey(new Date()), []);

  const [moment, setMoment] = useState<DayMoment>(() => {
    const hour = new Date().getHours();
    return hour < 14 ? 'INICIO_DIA' : 'FINAL_DIA';
  });

  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [departments, setDepartments] = useState<DepartmentWithQuestionnaireStats[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(
    isCeo ? 'TODOS' : user.departmentId || 'dep-cg-pcp'
  );

  const [overviewData, setOverviewData] = useState<DepartmentOverviewResponse | null>(null);
  const [execData, setExecData] = useState<ExecutiveAnalysisResponse['analysis'] | null>(null);
  const [selectedReportModal, setSelectedReportModal] = useState<DepartmentOverviewReport | null>(
    null
  );
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [emailToast, setEmailToast] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (isCeo) {
      setSelectedDepartmentId('TODOS');
    } else if (user.departmentId) {
      setSelectedDepartmentId(user.departmentId);
    }
  }, [user.id, user.role, user.departmentId, isCeo]);

  useEffect(() => {
    let active = true;
    questionnaireApi
      .listDepartments(currentCompany.id)
      .then(res => {
        if (active) setDepartments(res.departments || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentCompany.id]);

  useEffect(() => {
    let active = true;

    const startWindow = (() => {
      const d = parseDateKey(selectedDate);
      d.setDate(d.getDate() - 6);
      return dateKey(d);
    })();

    const deptParam =
      isCeo && selectedDepartmentId === 'TODOS'
        ? undefined
        : isCeo
          ? selectedDepartmentId
          : user.departmentId || selectedDepartmentId;

    const promises: Promise<any>[] = [
      reportsApi.getOverview({
        companyId: currentCompany.id,
        departmentId: deptParam,
        startDate: startWindow,
        endDate: selectedDate,
        periodType: 'PERSONALIZADO',
      }),
    ];

    if (isCeo && selectedDepartmentId === 'TODOS') {
      promises.push(
        reportsApi
          .executiveAsk({
            companyId: currentCompany.id,
            query: 'Resumo executivo diário de entregas, bloqueios e pendências por departamento',
            startDate: startWindow,
            endDate: selectedDate,
            periodType: 'SEMANAL',
          })
          .catch(() => null)
      );
    }

    setApiError(null);
    Promise.all(promises)
      .then(([ov, ex]) => {
        if (!active) return;
        setOverviewData(ov);
        setExecData(ex?.analysis || null);
      })
      .catch(err => {
        if (!active) return;
        setApiError(err?.message || 'Erro ao consultar dados do Briefing no PostgreSQL.');
      });

    return () => {
      active = false;
    };
  }, [currentCompany.id, selectedDate, selectedDepartmentId, isCeo, user.departmentId]);

  const scopedTasks = useMemo(() => {
    const activeDeptObj = departments.find(d => d.id === selectedDepartmentId);
    return tasks.filter(t => {
      if (t.isDaily) return false;
      if (isCeo && selectedDepartmentId === 'TODOS') return true;
      const targetDeptId = isCeo ? selectedDepartmentId : user.departmentId;
      const targetDeptName = isCeo
        ? activeDeptObj?.name?.toLowerCase()
        : (user.department || '').toLowerCase();

      if (t.targetDepartmentId && targetDeptId && t.targetDepartmentId === targetDeptId) {
        return true;
      }
      if (targetDeptName && t.project && t.project.toLowerCase().includes(targetDeptName)) {
        return true;
      }
      return !isCeo && t.assignee?.toLowerCase() === user.name.toLowerCase();
    });
  }, [tasks, isCeo, selectedDepartmentId, departments, user]);

  const taskMetrics = useMemo(() => {
    const overdueOrDueToday = scopedTasks.filter(
      t => t.status !== 'Concluída' && t.dueDate <= selectedDate
    );
    const urgentOpen = scopedTasks.filter(
      t => t.status !== 'Concluída' && (t.priority === 'Urgente' || t.priority === 'Alta')
    );
    const inProgress = scopedTasks.filter(t => t.status === 'Em andamento');
    const completed = scopedTasks.filter(t => t.status === 'Concluída');
    const totalActive = scopedTasks.length;
    const completionRate =
      totalActive > 0 ? Math.round((completed.length / totalActive) * 100) : 0;

    return {
      overdueOrDueToday,
      urgentOpen,
      inProgress,
      completed,
      totalActive,
      completionRate,
    };
  }, [scopedTasks, selectedDate]);

  const reportsToday = useMemo(() => {
    const all = overviewData?.reports || [];
    const exactToday = all.filter(r => r.dateKey === selectedDate);
    return exactToday.length > 0 ? exactToday : all;
  }, [overviewData, selectedDate]);

  const highlights = overviewData?.highlights;
  const compliance = overviewData?.compliance;

  const briefingSpeechText = useMemo(() => {
    const scopeLabel =
      isCeo && selectedDepartmentId === 'TODOS'
        ? 'toda a empresa'
        : overviewData?.department?.name || user.department || 'seu setor';

    if (moment === 'INICIO_DIA') {
      return `Briefing de abertura para ${scopeLabel}. ${highlights?.bloqueiosOperacionais.length || 0} bloqueios, ${highlights?.pendenciasExistentes.length || 0} pendências do turno anterior e ${taskMetrics.overdueOrDueToday.length} tarefas prioritárias para hoje.`;
    }
    return `Briefing de fechamento para ${scopeLabel}. ${compliance?.submittedCount || 0} de ${compliance?.totalEmployees || 0} colaboradores enviaram relatório, com ${highlights?.atividadesRealizadas.length || 0} entregas registradas e ${highlights?.pendenciasExistentes.length || 0} pendências para amanhã.`;
  }, [
    moment,
    user.department,
    isCeo,
    selectedDepartmentId,
    overviewData,
    taskMetrics,
    highlights,
    compliance,
  ]);

  const handleToggleSpeak = () => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(briefingSpeechText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleQuickSendEmail = async () => {
    setSendingEmail(true);
    setEmailToast(null);
    try {
      const resp = await reportsApi.sendConsolidationEmail({
        recipientEmail: user.email || 'andre@coppergroup.com.br',
        subject: `[CopperOS • Briefing ${moment === 'INICIO_DIA' ? 'Abertura' : 'Fechamento'}] ${selectedDate}`,
        content: `${briefingSpeechText}\n\n---\n${overviewData?.liveSynthesisPreview || ''}`,
        companyId: currentCompany.id,
      });
      setEmailToast(`Enviado para ${resp.dispatch.recipient}`);
      setTimeout(() => setEmailToast(null), 3500);
    } catch {
      setEmailToast('Falha ao enviar e-mail.');
    } finally {
      setSendingEmail(false);
    }
  };

  const shiftDate = (delta: number) => {
    const d = parseDateKey(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(dateKey(d));
  };

  return (
    <div className="space-y-4 text-xs">
      {/* ── 1. BARRA SUPERIOR COMPACTA (ALINHADA AO DESIGN COPPEROS) ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-gray-50/70 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 rounded-xl p-3.5">
        <div className="flex items-center gap-3">
          {/* Seletor Início do Dia | Fim do Dia */}
          <div className="inline-flex p-1 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setMoment('INICIO_DIA');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                moment === 'INICIO_DIA'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Início do Dia</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setMoment('FINAL_DIA');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                moment === 'FINAL_DIA'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Fim do Dia</span>
            </button>
          </div>

          <div className="hidden sm:block pl-1">
            <div className="font-bold text-gray-900 dark:text-white">
              {moment === 'INICIO_DIA'
                ? 'Resumo de Abertura (5 min)'
                : 'Resumo de Fechamento (5 min)'}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              {isCeo
                ? 'Visão Executiva • André'
                : isManager
                  ? `Gestor • ${user.department || 'Setor'}`
                  : user.name}
            </div>
          </div>
        </div>

        {/* Filtros Direitos: Setor (CEO) + Data + Áudio + E-mail */}
        <div className="flex flex-wrap items-center gap-2">
          {isCeo && (
            <select
              value={selectedDepartmentId}
              onChange={e => setSelectedDepartmentId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="TODOS">Todos os Departamentos</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-xl px-2 py-1">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="p-0.5 text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
              title="Dia anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-mono font-semibold text-gray-900 dark:text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="p-0.5 text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
              title="Próximo dia"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {selectedDate !== todayKey && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayKey)}
                className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold cursor-pointer"
              >
                Hoje
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleToggleSpeak}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 hover:border-emerald-500 text-gray-700 dark:text-gray-300 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Ouvir resumo em áudio"
          >
            {isSpeaking ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                <span>Parar</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Ouvir</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={sendingEmail}
            onClick={handleQuickSendEmail}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 hover:border-emerald-500 text-gray-700 dark:text-gray-300 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Enviar briefing por e-mail"
          >
            <Mail className="w-3.5 h-3.5 text-emerald-500" />
            <span>{sendingEmail ? 'Enviando...' : 'E-mail'}</span>
          </button>
        </div>
      </div>

      {apiError && (
        <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {emailToast && (
        <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{emailToast}</span>
        </div>
      )}

      {/* ── 2. FAIXA ENXUTA DE 4 INDICADORES ── */}
      {moment === 'INICIO_DIA' ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium block">
                Bloqueios Ativos
              </span>
              <span className="text-[10px] text-gray-400">Paradas relatadas</span>
            </div>
            <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
              {highlights?.bloqueiosOperacionais.length || 0}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium block">
                Pendências do Turno
              </span>
              <span className="text-[10px] text-gray-400">Herdadas de ontem</span>
            </div>
            <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
              {highlights?.pendenciasExistentes.length || 0}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium block">
                Prioridades de Hoje
              </span>
              <span className="text-[10px] text-gray-400">
                {taskMetrics.urgentOpen.length} urgente(s)/alta(s)
              </span>
            </div>
            <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {taskMetrics.overdueOrDueToday.length}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium block">
                Em Andamento
              </span>
              <span className="text-[10px] text-gray-400">
                De {taskMetrics.totalActive} tarefas
              </span>
            </div>
            <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
              {taskMetrics.inProgress.length}
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium block">
                Relatórios Enviados
              </span>
              <span className="text-[10px] text-gray-400">
                {compliance?.missingCount || 0} sem envio
              </span>
            </div>
            <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {compliance
                ? `${compliance.submittedCount}/${compliance.totalEmployees}`
                : reportsToday.length}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium block">
                Entregas Registradas
              </span>
              <span className="text-[10px] text-gray-400">
                {taskMetrics.completed.length} tarefas concluídas
              </span>
            </div>
            <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
              {highlights?.atividadesRealizadas.length || 0}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium block">
                Ocorrências no Dia
              </span>
              <span className="text-[10px] text-gray-400">
                {highlights?.bloqueiosOperacionais.length || 0} bloqueio(s)
              </span>
            </div>
            <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
              {highlights?.problemasRelatados.length || 0}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium block">
                Ficou p/ Amanhã
              </span>
              <span className="text-[10px] text-gray-400">Passagem de turno</span>
            </div>
            <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
              {highlights?.pendenciasExistentes.length || 0}
            </span>
          </div>
        </div>
      )}

      {/* ── 3. CONTEÚDO PRINCIPAL EM 2 COLUNAS LIMPAS ── */}
      {moment === 'INICIO_DIA' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Esquerda (7 cols): O Que Destravar & Prioridades de Hoje */}
          <div className="lg:col-span-7 bg-gray-50/50 dark:bg-night-850/60 border border-gray-200/80 dark:border-night-800 rounded-xl p-4 space-y-4">
            {/* Bloco A: Pendências e Bloqueios do Último Turno */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>O Que Destravar Cedo (Último Fechamento)</span>
                </h3>
                <span className="text-[11px] text-gray-400">
                  {(highlights?.problemasRelatados.length || 0) +
                    (highlights?.pendenciasExistentes.length || 0)}{' '}
                  item(ns)
                </span>
              </div>

              {(highlights?.problemasRelatados.length || 0) === 0 &&
              (highlights?.pendenciasExistentes.length || 0) === 0 ? (
                <div className="p-4 text-center text-gray-400 bg-white dark:bg-night-900 border border-gray-200/60 dark:border-night-800 rounded-xl">
                  Nenhuma pendência ou bloqueio deixado pelo turno anterior.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(highlights?.problemasRelatados || []).slice(0, 4).map((prob, idx) => (
                    <div
                      key={`m-prob-${idx}`}
                      className="p-3 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {prob.userName}
                          </span>
                          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                            Impedimento
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 pl-4">{prob.text}</p>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 shrink-0">
                        {prob.dateKey}
                      </span>
                    </div>
                  ))}

                  {(highlights?.pendenciasExistentes || []).slice(0, 4).map((pend, idx) => (
                    <div
                      key={`m-pend-${idx}`}
                      className="p-3 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {pend.userName}
                          </span>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                            Pendência
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 pl-4">{pend.text}</p>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 shrink-0">
                        {pend.dateKey}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bloco B: Tarefas Prioritárias de Hoje */}
            <div className="pt-3 border-t border-gray-200/70 dark:border-night-800 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  <span>Tarefas Prioritárias de Hoje</span>
                </h3>
                <span className="text-[11px] text-gray-400">
                  {taskMetrics.urgentOpen.length} urgente(s)
                </span>
              </div>

              {taskMetrics.overdueOrDueToday.length === 0 && taskMetrics.urgentOpen.length === 0 ? (
                <div className="p-4 text-center text-gray-400 bg-white dark:bg-night-900 border border-gray-200/60 dark:border-night-800 rounded-xl">
                  Nenhuma tarefa urgente ou vencendo hoje.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {(taskMetrics.overdueOrDueToday.length > 0
                    ? taskMetrics.overdueOrDueToday
                    : taskMetrics.urgentOpen
                  )
                    .slice(0, 5)
                    .map(task => (
                      <div
                        key={task.id}
                        className="px-3 py-2.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white truncate">
                            {task.title}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {task.assignee} • {task.project}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-night-800 text-gray-700 dark:text-gray-300 text-[10px] font-semibold shrink-0">
                          {task.priority}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Direita (5 cols): Status dos Setores (CEO) ou Equipe (Gerente) */}
          <div className="lg:col-span-5 bg-gray-50/50 dark:bg-night-850/60 border border-gray-200/80 dark:border-night-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <span>
                  {isCeo && selectedDepartmentId === 'TODOS'
                    ? 'Panorama por Departamento'
                    : 'Equipe do Setor'}
                </span>
              </h3>
              {isCeo && selectedDepartmentId !== 'TODOS' && (
                <button
                  type="button"
                  onClick={() => setSelectedDepartmentId('TODOS')}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Ver todos
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {isCeo && selectedDepartmentId === 'TODOS' && execData ? (
                execData.departmentComparison
                  .filter(
                    d => d.reportsCount > 0 || d.problemsCount > 0 || d.employeesCount > 0
                  )
                  .map(dept => {
                    const hasBlock = dept.operationalBlocksCount > 0;
                    const hasProb = dept.problemsCount > 0 || dept.pendingItemsCount > 0;
                    return (
                      <div
                        key={dept.departmentId}
                        onClick={() => setSelectedDepartmentId(dept.departmentId)}
                        className="px-3 py-2.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 flex items-center justify-between cursor-pointer hover:border-emerald-500 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white truncate">
                            {dept.departmentName}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">
                            {dept.submittedEmployeesCount}/{dept.employeesCount} relatórios •{' '}
                            {dept.pendingItemsCount} pendência(s)
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-night-850 border border-gray-200/70 dark:border-night-800 text-[10px] font-semibold text-gray-700 dark:text-gray-300 shrink-0">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              hasBlock
                                ? 'bg-rose-500'
                                : hasProb
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                            }`}
                          />
                          {hasBlock ? 'Bloqueio' : hasProb ? 'Atenção' : 'Normal'}
                        </span>
                      </div>
                    );
                  })
              ) : (
                (overviewData?.employees || []).map(emp => {
                  const empTasks = scopedTasks.filter(
                    t =>
                      t.status !== 'Concluída' &&
                      t.assignee?.toLowerCase() === emp.name.toLowerCase()
                  );
                  return (
                    <div
                      key={emp.id}
                      className="px-3 py-2.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {emp.name}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          {emp.jobTitle || emp.role}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-semibold">
                        {empTasks.length} ativa(s)
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── MODO FIM DO DIA (2 COLUNAS LIMPAS) ── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Esquerda (7 cols): Relatórios Entregues & Síntese IA */}
          <div className="lg:col-span-7 bg-gray-50/50 dark:bg-night-850/60 border border-gray-200/80 dark:border-night-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Entregas & Relatórios Recebidos ({reportsToday.length})</span>
              </h3>
              <span className="text-[11px] text-gray-400">Clique para abrir</span>
            </div>

            {reportsToday.length === 0 ? (
              <div className="p-6 text-center text-gray-400 bg-white dark:bg-night-900 border border-gray-200/60 dark:border-night-800 rounded-xl">
                Nenhum relatório enviado para este período até o momento.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {reportsToday.map(rep => (
                  <div
                    key={rep.id}
                    onClick={() => setSelectedReportModal(rep)}
                    className="p-3 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 hover:border-emerald-500 cursor-pointer space-y-1 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {rep.userName}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {rep.dateKey} • {rep.turno}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                      {rep.aiIndividualSummary || rep.pergunta1}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Direita (5 cols): Check-in de Envio da Equipe + Passagem p/ Amanhã */}
          <div className="lg:col-span-5 bg-gray-50/50 dark:bg-night-850/60 border border-gray-200/80 dark:border-night-800 rounded-xl p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>Check-in de Envio da Equipe</span>
                </h3>
                {compliance && (
                  <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {compliance.submittedCount}/{compliance.totalEmployees}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 space-y-3">
                <div>
                  <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Enviaram ({compliance?.submittedEmployees.length || 0})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(compliance?.submittedEmployees || []).map(emp => (
                      <span
                        key={emp.id}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                      >
                        {emp.name}
                      </span>
                    ))}
                    {(compliance?.submittedEmployees.length || 0) === 0 && (
                      <span className="text-gray-400">Nenhum envio registrado.</span>
                    )}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-gray-100 dark:border-night-800">
                  <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>
                      Sem envio registrado — Ausência de informação (
                      {compliance?.missingEmployees.length || 0})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(compliance?.missingEmployees || []).map(emp => (
                      <span
                        key={emp.id}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-night-850 text-gray-700 dark:text-gray-300 font-medium"
                      >
                        {emp.name}
                      </span>
                    ))}
                    {(compliance?.missingEmployees.length || 0) === 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Todos os colaboradores enviaram.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Passagem rápida para amanhã */}
            {(highlights?.pendenciasExistentes.length || 0) > 0 && (
              <div className="space-y-1.5">
                <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Passagem para Amanhã ({highlights?.pendenciasExistentes.length})</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {(highlights?.pendenciasExistentes || []).slice(0, 3).map((pend, idx) => (
                    <div
                      key={`f-pend-${idx}`}
                      className="p-2.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 text-gray-700 dark:text-gray-300"
                    >
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {pend.userName}:{' '}
                      </span>
                      {pend.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. ATALHOS DISCRETOS PARA DETALHAMENTO ── */}
      {onNavigateSubTab && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => onNavigateSubTab('sintese-setor')}
            className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-night-850 hover:bg-gray-200 dark:hover:bg-night-800 text-gray-700 dark:text-gray-300 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-500" />
            <span>Ver Relatórios por Período</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          {isCeo && (
            <button
              type="button"
              onClick={() => onNavigateSubTab('ia-executiva')}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Abrir IA Executiva (André)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* ── MODAL DE LEITURA RÁPIDA DE RELATÓRIO INDIVIDUAL ── */}
      {selectedReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl max-w-lg w-full p-5 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-night-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                  Relatório de Expediente
                </span>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {selectedReportModal.userName} • {selectedReportModal.dateKey}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportModal(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <div className="font-bold text-emerald-700 dark:text-emerald-400">Síntese IA</div>
              <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
                {selectedReportModal.aiIndividualSummary}
              </p>
            </div>

            <div className="space-y-2">
              {Array.isArray(selectedReportModal.answers) &&
              selectedReportModal.answers.length > 0 ? (
                selectedReportModal.answers.map((ans, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800"
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {idx + 1}. {ans.questionTextSnapshot}
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                      {ans.answerText}
                    </p>
                  </div>
                ))
              ) : (
                <>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      1. Atividades Realizadas
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">
                      {selectedReportModal.pergunta1}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      2. Dificuldades / Problemas
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">
                      {selectedReportModal.pergunta2}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      3. Pendências
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">
                      {selectedReportModal.pergunta3}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
