import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  Building2,
  ArrowUpRight,
  Calendar,
  Layers,
  FileText,
  RefreshCw,
  Search,
  Eye,
  X,
} from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import {
  reportsApi,
  ConsolidationPeriodType,
  ExecutiveAnalysisResponse,
} from '../../services/reportsApi';

const PRESET_QUERIES = [
  'Quais foram os principais problemas da Copper nos últimos 30 dias?',
  'Quais departamentos relataram mais impedimentos nesta semana?',
  'Quais pendências se repetiram neste mês?',
  'Faça uma síntese das atividades de ontem.',
  'Compare os problemas operacionais deste mês com o anterior.',
];

export const ExecutiveAnalyticsView: React.FC = () => {
  const { user, currentCompany } = useCopperOS();
  const activeCompanyId = currentCompany.id;

  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  })();

  const [query, setQuery] = useState<string>(PRESET_QUERIES[0]);
  const [periodType, setPeriodType] = useState<ConsolidationPeriodType>('MENSAL');
  const [startDate, setStartDate] = useState<string>(thirtyDaysAgo);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExecutiveAnalysisResponse | null>(null);

  const [recipientEmail, setRecipientEmail] = useState<string>(
    user.email || 'andre@coppergroup.com.br'
  );
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [execTab, setExecTab] = useState<'resumo' | 'departamentos' | 'gargalos' | 'fontes'>('resumo');

  const applyPeriodPreset = (preset: ConsolidationPeriodType) => {
    setPeriodType(preset);
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    if (preset === 'DIARIO') {
      setStartDate(end);
      setEndDate(end);
    } else if (preset === 'SEMANAL') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(end);
    } else if (preset === 'MENSAL') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(end);
    }
  };

  const runExecutiveQuery = async (customQuery?: string, customPeriod?: ConsolidationPeriodType) => {
    const activeQ = customQuery !== undefined ? customQuery : query;
    const activePeriod = customPeriod || periodType;
    setLoading(true);
    setError(null);
    setEmailStatus(null);

    try {
      let sDate = startDate;
      let eDate = endDate;
      const qLower = activeQ.toLowerCase();

      if (customQuery) {
        const now = new Date();
        const todayKey = now.toISOString().slice(0, 10);
        if (qLower.includes('ontem')) {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          const yKey = y.toISOString().slice(0, 10);
          sDate = yKey;
          eDate = yKey;
          setStartDate(yKey);
          setEndDate(yKey);
          setPeriodType('DIARIO');
        } else if (qLower.includes('semana')) {
          const w = new Date(now);
          w.setDate(w.getDate() - 6);
          sDate = w.toISOString().slice(0, 10);
          eDate = todayKey;
          setStartDate(sDate);
          setEndDate(eDate);
          setPeriodType('SEMANAL');
        } else if (qLower.includes('30 dias') || qLower.includes('mês') || qLower.includes('mes')) {
          const m = new Date(now);
          m.setDate(m.getDate() - 29);
          sDate = m.toISOString().slice(0, 10);
          eDate = todayKey;
          setStartDate(sDate);
          setEndDate(eDate);
          setPeriodType('MENSAL');
        }
      }

      const res = await reportsApi.executiveAsk({
        companyId: activeCompanyId,
        query: activeQ,
        startDate: sDate,
        endDate: eDate,
        periodType: activePeriod,
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message || 'Erro ao executar consulta analítica executiva.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.role === 'CEO') {
      runExecutiveQuery(PRESET_QUERIES[0], 'MENSAL');
    }
  }, [activeCompanyId, user.role]);

  const handleVoiceQuestion = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Reconhecimento de voz não suportado neste navegador.');
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setQuery(transcript);
        runExecutiveQuery(transcript);
      }
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleSpeakAnalysis = () => {
    if (!('speechSynthesis' in window) || !result) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const cleanText = result.analysis.answerMarkdown.replace(/[#*_`>-]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendEmail = async () => {
    if (!result) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const resp = await reportsApi.sendConsolidationEmail({
        consolidationId: result.consolidationId,
        recipientEmail: recipientEmail || 'andre@coppergroup.com.br',
        companyId: activeCompanyId,
      });
      setEmailStatus(
        `Enviado com sucesso para ${resp.dispatch.recipient} (${resp.dispatch.transportMode === 'WEBHOOK_API' ? 'Disparo SMTP/API' : 'Registrado no Spool Auditado PostgreSQL'}) às ${new Date(resp.dispatch.dispatchedAt).toLocaleTimeString('pt-BR')}`
      );
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar síntese por e-mail.');
    } finally {
      setSendingEmail(false);
    }
  };

  if (user.role !== 'CEO') {
    return (
      <div className="bg-zinc-900/90 border border-red-500/30 rounded-2xl p-8 text-center">
        <ShieldCheck className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white">Acesso Restrito — Nível 3 (CEO)</h3>
        <p className="text-sm text-zinc-400 mt-1">
          A camada de Inteligência Executiva Consolidada e comparação entre departamentos é exclusiva para o André (Administrador Executivo).
        </p>
      </div>
    );
  }

  const analysis = result?.analysis;
  const selectedSource = analysis?.sources.find(s => s.reportId === selectedSourceId) || null;

  return (
    <div className="space-y-6">
      {/* Cabeçalho Executivo Nível 3 */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Exclusivo Nível 3 • André (CEO)
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                100% Fundamentado em Registros Reais PostgreSQL
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Inteligência Executiva & Consolidação Multi-Departamental
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Identifica gargalos operacionais recorrentes, compara períodos e departamentos, aponta ausências de informação sem juízo subjetivo e mantém rastreabilidade até o relatório original.
            </p>
          </div>

          {/* Seletor de Período Base */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'DIARIO', label: 'Diário' },
                { id: 'SEMANAL', label: 'Semanal (7d)' },
                { id: 'MENSAL', label: 'Mensal (30d)' },
                { id: 'PERSONALIZADO', label: 'Personalizado' },
              ] as Array<{ id: ConsolidationPeriodType; label: string }>
            ).map(p => (
              <button
                key={p.id}
                onClick={() => applyPeriodPreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  periodType === p.id
                    ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold shadow'
                    : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-xl px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setPeriodType('PERSONALIZADO');
                  setStartDate(e.target.value);
                }}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none"
              />
              <span className="text-zinc-500 text-xs">até</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setPeriodType('PERSONALIZADO');
                  setEndDate(e.target.value);
                }}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Barra de Pergunta Analítica do André (Texto + Voz STT) */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') runExecutiveQuery();
                }}
                placeholder="Pergunte ao Copiloto Executivo (ex: Quais foram os principais problemas da Copper nos últimos 30 dias?)"
                className="w-full bg-zinc-950/90 border border-zinc-700/80 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleVoiceQuestion}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                isListening
                  ? 'bg-red-500/20 border-red-500 text-red-300 animate-pulse'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-amber-400" />}
              {isListening ? 'Ouvindo...' : 'Perguntar por Voz'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => runExecutiveQuery()}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Analisar Dados Reais
            </button>
          </div>

          {/* Atalhos de Consultas Analíticas do André (Seção 10) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-zinc-400 font-medium mr-1">
              Consultas rápidas (André):
            </span>
            {PRESET_QUERIES.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setQuery(preset);
                  runExecutiveQuery(preset);
                }}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                  query === preset
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-semibold'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                “{preset}”
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* Sub-navegação Executiva Enxuta (Evita poluição visual de múltiplas tabelas) */}
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2">
            <button
              type="button"
              onClick={() => setExecTab('resumo')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                execTab === 'resumo'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Síntese & Comparativo de Períodos</span>
            </button>

            <button
              type="button"
              onClick={() => setExecTab('departamentos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                execTab === 'departamentos'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Por Departamento ({analysis.departmentComparison.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setExecTab('gargalos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                execTab === 'gargalos'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Padrões & Ausências ({analysis.recurringPatterns.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setExecTab('fontes')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                execTab === 'fontes'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Fontes Originais ({analysis.sources.length})</span>
            </button>
          </div>

          {execTab === 'resumo' && (
            <div className="space-y-4">
              {/* Card 1: Resposta Analítica + Disparo de E-mail + Leitura em Voz */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold">
                      Consulta Analítica Fundamentada
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      “{analysis.queryAnswered}”
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSpeakAnalysis}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5"
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-red-400" /> Parar Leitura
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Ouvir Síntese (TTS)
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl p-1">
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={e => setRecipientEmail(e.target.value)}
                        placeholder="andre@coppergroup.com.br"
                        className="bg-transparent text-xs text-zinc-200 px-2.5 py-1 focus:outline-none w-48"
                      />
                      <button
                        type="button"
                        disabled={sendingEmail}
                        onClick={handleSendEmail}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {sendingEmail ? 'Enviando...' : 'Enviar por E-mail'}
                      </button>
                    </div>
                  </div>
                </div>

                {emailStatus && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{emailStatus}</span>
                  </div>
                )}

                <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-xl p-4 text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans">
                  {analysis.answerMarkdown}
                </div>
              </div>

              {/* Card 2: Comparação entre Períodos (Atual vs Anterior) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4">
                  <div className="text-xs font-semibold text-zinc-400 flex items-center justify-between">
                    <span>Período Analisado</span>
                    <span className="text-amber-400 font-mono">
                      {analysis.periodComparison.currentPeriod.startDate} →{' '}
                      {analysis.periodComparison.currentPeriod.endDate}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <div className="bg-zinc-950/70 rounded-xl p-2.5 border border-zinc-800/80">
                      <div className="text-[11px] text-zinc-400">Relatórios</div>
                      <div className="text-lg font-bold text-white">
                        {analysis.periodComparison.currentPeriod.reportsCount}
                      </div>
                    </div>
                    <div className="bg-zinc-950/70 rounded-xl p-2.5 border border-zinc-800/80">
                      <div className="text-[11px] text-zinc-400">Problemas</div>
                      <div className="text-lg font-bold text-amber-400">
                        {analysis.periodComparison.currentPeriod.problemsCount}
                      </div>
                    </div>
                    <div className="bg-zinc-950/70 rounded-xl p-2.5 border border-zinc-800/80">
                      <div className="text-[11px] text-zinc-400">Bloqueios</div>
                      <div className="text-lg font-bold text-red-400">
                        {analysis.periodComparison.currentPeriod.blocksCount}
                      </div>
                    </div>
                    <div className="bg-zinc-950/70 rounded-xl p-2.5 border border-zinc-800/80">
                      <div className="text-[11px] text-zinc-400">Pendências</div>
                      <div className="text-lg font-bold text-sky-400">
                        {analysis.periodComparison.currentPeriod.pendingCount}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4">
                  <div className="text-xs font-semibold text-zinc-400 flex items-center justify-between">
                    <span>Período Anterior Equivalente</span>
                    <span className="text-zinc-400 font-mono">
                      {analysis.periodComparison.previousPeriod.startDate} →{' '}
                      {analysis.periodComparison.previousPeriod.endDate}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <div className="bg-zinc-950/70 rounded-xl p-2.5 border border-zinc-800/80">
                      <div className="text-[11px] text-zinc-400">Relatórios</div>
                      <div className="text-lg font-bold text-zinc-300">
                        {analysis.periodComparison.previousPeriod.reportsCount}
                      </div>
                    </div>
                    <div className="bg-zinc-950/70 rounded-xl p-2.5 border border-zinc-800/80">
                      <div className="text-[11px] text-zinc-400">Problemas</div>
                      <div className="text-lg font-bold text-zinc-300">
                        {analysis.periodComparison.previousPeriod.problemsCount}
                      </div>
                    </div>
                    <div className="bg-zinc-950/70 rounded-xl p-2.5 border border-zinc-800/80">
                      <div className="text-[11px] text-zinc-400">Bloqueios</div>
                      <div className="text-lg font-bold text-zinc-300">
                        {analysis.periodComparison.previousPeriod.blocksCount}
                      </div>
                    </div>
                    <div className="bg-zinc-950/70 rounded-xl p-2.5 border border-zinc-800/80">
                      <div className="text-[11px] text-zinc-400">Pendências</div>
                      <div className="text-lg font-bold text-zinc-300">
                        {analysis.periodComparison.previousPeriod.pendingCount}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/90 border border-amber-500/25 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    Variação entre Períodos
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed mt-2">
                    {analysis.periodComparison.deltaSummary}
                  </p>
                </div>
              </div>
            </div>
          )}

          {execTab === 'departamentos' && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    Comparativo Consolidado por Departamento
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Visão multi-departamental de relatos enviados, impedimentos, bloqueios operacionais, pendências e ausência de informação.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400">
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3">Relatórios Recebidos</th>
                      <th className="py-2.5 px-3">Cobertura Equipe</th>
                      <th className="py-2.5 px-3">Sem Envio (Ausência Info)</th>
                      <th className="py-2.5 px-3">Problemas Relatados</th>
                      <th className="py-2.5 px-3">Bloqueios Críticos</th>
                      <th className="py-2.5 px-3">Pendências</th>
                      <th className="py-2.5 px-3">Tarefas Concluídas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {analysis.departmentComparison.map(dept => (
                      <tr key={dept.departmentId} className="hover:bg-zinc-800/30">
                        <td className="py-2.5 px-3 font-semibold text-white">
                          {dept.departmentName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-200">
                          {dept.reportsCount}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-300">
                          {dept.submittedEmployeesCount}/{dept.employeesCount} funcionários
                        </td>
                        <td className="py-2.5 px-3">
                          {dept.missingEmployeesCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {dept.missingEmployeesCount} sem envio
                            </span>
                          ) : (
                            <span className="text-zinc-500">100% enviado</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-bold ${
                              dept.problemsCount > 0 ? 'text-amber-400' : 'text-zinc-500'
                            }`}
                          >
                            {dept.problemsCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-bold ${
                              dept.operationalBlocksCount > 0 ? 'text-red-400' : 'text-zinc-500'
                            }`}
                          >
                            {dept.operationalBlocksCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-sky-300 font-semibold">
                          {dept.pendingItemsCount}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-semibold">
                          {dept.tasksCompletedCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {execTab === 'gargalos' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Padrões Recorrentes */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Padrões Recorrentes & Gargalos Identificados
                </h3>
                {analysis.recurringPatterns.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    Nenhum padrão recorrente crítico detectado nos relatórios do intervalo.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {analysis.recurringPatterns.map((pat, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-300">{pat.theme}</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300">
                            {pat.occurrences} ocorrência(s)
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300">{pat.description}</p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-zinc-500">Setores:</span>
                          {pat.departmentsAffected.map(d => (
                            <span
                              key={d}
                              className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300"
                            >
                              {d}
                            </span>
                          ))}
                          {pat.sourceReportIds.map(id => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                setSelectedSourceId(id);
                                setExecTab('fontes');
                              }}
                              className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 flex items-center gap-1"
                            >
                              <Eye className="w-2.5 h-2.5" /> Fonte #{id.slice(0, 8)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ausência de Informação */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  Dados Ausentes / Cobertura de Envio por Setor
                </h3>
                <p className="text-[11px] text-zinc-400">
                  A falta de envio no intervalo é registrada estritamente como <strong>ausência de informação</strong>, e nunca como ausência de trabalho ou ranking subjetivo.
                </p>
                {analysis.informationGaps.length === 0 ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300">
                    Todos os funcionários ativos possuem relatórios registrados no período consultado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {analysis.informationGaps.map((gap, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">
                            {gap.departmentName}
                          </span>
                          <span className="text-[11px] text-amber-300">
                            {gap.missingEmployeeNames.length} sem registro no período
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Sem relatório enviado: {gap.missingEmployeeNames.join(', ')}
                        </p>
                        <p className="text-[11px] text-zinc-500 italic">{gap.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {execTab === 'fontes' && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Fontes Rastreáveis que Fundamentam esta Análise ({analysis.sources.length} relatórios originais)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Clique em qualquer registro para inspecionar a fonte original auditável enviada pelo funcionário.
                  </p>
                </div>
              </div>

              {selectedSource && (
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-amber-300">
                      Inspeção de Fonte Original • ID #{selectedSource.reportId}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSourceId(null)}
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-white font-semibold">
                    {selectedSource.userName} ({selectedSource.department}) — Expediente{' '}
                    {selectedSource.dateKey} • Turno {selectedSource.shift}
                  </div>
                  <p className="text-xs text-zinc-200 bg-zinc-950/80 p-3 rounded-lg border border-zinc-800">
                    {selectedSource.summaryExcerpt}
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-zinc-400">
                    <span>Tarefas Concluídas vinculadas: {selectedSource.tasksCompletedCount}</span>
                    <span>Tarefas Pendentes vinculadas: {selectedSource.tasksPendingCount}</span>
                    <span>
                      Impedimentos relatados: {selectedSource.hasProblems ? 'Sim' : 'Não'}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {analysis.sources.map(src => (
                  <button
                    key={src.reportId}
                    type="button"
                    onClick={() => setSelectedSourceId(src.reportId)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      selectedSourceId === src.reportId
                        ? 'bg-amber-500/15 border-amber-500/60'
                        : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-amber-400">#{src.reportId.slice(0, 8)}</span>
                      <span className="text-zinc-400">{src.dateKey}</span>
                    </div>
                    <div className="text-xs font-bold text-white mt-1">
                      {src.userName} • <span className="text-zinc-400 font-normal">{src.department}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">
                      {src.summaryExcerpt}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                      <span>
                        Concluídas: {src.tasksCompletedCount} | Pendentes: {src.tasksPendingCount}
                      </span>
                      <span className="text-amber-300 flex items-center gap-0.5">
                        Ver fonte <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
