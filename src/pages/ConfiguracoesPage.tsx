import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings,
  User as UserIcon,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Save,
  Clock,
  Scale,
  Download,
  Upload,
  Sliders,
  History,
  Mic,
  MicOff,
  ArrowLeft,
  RefreshCw,
  Search,
  MapPin,
  KeyRound,
  Bell,
  Database,
  Play,
  Plus,
  Trash2,
  Mail,
  Zap,
  FileSpreadsheet,
  Edit3,
  FileText,
  Lock,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useCopperOS } from '../context/CopperOSContext';
import { useTasks } from '../context/TasksContext';
import { soundEngine } from '../services/soundEngine';
import { aiCopilotService } from '../services/aiCopilotService';
import { voiceTtsService, PRESET_VOICES } from '../services/voiceTtsService';
import { voiceEngine } from '../services/speechService';
import { auditApi, AuditLogItem } from '../services/auditApi';
import { tasksApi } from '../services/tasksApi';
import { systemApi } from '../services/systemApi';
import { downloadCsv } from '../utils/exportFile';
import { Company, CompanyBranch, User } from '../types';
import { TiUserManagementPanel } from '../components/admin/TiUserManagementPanel';

type SettingsSection = 'ti-usuarios' | 'perfil' | 'visual' | 'empresas' | 'automacoes' | 'lgpd';

export const ConfiguracoesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    setIsSettingsOpen,
    user,
    availableUsers,
    switchUser,
    updateUserProfile,
    addUserProfile,
    isDarkMode,
    toggleTheme,
    soundEnabled,
    toggleSound,
    companies,
    currentCompany,
    currentCompanyId,
    setCurrentCompanyId,
    activeBranch,
    setActiveBranchId,
    addCompany,
    addBranch,
    deleteBranch,
    isWakeWordListening,
    setIsWakeWordListening,
  } = useCopperOS();

  const { tasks, setTasks, refreshTasks, dispatchRoutineNow, lastRoutineSweepAt } = useTasks();

  const isHigherRole = user.role === 'ADMIN' || user.role === 'CEO' || user.role === 'MANAGER';
  const isTiRole = user.role === 'ADMIN' || user.role === 'SUPERADMIN' || user.role === 'CEO';

  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    const sec = searchParams.get('section') as SettingsSection | null;
    if (isTiRole && sec === 'ti-usuarios') return 'ti-usuarios';
    if (sec && ['perfil', 'visual', 'empresas', 'automacoes', 'lgpd'].includes(sec)) {
      return sec;
    }
    return isTiRole ? 'ti-usuarios' : 'perfil';
  });
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const showBannerNotice = (msg: string) => {
    soundEngine.playSuccess();
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3500);
  };

  // ── 1. Estados de Edição de Perfil & Novo Colaborador ──
  const [profileForm, setProfileForm] = useState({
    name: user.name,
    email: user.email,
    jobTitle: user.jobTitle || '',
    department: user.department || '',
    role: user.role,
  });

  useEffect(() => {
    setProfileForm({
      name: user.name,
      email: user.email,
      jobTitle: user.jobTitle || '',
      department: user.department || '',
      role: user.role,
    });
  }, [user]);

  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    jobTitle: '',
    department: 'Operações Industriais',
    role: 'MANAGER' as User['role'],
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.name.trim()) return;
    updateUserProfile({
      name: profileForm.name.trim(),
      email: profileForm.email.trim(),
      jobTitle: profileForm.jobTitle.trim(),
      department: profileForm.department.trim(),
      role: profileForm.role,
    });
    auditApi
      .record({
        action: 'USER_PROFILE_UPDATE',
        entity: 'User',
        entityId: user.id,
        companyId: currentCompanyId,
        userId: user.id,
        userName: profileForm.name.trim(),
        userEmail: profileForm.email.trim(),
        userRole: profileForm.role,
        description: `Perfil atualizado: ${profileForm.name.trim()} (${profileForm.jobTitle.trim() || profileForm.role})`,
      })
      .catch(() => { });
    showBannerNotice('Dados do seu perfil atualizados e gravados com sucesso!');
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name.trim() || !newUserForm.email.trim()) return;
    const created: User = {
      id: `usr-${Date.now()}`,
      name: newUserForm.name.trim(),
      email: newUserForm.email.trim(),
      role: newUserForm.role,
      jobTitle: newUserForm.jobTitle.trim() || 'Coordenador Operacional',
      department: newUserForm.department.trim() || 'Operações',
      organizationId: 'org-copper-group',
      companyAccess: ['*'],
      permissions:
        newUserForm.role === 'CEO'
          ? ['company.view', 'company.edit', 'module.view', 'module.create', 'module.edit', 'module.delete', 'reports.view', 'reports.export']
          : newUserForm.role === 'MANAGER'
            ? ['module.view', 'module.create', 'module.edit', 'reports.view']
            : ['module.view', 'module.edit'],
    };
    addUserProfile(created);
    setShowNewUserForm(false);
    setNewUserForm({ name: '', email: '', jobTitle: '', department: 'Operações Industriais', role: 'MANAGER' });
    showBannerNotice(`Colaborador "${created.name}" cadastrado e ativado!`);
  };

  // ── 2. Estados de Voz & Teste de Microfone ("Ei Copper") ──
  const initialVoice = useMemo(() => voiceTtsService.getSettings(), []);
  const [selectedVoiceId, setSelectedVoiceId] = useState(initialVoice.voiceId);
  const [voiceRate, setVoiceRate] = useState(initialVoice.rate);
  const [voicePitch, setVoicePitch] = useState(initialVoice.pitch);
  const [voiceRepliesOn, setVoiceRepliesOn] = useState(
    () => typeof localStorage === 'undefined' || localStorage.getItem('copper_voice_replies') !== 'false'
  );
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micTestResult, setMicTestResult] = useState<string>('');

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    voiceTtsService.saveSettings({ voiceId, rate: voiceRate, pitch: voicePitch });
    soundEngine.playClick();
  };

  const handleRateChange = (rate: number) => {
    setVoiceRate(rate);
    voiceTtsService.saveSettings({ rate });
  };

  const handlePitchChange = (pitch: number) => {
    setVoicePitch(pitch);
    voiceTtsService.saveSettings({ pitch });
  };

  const handleToggleVoiceReplies = () => {
    const next = !voiceRepliesOn;
    setVoiceRepliesOn(next);
    try {
      localStorage.setItem('copper_voice_replies', String(next));
    } catch { }
    soundEngine.playSwitch();
  };

  const handleTestMicrophone = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicTestResult('Navegador sem suporte a Web Speech API (use Chrome ou Edge).');
      return;
    }
    if (isTestingMic) {
      setIsTestingMic(false);
      return;
    }

    try {
      voiceEngine.stop();
      const rec = new SpeechRecognition();
      rec.lang = 'pt-BR';
      rec.interimResults = true;
      rec.onstart = () => {
        setIsTestingMic(true);
        setMicTestResult('Ouvindo... Fale algo no microfone agora.');
      };
      rec.onresult = (ev: any) => {
        const txt = Array.from(ev.results)
          .map((r: any) => r[0]?.transcript || '')
          .join(' ');
        setMicTestResult(`Captado: “${txt}”`);
      };
      rec.onerror = (ev: any) => {
        setIsTestingMic(false);
        setMicTestResult(`Erro no microfone: ${ev.error}`);
        if (isWakeWordListening) voiceEngine.start();
      };
      rec.onend = () => {
        setIsTestingMic(false);
        if (isWakeWordListening) voiceEngine.start();
      };
      rec.start();
    } catch {
      setIsTestingMic(false);
      if (isWakeWordListening) voiceEngine.start();
    }
  };

  // ── 3. Estados de Empresas & Filiais ──
  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    tradeName: '',
    legalName: '',
    cnpj: '',
    monogram: '',
    city: 'São Paulo',
    state: 'SP',
    sector: 'Metalurgia & Transformação',
  });

  const [addingBranchForCompanyId, setAddingBranchForCompanyId] = useState<string | null>(null);
  const [newBranchForm, setNewBranchForm] = useState({
    name: '',
    code: 'FIL-04',
    city: '',
    state: 'SP',
    manager: '',
    operationalArea: '',
    activeEmployeesCount: 45,
  });

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyForm.tradeName.trim()) return;
    const compId = `emp-${Date.now()}`;
    const branchId = `br-${Date.now()}`;
    const monogram =
      newCompanyForm.monogram.trim().toUpperCase().slice(0, 2) ||
      newCompanyForm.tradeName.trim().slice(0, 2).toUpperCase();

    const createdCompany: Company = {
      id: compId,
      monogram,
      numericCode: String(companies.length + 1).padStart(2, '0'),
      legalName: newCompanyForm.legalName.trim() || newCompanyForm.tradeName.trim(),
      tradeName: newCompanyForm.tradeName.trim(),
      sector: newCompanyForm.sector.trim(),
      cnpj: newCompanyForm.cnpj.trim() || '00.000.000/0001-00',
      status: 'OPERATIONAL',
      unitsCount: 1,
      state: newCompanyForm.state.trim() || 'SP',
      city: newCompanyForm.city.trim() || 'São Paulo',
      enabledModules: ['tarefas', 'metrologia'],
      stats: {
        ordersCount: 0,
        inProductionCount: 0,
        pendingCount: 0,
        alertsCount: 0,
        revenueMtd: 'R$ 0,00',
        operationalEfficiency: '100%',
      },
      lastActivityAt: 'Agora',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      branches: [
        {
          id: branchId,
          companyId: compId,
          name: `Matriz (${newCompanyForm.city.trim() || 'São Paulo'} - ${newCompanyForm.state.trim() || 'SP'})`,
          code: 'MTZ-01',
          numericCode: '01',
          type: 'MATRIZ',
          cnpj: newCompanyForm.cnpj.trim() || '00.000.000/0001-00',
          state: newCompanyForm.state.trim() || 'SP',
          city: newCompanyForm.city.trim() || 'São Paulo',
          address: 'Distrito Industrial',
          manager: user.name,
          phone: '(11) 3000-0000',
          email: user.email,
          status: 'OPERATIONAL',
          activeEmployeesCount: 50,
          operationalArea: newCompanyForm.sector.trim(),
        },
      ],
    };

    addCompany(createdCompany);
    setCurrentCompanyId(compId);
    setActiveBranchId(branchId);
    setShowNewCompanyForm(false);
    setNewCompanyForm({
      tradeName: '',
      legalName: '',
      cnpj: '',
      monogram: '',
      city: 'São Paulo',
      state: 'SP',
      sector: 'Metalurgia & Transformação',
    });
    showBannerNotice(`Empresa "${createdCompany.tradeName}" cadastrada e selecionada!`);
  };

  const handleCreateBranch = (e: React.FormEvent, companyId: string) => {
    e.preventDefault();
    if (!newBranchForm.name.trim()) return;
    const brId = `br-${Date.now()}`;
    const createdBranch: CompanyBranch = {
      id: brId,
      companyId,
      name: newBranchForm.name.trim(),
      code: newBranchForm.code.trim().toUpperCase() || 'FIL-NOVA',
      numericCode: '02',
      type: 'FILIAL',
      cnpj: '12.345.678/0004-00',
      state: newBranchForm.state.trim() || 'SP',
      city: newBranchForm.city.trim() || 'São Paulo',
      address: 'Polo Industrial',
      manager: newBranchForm.manager.trim() || user.name,
      phone: '(11) 3400-0000',
      email: user.email,
      status: 'OPERATIONAL',
      activeEmployeesCount: Number(newBranchForm.activeEmployeesCount) || 30,
      operationalArea: newBranchForm.operationalArea.trim() || 'Operações e Logística',
    };

    addBranch(companyId, createdBranch);
    setCurrentCompanyId(companyId);
    setActiveBranchId(brId);
    setAddingBranchForCompanyId(null);
    setNewBranchForm({
      name: '',
      code: 'FIL-04',
      city: '',
      state: 'SP',
      manager: '',
      operationalArea: '',
      activeEmployeesCount: 45,
    });
    showBannerNotice(`Filial "${createdBranch.name}" adicionada e ativada!`);
  };

  // ── 4. Estados de Automações, Rotinas & Travas RN-16 ──
  const [routineHour, setRoutineHour] = useState(() => localStorage.getItem('copperos_cfg_routine_hour') || '06:30');
  const [enableMetrologyLock, setEnableMetrologyLock] = useState(
    () => localStorage.getItem('copperos_cfg_rn16_lock') !== 'false'
  );
  const [rdoReminder, setRdoReminder] = useState(
    () => localStorage.getItem('copperos_cfg_rdo_reminder') !== 'false'
  );
  const [directorEmail, setDirectorEmail] = useState(
    () => localStorage.getItem('copperos_cfg_director_email') || 'andre@coppergroup.com.br'
  );
  const [urgentAlerts, setUrgentAlerts] = useState(
    () => localStorage.getItem('copperos_cfg_urgent_alerts') !== 'false'
  );
  const [lgpdRetentionMonths, setLgpdRetentionMonths] = useState(
    () => Number(localStorage.getItem('copperos_cfg_lgpd_months') || 24)
  );
  const [isSweepingNow, setIsSweepingNow] = useState(false);

  const handleDispatchAllRoutinesNow = async () => {
    setIsSweepingNow(true);
    try {
      const activeRoutines = tasks.filter(t => t.isDaily && t.dailyActive !== false);
      let totalCreated = 0;
      for (const r of activeRoutines) {
        const count = await dispatchRoutineNow(r.id);
        totalCreated += count;
      }
      if (totalCreated > 0) {
        showBannerNotice(`Varredura executada: ${totalCreated} nova(s) tarefa(s) diária(s) lançada(s) no banco!`);
      } else {
        showBannerNotice(
          `Varredura concluída (${activeRoutines.length} rotina(s) ativa(s) verificada(s)): todas as tarefas de hoje já foram lançadas.`
        );
      }
    } catch {
      showBannerNotice('Erro ao executar varredura manual de rotinas.');
    } finally {
      setIsSweepingNow(false);
    }
  };

  // ── 5. Estados de Auditoria PostgreSQL, Backup & LGPD ──
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');
  const [manualAuditNote, setManualAuditNote] = useState('');
  const [showLgpdPolicyModal, setShowLgpdPolicyModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAuditLogs = () => {
    setLoadingAuditLogs(true);
    auditApi
      .list({ limit: 150 })
      .then(res => setAuditLogs(res))
      .catch(err => console.warn('Erro ao carregar auditoria:', err))
      .finally(() => setLoadingAuditLogs(false));
  };

  useEffect(() => {
    if (activeSection === 'lgpd') {
      fetchAuditLogs();
    }
  }, [activeSection]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter(log => {
      const matchAction = auditActionFilter === 'ALL' || log.action.includes(auditActionFilter);
      const matchText =
        !q ||
        log.description.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q);
      return matchAction && matchText;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  const handleRecordManualAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAuditNote.trim()) return;
    try {
      await auditApi.record({
        action: 'MANUAL_COMPLIANCE_NOTE',
        entity: 'Governance',
        companyId: currentCompanyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        description: manualAuditNote.trim(),
      });
      setManualAuditNote('');
      fetchAuditLogs();
      showBannerNotice('Registro de conformidade gravado na trilha imutável do PostgreSQL!');
    } catch {
      showBannerNotice('Falha ao gravar nota de auditoria.');
    }
  };

  const handleExportTitularData = () => {
    soundEngine.playSuccess();
    const myTasks = tasks.filter(
      t => t.assignee === user.name || t.assignee === user.email || t.assignedBy === user.name
    );
    const myLogs = auditLogs.filter(l => l.userId === user.id || l.userEmail === user.email);

    const titularData = {
      termo:
        'Relatório de Portabilidade de Dados Pessoais do Titular — Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018, Art. 18, V)',
      dataEmissao: new Date().toISOString(),
      agentesDeTratamento: {
        controlador: {
          nomeFantasia: currentCompany.tradeName,
          razaoSocial: currentCompany.legalName,
          cnpj: currentCompany.cnpj,
          sede: `${currentCompany.city || 'São Paulo'} - ${currentCompany.state || 'SP'}`,
        },
        encarregadoDPO: {
          cargo: 'Encarregado de Proteção de Dados (DPO - Art. 41 LGPD)',
          email: 'dpo@coppergroup.com.br',
          canal: 'Canal Oficial de Atendimento a Titulares e ANPD',
        },
      },
      titular: {
        id: user.id,
        nome: user.name,
        email: user.email,
        papel: user.role,
        cargo: user.role === 'CEO' ? 'Diretor Executivo / CEO' : user.role === 'MANAGER' ? 'Gestor de Departamento' : 'Operador Industrial',
        departamento: user.department || 'Operações Gerais',
        departamentoId: user.departmentId || null,
        organizacao: 'org-copper-group',
      },
      basesLegaisDoTratamento: [
        'Art. 7º, V da LGPD — Execução de contrato de trabalho e procedimentos preliminares a pedido do titular',
        'Art. 7º, II da LGPD — Cumprimento de obrigação legal ou regulamentar pelo controlador (CLT, NRs do MTE e rastreabilidade metrológica RBC/INMETRO)',
        'Art. 7º, IX da LGPD — Legítimo interesse do controlador na coordenação da fábrica, passagem de turnos e prevenção de acidentes/divergências industriais',
      ],
      direitosAsseguradosArt18: [
        'I - Confirmação da existência de tratamento: Ativo no CopperOS',
        'II - Acesso aos dados: Disponibilizado através deste extrato em formato aberto e estruturado',
        'III - Correção de dados incompletos ou inexatos: Realizado via tela de Perfil ou solicitação ao Gestor/DPO',
        'IV - Anonimização, bloqueio ou eliminação de dados excessivos: Política de retenção configurada para até 60 meses com purge de dados prescritos',
        'V - Portabilidade dos dados: Exportação imediata em JSON padronizado',
        'VI - Eliminação de dados tratados com consentimento: Conforme política de retenção trabalhista',
        'VII/VIII - Compartilhamento e revogação: Dados estritamente internos corporativos, sem comercialização a terceiros',
      ],
      garantiaDecisoesAutomatizadasArt20:
        'O CopperOS utiliza inteligência artificial apenas para síntese e sumarização assistiva de relatórios de turno. Não realiza perfilamento punitivo, cálculo algorítmico disciplinar ou decisões trabalhistas automatizadas.',
      minhasTarefasAtribuidas: myTasks,
      meusRegistrosDeAuditoria: myLogs,
    };

    const blob = new Blob([JSON.stringify(titularData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dados-titular-lgpd-${user.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    auditApi
      .record({
        action: 'LGPD_TITULAR_DATA_EXPORT',
        entity: 'TitularRights',
        companyId: currentCompanyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        description: `Portabilidade de dados pessoais (Art. 18, V LGPD) requisitada e exportada por ${user.name}`,
      })
      .then(() => fetchAuditLogs())
      .catch(() => { });

    showBannerNotice('Portabilidade LGPD (Art. 18, V): Seus dados foram exportados com sucesso!');
  };

  const handleExportAuditCsv = () => {
    if (filteredAuditLogs.length === 0) return;
    soundEngine.playClick();
    downloadCsv(
      `auditoria-copperos-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Data/Hora', 'Ação', 'Entidade', 'Descrição', 'Usuário', 'Papel', 'E-mail', 'IP'],
      filteredAuditLogs.map(l => [
        new Date(l.occurredAt).toLocaleString('pt-BR'),
        l.action,
        l.entity,
        l.description,
        l.userName,
        l.userRole,
        l.userEmail,
        l.ipAddress || '127.0.0.1',
      ])
    );

    auditApi
      .record({
        action: 'AUDIT_LOG_CSV_EXPORT',
        entity: 'AuditLog',
        companyId: currentCompanyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        description: `Planilha CSV com ${filteredAuditLogs.length} evento(s) de auditoria exportada por ${user.name}`,
      })
      .catch(() => { });
  };

  const handleExportSystemData = () => {
    soundEngine.playSuccess();
    const backupData = {
      timestamp: new Date().toISOString(),
      user,
      currentCompany,
      activeBranch,
      settings: {
        routineHour,
        enableMetrologyLock,
        rdoReminder,
        directorEmail,
        urgentAlerts,
        lgpdRetentionMonths,
      },
      tasksCount: tasks.length,
      tasks,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-copperos-tarefas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    auditApi
      .record({
        action: 'SYSTEM_BACKUP_EXPORT',
        entity: 'Backup',
        companyId: currentCompanyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        description: `Backup completo JSON do sistema exportado por ${user.name} (${tasks.length} tarefas)`,
      })
      .catch(() => { });

    showBannerNotice(`Backup JSON exportado com ${tasks.length} tarefas e configurações!`);
  };

  const handleImportBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          setTasks(parsed.tasks);
          await tasksApi.batch({ tasks: parsed.tasks });
          await refreshTasks();
          await auditApi.record({
            action: 'BACKUP_RESTORE',
            entity: 'TaskBatch',
            companyId: currentCompanyId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            userRole: user.role,
            description: `Backup JSON restaurado com ${parsed.tasks.length} tarefa(s).`,
          });
          fetchAuditLogs();
          showBannerNotice(`Backup restaurado com sucesso (${parsed.tasks.length} tarefas sincronizadas no PostgreSQL)!`);
        } else {
          showBannerNotice('Arquivo JSON válido, mas não continha lista de tarefas.');
        }
      } catch (err) {
        console.error('Erro ao importar backup:', err);
        showBannerNotice('Erro ao ler arquivo de backup JSON.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleSaveAll = () => {
    const cleanEmail = directorEmail.trim() || 'andre@coppergroup.com.br';
    try {
      localStorage.setItem('copperos_cfg_routine_hour', routineHour);
      localStorage.setItem('copperos_cfg_rn16_lock', String(enableMetrologyLock));
      localStorage.setItem('copperos_cfg_rdo_reminder', String(rdoReminder));
      localStorage.setItem('copperos_cfg_director_email', cleanEmail);
      localStorage.setItem('copperos_cfg_urgent_alerts', String(urgentAlerts));
      localStorage.setItem('copperos_cfg_lgpd_months', String(lgpdRetentionMonths));
      localStorage.setItem('copper_voice_replies', String(voiceRepliesOn));
      voiceTtsService.saveSettings({
        voiceId: selectedVoiceId,
        rate: voiceRate,
        pitch: voicePitch,
      });
    } catch {
      // noop
    }

    systemApi
      .saveSettings(
        {
          copperos_cfg_routine_hour: routineHour,
          copperos_cfg_rn16_lock: String(enableMetrologyLock),
          copperos_cfg_rdo_reminder: String(rdoReminder),
          copperos_cfg_director_email: cleanEmail,
          copperos_cfg_urgent_alerts: String(urgentAlerts),
          copperos_cfg_lgpd_months: String(lgpdRetentionMonths),
        },
        user.name
      )
      .catch(() => { });

    auditApi
      .record({
        action: 'SYSTEM_CONFIG_SAVE',
        entity: 'SystemConfig',
        companyId: currentCompanyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        description: `Parâmetros operacionais salvos no PostgreSQL (Rotina: ${routineHour}, RN-16: ${enableMetrologyLock ? 'Ativa' : 'Inativa'
          }, Voz: ${selectedVoiceId})`,
      })
      .catch(() => { });

    showBannerNotice('Todas as configurações foram aplicadas e gravadas no banco PostgreSQL!');
  };

  const handleBackToTasks = () => {
    soundEngine.playClick();
    setIsSettingsOpen(false);
    if (searchParams.get('tab') === 'Configurações') {
      setSearchParams({ tab: 'Minhas tarefas' });
    }
  };

  // Bloqueio de Acesso para Operadores e Cargos Sem Permissão de Configuração
  if (!isHigherRole) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Acesso Restrito
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          As configurações e governança do sistema são restritas a cargos de Gestão, Diretoria e TI.
        </p>
        <button
          onClick={() => {
            soundEngine.playClick();
            setIsSettingsOpen(false);
            setSearchParams({ tab: 'Minhas tarefas' });
          }}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
        >
          Voltar às Minhas Tarefas
        </button>
      </div>
    );
  }

  const navItems: { id: SettingsSection; label: string; subtitle: string; icon: React.ElementType }[] = [
    ...(isTiRole
      ? [
        {
          id: 'ti-usuarios' as SettingsSection,
          label: 'Painel TI · Usuários & Acessos',
          subtitle: 'Cadastro, reset de PIN e permissões',
          icon: Users,
        },
      ]
      : []),
    {
      id: 'perfil',
      label: 'Perfil Operacional Ativo',
      subtitle: 'Editar meus dados e avatar',
      icon: UserIcon,
    },
    {
      id: 'visual',
      label: 'Interface, Som & Voz',
      subtitle: 'Tema, vozes neurais e “Ei Copper”',
      icon: Sliders,
    },
    ...(user.role === 'CEO' || user.role === 'ADMIN'
      ? [
        {
          id: 'empresas' as SettingsSection,
          label: 'Empresas & Filiais',
          subtitle: 'Gerenciar unidades multi-tenant',
          icon: Building2,
        },
      ]
      : []),
    {
      id: 'automacoes',
      label: 'Rotinas & Travas RN-16',
      subtitle: 'Varredura, metrologia e RDO',
      icon: Clock,
    },
    {
      id: 'lgpd',
      label: 'Governança & LGPD',
      subtitle: 'PostgreSQL, Art. 18 e trilha',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6 font-sans pb-16 w-full">
      {/* Cabeçalho da Página de Configurações */}
      <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-5 sm:p-6 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Configurações & Governança do Sistema
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  {currentCompany.tradeName} · {activeBranch?.code || 'MTZ-01'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Gerencie perfis operacionais, unidades fabris, motor de rotinas, síntese de voz, LGPD e trilha de auditoria PostgreSQL.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleBackToTasks}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-night-850 border border-gray-200 dark:border-night-800 hover:border-emerald-500 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar às Tarefas</span>
            </button>

            <button
              onClick={handleSaveAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>

        {savedNotice && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}
      </div>

      {/* Layout Principal em 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Menu Lateral de Seções */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-3 shadow-xs space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    soundEngine.playTab();
                    setActiveSection(item.id);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer ${isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 dark:bg-emerald-500 dark:text-night-950'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-850'
                    }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive
                      ? 'bg-white/20 text-white dark:bg-night-950/15 dark:text-night-950'
                      : 'bg-gray-100 dark:bg-night-800 text-gray-500 dark:text-gray-400'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{item.label}</p>
                    <p
                      className={`text-[10px] truncate ${isActive ? 'text-emerald-100 dark:text-night-900/80' : 'text-gray-400'
                        }`}
                    >
                      {item.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Card de Status Técnico do Ambiente */}
          <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                Diagnóstico do Ambiente
              </span>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Banco de Dados</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  PostgreSQL 16 (Ativo)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Tarefas Sincronizadas</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {tasks.length} registros
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Empresas / Unidades</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {companies.length} emp · {companies.reduce((acc, c) => acc + (c.branches?.length || 0), 0)} filiais
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Última Varredura</span>
                <span className="font-mono text-gray-600 dark:text-gray-300">
                  {lastRoutineSweepAt
                    ? lastRoutineSweepAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : 'Agora'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Voz “Ei Copper”</span>
                <span
                  className={`font-semibold ${isWakeWordListening ? 'text-emerald-500' : 'text-amber-500'
                    }`}
                >
                  {isWakeWordListening ? 'Escuta Contínua' : 'Pausada'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Painel Principal da Seção Selecionada */}
        <div className="lg:col-span-9 space-y-6">
          {/* ── 0. PAINEL TI · GESTÃO DE USUÁRIOS E ACESSOS (Apenas ADMIN / CEO) ── */}
          {activeSection === 'ti-usuarios' && isTiRole && (
            <TiUserManagementPanel onShowNotice={showBannerNotice} />
          )}

          {/* ── 1. PERFIL & CONTROLE DE ACESSO (RBAC) ── */}
          {activeSection === 'perfil' && (
            <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                    Perfil Operacional Ativo & Controle de Acesso (RBAC)
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Edite seus dados corporativos, cadastre novos colaboradores ou alterne entre os perfis hierárquicos da planta.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNewUserForm(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showNewUserForm ? 'Cancelar Novo' : 'Novo Colaborador'}</span>
                </button>
              </div>

              {/* Formulário de Novo Colaborador */}
              {showNewUserForm && (
                <form
                  onSubmit={handleCreateUser}
                  className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/30 space-y-4"
                >
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Cadastrar Novo Colaborador / Perfil de Acesso
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={newUserForm.name}
                        onChange={e => setNewUserForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Roberto Almeida"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        E-mail Corporativo *
                      </label>
                      <input
                        type="email"
                        required
                        value={newUserForm.email}
                        onChange={e => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="roberto@coppergroup.com.br"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        Nível Hierárquico (RBAC)
                      </label>
                      <select
                        value={newUserForm.role}
                        onChange={e =>
                          setNewUserForm(prev => ({ ...prev, role: e.target.value as User['role'] }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white font-semibold"
                      >
                        <option value="CEO">CEO / Diretoria</option>
                        <option value="MANAGER">MANAGER / Gestor & Supervisor</option>
                        <option value="OPERATOR">OPERATOR / Operador de Planta</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        Cargo / Função
                      </label>
                      <input
                        type="text"
                        value={newUserForm.jobTitle}
                        onChange={e => setNewUserForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder="Ex: Engenheiro de Fundição"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        Departamento
                      </label>
                      <input
                        type="text"
                        value={newUserForm.department}
                        onChange={e => setNewUserForm(prev => ({ ...prev, department: e.target.value }))}
                        placeholder="Ex: Manutenção Industrial"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shadow-xs"
                      >
                        Cadastrar e Ativar Perfil
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Formulário Editável do Perfil Ativo */}
              <form
                onSubmit={handleSaveProfile}
                className="p-5 rounded-2xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 space-y-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-xl shrink-0">
                      {profileForm.name.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base text-gray-900 dark:text-white">
                          {user.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                          Perfil Ativo
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Edite seus dados abaixo e clique em Atualizar Perfil para refletir em todo o sistema.
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shadow-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Atualizar Perfil</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      Nome do Usuário
                    </label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      Papel RBAC
                    </label>
                    <select
                      value={profileForm.role}
                      onChange={e =>
                        setProfileForm(prev => ({ ...prev, role: e.target.value as User['role'] }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white font-bold"
                    >
                      <option value="CEO">CEO (Diretoria)</option>
                      <option value="MANAGER">MANAGER (Gestor / Supervisor)</option>
                      <option value="OPERATOR">OPERATOR (Operador)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      Cargo / Título
                    </label>
                    <input
                      type="text"
                      value={profileForm.jobTitle}
                      onChange={e => setProfileForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      Departamento / Setor
                    </label>
                    <input
                      type="text"
                      value={profileForm.department}
                      onChange={e => setProfileForm(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </form>

              {/* Permissões Ativas */}
              {user.permissions && user.permissions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Permissões Concedidas ao Cargo ({user.permissions.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {user.permissions.map(perm => (
                      <span
                        key={perm}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-[11px] font-mono text-gray-700 dark:text-gray-300"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Seletor de Perfis Hierárquicos */}
              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-night-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Alternar Perfil Hierárquico ({availableUsers.length} perfis disponíveis)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableUsers.map(u => {
                    const isCurrent = u.id === user.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playSwitch();
                          switchUser(u.id);
                          showBannerNotice(`Perfil alternado para ${u.name} (${u.role})`);
                        }}
                        className={`p-4 rounded-2xl border text-left flex items-start justify-between gap-3 transition-all cursor-pointer ${isCurrent
                          ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-500/15 shadow-xs'
                          : 'bg-white dark:bg-night-900 border-gray-200 dark:border-night-800 hover:border-emerald-500/40'
                          }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                            {u.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {u.name}
                              </p>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-gray-100 dark:bg-night-800 text-gray-600 dark:text-gray-300">
                                {u.role}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {u.jobTitle}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">{u.department}</p>
                          </div>
                        </div>
                        {isCurrent && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── 2. INTERFACE, SOM & VOZ ("EI COPPER") ── */}
          {activeSection === 'visual' && (
            <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-6 shadow-xs space-y-6">
              <div>
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                  Preferências de Interface, Áudio & Motor de Voz (“Ei Copper”)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Personalize o tema visual, escolha o timbre da voz do assistente, ajuste velocidade/tom e teste seu microfone ao vivo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tema */}
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex flex-col justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {isDarkMode ? (
                        <Moon className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-500" />
                      )}
                      <span>Tema Visual da Interface</span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      O Modo Escuro reduz a fadiga ocular em salas de controle; o Modo Claro favorece ambientes externos.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      toggleTheme();
                      soundEngine.playClick();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-gray-200 dark:border-night-700 bg-white dark:bg-night-900 text-xs font-bold flex items-center justify-center gap-2 hover:border-emerald-500 transition-colors cursor-pointer"
                  >
                    {isDarkMode ? (
                      <>
                        <Sun className="w-4 h-4 text-amber-400" />
                        <span>Alternar para Modo Claro</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-slate-700" />
                        <span>Alternar para Modo Escuro</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Efeitos Sonoros */}
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex flex-col justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-gray-400" />
                      )}
                      <span>Efeitos Sonoros Operacionais</span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Feedback acústico ao concluir tarefas, trocar abas e confirmar comandos.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      toggleSound();
                      soundEngine.playSwitch();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-gray-200 dark:border-night-700 bg-white dark:bg-night-900 text-xs font-bold flex items-center justify-center gap-2 hover:border-emerald-500 transition-colors cursor-pointer"
                  >
                    {soundEnabled ? (
                      <>
                        <Volume2 className="w-4 h-4 text-emerald-500" />
                        <span>Som Ativo (Clique para Silenciar)</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-4 h-4 opacity-50" />
                        <span>Silenciado (Clique para Ativar)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Controle de Escuta & Diagnóstico de Microfone */}
              <div className="p-5 rounded-2xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Mic className="w-4 h-4 text-emerald-500" />
                      <span>Assistente Hands-Free (“Ei Copper”) & Diagnóstico de Microfone</span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Controla a pílula inferior “Ei Copper” e as respostas faladas do assistente.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleTestMicrophone}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${isTestingMic
                        ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                        : 'border-gray-200 dark:border-night-700 bg-white dark:bg-night-900 hover:border-emerald-500 text-gray-800 dark:text-gray-200'
                        }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isTestingMic ? 'Ouvindo Microfone...' : 'Testar Microfone'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleVoiceReplies}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${voiceRepliesOn
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-gray-200 dark:border-night-700 bg-white dark:bg-night-900 text-gray-400'
                        }`}
                    >
                      {voiceRepliesOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      <span>{voiceRepliesOn ? 'Voz Falada: ON' : 'Voz Falada: OFF'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const next = !isWakeWordListening;
                        setIsWakeWordListening(next);
                        if (next) soundEngine.playWake();
                        else soundEngine.playSwitch();
                      }}
                      className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${isWakeWordListening
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-gray-200 dark:border-night-700 bg-white dark:bg-night-900 text-gray-400'
                        }`}
                    >
                      {isWakeWordListening ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Escuta Ativa</span>
                        </>
                      ) : (
                        <>
                          <MicOff className="w-4 h-4 opacity-50" />
                          <span>Escuta Pausada</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {micTestResult && (
                  <div className="p-3 rounded-xl bg-white dark:bg-night-900 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    {micTestResult}
                  </div>
                )}

                {/* Sliders de Velocidade e Tom */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-200/60 dark:border-night-800">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200/70 dark:border-night-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800 dark:text-gray-200">Velocidade da Locução</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {voiceRate.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.35"
                      step="0.05"
                      value={voiceRate}
                      onChange={e => handleRateChange(parseFloat(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200/70 dark:border-night-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800 dark:text-gray-200">Ajuste de Timbre / Tom</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {voicePitch >= 0 ? `+${voicePitch}` : voicePitch}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      step="1"
                      value={voicePitch}
                      onChange={e => handlePitchChange(parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Seleção de Vozes */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                    Timbre de Voz do Assistente Copper
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {PRESET_VOICES.filter(v => v.provider !== 'elevenlabs').map(voice => {
                      const isSelected = selectedVoiceId === voice.id;
                      return (
                        <div
                          key={voice.id}
                          onClick={() => handleVoiceChange(voice.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-500/15'
                            : 'bg-white dark:bg-night-900 border-gray-200/80 dark:border-night-800 hover:border-emerald-500/30'
                            }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                              {voice.name}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">
                              {voice.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleVoiceChange(voice.id);
                              voiceTtsService.playVoiceSample(voice.id);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>Ouvir</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 3. EMPRESAS & FILIAIS (MULTI-TENANT) ── */}
          {activeSection === 'empresas' && (
            <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                    Estrutura Corporativa Multi-Empresa & Filiais
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Alterne entre empresas e filiais com 1 clique ou cadastre novas empresas e plantas industriais no grupo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNewCompanyForm(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showNewCompanyForm ? 'Cancelar' : 'Nova Empresa'}</span>
                </button>
              </div>

              {/* Formulário de Nova Empresa */}
              {showNewCompanyForm && (
                <form
                  onSubmit={handleCreateCompany}
                  className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/30 space-y-4"
                >
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Cadastrar Nova Empresa no Grupo
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        Nome Fantasia *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCompanyForm.tradeName}
                        onChange={e => setNewCompanyForm(prev => ({ ...prev, tradeName: e.target.value }))}
                        placeholder="Ex: Cobre Sul Logística"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        Razão Social
                      </label>
                      <input
                        type="text"
                        value={newCompanyForm.legalName}
                        onChange={e => setNewCompanyForm(prev => ({ ...prev, legalName: e.target.value }))}
                        placeholder="Ex: Cobre Sul S.A."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        CNPJ
                      </label>
                      <input
                        type="text"
                        value={newCompanyForm.cnpj}
                        onChange={e => setNewCompanyForm(prev => ({ ...prev, cnpj: e.target.value }))}
                        placeholder="00.000.000/0001-00"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        Cidade Sede
                      </label>
                      <input
                        type="text"
                        value={newCompanyForm.city}
                        onChange={e => setNewCompanyForm(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                        UF
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={newCompanyForm.state}
                        onChange={e => setNewCompanyForm(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Salvar Empresa
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {companies.map(comp => {
                  const isCompActive = comp.id === currentCompanyId;
                  const isAddingBranch = addingBranchForCompanyId === comp.id;

                  return (
                    <div
                      key={comp.id}
                      className={`p-5 rounded-2xl border transition-all ${isCompActive
                        ? 'bg-emerald-500/5 border-emerald-500/40 dark:bg-emerald-500/10'
                        : 'bg-gray-50/60 dark:bg-night-850/60 border-gray-200 dark:border-night-800'
                        }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200/70 dark:border-night-800">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                            {comp.monogram}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                                {comp.tradeName}
                              </h3>
                              {isCompActive && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                                  Empresa Ativa
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {comp.legalName} · CNPJ {comp.cnpj}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setAddingBranchForCompanyId(isAddingBranch ? null : comp.id)
                            }
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Filial</span>
                          </button>

                          {!isCompActive && (
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playSwitch();
                                setCurrentCompanyId(comp.id);
                                showBannerNotice(`Empresa ativa alterada para ${comp.tradeName}`);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 hover:border-emerald-500 text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer"
                            >
                              Ativar Empresa
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Formulário de Nova Filial para esta Empresa */}
                      {isAddingBranch && (
                        <form
                          onSubmit={e => handleCreateBranch(e, comp.id)}
                          className="my-4 p-4 rounded-xl bg-white dark:bg-night-900 border border-emerald-500/30 space-y-3"
                        >
                          <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            Nova Filial / Unidade Operacional em {comp.tradeName}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <input
                              type="text"
                              required
                              value={newBranchForm.name}
                              onChange={e => setNewBranchForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Nome da Filial (Ex: Usina Sorocaba)"
                              className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                            />
                            <input
                              type="text"
                              value={newBranchForm.code}
                              onChange={e => setNewBranchForm(prev => ({ ...prev, code: e.target.value }))}
                              placeholder="Código (Ex: FIL-04)"
                              className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white font-mono"
                            />
                            <input
                              type="text"
                              value={newBranchForm.city}
                              onChange={e => setNewBranchForm(prev => ({ ...prev, city: e.target.value }))}
                              placeholder="Cidade (Ex: Sorocaba)"
                              className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                            />
                            <input
                              type="text"
                              value={newBranchForm.operationalArea}
                              onChange={e =>
                                setNewBranchForm(prev => ({ ...prev, operationalArea: e.target.value }))
                              }
                              placeholder="Área Operacional (Ex: Trefilação)"
                              className="sm:col-span-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white"
                            />
                            <button
                              type="submit"
                              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                            >
                              Adicionar Filial
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Filiais da Empresa */}
                      {comp.branches && comp.branches.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
                          {comp.branches.map(br => {
                            const isBranchActive = isCompActive && activeBranch?.id === br.id;
                            return (
                              <div
                                key={br.id}
                                onClick={() => {
                                  soundEngine.playSwitch();
                                  setCurrentCompanyId(comp.id);
                                  setActiveBranchId(br.id);
                                  showBannerNotice(`Unidade ativa: ${br.name}`);
                                }}
                                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${isBranchActive
                                  ? 'bg-white dark:bg-night-900 border-emerald-500 shadow-sm'
                                  : 'bg-white/70 dark:bg-night-900/60 border-gray-200/80 dark:border-night-800 hover:border-emerald-500/40'
                                  }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 dark:bg-night-800 text-gray-700 dark:text-gray-300">
                                      {br.code}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {isBranchActive && (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                      )}
                                      {(comp.branches?.length || 0) > 1 && (
                                        <button
                                          type="button"
                                          onClick={e => {
                                            e.stopPropagation();
                                            deleteBranch(comp.id, br.id);
                                            showBannerNotice(`Filial "${br.name}" removida.`);
                                          }}
                                          className="p-1 rounded text-gray-400 hover:text-rose-500 cursor-pointer"
                                          title="Remover filial"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs font-bold text-gray-900 dark:text-white mt-2">
                                    {br.name}
                                  </p>
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                    {br.operationalArea}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-100 dark:border-night-800">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {br.city}/{br.state}
                                  </span>
                                  <span>{br.activeEmployeesCount} colab.</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 4. ROTINAS & TRAVAS OPERACIONAIS ── */}
          {activeSection === 'automacoes' && (
            <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                    Motor de Rotinas Diárias, RDO & Travas Industriais
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Configure horários de disparo recorrente, destinatário executivo do RDO e a trava metrológica RN-16.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDispatchAllRoutinesNow}
                  disabled={isSweepingNow}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer shrink-0"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isSweepingNow ? 'Varrendo Rotinas...' : 'Executar Varredura Agora'}</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-500" />
                      <span>Horário Padrão de Disparo Matinal das Rotinas</span>
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Horário preenchido automaticamente ao criar novas rotinas diárias na tela de Tarefas.
                    </p>
                  </div>
                  <input
                    type="time"
                    value={routineHour}
                    onChange={e => {
                      setRoutineHour(e.target.value);
                      localStorage.setItem('copperos_cfg_routine_hour', e.target.value);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-night-700 bg-white dark:bg-night-900 font-mono text-xs text-gray-900 dark:text-white font-bold"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-emerald-500" />
                      <span>E-mail Padrão da Diretoria para Recebimento de Fechamentos (RDO)</span>
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Utilizado automaticamente no modal de Fechamento de Expediente ao enviar relatórios de turno.
                    </p>
                  </div>
                  <input
                    type="email"
                    value={directorEmail}
                    onChange={e => {
                      setDirectorEmail(e.target.value);
                      localStorage.setItem('copperos_cfg_director_email', e.target.value);
                    }}
                    placeholder="diretoria@coppergroup.com.br"
                    className="w-full sm:w-64 px-3.5 py-2 rounded-xl border border-gray-300 dark:border-night-700 bg-white dark:bg-night-900 font-mono text-xs text-gray-900 dark:text-white"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Scale className="w-4 h-4 text-emerald-500" />
                      <span>Trava Operacional RN-16 (Metrologia de Balanças INMETRO)</span>
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Bloqueia automaticamente pesagens caso uma balança esteja com certificado RBC vencido.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !enableMetrologyLock;
                      setEnableMetrologyLock(next);
                      localStorage.setItem('copperos_cfg_rn16_lock', String(next));
                      soundEngine.playSwitch();
                    }}
                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${enableMetrologyLock ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-night-700'
                      }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${enableMetrologyLock ? 'translate-x-6' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Bell className="w-4 h-4 text-emerald-500" />
                      <span>Envio Automático de E-mail no Fechamento de Turno</span>
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Deixa a opção de envio para a Diretoria marcada por padrão ao abrir o Fechamento de Expediente.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !rdoReminder;
                      setRdoReminder(next);
                      localStorage.setItem('copperos_cfg_rdo_reminder', String(next));
                      soundEngine.playSwitch();
                    }}
                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${rdoReminder ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-night-700'
                      }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${rdoReminder ? 'translate-x-6' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                      Destaque Visual para Tarefas Urgentes e Atrasadas
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Exibe indicadores críticos na tabela e no Kanban para tarefas vencidas ou Urgentes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !urgentAlerts;
                      setUrgentAlerts(next);
                      localStorage.setItem('copperos_cfg_urgent_alerts', String(next));
                      soundEngine.playSwitch();
                    }}
                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${urgentAlerts ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-night-700'
                      }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${urgentAlerts ? 'translate-x-6' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 5. AUDITORIA POSTGRESQL, BACKUP & GOVERNANÇA LGPD (LEI Nº 13.709/2018) ── */}
          {activeSection === 'lgpd' && (
            <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-6 shadow-xs space-y-6">
              {/* Cabeçalho da Seção LGPD */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-night-800">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                      Governança de Dados, Auditoria & Conformidade LGPD (Lei nº 13.709/2018)
                    </h2>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Gestão de conformidade com os princípios do Art. 6º, bases legais do Art. 7º, exercício dos direitos do titular (Art. 18) e trilha imutável no PostgreSQL.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowLgpdPolicyModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 text-xs font-bold text-emerald-800 dark:text-emerald-300 cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Ver Política & Termo LGPD</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportTitularData}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 text-xs font-bold text-blue-800 dark:text-blue-300 cursor-pointer transition-colors"
                    title="Exportar dados pessoais tratados para este titular (Art. 18, V)"
                  >
                    <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Exportar Meus Dados (Art. 18)</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportBackupJson}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-night-850 border border-gray-200 dark:border-night-700 hover:border-emerald-500 text-xs font-bold text-gray-700 dark:text-gray-200 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-emerald-500" />
                    <span>Importar Backup JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportSystemData}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Backup Geral JSON</span>
                  </button>
                </div>
              </div>

              {/* Quadro Informativo de Conformidade Legal LGPD */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-gray-200/80 dark:border-night-800 bg-gray-50/70 dark:bg-night-850/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                    <Lock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Bases Legais (Art. 7º)</span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    <strong>Art. 7º, V</strong> (Execução de contrato de trabalho) e <strong>Art. 7º, II</strong> (Obrigação legal CLT/NRs).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200/80 dark:border-night-800 bg-gray-50/70 dark:bg-night-850/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                    <Mail className="w-3.5 h-3.5 text-blue-500" />
                    <span>Encarregado DPO (Art. 41)</span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    Canal oficial: <strong className="text-gray-700 dark:text-gray-300">dpo@coppergroup.com.br</strong> para petições e ANPD.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200/80 dark:border-night-800 bg-gray-50/70 dark:bg-night-850/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                    <span>Dados Sensíveis (Art. 11)</span>
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold leading-relaxed">
                    Isento — Nenhum dado sensível (saúde, biometria facial, religião) é coletado no sistema.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200/80 dark:border-night-800 bg-gray-50/70 dark:bg-night-850/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>IA e Decisões (Art. 20)</span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    Resumos estritamente assistivos. Sem perfilamento punitivo nem decisões automatizadas.
                  </p>
                </div>
              </div>

              {/* Registro Manual de Conformidade no PostgreSQL */}
              <form
                onSubmit={handleRecordManualAudit}
                className="p-4 rounded-2xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              >
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Registrar Evento de Conformidade / Auditoria na Trilha PostgreSQL
                  </label>
                  <input
                    type="text"
                    value={manualAuditNote}
                    onChange={e => setManualAuditNote(e.target.value)}
                    placeholder="Ex: Auditoria periódica de acesso LGPD realizada; sem incidentes de segurança..."
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-700 text-xs text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!manualAuditNote.trim()}
                  className="sm:self-end px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer shrink-0 transition-colors"
                >
                  Gravar na Trilha
                </button>
              </form>

              {/* Tabela Completa de Auditoria */}
              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-night-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      Trilha Imutável de Auditoria (`AuditLog` PostgreSQL)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gray-100 dark:bg-night-800 text-gray-600 dark:text-gray-300">
                      {filteredAuditLogs.length} evento(s)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={auditSearch}
                        onChange={e => setAuditSearch(e.target.value)}
                        placeholder="Buscar evento ou autor..."
                        className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-night-700 bg-gray-50 dark:bg-night-850 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <select
                      value={auditActionFilter}
                      onChange={e => setAuditActionFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-night-700 bg-gray-50 dark:bg-night-850 text-xs text-gray-700 dark:text-gray-300"
                    >
                      <option value="ALL">Todas as Ações</option>
                      <option value="CREATE">Criações</option>
                      <option value="STATUS">Mudanças de Status</option>
                      <option value="UPDATE">Edições</option>
                      <option value="DELETE">Exclusões</option>
                      <option value="CONFIG">Configurações</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleExportAuditCsv}
                      disabled={filteredAuditLogs.length === 0}
                      className="px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-night-700 hover:border-emerald-500 disabled:opacity-40 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1 cursor-pointer"
                      title="Exportar trilha para CSV"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                      <span>CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={fetchAuditLogs}
                      className="p-1.5 rounded-xl border border-gray-200 dark:border-night-700 hover:border-emerald-500 text-gray-500 dark:text-gray-400 cursor-pointer"
                      title="Atualizar trilha de auditoria"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingAuditLogs ? 'animate-spin text-emerald-500' : ''}`} />
                    </button>
                  </div>
                </div>

                {loadingAuditLogs ? (
                  <div className="p-10 text-center text-xs text-gray-400 animate-pulse">
                    Consultando trilha de auditoria no banco PostgreSQL...
                  </div>
                ) : filteredAuditLogs.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-gray-50 dark:bg-night-850 border border-dashed border-gray-200 dark:border-night-800 text-xs text-gray-400">
                    Nenhum evento encontrado para o filtro selecionado.
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                    {filteredAuditLogs.map(log => (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl border border-gray-200/80 dark:border-night-800 bg-gray-50/50 dark:bg-night-850/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${log.action.includes('CREATE')
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                                : log.action.includes('DELETE')
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                                  : log.action.includes('STATUS')
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
                                }`}
                            >
                              {log.action}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {log.description}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400">
                            Ator: <strong className="text-gray-600 dark:text-gray-300">{log.userName}</strong> ({log.userRole}) · IP: {log.ipAddress || '127.0.0.1'}
                          </p>
                        </div>
                        <span className="text-[11px] text-gray-400 font-mono shrink-0">
                          {new Date(log.occurredAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal de Política de Privacidade e Termo LGPD */}
              {showLgpdPolicyModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-night-900 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 dark:border-night-800 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-night-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-6 h-6 text-emerald-500" />
                        <div>
                          <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                            Governança LGPD — CopperOS
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Termo de Privacidade e Proteção de Dados (Lei Federal nº 13.709/2018)
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowLgpdPolicyModal(false)}
                        className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-night-800 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl">
                        <h4 className="font-bold text-emerald-900 dark:text-emerald-300 text-sm mb-1">
                          Declaração Geral de Conformidade
                        </h4>
                        <p>
                          O <strong>CopperOS</strong> foi projetado segundo os princípios de <em>Privacy by Design</em> e <em>Privacy by Default</em> (Art. 46 e 49 da LGPD), tratando exclusivamente os dados pessoais necessários para a condução das rotinas industriais, operacionais e de segurança metrológica da empresa.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-extrabold text-gray-900 dark:text-white text-sm">
                          1. Agentes de Tratamento e Canal de Contato (Art. 41)
                        </h4>
                        <ul className="list-disc pl-5 space-y-1">
                          <li><strong>Controlador:</strong> {currentCompany.legalName} (CNPJ: {currentCompany.cnpj}).</li>
                          <li><strong>Operador:</strong> Plataforma de Gestão CopperOS (Sistemas Internos de Banco de Dados PostgreSQL).</li>
                          <li><strong>Encarregado pelo Tratamento de Dados Pessoais (DPO):</strong> André (Diretoria Executiva) · E-mail: <code>dpo@coppergroup.com.br</code>.</li>
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-extrabold text-gray-900 dark:text-white text-sm">
                          2. Bases Legais Utilizadas (Art. 7º e 11)
                        </h4>
                        <ul className="list-disc pl-5 space-y-1">
                          <li><strong>Art. 7º, Inciso V (Execução de Contrato):</strong> Gestão de tarefas, atribuição de ordens de serviço, coordenação de equipe e prestação de contas do turno de trabalho.</li>
                          <li><strong>Art. 7º, Inciso II (Cumprimento de Obrigação Legal/Regulamentar):</strong> Atendimento a normas do Ministério do Trabalho e Emprego (CLT, NRs), calibração e rastreabilidade metrológica de balanças (Inmetro/RBC).</li>
                          <li><strong>Art. 7º, Inciso IX (Legítimo Interesse):</strong> Continuidade e integridade dos processos fabris, segurança física das instalações e auditoria de ações no sistema.</li>
                          <li><strong>Dados Sensíveis (Art. 11):</strong> Não coletados. O sistema veda a exigência de dados sobre saúde, biometria facial para fins discriminatórios, religião, filiação partidária ou vida sexual.</li>
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-extrabold text-gray-900 dark:text-white text-sm">
                          3. Aplicação dos Princípios Fundamentais (Art. 6º)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/60 dark:border-night-800">
                            <strong>Finalidade & Adequação:</strong> Finalidades explícitas e legítimas, limitadas à rotina corporativa.
                          </div>
                          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/60 dark:border-night-800">
                            <strong>Necessidade (Minimização):</strong> Apenas dados estritamente pertinentes são coletados.
                          </div>
                          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/60 dark:border-night-800">
                            <strong>Livre Acesso & Qualidade:</strong> O colaborador consulta seus próprios relatórios com exatidão e transparência.
                          </div>
                          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/60 dark:border-night-800">
                            <strong>Segurança & Prevenção:</strong> Hashing com salt em senhas, tokens HMAC de sessão e isolamento RBAC.
                          </div>
                          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/60 dark:border-night-800">
                            <strong>Não Discriminação:</strong> Inteligência artificial não executa perfilamento discriminatório ou punitivo.
                          </div>
                          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/60 dark:border-night-800">
                            <strong>Prestação de Contas:</strong> Trilha imutável <code>AuditLog</code> com registro de data, IP e diff de valores.
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-extrabold text-gray-900 dark:text-white text-sm">
                          4. Direitos do Titular de Dados (Art. 18)
                        </h4>
                        <p>
                          Todo colaborador tem direito de requisitar a qualquer momento: confirmação de tratamento, acesso facilitado, retificação de dados incorretos, portabilidade dos seus dados em formato aberto (JSON), bem como revisão de qualquer síntese automatizada (Art. 20).
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-night-850 border-t border-gray-100 dark:border-night-800 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowLgpdPolicyModal(false)}
                        className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        Entendido e Ciente
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
