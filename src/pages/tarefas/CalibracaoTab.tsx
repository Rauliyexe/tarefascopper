import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Scale,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Unlock,
  FileCheck,
  QrCode,
  Download,
  Plus,
  RefreshCw,
} from 'lucide-react';
import type { EquipamentoPesagemLeitura, StatusCalibracaoEquipamento } from '../../types';
import { soundEngine } from '../../services/soundEngine';
import { downloadCsv } from '../../utils/exportFile';
import { recordsApi } from '../../services/recordsApi';
import { useCopperOS } from '../../context/CopperOSContext';

export const CalibracaoTab: React.FC = () => {
  const { currentCompanyId, user } = useCopperOS();
  const [equipamentos, setEquipamentos] = useState<EquipamentoPesagemLeitura[]>([]);
  const [filterType, setFilterType] = useState<string>('TODOS');
  const [loading, setLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rn16LockEnabled =
    typeof localStorage === 'undefined' || localStorage.getItem('copperos_cfg_rn16_lock') !== 'false';

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const loadEquipamentos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await recordsApi.listEquipamentos(currentCompanyId);
      if (Array.isArray(res)) {
        const mapped: EquipamentoPesagemLeitura[] = res.map((b: any) => ({
          id: b.id,
          codigo: b.codigo,
          nome: b.nome,
          tipo: b.tipo,
          capacidadeMaxKg: Number(b.capacidadeMaxKg),
          precisaoKg: Number(b.precisaoKg),
          localizacao: b.localizacao,
          marcaModelo: b.marcaModelo,
          ultimaCalibracao: b.ultimaCalibracao ? String(b.ultimaCalibracao).split('T')[0] : '2026-01-10',
          validadeCalibracao: b.validadeCalibracao ? String(b.validadeCalibracao).split('T')[0] : '2027-01-10',
          certificadoNumero: b.certificadoNumero || 'RBC-2026',
          orgaoCertificador: b.orgaoCertificador || 'Inmetro / RBC',
          status: b.status as StatusCalibracaoEquipamento,
          bloqueadoOperacionalmente: Boolean(b.bloqueadoOperacionalmente),
          motivoBloqueio: b.motivoBloqueio || undefined,
        }));
        setEquipamentos(mapped);
      }
    } catch (err) {
      console.warn('[CalibracaoTab] Erro ao carregar balanças:', err);
    } finally {
      setLoading(false);
    }
  }, [currentCompanyId]);

  useEffect(() => {
    loadEquipamentos();
  }, [loadEquipamentos]);

  // Modal de Recalibração RBC
  const [recalibModal, setRecalibModal] = useState<EquipamentoPesagemLeitura | null>(null);
  const [certNum, setCertNum] = useState('');
  const [orgao, setOrgao] = useState('IPT / Labmetro RBC');
  const [novaData, setNovaData] = useState('2027-09-30');

  // Modal de Teste da TRAVA RN-16
  const [travaModal, setTravaModal] = useState<EquipamentoPesagemLeitura | null>(null);

  // Modal de Cadastro de Novo Equipamento no SQLite
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newEqForm, setNewEqForm] = useState({
    codigo: '',
    nome: '',
    tipo: 'BALANCA_RODOVIARIA',
    capacidadeMaxKg: 80000,
    precisaoKg: 10,
    localizacao: 'Portaria Logística',
    marcaModelo: 'Toledo Prix 9094',
    validadeCalibracao: '2027-10-30',
    certificadoNumero: `RBC-INMETRO-${Math.floor(10000 + Math.random() * 90000)}/2026`,
    orgaoCertificador: 'IPEM-SP / Labmetro RBC',
  });

  const blockedEquipment = useMemo(() => {
    return equipamentos.filter(e => e.status === 'CALIBRACAO_VENCIDA_BLOQUEADO' || e.bloqueadoOperacionalmente);
  }, [equipamentos]);

  const filteredEquipamentos = useMemo(() => {
    if (filterType === 'TODOS') return equipamentos;
    if (filterType === 'BLOQUEADOS') {
      return equipamentos.filter(e => e.status === 'CALIBRACAO_VENCIDA_BLOQUEADO' || e.bloqueadoOperacionalmente);
    }
    if (filterType === 'VALIDOS') return equipamentos.filter(e => e.status === 'CALIBRADO_ATIVO' && !e.bloqueadoOperacionalmente);
    return equipamentos.filter(e => e.tipo === filterType);
  }, [equipamentos, filterType]);

  const handleSimularRecalibracao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recalibModal) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const cleanCert = certNum.trim() || `CAL-RBC-${Math.floor(10000 + Math.random() * 90000)}/2026`;

    try {
      const updated = await recordsApi.updateEquipamento(recalibModal.id, {
        status: 'CALIBRADO_ATIVO' as StatusCalibracaoEquipamento,
        bloqueadoOperacionalmente: false,
        motivoBloqueio: '',
        ultimaCalibracao: todayStr,
        validadeCalibracao: novaData,
        certificadoNumero: cleanCert,
        orgaoCertificador: orgao,
        userName: user?.name || 'Engenharia de Metrologia',
      });

      soundEngine.playSuccess();
      setEquipamentos(prev => prev.map(eqp => (eqp.id === recalibModal.id ? { ...eqp, ...updated } : eqp)));
      showNotice(`Certificado ${cleanCert} homologado no SQLite! Trava RN-16 liberada para ${recalibModal.codigo}.`);
    } catch {
      soundEngine.playSuccess();
      setEquipamentos(prev =>
        prev.map(eqp =>
          eqp.id === recalibModal.id
            ? {
                ...eqp,
                status: 'CALIBRADO_ATIVO' as StatusCalibracaoEquipamento,
                bloqueadoOperacionalmente: false,
                motivoBloqueio: undefined,
                ultimaCalibracao: todayStr,
                validadeCalibracao: novaData,
                certificadoNumero: cleanCert,
                orgaoCertificador: orgao,
              }
            : eqp
        )
      );
    }

    setRecalibModal(null);
    setCertNum('');
  };

  const handleSimularVencimento = async (eqp: EquipamentoPesagemLeitura) => {
    soundEngine.playSwoosh();
    const motivo =
      'Validade do Certificado RBC expirada. Bloqueio operacional imposto pela Trava RN-16 (Portaria INMETRO / ISO 9001).';
    try {
      const updated = await recordsApi.updateEquipamento(eqp.id, {
        status: 'CALIBRACAO_VENCIDA_BLOQUEADO' as StatusCalibracaoEquipamento,
        bloqueadoOperacionalmente: true,
        motivoBloqueio: motivo,
        validadeCalibracao: '2026-09-01',
        userName: user?.name || 'Engenharia de Metrologia',
      });
      setEquipamentos(prev => prev.map(item => (item.id === eqp.id ? { ...item, ...updated } : item)));
      showNotice(`Trava Metrológica RN-16 acionada para ${eqp.codigo} e gravada na auditoria SQLite!`);
    } catch {
      // Fallback local
    }
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEqForm.codigo.trim() || !newEqForm.nome.trim()) return;

    try {
      const created = await recordsApi.createEquipamento({
        companyId: currentCompanyId,
        codigo: newEqForm.codigo.trim().toUpperCase(),
        nome: newEqForm.nome.trim(),
        tipo: newEqForm.tipo as any,
        capacidadeMaxKg: Number(newEqForm.capacidadeMaxKg),
        precisaoKg: Number(newEqForm.precisaoKg),
        localizacao: newEqForm.localizacao.trim(),
        marcaModelo: newEqForm.marcaModelo.trim(),
        ultimaCalibracao: new Date().toISOString().slice(0, 10),
        validadeCalibracao: newEqForm.validadeCalibracao,
        certificadoNumero: newEqForm.certificadoNumero.trim(),
        orgaoCertificador: newEqForm.orgaoCertificador.trim(),
        status: 'CALIBRADO_ATIVO' as StatusCalibracaoEquipamento,
        bloqueadoOperacionalmente: false,
        userName: user?.name || 'Engenharia de Metrologia',
      });

      soundEngine.playSuccess();
      setEquipamentos(prev => [created, ...prev]);
      setIsCreateOpen(false);
      setNewEqForm({
        codigo: '',
        nome: '',
        tipo: 'BALANCA_RODOVIARIA',
        capacidadeMaxKg: 80000,
        precisaoKg: 10,
        localizacao: 'Portaria Logística',
        marcaModelo: 'Toledo Prix 9094',
        validadeCalibracao: '2027-10-30',
        certificadoNumero: `RBC-INMETRO-${Math.floor(10000 + Math.random() * 90000)}/2026`,
        orgaoCertificador: 'IPEM-SP / Labmetro RBC',
      });
      showNotice(`Equipamento ${created.codigo} cadastrado com sucesso no banco SQLite!`);
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar equipamento');
    }
  };

  const handleExportCsv = () => {
    soundEngine.playClick();
    const headers = [
      'Código',
      'Nome do Equipamento',
      'Tipo',
      'Localização / Posto',
      'Status Calibração',
      'Bloqueado Operacionalmente',
      'Última Calibração',
      'Validade Calibração',
      'Certificado RBC',
      'Órgão Calibrador',
      'Capacidade Máx (kg)',
      'Precisão (kg)',
      'Motivo de Bloqueio',
    ];

    const rows = filteredEquipamentos.map(e => [
      e.codigo,
      e.nome,
      e.tipo,
      e.localizacao,
      e.status,
      e.bloqueadoOperacionalmente ? 'SIM' : 'NÃO',
      e.ultimaCalibracao,
      e.validadeCalibracao,
      e.certificadoNumero || '-',
      e.orgaoCertificador || '-',
      String(e.capacidadeMaxKg),
      String(e.precisaoKg),
      e.motivoBloqueio || '-',
    ]);

    downloadCsv(`calendario-calibracao-copperos-${Date.now()}.csv`, headers, rows);
  };

  return (
    <div className="p-6 space-y-6">
      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Banner de Status de Calibração RN-16 */}
      {blockedEquipment.length > 0 && rn16LockEnabled ? (
        <div className="p-5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-800 dark:text-rose-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-600/30">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  TRAVA METROLÓGICA RN-16 ATIVA — {blockedEquipment.length} Equipamento(s) com Calibração Vencida
                </h3>
                <span className="px-2 py-0.5 rounded-full text-micro font-bold bg-rose-600 text-white font-mono">
                  BLOQUEIO INVIOLÁVEL
                </span>
              </div>
              <p className="text-xs text-rose-700/80 dark:text-rose-300/80 mt-1">
                Conforme a <strong>Portaria INMETRO/IPEM e ISO 9001</strong>, equipamentos com calibração vencida estão
                bloqueados no banco SQLite para pesagens de recebimento, fundição ou expedição até homologação de novo laudo RBC.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                soundEngine.playSwoosh();
                setTravaModal(blockedEquipment[0]);
              }}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Lock className="w-3.5 h-3.5" />
              Inspecionar Bloqueio
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="text-xs">
              <strong>Parque Metrológico Regularizado no SQLite:</strong> Todos os equipamentos de pesagem e leitura estão com calibração em dia.
            </div>
          </div>
          {!rn16LockEnabled && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold">
              Trava RN-16 desativada nas Configurações
            </span>
          )}
        </div>
      )}

      {/* Grid de Resumo Metrológico */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-night-900 p-4 rounded-xl border border-gray-200 dark:border-night-800">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total de Equipamentos (SQLite)</span>
          <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">{equipamentos.length}</p>
          <span className="text-micro text-gray-500">Monitorados em tempo real</span>
        </div>

        <div className="bg-white dark:bg-night-900 p-4 rounded-xl border border-gray-200 dark:border-night-800">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Calibração Válida</span>
          <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {equipamentos.filter(e => e.status === 'CALIBRADO_ATIVO' && !e.bloqueadoOperacionalmente).length}
          </p>
          <span className="text-micro text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Certificados RBC vigentes
          </span>
        </div>

        <div className="bg-white dark:bg-night-900 p-4 rounded-xl border border-gray-200 dark:border-night-800">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Bloqueados por Vencimento (RN-16)</span>
          <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {blockedEquipment.length}
          </p>
          <span className="text-micro text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
            <Lock className="w-3 h-3" /> Trava operacional ativa
          </span>
        </div>
      </div>

      {/* Controles de Filtro, Cadastro e Exportação */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-night-900 p-4 rounded-xl border border-gray-200 dark:border-night-800">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Todos', val: 'TODOS' },
            { label: 'Bloqueados (RN-16)', val: 'BLOQUEADOS' },
            { label: 'Válidos', val: 'VALIDOS' },
            { label: 'Balanças Rodoviárias', val: 'BALANCA_RODOVIARIA' },
            { label: 'Balanças de Piso/Forno', val: 'BALANCA_PISO' },
            { label: 'Plataformas Expedição', val: 'BALANCA_PLATAFORMA' },
            { label: 'Espectrômetros ASTM', val: 'ESPECTROMETRO' },
          ].map(f => (
            <button
              key={f.val}
              onClick={() => {
                soundEngine.playClick();
                setFilterType(f.val);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === f.val
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-night-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setIsCreateOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Balança / Equipamento</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-night-700 hover:border-emerald-500 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={loadEquipamentos}
            className="p-1.5 rounded-xl border border-gray-300 dark:border-night-700 hover:border-emerald-500 text-gray-500 dark:text-gray-400 cursor-pointer"
            title="Sincronizar com SQLite"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grade de Equipamentos Metrológicos */}
      {filteredEquipamentos.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Scale className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Nenhum equipamento encontrado para este filtro
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Altere o filtro acima ou cadastre um novo equipamento no parque metrológico.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEquipamentos.map(eqp => {
            const isVencido = eqp.status === 'CALIBRACAO_VENCIDA_BLOQUEADO' || eqp.bloqueadoOperacionalmente;

            return (
              <div
                key={eqp.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isVencido
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60 shadow-sm'
                    : 'bg-white dark:bg-night-900 border-gray-200 dark:border-night-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isVencido
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {eqp.tipo === 'PISTOLA_QR' ? <QrCode className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-micro font-bold text-gray-500">{eqp.codigo}</span>
                        {isVencido ? (
                          <span className="px-2 py-0.5 rounded-full text-micro font-bold bg-rose-600 text-white flex items-center gap-1">
                            <Lock className="w-3 h-3" /> BLOQUEADO (RN-16)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-micro font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> CALIBRADO & ATIVO
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mt-1">{eqp.nome}</h4>
                      <p className="text-micro text-gray-500">
                        {eqp.localizacao} {eqp.marcaModelo ? `• ${eqp.marcaModelo}` : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Parâmetros Metrológicos */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs bg-gray-50 dark:bg-night-850 p-3 rounded-xl">
                  <div>
                    <span className="text-micro text-gray-500 block">Capacidade Máxima:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {eqp.capacidadeMaxKg ? `${eqp.capacidadeMaxKg.toLocaleString('pt-BR')} kg` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-micro text-gray-500 block">Precisão / Divisão:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {eqp.precisaoKg ? `${eqp.precisaoKg} kg` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-micro text-gray-500 block">Última Calibração:</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {new Date(eqp.ultimaCalibracao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-micro text-gray-500 block">Validade da Calibração:</span>
                    <span
                      className={`font-mono font-bold ${
                        isVencido ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {new Date(eqp.validadeCalibracao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Informações de Certificação */}
                <div className="mt-3 text-micro text-gray-600 dark:text-gray-400 flex items-center justify-between">
                  <span>
                    Certificado: <strong>{eqp.certificadoNumero || 'Pendente'}</strong>
                  </span>
                  <span>
                    Órgão: <strong>{eqp.orgaoCertificador || 'IPEM/INMETRO'}</strong>
                  </span>
                </div>

                {/* Alerta de Bloqueio Específico */}
                {isVencido && eqp.motivoBloqueio && (
                  <div className="mt-3 p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-micro">
                    <strong>Motivo do Bloqueio: </strong> {eqp.motivoBloqueio}
                  </div>
                )}

                {/* Ações */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-night-800 flex items-center justify-between gap-2 flex-wrap">
                  {isVencido ? (
                    <>
                      <button
                        onClick={() => {
                          soundEngine.playSwoosh();
                          setTravaModal(eqp);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/40 transition cursor-pointer flex items-center gap-1"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Ver Regra da Trava
                      </button>

                      <button
                        onClick={() => {
                          soundEngine.playClick();
                          setRecalibModal(eqp);
                          setCertNum(`CAL-RBC-${Math.floor(10000 + Math.random() * 90000)}/2026`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Registrar Nova Calibração RBC
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          soundEngine.playClick();
                          setRecalibModal(eqp);
                          setCertNum(eqp.certificadoNumero || '');
                        }}
                        className="flex-1 py-1.5 px-3 rounded-lg border border-gray-300 dark:border-night-700 text-gray-700 dark:text-gray-300 hover:border-emerald-500 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                        Atualizar Certificado
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSimularVencimento(eqp)}
                        className="py-1.5 px-2.5 rounded-lg border border-amber-300 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                        title="Simular expiração de certificado para testar a Trava RN-16"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Testar Trava RN-16
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Cadastro de Novo Equipamento */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-night-800 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  Cadastrar Nova Balança / Equipamento no SQLite
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Código Identificador *
                  </label>
                  <input
                    type="text"
                    required
                    value={newEqForm.codigo}
                    onChange={e => setNewEqForm(prev => ({ ...prev, codigo: e.target.value }))}
                    placeholder="Ex: BAL-ROD-04"
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Categoria Metrológica *
                  </label>
                  <select
                    value={newEqForm.tipo}
                    onChange={e => setNewEqForm(prev => ({ ...prev, tipo: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white"
                  >
                    <option value="BALANCA_RODOVIARIA">Balança Rodoviária</option>
                    <option value="BALANCA_PISO">Balança de Piso / Forno</option>
                    <option value="BALANCA_PLATAFORMA">Balança Plataforma Expedição</option>
                    <option value="ESPECTROMETRO">Espectrômetro / Analítico</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Nome Descritivo do Equipamento *
                </label>
                <input
                  type="text"
                  required
                  value={newEqForm.nome}
                  onChange={e => setNewEqForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Balança Rodoviária Portaria Sul (80 Toneladas)"
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Capacidade Máxima (kg)
                  </label>
                  <input
                    type="number"
                    value={newEqForm.capacidadeMaxKg}
                    onChange={e => setNewEqForm(prev => ({ ...prev, capacidadeMaxKg: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Precisão / Divisão (kg)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={newEqForm.precisaoKg}
                    onChange={e => setNewEqForm(prev => ({ ...prev, precisaoKg: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Localização / Setor
                  </label>
                  <input
                    type="text"
                    value={newEqForm.localizacao}
                    onChange={e => setNewEqForm(prev => ({ ...prev, localizacao: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Marca / Modelo
                  </label>
                  <input
                    type="text"
                    value={newEqForm.marcaModelo}
                    onChange={e => setNewEqForm(prev => ({ ...prev, marcaModelo: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nº Certificado RBC
                  </label>
                  <input
                    type="text"
                    value={newEqForm.certificadoNumero}
                    onChange={e => setNewEqForm(prev => ({ ...prev, certificadoNumero: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Validade da Calibração
                  </label>
                  <input
                    type="date"
                    value={newEqForm.validadeCalibracao}
                    onChange={e => setNewEqForm(prev => ({ ...prev, validadeCalibracao: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-night-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  Salvar no SQLite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Recalibração RBC */}
      {recalibModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-night-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  Lançar Certificado de Calibração (SQLite)
                </h3>
              </div>
              <button
                onClick={() => setRecalibModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimularRecalibracao} className="space-y-4">
              <div>
                <span className="text-xs text-gray-500">Equipamento:</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {recalibModal.nome} ({recalibModal.codigo})
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Número do Certificado RBC / Inmetro *
                </label>
                <input
                  type="text"
                  value={certNum}
                  onChange={e => setCertNum(e.target.value)}
                  placeholder="Ex: CAL-RBC-88421/2026"
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Órgão Calibrador Acreditado *
                </label>
                <input
                  type="text"
                  value={orgao}
                  onChange={e => setOrgao(e.target.value)}
                  placeholder="Ex: IPT / Labmetro RBC"
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Nova Validade da Calibração *
                </label>
                <input
                  type="date"
                  value={novaData}
                  onChange={e => setNovaData(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-micro">
                Ao homologar o laudo, o registro será atualizado no banco <strong>SQLite</strong>, a Trava RN-16 será liberada e o evento será gravado na trilha imutável de auditoria (`AuditLog`).
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-night-800">
                <button
                  type="button"
                  onClick={() => setRecalibModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Homologar e Desbloquear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhe da TRAVA do CopperOS */}
      {travaModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-night-900 border border-rose-500/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert className="w-7 h-7" />
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-gray-900 dark:text-white">
                  Princípio do Bloqueio: TRAVA INVIOLÁVEL RN-16
                </h3>
                <span className="text-micro font-mono text-rose-600 dark:text-rose-400 font-bold">
                  REGRA CO-MET-001 (Portaria INMETRO 236/94 & NBR 6591)
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-gray-700 dark:text-gray-300">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <strong className="text-rose-700 dark:text-rose-300 block mb-1">Equipamento Violado:</strong>
                <span>
                  {travaModal.nome} ({travaModal.codigo}) — {travaModal.localizacao}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">Data de Expiração:</span>
                  <span className="text-rose-600 font-bold">
                    {new Date(travaModal.validadeCalibracao).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Data Atual do Sistema:</span>
                  <span className="text-gray-900 dark:text-white font-bold">
                    {new Date().toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status Operacional (SQLite):</span>
                  <span className="text-rose-600 font-bold">BLOQUEADO (PESAGEM REJEITADA)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-micro">
                <strong>O que falta para liberar:</strong> Realizar calibração com pesos-padrão rastreados RBC, emitir laudo de conformidade metrológica e clicar em <strong>Registrar Nova Calibração RBC</strong>.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-night-800">
              <button
                onClick={() => {
                  const target = travaModal;
                  setTravaModal(null);
                  setRecalibModal(target);
                  setCertNum(`CAL-RBC-${Math.floor(10000 + Math.random() * 90000)}/2026`);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Lançar Certificado RBC Agora
              </button>
              <button
                onClick={() => setTravaModal(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
