import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Filter,
  Building2,
  Calendar as CalendarIcon,
  FileText,
  ChevronDown,
  ChevronUp,
  Printer,
  Copy,
  Check,
  Loader2,
  ShieldAlert,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import {
  ConsolidationPeriodType,
  DepartmentOverviewResponse,
  reportsApi,
} from '../../services/reportsApi';
import {
  DepartmentWithQuestionnaireStats,
  questionnaireApi,
} from '../../services/questionnaireApi';
import { dateKey, parseDateKey } from '../../domain/recurrence';
import { soundEngine } from '../../services/soundEngine';
import { printHtmlDocument } from '../../utils/exportFile';

interface DepartmentReportsManagerViewProps {
  externalPeriodMode?: 'DIARIO' | 'SEMANAL' | 'MENSAL';
  externalSelectedDate?: string;
}

export const DepartmentReportsManagerView: React.FC<DepartmentReportsManagerViewProps> = ({
  externalPeriodMode,
  externalSelectedDate,
}) => {
  const { user, currentCompany } = useCopperOS();
  const isCeo = user.role === 'CEO';
  const isManager = user.role === 'MANAGER';
  const isOperator = user.role === 'OPERATOR';

  const todayStr = useMemo(() => dateKey(new Date()), []);

  const [periodType, setPeriodType] = useState<ConsolidationPeriodType>(
    externalPeriodMode || 'DIARIO'
  );
  const [referenceDate, setReferenceDate] = useState<string>(externalSelectedDate || todayStr);
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  const [departments, setDepartments] = useState<DepartmentWithQuestionnaireStats[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(
    user.departmentId || 'dep-cg-pcp'
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('TODOS');

  const [overview, setOverview] = useState<DepartmentOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingSynthesis, setIsGeneratingSynthesis] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [synthesisSavedBanner, setSynthesisSavedBanner] = useState<string | null>(null);
  const [copiedSynthesis, setCopiedSynthesis] = useState<boolean>(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [innerTab, setInnerTab] = useState<'relatorios' | 'sintese-ia'>('relatorios');

  // Sincroniza quando o seletor global do RelatorioDiarioTab muda
  useEffect(() => {
    if (externalPeriodMode && periodType !== 'PERSONALIZADO') {
      setPeriodType(externalPeriodMode);
    }
  }, [externalPeriodMode]);

  useEffect(() => {
    if (externalSelectedDate) {
      setReferenceDate(externalSelectedDate);
    }
  }, [externalSelectedDate]);

  // Atualiza departamento padrão ao alternar usuário
  useEffect(() => {
    if (user.departmentId) {
      setSelectedDepartmentId(user.departmentId);
      setSelectedEmployeeId('TODOS');
    }
  }, [user.id, user.departmentId]);

  // Calcula [startDate, endDate] unificado para Diário, Semanal, Mensal e Personalizado
  const calculatedRange = useMemo(() => {
    if (periodType === 'PERSONALIZADO') {
      const s = customStartDate <= customEndDate ? customStartDate : customEndDate;
      const e = customStartDate <= customEndDate ? customEndDate : customStartDate;
      return { startDate: s, endDate: e };
    }

    const base = parseDateKey(referenceDate);

    if (periodType === 'DIARIO') {
      return { startDate: referenceDate, endDate: referenceDate };
    }

    if (periodType === 'SEMANAL') {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      const dayOfWeek = d.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { startDate: dateKey(monday), endDate: dateKey(sunday) };
    }

    // MENSAL
    const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { startDate: dateKey(firstDay), endDate: dateKey(lastDay) };
  }, [periodType, referenceDate, customStartDate, customEndDate]);

  // Carrega lista de departamentos para filtro (CEO pode escolher qualquer um)
  useEffect(() => {
    questionnaireApi
      .listDepartments(currentCompany?.id || 'emp-copper-group')
      .then(res => {
        setDepartments(res.departments || []);
      })
      .catch(() => {});
  }, [currentCompany?.id, user.id]);

  const loadOverview = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const deptParam = isCeo
        ? selectedDepartmentId
        : user.departmentId || selectedDepartmentId;

      const data = await reportsApi.getOverview({
        companyId: currentCompany?.id || 'emp-copper-group',
        departmentId: deptParam,
        userId: isOperator ? user.id : selectedEmployeeId !== 'TODOS' ? selectedEmployeeId : undefined,
        startDate: calculatedRange.startDate,
        endDate: calculatedRange.endDate,
        periodType,
      });
      setOverview(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao consultar consolidação do departamento.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [
    currentCompany?.id,
    user.id,
    user.role,
    selectedDepartmentId,
    selectedEmployeeId,
    calculatedRange.startDate,
    calculatedRange.endDate,
    periodType,
  ]);

  // Escuta novos relatórios enviados no modal
  useEffect(() => {
    const handleNew = () => loadOverview();
    window.addEventListener('copperos_fechamento_saved', handleNew);
    return () => window.removeEventListener('copperos_fechamento_saved', handleNew);
  }, [calculatedRange.startDate, calculatedRange.endDate, selectedDepartmentId]);

  const handleGenerateDepartmentSynthesis = async () => {
    setIsGeneratingSynthesis(true);
    setErrorMsg(null);
    setSynthesisSavedBanner(null);
    try {
      const deptParam = isCeo
        ? selectedDepartmentId
        : user.departmentId || selectedDepartmentId;

      const res = await reportsApi.generateDepartmentSynthesis({
        companyId: currentCompany?.id || 'emp-copper-group',
        departmentId: deptParam,
        userId: selectedEmployeeId !== 'TODOS' ? selectedEmployeeId : undefined,
        startDate: calculatedRange.startDate,
        endDate: calculatedRange.endDate,
        periodType,
      });
      soundEngine.playSuccess();
      setSynthesisSavedBanner(
        `Síntese departamental (${periodType}) gerada e salva no PostgreSQL com sucesso (${res.consolidation.sources.length} relatório(s) analisado(s)).`
      );
      await loadOverview();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível gerar a síntese departamental.');
    } finally {
      setIsGeneratingSynthesis(false);
    }
  };

  const handleCopySynthesis = () => {
    if (!overview?.liveSynthesisPreview) return;
    navigator.clipboard.writeText(overview.liveSynthesisPreview);
    soundEngine.playSuccess();
    setCopiedSynthesis(true);
    setTimeout(() => setCopiedSynthesis(false), 2000);
  };

  const handlePrintDepartmentSynthesis = () => {
    if (!overview) return;
    soundEngine.playClick();
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0f172a; max-width: 800px; margin: 0 auto;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px;">
          <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">Síntese Operacional do Departamento — ${overview.department.name}</h2>
          <p style="margin: 4px 0 0; font-size: 11px; color: #475569;">
            Período (${overview.period.periodType}): ${overview.period.startDate} até ${overview.period.endDate} • Emitido por: ${user.name} (${user.role})
          </p>
        </div>
        <pre style="font-size: 12px; line-height: 1.55; background: #f8fafc; padding: 16px; border: 1px solid #cbd5e1; border-radius: 8px; white-space: pre-wrap;">${overview.liveSynthesisPreview}</pre>
      </div>
    `;
    printHtmlDocument(`Sintese_${overview.department.name}_${overview.period.startDate}`, html);
  };

  const compliance = overview?.compliance;
  const highlights = overview?.highlights;

  return (
    <div className="space-y-5 text-xs">
      {/* ── BARRA DE FILTROS UNIFICADA (DEPARTAMENTO, FUNCIONÁRIO E PERÍODO) ── */}
      <div className="bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
                  {isOperator
                    ? 'Meus Relatórios e Sínteses no Período'
                    : `Gestão & Síntese Departamental — ${overview?.department?.name || user.department}`}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  {isCeo
                    ? 'Acesso Total (André / CEO)'
                    : isManager
                      ? 'Escopo Departamental (Gestor)'
                      : 'Escopo Individual (Colaborador)'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Motor único de consolidação Diária, Semanal, Mensal e Personalizada com rastreabilidade das fontes.
              </p>
            </div>
          </div>

          {/* Seletor de Intervalo: Diário | Semanal | Mensal | Personalizado */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-night-950 border border-gray-200/80 dark:border-night-800 self-start">
            {(['DIARIO', 'SEMANAL', 'MENSAL', 'PERSONALIZADO'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setPeriodType(mode);
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  periodType === mode
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {mode === 'DIARIO'
                  ? 'Diário'
                  : mode === 'SEMANAL'
                    ? 'Semanal'
                    : mode === 'MENSAL'
                      ? 'Mensal'
                      : 'Personalizado'}
              </button>
            ))}
          </div>
        </div>

        {/* Linha de Filtros: Departamento + Funcionário + Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-night-800">
          {/* Filtro de Departamento */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-emerald-500" />
              <span>Departamento</span>
              {!isCeo && <Lock className="w-3 h-3 text-amber-500 ml-1" />}
            </label>
            {isCeo ? (
              <select
                value={selectedDepartmentId}
                onChange={e => {
                  setSelectedDepartmentId(e.target.value);
                  setSelectedEmployeeId('TODOS');
                }}
                className="w-full px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-night-950 border border-gray-200 dark:border-night-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-night-950 border border-gray-200 dark:border-night-800 text-xs font-bold text-gray-700 dark:text-gray-300 truncate">
                {overview?.department?.name || user.department || 'Meu Departamento'}
              </div>
            )}
          </div>

          {/* Filtro de Funcionário */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-emerald-500" />
              <span>Filtrar por Funcionário</span>
            </label>
            {isOperator ? (
              <div className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-night-950 border border-gray-200 dark:border-night-800 text-xs font-bold text-gray-700 dark:text-gray-300 truncate">
                {user.name}
              </div>
            ) : (
              <select
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-night-950 border border-gray-200 dark:border-night-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="TODOS">Todos os colaboradores do setor</option>
                {(overview?.employees || []).map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Seletor de Data de Referência ou Intervalo Personalizado */}
          {periodType !== 'PERSONALIZADO' ? (
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1 flex items-center gap-1">
                <CalendarIcon className="w-3 h-3 text-emerald-500" />
                <span>
                  Data de Referência ({calculatedRange.startDate} → {calculatedRange.endDate})
                </span>
              </label>
              <input
                type="date"
                value={referenceDate}
                onChange={e => setReferenceDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-night-950 border border-gray-200 dark:border-night-800 text-xs font-mono font-bold text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-night-950 border border-gray-200 dark:border-night-800 text-xs font-mono font-bold text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                  Data Final
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-night-950 border border-gray-200 dark:border-night-800 text-xs font-mono font-bold text-gray-900 dark:text-white"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center gap-2 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {synthesisSavedBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{synthesisSavedBanner}</span>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center bg-white dark:bg-night-900 rounded-2xl border border-gray-200 dark:border-night-800 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          <span className="text-gray-500">Consultando relatórios e consolidando indicadores do setor...</span>
        </div>
      ) : (
        overview && (
          <>
            {/* ── PAINEL COMPACTO DE COBERTURA DA EQUIPE (QUEM ENVIOU VS. SEM ENVIO) ── */}
            {!isOperator && compliance && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* Quem Enviou */}
                <div className="lg:col-span-6 bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Enviaram Relatório ({compliance.submittedCount})</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      {compliance.totalEmployees > 0
                        ? Math.round((compliance.submittedCount / compliance.totalEmployees) * 100)
                        : 0}
                      % do setor
                    </span>
                  </div>

                  {compliance.submittedEmployees.length === 0 ? (
                    <p className="text-gray-400 italic">
                      Nenhum colaborador enviou relatório neste período.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {compliance.submittedEmployees.map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() =>
                            setSelectedEmployeeId(emp.id === selectedEmployeeId ? 'TODOS' : emp.id)
                          }
                          className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                            selectedEmployeeId === emp.id
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-500/20'
                          }`}
                        >
                          <span>{emp.name}</span>
                          <span className="px-1 rounded bg-black/15 text-[10px] font-mono">
                            {emp.reportsCount}x
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quem Ainda Não Enviou (Ausência de Informação) */}
                <div className="lg:col-span-6 bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>Sem Envio no Período ({compliance.missingCount})</span>
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      Ausência de informação
                    </span>
                  </div>

                  {compliance.missingEmployees.length === 0 ? (
                    <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      100% da equipe enviou relatório no período.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {compliance.missingEmployees.map(emp => (
                        <span
                          key={emp.id}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 font-semibold flex items-center gap-1.5"
                          title={emp.statusNote}
                        >
                          <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>{emp.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SELETOR DE VISÃO INTERNA (EVITA EMPILHAR TUDO NA MESMA TELA) ── */}
            {!isOperator && (
              <div className="flex items-center justify-between flex-wrap gap-2 bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-2 shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInnerTab('relatorios')}
                    className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      innerTab === 'relatorios'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-night-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Relatórios Individuais ({overview.reports.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInnerTab('sintese-ia')}
                    className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      innerTab === 'sintese-ia'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-night-800'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Síntese IA do Setor & Destaques</span>
                    {highlights && highlights.problemasRelatados.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px]">
                        {highlights.problemasRelatados.length} alerta(s)
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 pr-1">
                  <button
                    type="button"
                    disabled={isGeneratingSynthesis}
                    onClick={() => {
                      setInnerTab('sintese-ia');
                      handleGenerateDepartmentSynthesis();
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingSynthesis ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Gerar Síntese IA</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── ABA INTERNA 2: SÍNTESE DO DEPARTAMENTO (IA) + 3 COLUNAS DE DESTAQUES ── */}
            {!isOperator && innerTab === 'sintese-ia' && (
              <div className="space-y-4">
                {highlights && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* Atividades Realizadas */}
                    <div className="bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-4 shadow-xs space-y-2">
                      <h4 className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Atividades ({highlights.atividadesRealizadas.length})</span>
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {highlights.atividadesRealizadas.length === 0 ? (
                          <p className="text-gray-400 italic">Sem atividades relatadas.</p>
                        ) : (
                          highlights.atividadesRealizadas.map((item, idx) => (
                            <div
                              key={`act-${idx}`}
                              className="p-2.5 rounded-xl bg-gray-50 dark:bg-night-950 border border-gray-200/70 dark:border-night-800 space-y-1"
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span>{item.userName}</span>
                                <span className="font-mono">{item.dateKey}</span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 leading-snug">
                                {item.text}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Dificuldades & Bloqueios */}
                    <div className="bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-4 shadow-xs space-y-2">
                      <h4 className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Dificuldades & Bloqueios ({highlights.problemasRelatados.length})</span>
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {highlights.problemasRelatados.length === 0 ? (
                          <p className="text-gray-400 italic">Nenhum impedimento relatado.</p>
                        ) : (
                          highlights.problemasRelatados.map((item, idx) => {
                            const isBlock = highlights.bloqueiosOperacionais.some(
                              b => b.reportId === item.reportId
                            );
                            return (
                              <div
                                key={`prob-${idx}`}
                                className={`p-2.5 rounded-xl border space-y-1 ${
                                  isBlock
                                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/60'
                                    : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                  <span
                                    className={
                                      isBlock
                                        ? 'text-rose-700 dark:text-rose-300'
                                        : 'text-amber-700 dark:text-amber-300'
                                    }
                                  >
                                    {item.userName} {isBlock ? '• BLOQUEIO' : ''}
                                  </span>
                                  <span className="font-mono text-gray-400">{item.dateKey}</span>
                                </div>
                                <p className="text-gray-800 dark:text-gray-200 leading-snug">
                                  {item.text}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Pendências */}
                    <div className="bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-4 shadow-xs space-y-2">
                      <h4 className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>Pendências ({highlights.pendenciasExistentes.length})</span>
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {highlights.pendenciasExistentes.length === 0 ? (
                          <p className="text-gray-400 italic">Sem pendências declaradas.</p>
                        ) : (
                          highlights.pendenciasExistentes.map((item, idx) => (
                            <div
                              key={`pend-${idx}`}
                              className="p-2.5 rounded-xl bg-gray-50 dark:bg-night-950 border border-gray-200/70 dark:border-night-800 space-y-1"
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                <span>{item.userName}</span>
                                <span className="font-mono">{item.dateKey}</span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 leading-snug">
                                {item.text}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                      Texto Consolidado — {overview.department.name}
                    </h4>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopySynthesis}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-night-800 hover:border-emerald-500 text-gray-700 dark:text-gray-300 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedSynthesis ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedSynthesis ? 'Copiado!' : 'Copiar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handlePrintDepartmentSynthesis}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-night-800 hover:border-emerald-500 text-gray-700 dark:text-gray-300 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir PDF</span>
                      </button>
                    </div>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed whitespace-pre-wrap overflow-x-auto">
                    {overview.liveSynthesisPreview}
                  </pre>
                </div>
              </div>
            )}

            {/* ── ABA INTERNA 1: LISTA LIMPA DE RELATÓRIOS INDIVIDUAIS ── */}
            {(isOperator || innerTab === 'relatorios') && (
              <div className="bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    <span>Relatórios Individuais ({overview.reports.length})</span>
                  </h4>
                  {selectedEmployeeId !== 'TODOS' && (
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeId('TODOS')}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Mostrar todos do setor
                    </button>
                  )}
                </div>

                {overview.reports.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200 dark:border-night-800 rounded-xl">
                    Nenhum relatório individual encontrado para os filtros selecionados.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {overview.reports.map(rep => {
                      const isExpanded = expandedReportId === rep.id;
                      return (
                        <div
                          key={rep.id}
                          className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-night-950 border border-gray-200 dark:border-night-800 space-y-2"
                        >
                          <div
                            onClick={() => setExpandedReportId(isExpanded ? null : rep.id)}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                          >
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 dark:text-white">
                                  {rep.userName}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                                  {rep.dateKey}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-night-800 text-gray-700 dark:text-gray-300 text-[10px] font-bold">
                                  {rep.turno} • {rep.metodo}
                                </span>
                              </div>
                              <p className="text-gray-600 dark:text-gray-300 mt-1">
                                <strong>Síntese IA:</strong> {rep.aiIndividualSummary}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 self-end sm:self-center shrink-0 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                              <span>{isExpanded ? 'Ocultar' : 'Ver respostas'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="pt-3 border-t border-gray-200 dark:border-night-800 space-y-2">
                              {Array.isArray(rep.answers) && rep.answers.length > 0 ? (
                                rep.answers.map((ans, idx) => (
                                  <div
                                    key={`${rep.id}-q-${idx}`}
                                    className="p-2.5 rounded-lg bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800"
                                  >
                                    <p className="font-bold text-gray-900 dark:text-white text-[11px]">
                                      {idx + 1}. {ans.questionTextSnapshot}
                                    </p>
                                    <p className="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                                      {ans.answerText}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
                                  <p>
                                    <strong>1. Atividades:</strong> {rep.pergunta1}
                                  </p>
                                  <p>
                                    <strong>2. Problemas:</strong> {rep.pergunta2}
                                  </p>
                                  <p>
                                    <strong>3. Pendências:</strong> {rep.pergunta3}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
};
