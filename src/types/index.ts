export type CompanyStatus = 'OPERATIONAL' | 'WARNING' | 'MAINTENANCE' | 'INACTIVE';

export type UserRole = 'CEO' | 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';

export type Permission =
  | 'company.view'
  | 'company.edit'
  | 'company.manage_modules'
  | 'module.view'
  | 'module.create'
  | 'module.edit'
  | 'module.delete'
  | 'reports.view'
  | 'reports.export'
  | 'control_tower.view'
  | 'control_tower.manage_alerts'
  | 'cadastro.view'
  | 'cadastro.edit';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  jobTitle?: string;
  department?: string;
  departmentId?: string;
  canAccessAllDepartments?: boolean;
  organizationId: string;
  companyAccess: string[];
  permissions: Permission[];
  /** Módulos liberados pelos perfis de acesso (null = segue só o papel). */
  allowedModules?: string[] | null;
  /** Nível por rotina (modulo.rotina) dos perfis de acesso; null = sem perfil (segue o papel). */
  permissoes?: Record<string, string> | null;
  rolePresetId?: string;
  /** LGPD: pode exportar e anonimizar dados de titulares (clientes pessoa física). */
  podeTratarDadosTitular?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  legalEntity: string;
  taxGroup: string;
  holdingCode: string;
}

export interface CompanyStats {
  ordersCount: number;
  inProductionCount: number;
  pendingCount: number;
  alertsCount: number;
  revenueMtd?: string;
  operationalEfficiency?: string;
}

export interface CompanyBranch {
  id: string;
  companyId: string;
  name: string;
  code: string;
  numericCode?: string;
  type: 'MATRIZ' | 'FILIAL';
  cnpj: string;
  state: string;
  city: string;
  address: string;
  manager: string;
  phone: string;
  email: string;
  status: CompanyStatus;
  activeEmployeesCount: number;
  operationalArea?: string;
  notes?: string;
}

export interface Company {
  id: string;
  monogram?: string;      // e.g. 'CG', 'AF', 'DC', 'SA'
  numericCode?: string;   // e.g. '01', '02', '03', '04'
  logoUrl?: string;       // e.g. '/logos/af-locacoes.png'
  legalName: string;      // Razão Social
  tradeName: string;      // Nome Fantasia (e.g. 'Copper Group')
  sector: string;         // Segmento (e.g. 'Soluções Industriais')
  cnpj: string;           // Identificador fiscal formatado
  status: CompanyStatus;
  unitsCount: number;
  state: string;
  city: string;
  enabledModules: string[];
  stats: CompanyStats;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  branches?: CompanyBranch[];
}

export interface Department {
  id: string;
  companyId: string;
  code: string;
  name: string;
}

export interface Employee {
  id: string;
  companyId: string;
  departmentId: string;
  name: string;
  email: string;
  role: string;
  /** Colaboradores inativos são ignorados no disparo das rotinas diárias. */
  active: boolean;
}

export type TaskPriority = 'Urgente' | 'Alta' | 'Média' | 'Baixa';
export type TaskStatus = 'Pendente' | 'Em andamento' | 'Concluída';

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string; // Data URL ou URL remota
  size?: number;
  type?: string;
  createdAt: string;
  uploadedBy?: string;
}

/** Comentário, ocorrência ou feedback de andamento registrado na tarefa */
export interface TaskComment {
  id: string;
  author: string;
  authorEmail?: string;
  authorRole?: string;
  content: string;
  createdAt: string;
  type?: 'FEEDBACK' | 'CONCLUSAO' | 'SISTEMA';
  attachments?: TaskAttachment[];
}

/** Como uma rotina diária escolhe seus destinatários. */
export type RoutineTargetMode = 'EMPLOYEE' | 'DEPARTMENT';

export interface TarefaItem {
  id: string;
  title: string;
  project: string;
  assignee: string;
  /** ISO (yyyy-mm-dd) para permitir ordenação e detecção de atraso. */
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  /** Empresa de origem — usado no dashboard consolidado da holding. */
  companyId?: string;

  // ── Gestão de Rotinas Diárias do Gestor ──
  /** Define se é uma tarefa que se repete diariamente */
  isDaily?: boolean;
  /** Horário diário de envio / notificação (ex: "08:00") */
  dailyTime?: string;
  /** Se deve ser enviada somente em dias úteis (Segunda a Sexta) */
  dailyWeekdaysOnly?: boolean;
  /** Nome do gestor responsável pela atribuição da rotina */
  assignedBy?: string;
  /** Se a automação diária está ativa ou pausada */
  dailyActive?: boolean;
  /** Instruções adicionais / checklist para a execução diária */
  routineDescription?: string;
  /** Data do último disparo efetuado */
  lastDispatchedDate?: string;

  // ── Destinatários da rotina ──
  /** 'DEPARTMENT' lança uma tarefa para cada colaborador ativo do departamento. */
  routineTargetMode?: RoutineTargetMode;
  /** Departamento alvo quando routineTargetMode = 'DEPARTMENT'. */
  targetDepartmentId?: string;
  /** Colaborador dono desta tarefa (quando gerada por uma rotina). */
  assigneeId?: string;
  /** Id da rotina que gerou esta tarefa. Ausente em tarefas avulsas e nos próprios templates. */
  sourceRoutineId?: string;

  // ── Checklists & Evidências Fotográficas ──
  checklists?: TaskChecklistItem[];
  attachments?: TaskAttachment[];
  comments?: TaskComment[];
}

export type ModuleCategory = 'CORE' | 'OPERATIONS' | 'MANAGEMENT' | 'ADVANCED';

export interface ModuleDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  route: string;
  version: string;
  status: 'ACTIVE' | 'BETA' | 'AVAILABLE';
  category: ModuleCategory;
  permissionsRequired: Permission[];
  enabledByDefault: boolean;
  tags: string[];
  isEmProducao?: boolean;
  etapaProducao?: string;
  progressoProducao?: number;
}

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  timestamp: string;
  moduleSource: string;
  companyId: string;
  acknowledged?: boolean;
}

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  timeFormatted: string;
  title: string;
  code?: string;
  user: string;
  type: 'ORDER' | 'INVOICE' | 'SUPPLIER' | 'PRODUCTION' | 'SYSTEM' | 'SECURITY';
  companyId: string;
}

export type CadastroCategory =
  | 'CLIENTS'
  | 'SUPPLIERS'
  | 'EMPLOYEES'
  | 'PRODUCTS'
  | 'SERVICES'
  | 'UNITS'
  | 'CONTACTS';

export interface DirectoryRecord {
  id: string;
  structuredId?: string;  // Formato hierárquico: ID{EE}{FF}{NNNN} ex: ID01010001
  companyId: string;
  branchId?: string | null;
  isGlobal?: boolean;     // Se verdadeiro, compartilhado entre todas as empresas (ex: fornecedores da holding)
  category: CadastroCategory;
  code: string;
  name: string;
  document?: string;
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'BLOCKED';
  detail: string;
  contactEmail?: string;
  contactPhone?: string;
  tags?: string[];
  updatedAt: string;
  unit?: string;
  unitCost?: number;
  minStock?: number;
  currentStock?: number;
  barcode?: string;
  location?: string;
  responsible?: string;
  brand?: string;
  subCategory?: string;
  ncm?: string;
  notes?: string;
  /** LGPD: 'F' = Pessoa Física (titular), 'J' = Pessoa Jurídica (empresa) */
  tipoPessoa?: 'F' | 'J';
  /** LGPD: data em que os dados pessoais foram anonimizados a pedido do titular */
  anonimizadoEm?: string | null;
  company?: { id: string; tradeName: string; numericCode: string };
  branch?: { id: string; name: string; code: string; numericCode: string } | null;
}

export type ReportCategory = 'OPERATIONAL' | 'FINANCIAL' | 'COMMERCIAL' | 'PRODUCTION' | 'INVENTORY' | 'COMPLIANCE';

export interface ReportIndicator {
  indicator: string;
  actual: string;
  target: string;
  variation: string;
  status?: 'good' | 'warning' | 'neutral';
}

export interface ScheduledReport {
  id: string;
  companyId: string;
  reportTitle: string;
  category: ReportCategory;
  frequency: 'DIARIO' | 'SEMANAL' | 'MENSAL';
  nextRun: string;
  recipients: string[];
  active: boolean;
  format: 'PDF' | 'XLS' | 'JSON';
}

export interface ReportItem {
  id: string;
  companyId: string;
  title: string;
  description: string;
  category: ReportCategory;
  lastUpdated: string;
  responsible: string;
  status: 'READY' | 'PROCESSING' | 'SCHEDULED';
  formats: ('PDF' | 'XLS' | 'INTERACTIVE')[];
  period: string;
  sizeEstimate?: string;
  customIndicators?: ReportIndicator[];
}

export type MovementKind = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'TRANSFERENCIA';

export interface StockMovement {
  id: string;
  companyId: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  kind: MovementKind;
  quantity: number;
  balanceAfter: number;
  documentRef?: string; // NF-e, OS, Pedido de Compra
  batchNumber?: string; // Lote / Série
  reason: string;
  user: string;
  at: string;
  costTotal?: number;
  originLocation?: string;
  destinationLocation?: string;
}

// ── Módulo de Fundição & Balanço de Massa Industrial ─────────

export type StatusEtapaFundicao =
  | 'CARGA'            // Carregamento e pesagem de sucata / insumos
  | 'FUSAO'            // Aquecimento e fusão no forno
  | 'AJUSTE_QUIMICO'   // Amostragem, análise espectrométrica e aditivos
  | 'VAZAMENTO'        // Vazamento / lingotamento / moldagem
  | 'RESFRIAMENTO'     // Resfriamento e desmoldagem
  | 'CONCLUIDA'        // Corrida finalizada com balanço de massa fechado
  | 'CANCELADA';

export interface InsumoCargaItem {
  id: string;
  itemNome: string;             // ex: "Sucata de Cobre Mel", "Vergalhão Cobre", "Retorno Próprio", "Fósforo-Cobre"
  categoria: 'SUCATA' | 'PRIMARIO' | 'RETORNO_PROPRIO' | 'LIGA_ADITIVO' | 'FUNDENTE';
  pesoKg: number;               // Peso carregado
  teorEstimadoCu?: number;      // % estimada de Cobre
  loteOrigem?: string;          // Lote do fornecedor ou do almoxarifado
}

export interface AnaliseQuimicaCorrida {
  amostraId: string;
  horario: string;
  cuPercent: number;            // % Cobre (ex: 99.85%)
  oxigenioPpm?: number;         // ppm O2
  impurezas?: {
    elemento: string;           // Pb, Fe, Ni, Sn, Zn, P, etc.
    ppmOuPercent: string;
  }[];
  conforme: boolean;
  laboratorista?: string;
}

export interface BalancoMassaCorrida {
  pesoCargaTotalKg: number;     // Entrada total (sucata + retalhos + ligas)
  pesoProduzidoKg: number;      // Saída líquida boa (tarugos, lingotes, peças boas)
  pesoRetornoKg: number;        // Retorno limpo (canais, maçarotes, sobras)
  pesoEscoriaBorraKg: number;   // Borra / Escória de forno (dross)
  pesoPerdaQueimaKg: number;    // Perda por queima / volatilização (calculada)
  rendimentoMetalicoPercent: number; // (pesoProduzido / pesoCarga) * 100
  recuperacaoTotalPercent: number;   // ((pesoProduzido + pesoRetorno) / pesoCarga) * 100
  diferencaBalancoKg: number;   // Balanço: Carga - (Produzido + Retorno + Escória + Perda)
}

export interface CorridaFundicao {
  id: string;
  numeroCorrida: string;        // ex: "CR-2026-084"
  companyId: string;
  fornoId: string;              // ex: "FORNO-IND-01" (Forno de Indução 1)
  fornoNome: string;
  ligaNome: string;             // ex: "Cobre ETP (Cu-ETP)", "Cobre Fosforoso (Cu-DHP)", "Bronze TM 23"
  operadorResponsavel: string;
  turno: 'Turno 1' | 'Turno 2' | 'Turno 3' | 'Comercial';
  dataInicio: string;           // ISO string ou YYYY-MM-DD HH:mm
  dataFim?: string;
  temperaturaAtualC?: number;   // ex: 1180°C
  temperaturaVazamentoC?: number;
  statusEtapa: StatusEtapaFundicao;
  cargas: InsumoCargaItem[];
  analisesQuimicas: AnaliseQuimicaCorrida[];
  balancoMassa: BalancoMassaCorrida;
  observacoes?: string;
  produtoFinal: {
    tipo: 'TARUGO' | 'LINGOTE' | 'BARRA' | 'PECA_FUNDIDA' | 'ANODO';
    especificacao: string;      // ex: "Tarugo Ø 8 polegadas x 3m"
    quantidadePecas: number;
  };
}

// ─────────────────────────────────────────────────────────────
// ETAPA 1: BASE DO SISTEMA — CADASTROS MESTRES, GOVERNANÇA E AUDITORIA
// ─────────────────────────────────────────────────────────────

export type EquipamentoTipo =
  | 'RODOVIARIA'
  | 'INTERNA_01'
  | 'INTERNA_02'
  | 'FIXA_REBOBINADOR'
  | 'PISTOLA_QR';

export type StatusCalibracaoEquipamento =
  | 'CALIBRADO_ATIVO'
  | 'CALIBRACAO_VENCIDA_BLOQUEADO'
  | 'EM_MANUTENCAO';

export interface EquipamentoPesagemLeitura {
  id: string;
  codigo: string;
  nome: string;
  tipo: EquipamentoTipo;
  capacidadeMaxKg: number;
  precisaoKg: number;
  localizacao: string;
  marcaModelo: string;
  ultimaCalibracao: string;        // YYYY-MM-DD
  validadeCalibracao: string;      // YYYY-MM-DD
  orgaoCertificador: string;       // ex: "IPEM / RBC - Cert. 2026/894"
  certificadoNumero: string;
  status: StatusCalibracaoEquipamento;
  bloqueadoOperacionalmente: boolean;
  motivoBloqueio?: string;
  historicoCalibracoes?: {
    data: string;
    validade: string;
    laudo: string;
    responsavel: string;
  }[];
}

export interface VeiculoTransporte {
  id: string;
  placa: string;
  modelo: string;
  tipoCarroceria: 'Carreta Graneleira' | 'Sider / Baú' | 'Truck Aberto' | 'Container';
  taraCadastradaKg: number;
  transportadoraId: string;
  transportadoraNome: string;
  dataUltimaPesagemTara?: string;
  vencimentoInspecao: string;
  status: 'ATIVO' | 'BLOQUEADO' | 'PENDENTE';
}

export interface MotoristaTransporte {
  id: string;
  nome: string;
  cpf: string;
  cnhNumero: string;
  cnhCategoria: string;
  telefone: string;
  transportadoraId: string;
  transportadoraNome: string;
  status: 'HOMOLOGADO' | 'PENDENTE_DOCUMENTACAO' | 'BLOQUEADO';
}

export interface CentroTrabalho {
  id: string;
  codigo: string;
  nome: string;
  departamentoId: string;
  capacidadeNominalTurnoKg: number;
  maquinasAssociadas: string[];
  responsavel: string;
  status: 'OPERACIONAL' | 'MANUTENCAO' | 'BLOQUEADO';
}

export interface TaraPadrao {
  id: string;
  codigo: string;
  tipo: 'PALETE_MADEIRA' | 'PALETE_ACO' | 'BOBINA_VAZIA' | 'CARRETEL_MADEIRA' | 'CARRETEL_ACO';
  descricao: string;
  taraKg: number;
  toleranciaKg: number;
  ativo: boolean;
}

export interface ClasseSucata {
  id: string;
  codigo: string;
  nome: string;
  teorEstimadoCuMin: number;
  teorEstimadoCuMax: number;
  rendimentoMetalicoEsperado: number;
  maxImpurezasPercent: number;
  exigeEspectrometriaPrevia: boolean;
  descricao: string;
  padraoInternacional?: string; // ex: ISRI Berry / Candy / Birch
}

export type StatusEstoqueRastreavel =
  | 'bloqueado'
  | 'em_inspecao'
  | 'liberado'
  | 'reservado'
  | 'carregado'
  | 'expedido'
  | 'consumido'
  | 'segregado'
  | 'reprovado';

export type UnidadeEstoqueTipo =
  | 'PALETE_FARDOS'
  | 'LOTE_PALANQUILHA'
  | 'BOBINA_8MM'
  | 'BOBINA_RETANGULAR'
  | 'KIT_FIOS_CTC'
  | 'CARRETEL_CTC';

export interface UnidadeEstoqueRastreavel {
  id: string;
  qrCode: string;
  codigoLote: string;
  tipo: UnidadeEstoqueTipo;
  pesoLiquidoKg: number;
  pesoBrutoKg: number;
  taraKg: number;
  localizacaoWms: string;
  status: StatusEstoqueRastreavel;
  dataCriacao: string;
  fornadaOrigemId?: string;
  ancestraisIds: string[];   // Relação N:N para Fio Digital
  descendentesIds: string[]; // Relação N:N para Fio Digital
}

export type PostoOperacionalId =
  | 'GUARITA'
  | 'BALANCA_RODOVIARIA'
  | 'BALANCA_INTERNA'
  | 'ALMOXARIFADO'
  | 'PRENSAS'
  | 'FORNOS'
  | 'LABORATORIO'
  | 'LAMINACAO'
  | 'REBOBINADOR'
  | 'ALMOXARIFADO_QUIMICO'
  | 'QUALIDADE'
  | 'EXPEDICAO'
  | 'PCP'
  | 'COMPRAS'
  | 'FATURAMENTO'
  | 'CONTROLADORIA';

export interface PostoOperacionalConfig {
  id: PostoOperacionalId;
  nome: string;
  departamentoAssociado: string;
  descricao: string;
  acoesPermitidas: string[];
  postosConflitantesRegraOuro: PostoOperacionalId[];
}

export type AcaoAuditoriaTipo =
  | 'CRIACAO'
  | 'EDICAO'
  | 'CORRECAO_PESO'
  | 'APROVACAO_QUALIDADE'
  | 'LIBERACAO_PAGAMENTO'
  | 'MUDANCA_STATUS'
  | 'TRAVA_DISPARADA'
  | 'PARAMETRO_ALTERADO';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  usuarioId: string;
  usuarioNome: string;
  postoOperacional: PostoOperacionalId;
  departamento: string;
  acaoTipo: AcaoAuditoriaTipo;
  entidadeTipo: 'EQUIPAMENTO' | 'PRODUTO' | 'CORRIDA' | 'PESAGEM' | 'CARGA' | 'ESTOQUE' | 'PARAMETRO' | 'CLIENTE' | 'FORNECEDOR';
  entidadeId: string;
  entidadeCodigo: string;
  campoAlterado?: string;
  valorAnterior?: string | number | null;
  valorNovo: string | number;
  motivo: string;
  statusValidacao: 'SUCESSO' | 'BLOQUEADO_REGRA_OURO' | 'BLOQUEADO_CALIBRACAO_VENCIDA';
  mensagemBloqueio?: string;
}

export interface ParametroGovernanca {
  id: string;
  chave: string;
  nome: string;
  categoria: 'TOLERANCIA_PESAGEM' | 'ALCADA_FINANCEIRA' | 'LIMITE_CREDITO' | 'QUALIDADE_LAB';
  valor: number | string;
  unidade: string;
  descricao: string;
  ultimaAlteracaoPor: string;
  dataAlteracao: string;
  motivoAlteracao?: string;
}





