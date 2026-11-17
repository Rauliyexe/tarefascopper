import { Company, TarefaItem, User, TaskComment } from '../types';

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

export const DEFAULT_COMPANIES: Company[] = [
  {
    id: 'emp-copper-group',
    monogram: 'CG',
    numericCode: '01',
    legalName: 'Copper Group S.A. Indústria & Metalurgia',
    tradeName: 'Copper Group Matriz',
    sector: 'Metalurgia de Cobre & Transformação',
    cnpj: '12.345.678/0001-90',
    status: 'OPERATIONAL',
    unitsCount: 3,
    state: 'SP',
    city: 'São Paulo',
    lastActivityAt: 'Agora',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    enabledModules: ['tarefas', 'fundicao', 'metrologia', 'rastreabilidade'],
    stats: {
      ordersCount: 142,
      inProductionCount: 18,
      pendingCount: 6,
      alertsCount: 1,
      revenueMtd: 'R$ 48.950.000,00',
      operationalEfficiency: '98.4%',
    },
    branches: [
      {
        id: 'br-cg-matriz',
        companyId: 'emp-copper-group',
        name: 'Matriz Principal (São Paulo - SP)',
        code: 'MTZ-01',
        numericCode: '01',
        type: 'MATRIZ',
        cnpj: '12.345.678/0001-90',
        state: 'SP',
        city: 'São Paulo',
        address: 'Av. Industrial das Nações, 2500 - Distrito Metalúrgico',
        manager: 'André Francisco (CEO)',
        phone: '(11) 3450-8000',
        email: 'matriz@coppergroup.com.br',
        status: 'OPERATIONAL',
        activeEmployeesCount: 184,
        operationalArea: 'Sede Administrativa, Laminação e Centro Logístico',
      },
      {
        id: 'br-cg-sertaozinho',
        companyId: 'emp-copper-group',
        name: 'Usina de Fusão & Sucata (Sertãozinho - SP)',
        code: 'FIL-02',
        numericCode: '02',
        type: 'FILIAL',
        cnpj: '12.345.678/0002-71',
        state: 'SP',
        city: 'Sertãozinho',
        address: 'Rodovia SP-322, Km 312 - Pátio Industrial de Fusão',
        manager: 'Carlos Alberto Mendes',
        phone: '(16) 3942-5500',
        email: 'sertaozinho@coppergroup.com.br',
        status: 'OPERATIONAL',
        activeEmployeesCount: 92,
        operationalArea: 'Pátio de Sucata Mel, Fornos de Indução e Balança Rodoviária 80T',
      },
    ],
  },
  {
    id: 'emp-fundicao-sp',
    monogram: 'FT',
    numericCode: '02',
    legalName: 'Fundição Paulista de Metais Não-Ferrosos Ltda',
    tradeName: 'Fundição & Transformação SP',
    sector: 'Fundição de Cobre e Cadinhos',
    cnpj: '98.765.432/0001-10',
    status: 'OPERATIONAL',
    unitsCount: 2,
    state: 'SP',
    city: 'Mauá',
    lastActivityAt: 'Agora',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    enabledModules: ['tarefas', 'fundicao'],
    stats: {
      ordersCount: 45,
      inProductionCount: 9,
      pendingCount: 2,
      alertsCount: 0,
    },
    branches: [
      {
        id: 'br-ft-maua',
        companyId: 'emp-fundicao-sp',
        name: 'Planta de Fundição & Lingotamento (Mauá - SP)',
        code: 'UND-01',
        numericCode: '01',
        type: 'MATRIZ',
        cnpj: '98.765.432/0001-10',
        state: 'SP',
        city: 'Mauá',
        address: 'Estrada do Capuava, 1800 - Polo Industrial de Mauá',
        manager: 'Edson Lima',
        phone: '(11) 4547-3200',
        email: 'maua@fundicaosp.com.br',
        status: 'OPERATIONAL',
        activeEmployeesCount: 78,
        operationalArea: 'Fornos Basculantes, Lingoteiras e Manutenção OT',
      },
    ],
  },
];

export const DEFAULT_DEPARTMENTS = [
  { id: 'dep-cg-producao', companyId: 'emp-copper-group', code: 'DEP-0001', name: 'Produção & Fundição Metalúrgica', active: true },
  { id: 'dep-cg-pcp', companyId: 'emp-copper-group', code: 'DEP-0002', name: 'Planejamento, PCP & MRP', active: true },
  { id: 'dep-cg-engenharia', companyId: 'emp-copper-group', code: 'DEP-0003', name: 'Engenharia de Produto & BOM', active: true },
  { id: 'dep-cg-qualidade', companyId: 'emp-copper-group', code: 'DEP-0004', name: 'Qualidade & Laboratório ASTM B49', active: true },
  { id: 'dep-cg-manutencao', companyId: 'emp-copper-group', code: 'DEP-0005', name: 'Manutenção & Automação OT', active: true },
  { id: 'dep-cg-logistica', companyId: 'emp-copper-group', code: 'DEP-0006', name: 'Logística & Balança Rodoviária', active: true },
  { id: 'dep-cg-financeiro', companyId: 'emp-copper-group', code: 'DEP-0010', name: 'Diretoria & Administrativo', active: true },
  { id: 'dep-cg-ti', companyId: 'emp-copper-group', code: 'DEP-0013', name: 'Tecnologia da Informação & Governança', active: true },
];

export const DEFAULT_USERS: User[] = [
  {
    id: 'usr-ceo',
    name: 'Carlos Eduardo',
    email: 'ceo@coppergroup.com.br',
    role: 'CEO',
    jobTitle: 'Diretor Geral Executivo',
    department: 'Diretoria & Administrativo',
    departmentId: 'dep-cg-financeiro',
    canAccessAllDepartments: true,
    organizationId: 'org-copper-group',
    companyAccess: ['*'],
    permissions: [
      'company.view',
      'company.edit',
      'company.manage_modules',
      'module.view',
      'module.create',
      'module.edit',
      'module.delete',
      'reports.view',
      'reports.export',
      'control_tower.view',
      'control_tower.manage_alerts',
      'cadastro.view',
      'cadastro.edit',
    ],
  },
  {
    id: 'usr-admin-ti',
    name: 'Lucas Mendes (TI)',
    email: 'admin@coppergroup.com.br',
    role: 'ADMIN',
    jobTitle: 'Administrador de TI & Segurança',
    department: 'Tecnologia da Informação & Governança',
    departmentId: 'dep-cg-ti',
    canAccessAllDepartments: true,
    organizationId: 'org-copper-group',
    companyAccess: ['*'],
    permissions: [
      'company.view',
      'company.edit',
      'company.manage_modules',
      'module.view',
      'module.create',
      'module.edit',
      'module.delete',
      'reports.view',
      'reports.export',
      'control_tower.view',
      'control_tower.manage_alerts',
      'cadastro.view',
      'cadastro.edit',
    ],
  },
  {
    id: 'usr-manager-roberto',
    name: 'Roberto Silva',
    email: 'roberto.silva@coppergroup.com.br',
    role: 'MANAGER',
    jobTitle: 'Gerente de Operações Industriais',
    department: 'Produção & Fundição Metalúrgica',
    departmentId: 'dep-cg-producao',
    canAccessAllDepartments: false,
    organizationId: 'org-copper-group',
    companyAccess: ['emp-copper-group'],
    permissions: ['module.view', 'module.create', 'module.edit', 'reports.view', 'reports.export'],
  },
  {
    id: 'usr-operator-demo',
    name: 'Você (Operador)',
    email: 'operador@coppergroup.com.br',
    role: 'OPERATOR',
    jobTitle: 'Operador Especialista de Linha',
    department: 'Produção & Fundição Metalúrgica',
    departmentId: 'dep-cg-producao',
    canAccessAllDepartments: false,
    organizationId: 'org-copper-group',
    companyAccess: ['emp-copper-group'],
    permissions: ['module.view', 'module.edit'],
  },
  {
    id: 'usr-pcp',
    name: 'Carlos Alberto Mendes',
    email: 'carlos.mendes@coppergroup.com.br',
    role: 'MANAGER',
    jobTitle: 'Supervisor de Planejamento (PCP & MRP)',
    department: 'Planejamento, PCP & MRP',
    departmentId: 'dep-cg-pcp',
    canAccessAllDepartments: false,
    organizationId: 'org-copper-group',
    companyAccess: ['emp-copper-group', 'emp-fundicao-sp'],
    permissions: ['module.view', 'module.create', 'module.edit', 'reports.view', 'reports.export'],
  },
  {
    id: 'usr-qualidade',
    name: 'Dra. Fernanda Lemos',
    email: 'fernanda.lemos@coppergroup.com.br',
    role: 'MANAGER',
    jobTitle: 'Química Chefe & Garantia da Qualidade',
    department: 'Qualidade & Laboratório ASTM B49',
    departmentId: 'dep-cg-qualidade',
    canAccessAllDepartments: false,
    organizationId: 'org-copper-group',
    companyAccess: ['*'],
    permissions: ['module.view', 'module.create', 'module.edit', 'reports.view', 'reports.export'],
  },
  {
    id: 'usr-balanca',
    name: 'Marcos Oliveira',
    email: 'marcos.oliveira@coppergroup.com.br',
    role: 'OPERATOR',
    jobTitle: 'Operador Líder de Balança Rodoviária',
    department: 'Logística & Balança Rodoviária',
    departmentId: 'dep-cg-logistica',
    canAccessAllDepartments: false,
    organizationId: 'org-copper-group',
    companyAccess: ['emp-copper-group'],
    permissions: ['module.view', 'module.edit'],
  },
];

export const DEFAULT_TASKS: TarefaItem[] = [
  // ── Rotinas Diárias Recorrentes ──
  {
    id: 'rot-forno-01',
    title: 'Inspeção Termográfica e Pressão de Água do Forno 10T',
    project: 'Operação Fundição',
    assignee: 'Você (Operador)',
    dueDate: today,
    priority: 'Urgente',
    status: 'Em andamento',
    companyId: 'emp-copper-group',
    isDaily: true,
    dailyTime: '06:30',
    dailyWeekdaysOnly: false,
    assignedBy: 'Roberto Silva',
    dailyActive: true,
    lastDispatchedDate: today,
    routineDescription:
      'Rotina matinal crítica de verificação do revestimento refratário, circuito fechado de água de refrigeração e painel térmico do forno de indução Canal 10T.',
    routineTargetMode: 'DEPARTMENT',
    targetDepartmentId: 'dep-cg-producao',
    checklists: [
      { id: 'chk-r1-1', text: 'Checar pressão da água nos circuitos indutores (> 3.5 bar)', completed: true },
      { id: 'chk-r1-2', text: 'Medir espessura do cadinho refratário com ultrassom portátil', completed: true },
      { id: 'chk-r1-3', text: 'Confirmar temperatura de saída dos cabos de força (< 45°C)', completed: false },
      { id: 'chk-r1-4', text: 'Inspecionar exaustão de gases e captores de fumos', completed: false },
    ],
    comments: [],
  },
  {
    id: 'rot-balanca-02',
    title: 'Aferição Matinal com Peso Padrão da Balança Rodoviária 80T',
    project: 'Portaria & Metrologia',
    assignee: 'Marcos Oliveira',
    dueDate: today,
    priority: 'Alta',
    status: 'Em andamento',
    companyId: 'emp-copper-group',
    isDaily: true,
    dailyTime: '07:00',
    dailyWeekdaysOnly: false,
    assignedBy: 'Dra. Fernanda Lemos',
    dailyActive: true,
    lastDispatchedDate: today,
    routineDescription:
      'Conformidade com a Portaria INMETRO e Trava RN-16. Pesagem de teste com 5 pesos padrão de 1.000 kg aferidos pelo IPEM.',
    routineTargetMode: 'DEPARTMENT',
    targetDepartmentId: 'dep-cg-logistica',
    checklists: [
      { id: 'chk-r2-1', text: 'Limpeza dos batentes e células de carga da plataforma', completed: true },
      { id: 'chk-r2-2', text: 'Zeramento de tara do indicador eletrônico Toledo', completed: true },
      { id: 'chk-r2-3', text: 'Posicionamento dos blocos de 5.000 kg nas 4 extremidades', completed: true },
      { id: 'chk-r2-4', text: 'Emissão e arquivamento do ticket de calibração diária', completed: false },
    ],
    comments: [],
  },

  // ── Tarefas Individuais Operacionais ──
  {
    id: 'tsk-op-01',
    title: 'Carregamento de Cobre Mel e Escorificação na Lingoteira 02',
    project: 'Fundição & Fusão',
    assignee: 'Você (Operador)',
    dueDate: today,
    priority: 'Urgente',
    status: 'Em andamento',
    companyId: 'emp-copper-group',
    isDaily: false,
    assignedBy: 'Roberto Silva',
    routineDescription: 'Acompanhar fusão da carga de sucata limpa e remoção de escória antes do vazamento.',
    checklists: [
      { id: 'chk-o1', text: 'EPIs térmicos e protetor facial conferidos', completed: true },
      { id: 'chk-o2', text: 'Carga de 12.000 kg adicionada de forma controlada', completed: true },
      { id: 'chk-o3', text: 'Amostra de espectrometria retirada para o laboratório', completed: false },
    ],
    comments: [
      {
        id: 'cmt-1',
        author: 'Roberto Silva',
        authorRole: 'Gerente Industrial',
        content: 'Mantenha a temperatura controlada a 1180°C para evitar excesso de óxidos.',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'tsk-op-02',
    title: 'Checklist de Manutenção Preventiva dos Filtros de Mangas',
    project: 'Manutenção Fabril',
    assignee: 'Você (Operador)',
    dueDate: tomorrow,
    priority: 'Média',
    status: 'Pendente',
    companyId: 'emp-copper-group',
    isDaily: false,
    assignedBy: 'Roberto Silva',
    routineDescription: 'Verificar diferencial de pressão e sistema de ar comprimido reverso.',
    checklists: [
      { id: 'chk-o4', text: 'Verificar manômetro diferencial de pressão', completed: false },
      { id: 'chk-o5', text: 'Testar válvulas solenoides de pulso de ar', completed: false },
    ],
    comments: [],
  },
  {
    id: 'tsk-op-03',
    title: 'Troca de Matriz de Trefilação de Vergalhão 8.0mm para 2.5mm',
    project: 'Laminação & Trefila',
    assignee: 'Você (Operador)',
    dueDate: yesterday,
    priority: 'Alta',
    status: 'Concluída',
    companyId: 'emp-copper-group',
    isDaily: false,
    assignedBy: 'Roberto Silva',
    routineDescription: 'Setup de fieiras de diamante policristalino e lubrificação por emulsão solúvel.',
    checklists: [
      { id: 'chk-o6', text: 'Fieiras inspecionadas com micrômetro digital', completed: true },
      { id: 'chk-o7', text: 'Teste de tração realizado em 3 amostras', completed: true },
    ],
    comments: [],
  },

  // ── Tarefas da Diretoria / CEO ──
  {
    id: 'tsk-ceo-01',
    title: 'Aprovação de Alçada Executiva: Compra Lote 45T Sucata Cobre Mel 1A',
    project: 'Diretoria & Compras LME',
    assignee: 'Carlos Eduardo',
    dueDate: today,
    priority: 'Urgente',
    status: 'Em andamento',
    companyId: 'emp-copper-group',
    isDaily: false,
    assignedBy: 'Controladoria & Compras',
    routineDescription: 'Validação de spread LME e hedge cambial para aquisição de 45 toneladas de Cobre Mel 99,9%.',
    checklists: [
      { id: 'chk-c1', text: 'Conferir cotação oficial LME Cash Settlement do dia', completed: true },
      { id: 'chk-c2', text: 'Revisar laudo de impureza do fornecedor MetalSul (< 0.1%)', completed: true },
      { id: 'chk-c3', text: 'Assinar liberação financeira no ERP', completed: false },
    ],
    comments: [],
  },
  {
    id: 'tsk-ceo-02',
    title: 'Revisão do DRE Industrial e Eficiência Energética dos Fornos',
    project: 'Governança & Diretoria',
    assignee: 'Carlos Eduardo',
    dueDate: tomorrow,
    priority: 'Alta',
    status: 'Pendente',
    companyId: 'emp-copper-group',
    isDaily: false,
    assignedBy: 'Diretoria Executiva',
    routineDescription: 'Análise do consumo específico kWh/tonelada fundida entre Matriz São Paulo e Filiais.',
    checklists: [
      { id: 'chk-c4', text: 'Auditar indicador kWh/t do Forno Indução 10T', completed: false },
      { id: 'chk-c5', text: 'Validar meta de perda metálica por escorificação (< 1.2%)', completed: false },
    ],
    comments: [],
  },

  // ── Tarefas de TI ──
  {
    id: 'tsk-ti-01',
    title: 'Auditoria de Acessos e Políticas de Senhas/PIN dos Operadores',
    project: 'TI & Governança',
    assignee: 'Lucas Mendes (TI)',
    dueDate: today,
    priority: 'Alta',
    status: 'Em andamento',
    companyId: 'emp-copper-group',
    isDaily: false,
    assignedBy: 'Carlos Eduardo',
    routineDescription: 'Revisão das permissões de chão de fábrica, reset de credenciais inativas e conferência de logs LGPD.',
    checklists: [
      { id: 'chk-t1', text: 'Verificar usuários sem login há mais de 30 dias', completed: true },
      { id: 'chk-t2', text: 'Conferir trilha de auditoria e exportação Art. 18 LGPD', completed: false },
    ],
    comments: [],
  },
  {
    id: 'tsk-ti-02',
    title: 'Backup Periódico e Teste de Recuperação da Trilha PostgreSQL',
    project: 'TI & Infraestrutura',
    assignee: 'Lucas Mendes (TI)',
    dueDate: nextWeek,
    priority: 'Média',
    status: 'Pendente',
    companyId: 'emp-copper-group',
    isDaily: false,
    assignedBy: 'Lucas Mendes (TI)',
    routineDescription: 'Simulação de disaster recovery e integridade das chaves primárias do banco.',
    checklists: [],
    comments: [],
  },
];

const TASKS_STORAGE_KEY = 'copperos_standalone_tasks_v2';
const USERS_STORAGE_KEY = 'copperos_standalone_users_v2';
const AUDIT_STORAGE_KEY = 'copperos_standalone_audit_v2';

export const standaloneStore = {
  isOfflineMode: true,

  getUsers(): User[] {
    try {
      const stored = localStorage.getItem(USERS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_USERS;
  },

  saveUsers(users: User[]): void {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch {
      // ignore
    }
  },

  upsertUser(u: User): User {
    const users = this.getUsers();
    const idx = users.findIndex(item => item.id === u.id);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...u };
    } else {
      users.unshift(u);
    }
    this.saveUsers(users);
    return u;
  },

  deleteUser(id: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    this.saveUsers(users);
  },

  getTasks(): TarefaItem[] {
    try {
      const stored = localStorage.getItem(TASKS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_TASKS;
  },

  saveTasks(tasks: TarefaItem[]): void {
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // ignore
    }
  },

  createTask(payload: Partial<TarefaItem>): TarefaItem {
    const tasks = this.getTasks();
    const newTask: TarefaItem = {
      id: payload.id || `tsk-${Date.now()}`,
      title: payload.title || 'Nova Tarefa',
      project: payload.project || 'Operações',
      assignee: payload.assignee || 'Você (Operador)',
      dueDate: payload.dueDate || today,
      priority: payload.priority || 'Média',
      status: payload.status || 'Pendente',
      companyId: payload.companyId || 'emp-copper-group',
      isDaily: !!payload.isDaily,
      dailyTime: payload.dailyTime,
      dailyWeekdaysOnly: payload.dailyWeekdaysOnly,
      assignedBy: payload.assignedBy || 'Gestão',
      dailyActive: payload.dailyActive !== false,
      routineDescription: payload.routineDescription,
      routineTargetMode: payload.routineTargetMode,
      targetDepartmentId: payload.targetDepartmentId,
      checklists: payload.checklists || [],
      attachments: payload.attachments || [],
      comments: payload.comments || [],
    };
    tasks.unshift(newTask);
    this.saveTasks(tasks);
    return newTask;
  },

  updateTask(id: string, updates: Partial<TarefaItem>): TarefaItem {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx < 0) {
      throw new Error(`Tarefa ${id} não encontrada.`);
    }
    const updated = { ...tasks[idx], ...updates };
    tasks[idx] = updated;
    this.saveTasks(tasks);
    return updated;
  },

  deleteTask(id: string): void {
    const tasks = this.getTasks().filter(t => t.id !== id);
    this.saveTasks(tasks);
  },

  batchTasks(payload: {
    tasks: Partial<TarefaItem>[];
    updateRoutines?: Array<{ id: string; lastDispatchedDate: string }>;
  }): { count: number; tasks: TarefaItem[] } {
    const current = this.getTasks();
    const newItems: TarefaItem[] = payload.tasks.map(t => ({
      id: t.id || `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: t.title || 'Tarefa de Rotina',
      project: t.project || 'Operações',
      assignee: t.assignee || 'Você (Operador)',
      dueDate: t.dueDate || today,
      priority: t.priority || 'Média',
      status: t.status || 'Pendente',
      companyId: t.companyId || 'emp-copper-group',
      isDaily: !!t.isDaily,
      dailyTime: t.dailyTime,
      dailyWeekdaysOnly: t.dailyWeekdaysOnly,
      assignedBy: t.assignedBy || 'Rotina Automática',
      dailyActive: t.dailyActive !== false,
      routineDescription: t.routineDescription,
      routineTargetMode: t.routineTargetMode,
      targetDepartmentId: t.targetDepartmentId,
      checklists: t.checklists || [],
      attachments: t.attachments || [],
      comments: t.comments || [],
    }));

    if (payload.updateRoutines && payload.updateRoutines.length > 0) {
      for (const ur of payload.updateRoutines) {
        const r = current.find(item => item.id === ur.id);
        if (r) {
          r.lastDispatchedDate = ur.lastDispatchedDate;
        }
      }
    }

    const merged = [...newItems, ...current];
    this.saveTasks(merged);
    return { count: newItems.length, tasks: newItems };
  },

  addComment(taskId: string, comment: Partial<TaskComment>): TarefaItem {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx < 0) throw new Error(`Tarefa ${taskId} não encontrada.`);
    const fullComment: TaskComment = {
      id: comment.id || `cmt-${Date.now()}`,
      author: comment.author || 'Usuário',
      authorRole: comment.authorRole || 'Colaborador',
      content: comment.content || '',
      type: (comment.type as any) || 'FEEDBACK',
      attachments: comment.attachments || [],
      createdAt: new Date().toISOString(),
    };
    tasks[idx].comments = [...(tasks[idx].comments || []), fullComment];
    this.saveTasks(tasks);
    return tasks[idx];
  },

  getAuditLogs(): any[] {
    try {
      const stored = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [
      {
        id: 'aud-demo-1',
        action: 'USER_LOGIN',
        entity: 'Auth',
        description: 'Login bem-sucedido na plataforma (Modo Standalone)',
        userName: 'Carlos Eduardo',
        userRole: 'CEO',
        userEmail: 'ceo@coppergroup.com.br',
        occurredAt: new Date().toISOString(),
      },
    ];
  },

  recordAudit(log: any): void {
    try {
      const logs = this.getAuditLogs();
      logs.unshift({
        id: `aud-${Date.now()}`,
        occurredAt: new Date().toISOString(),
        ...log,
      });
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs.slice(0, 100)));
    } catch {
      // ignore
    }
  },
};
