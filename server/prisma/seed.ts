import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (raw: string) =>
  crypto.createHash('sha256').update(`copperos_salt_v1:${raw}`).digest('hex');

async function main() {
  console.log('🌱 Inicializando banco SQLite completo para Testes Piloto do CopperOS...');

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // Limpa dados anteriores para um seed limpo e determinístico
  await prisma.reportConsolidation.deleteMany({});
  await prisma.departmentQuestion.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.shiftReport.deleteMany({});
  await prisma.dailyNote.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.companyRecord.deleteMany({});
  await prisma.userProfile.deleteMany({});
  await prisma.systemSetting.deleteMany({});
  await prisma.auditLog.deleteMany({});

  // 1. Empresas e Filiais Multi-Tenant
  const companiesSeed = [
    {
      id: 'emp-copper-group',
      monogram: 'CG',
      numericCode: '01',
      legalName: 'Copper Group S.A. Indústria & Metalurgia',
      tradeName: 'Copper Group Holding',
      sector: 'Metalurgia de Cobre & Transformação',
      cnpj: '12.345.678/0001-90',
      status: 'OPERATIONAL',
      unitsCount: 3,
      state: 'SP',
      city: 'São Paulo',
      enabledModules: JSON.stringify(['tarefas', 'fundicao', 'metrologia', 'rastreabilidade']),
      stats: JSON.stringify({
        ordersCount: 142,
        inProductionCount: 18,
        pendingCount: 6,
        alertsCount: 1,
        revenueMtd: 'R$ 48.950.000,00',
        operationalEfficiency: '98.4%',
      }),
      branches: JSON.stringify([
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
        {
          id: 'br-cg-joinville',
          companyId: 'emp-copper-group',
          name: 'Laminação & Trefilação (Joinville - SC)',
          code: 'FIL-03',
          numericCode: '03',
          type: 'FILIAL',
          cnpj: '12.345.678/0003-52',
          state: 'SC',
          city: 'Joinville',
          address: 'Rua das Indústrias Metálicas, 750 - Polo Metalmecânico',
          manager: 'Dra. Fernanda Lemos',
          phone: '(47) 3421-9900',
          email: 'joinville@coppergroup.com.br',
          status: 'OPERATIONAL',
          activeEmployeesCount: 64,
          operationalArea: 'Trefilação de Vergalhão de Cobre ASTM B49 e Cordoalhas',
        },
      ]),
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
      enabledModules: JSON.stringify(['tarefas', 'fundicao', 'metrologia']),
      stats: JSON.stringify({
        ordersCount: 88,
        inProductionCount: 12,
        pendingCount: 4,
        alertsCount: 0,
        revenueMtd: 'R$ 21.400.000,00',
        operationalEfficiency: '97.2%',
      }),
      branches: JSON.stringify([
        {
          id: 'br-ft-maua',
          companyId: 'emp-fundicao-sp',
          name: 'Unidade Fornos & Cadinhos (Mauá - SP)',
          code: 'UND-01',
          numericCode: '01',
          type: 'MATRIZ',
          cnpj: '98.765.432/0001-10',
          state: 'SP',
          city: 'Mauá',
          address: 'Estrada do Capuava, 1800 - Polo Industrial de Mauá',
          manager: 'Edson Lima (Gerente de Planta)',
          phone: '(11) 4547-3200',
          email: 'maua@fundicaosp.com.br',
          status: 'OPERATIONAL',
          activeEmployeesCount: 78,
          operationalArea: 'Fornos Basculantes, Lingoteiras e Manutenção OT',
        },
        {
          id: 'br-ft-sorocaba',
          companyId: 'emp-fundicao-sp',
          name: 'Centro de Distribuição & Sucata (Sorocaba - SP)',
          code: 'UND-02',
          numericCode: '02',
          type: 'FILIAL',
          cnpj: '98.765.432/0002-09',
          state: 'SP',
          city: 'Sorocaba',
          address: 'Av. Pirelli, 4100 - Distrito Industrial',
          manager: 'Marcos Oliveira',
          phone: '(15) 3228-4100',
          email: 'sorocaba@fundicaosp.com.br',
          status: 'OPERATIONAL',
          activeEmployeesCount: 41,
          operationalArea: 'Triagem de Cobre Mel, Prensa Enfardadeira e Expedição',
        },
      ]),
    },
  ];

  for (const comp of companiesSeed) {
    await prisma.companyRecord.create({ data: comp });
  }

  // 2. Departamentos Organizacionais e Perfis de Colaboradores (RBAC)
  const defaultPasswordHash = hashPassword('copperos2026');

  const departmentsSeed = [
    { id: 'dep-cg-producao', companyId: 'emp-copper-group', code: 'DEP-0001', name: 'Produção & Fundição Metalúrgica', managerUserId: 'usr-pcp', active: true },
    { id: 'dep-cg-pcp', companyId: 'emp-copper-group', code: 'DEP-0002', name: 'Planejamento, PCP & MRP', managerUserId: 'usr-pcp', active: true },
    { id: 'dep-cg-engenharia', companyId: 'emp-copper-group', code: 'DEP-0003', name: 'Engenharia de Produto & BOM', managerUserId: 'usr-pcp', active: true },
    { id: 'dep-cg-qualidade', companyId: 'emp-copper-group', code: 'DEP-0004', name: 'Qualidade & Laboratório ASTM B49', managerUserId: 'usr-qualidade', active: true },
    { id: 'dep-cg-manutencao', companyId: 'emp-copper-group', code: 'DEP-0005', name: 'Manutenção & Automação OT', managerUserId: 'usr-pcp', active: true },
    { id: 'dep-cg-logistica', companyId: 'emp-copper-group', code: 'DEP-0006', name: 'Logística & Balança Rodoviária', managerUserId: 'usr-pcp', active: true },
    { id: 'dep-cg-almoxarifado', companyId: 'emp-copper-group', code: 'DEP-0007', name: 'Estoque & Almoxarifado Central', managerUserId: 'usr-pcp', active: true },
    { id: 'dep-cg-compras', companyId: 'emp-copper-group', code: 'DEP-0008', name: 'Compras & Suprimentos', managerUserId: 'usr-ceo', active: true },
    { id: 'dep-cg-comercial', companyId: 'emp-copper-group', code: 'DEP-0009', name: 'Comercial & Vendas', managerUserId: 'usr-ceo', active: true },
    { id: 'dep-cg-financeiro', companyId: 'emp-copper-group', code: 'DEP-0010', name: 'Administrativo & Financeiro', managerUserId: 'usr-ceo', active: true },
    { id: 'dep-cg-fiscal', companyId: 'emp-copper-group', code: 'DEP-0011', name: 'Fiscal & Tributário (SEFAZ)', managerUserId: 'usr-ceo', active: true },
    { id: 'dep-cg-contabilidade', companyId: 'emp-copper-group', code: 'DEP-0012', name: 'Contabilidade & Custos', managerUserId: 'usr-ceo', active: true },
    { id: 'dep-ft-fornos', companyId: 'emp-fundicao-sp', code: 'DEP-0101', name: 'Fornos Basculantes & Cadinhos', managerUserId: 'usr-pcp', active: true },
    { id: 'dep-ft-triagem', companyId: 'emp-fundicao-sp', code: 'DEP-0102', name: 'Triagem de Sucata Mel & Prensa', managerUserId: 'usr-pcp', active: true },
    { id: 'dep-ft-qualidade', companyId: 'emp-fundicao-sp', code: 'DEP-0103', name: 'Controle Metalúrgico & Metrologia', managerUserId: 'usr-qualidade', active: true },
    { id: 'dep-ft-manutencao', companyId: 'emp-fundicao-sp', code: 'DEP-0104', name: 'Manutenção Industrial Mauá', managerUserId: 'usr-pcp', active: true },
  ];

  for (const dep of departmentsSeed) {
    await prisma.department.create({ data: dep });
  }

  const usersSeed = [
    {
      id: 'usr-ceo',
      name: 'André Francisco',
      email: 'ceo@coppergroup.com.br',
      role: 'CEO',
      jobTitle: 'Diretor Geral de Operações',
      department: 'Administrativo & Financeiro',
      departmentId: 'dep-cg-financeiro',
      passwordHash: defaultPasswordHash,
      canAccessAllDepartments: true,
      organizationId: 'org-copper-group',
      companyAccess: JSON.stringify(['*']),
      permissions: JSON.stringify([
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
      ]),
    },
    {
      id: 'usr-pcp',
      name: 'Carlos Alberto Mendes',
      email: 'carlos.mendes@coppergroup.com.br',
      role: 'MANAGER',
      jobTitle: 'Supervisor de Planejamento (PCP & MRP)',
      department: 'Planejamento, PCP & MRP',
      departmentId: 'dep-cg-pcp',
      passwordHash: defaultPasswordHash,
      canAccessAllDepartments: false,
      organizationId: 'org-copper-group',
      companyAccess: JSON.stringify(['emp-copper-group', 'emp-fundicao-sp']),
      permissions: JSON.stringify(['module.view', 'module.create', 'module.edit', 'reports.view', 'reports.export']),
    },
    {
      id: 'usr-balanca',
      name: 'Marcos Oliveira',
      email: 'marcos.oliveira@coppergroup.com.br',
      role: 'OPERATOR',
      jobTitle: 'Operador Líder de Balança Rodoviária',
      department: 'Logística & Balança Rodoviária',
      departmentId: 'dep-cg-logistica',
      passwordHash: defaultPasswordHash,
      canAccessAllDepartments: false,
      organizationId: 'org-copper-group',
      companyAccess: JSON.stringify(['emp-copper-group']),
      permissions: JSON.stringify(['module.view', 'module.edit']),
    },
    {
      id: 'usr-qualidade',
      name: 'Dra. Fernanda Lemos',
      email: 'fernanda.lemos@coppergroup.com.br',
      role: 'MANAGER',
      jobTitle: 'Química Chefe & Garantia da Qualidade',
      department: 'Qualidade & Laboratório ASTM B49',
      departmentId: 'dep-cg-qualidade',
      passwordHash: defaultPasswordHash,
      canAccessAllDepartments: false,
      organizationId: 'org-copper-group',
      companyAccess: JSON.stringify(['*']),
      permissions: JSON.stringify(['module.view', 'module.create', 'module.edit', 'reports.view', 'reports.export']),
    },
    {
      id: 'col-cg-01',
      name: 'Marcos Silveira',
      email: 'marcos.silveira@coppergroup.com.br',
      role: 'OPERATOR',
      jobTitle: 'Operador Líder de Forno',
      department: 'Produção & Fundição Metalúrgica',
      departmentId: 'dep-cg-producao',
      passwordHash: defaultPasswordHash,
      canAccessAllDepartments: false,
      organizationId: 'org-copper-group',
      companyAccess: JSON.stringify(['emp-copper-group']),
      permissions: JSON.stringify(['module.view', 'module.edit']),
    },
    {
      id: 'col-cg-06',
      name: 'Juliana Prado',
      email: 'juliana.prado@coppergroup.com.br',
      role: 'OPERATOR',
      jobTitle: 'Analista de Planejamento PCP',
      department: 'Planejamento, PCP & MRP',
      departmentId: 'dep-cg-pcp',
      passwordHash: defaultPasswordHash,
      canAccessAllDepartments: false,
      organizationId: 'org-copper-group',
      companyAccess: JSON.stringify(['emp-copper-group']),
      permissions: JSON.stringify(['module.view', 'module.edit']),
    },
    {
      id: 'col-cg-10',
      name: 'Beatriz Lima',
      email: 'beatriz.lima@coppergroup.com.br',
      role: 'OPERATOR',
      jobTitle: 'Inspetora de Qualidade & RNC',
      department: 'Qualidade & Laboratório ASTM B49',
      departmentId: 'dep-cg-qualidade',
      passwordHash: defaultPasswordHash,
      canAccessAllDepartments: false,
      organizationId: 'org-copper-group',
      companyAccess: JSON.stringify(['emp-copper-group']),
      permissions: JSON.stringify(['module.view', 'module.edit']),
    },
  ];

  for (const u of usersSeed) {
    await prisma.userProfile.create({ data: u });
  }

  // 2.1 Questionários Dinâmicos por Departamento (Personalizados pelo André)
  const departmentQuestionsSeed = [
    // Administrativo & Financeiro (dep-cg-financeiro)
    {
      id: 'q-adm-1',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-financeiro',
      prompt: 'Quais atividades foram realizadas hoje?',
      order: 1,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-adm-2',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-financeiro',
      prompt: 'Houve alguma dificuldade ou bloqueio em aprovações/processos?',
      order: 2,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-adm-3',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-financeiro',
      prompt: 'Quais pendências ficaram para amanhã?',
      order: 3,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },

    // Produção & Fundição Metalúrgica (dep-cg-producao)
    {
      id: 'q-prod-1',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-producao',
      prompt: 'Quais atividades e corridas de fusão foram executadas hoje?',
      order: 1,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-prod-2',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-producao',
      prompt: 'Algum equipamento ou forno apresentou problemas?',
      order: 2,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-prod-3',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-producao',
      prompt: 'Houve atrasos ou interrupções na linha?',
      order: 3,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-prod-4',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-producao',
      prompt: 'O que ficou pendente para o próximo turno?',
      order: 4,
      required: false,
      active: true,
      createdByUserId: 'usr-ceo',
    },

    // Planejamento, PCP & MRP (dep-cg-pcp)
    {
      id: 'q-pcp-1',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-pcp',
      prompt: 'Quais ordens de produção e sequenciamentos foram cumpridos hoje?',
      order: 1,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-pcp-2',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-pcp',
      prompt: 'Houve falta de matéria-prima, sucata ou gargalo entre setores?',
      order: 2,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-pcp-3',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-pcp',
      prompt: 'Quais prioridades e reprogramações ficam para amanhã?',
      order: 3,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },

    // Qualidade & Laboratório ASTM B49 (dep-cg-qualidade)
    {
      id: 'q-qual-1',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-qualidade',
      prompt: 'Quais ensaios laboratoriais, laudos ASTM B49 e liberações foram concluídos hoje?',
      order: 1,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-qual-2',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-qualidade',
      prompt: 'Houve alguma não-conformidade (RNC), bloqueio metrológico (RN-16) ou desvio químico?',
      order: 2,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-qual-3',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-qualidade',
      prompt: 'Quais lotes ou calibrações seguem pendentes para o próximo expediente?',
      order: 3,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },

    // Logística & Balança Rodoviária (dep-cg-logistica)
    {
      id: 'q-log-1',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-logistica',
      prompt: 'Quantas pesagens/carretas de recebimento e expedição foram processadas hoje?',
      order: 1,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-log-2',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-logistica',
      prompt: 'Houve divergência de peso na balança rodoviária, fila no pátio ou falha de equipamento?',
      order: 2,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-log-3',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-logistica',
      prompt: 'Quais cargas ou conferências ficaram pendentes para amanhã?',
      order: 3,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },

    // Manutenção & Automação OT (dep-cg-manutencao)
    {
      id: 'q-man-1',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-manutencao',
      prompt: 'Quais manutenções preventivas e corretivas foram executadas hoje?',
      order: 1,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-man-2',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-manutencao',
      prompt: 'Algum equipamento crítico segue parado ou aguardando peça de reposição?',
      order: 2,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
    {
      id: 'q-man-3',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-manutencao',
      prompt: 'Quais ordens de serviço ficam programadas para amanhã?',
      order: 3,
      required: true,
      active: true,
      createdByUserId: 'usr-ceo',
    },
  ];

  // Garante que os demais departamentos também tenham um questionário base ativo
  const coveredDeps = new Set(departmentQuestionsSeed.map(q => q.departmentId));
  for (const dep of departmentsSeed) {
    if (!coveredDeps.has(dep.id)) {
      departmentQuestionsSeed.push(
        {
          id: `q-${dep.id}-1`,
          companyId: dep.companyId,
          departmentId: dep.id,
          prompt: `Quais atividades foram realizadas hoje no setor ${dep.name}?`,
          order: 1,
          required: true,
          active: true,
          createdByUserId: 'usr-ceo',
        },
        {
          id: `q-${dep.id}-2`,
          companyId: dep.companyId,
          departmentId: dep.id,
          prompt: 'Houve alguma dificuldade, atraso ou problema operacional?',
          order: 2,
          required: true,
          active: true,
          createdByUserId: 'usr-ceo',
        },
        {
          id: `q-${dep.id}-3`,
          companyId: dep.companyId,
          departmentId: dep.id,
          prompt: 'Quais pendências ficaram para o próximo expediente?',
          order: 3,
          required: true,
          active: true,
          createdByUserId: 'usr-ceo',
        }
      );
    }
  }

  for (const q of departmentQuestionsSeed) {
    await prisma.departmentQuestion.create({ data: q });
  }

  // 3. Configurações Globais do Sistema
  const defaultSettings = [
    { key: 'copperos_cfg_routine_hour', value: '06:30', updatedBy: 'Sistema' },
    { key: 'copperos_cfg_rn16_lock', value: 'true', updatedBy: 'Sistema' },
    { key: 'copperos_cfg_rdo_reminder', value: 'true', updatedBy: 'Sistema' },
    { key: 'copperos_cfg_director_email', value: 'andre@coppergroup.com.br', updatedBy: 'Sistema' },
    { key: 'copperos_cfg_urgent_alerts', value: 'true', updatedBy: 'Sistema' },
    { key: 'copperos_cfg_lgpd_months', value: '60', updatedBy: 'Sistema' },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.create({ data: s });
  }

  // 4. Tarefas e Rotinas Diárias (com checklists usando `completed: boolean`)
  const tasksSeed = [
    // Rotinas Diárias Recorrentes (Templates)
    {
      id: 'rot-forno-01',
      title: 'Inspeção Diária de Refratário e Refrigeração dos Fornos',
      project: 'Operação Fundição',
      assignee: 'Marcos Oliveira',
      assigneeId: 'usr-balanca',
      dueDate: today,
      priority: 'Alta',
      status: 'Pendente',
      companyId: 'emp-copper-group',
      isDaily: true,
      dailyTime: '06:30',
      dailyWeekdaysOnly: false,
      assignedBy: 'Carlos Alberto Mendes',
      dailyActive: true,
      lastDispatchedDate: today,
      routineDescription:
        'Rotina matinal crítica de verificação do revestimento refratário, circuito fechado de água de refrigeração e painel térmico do forno de indução Canal 10T.',
      routineTargetMode: 'DEPARTMENT',
      targetDepartmentId: 'dep-cg-producao',
      checklists: JSON.stringify([
        { id: 'chk-r1-1', text: 'Checar pressão da água nos circuitos indutores (> 3.5 bar)', completed: true },
        { id: 'chk-r1-2', text: 'Medir espessura do cadinho refratário com ultrassom portátil', completed: false },
        { id: 'chk-r1-3', text: 'Confirmar temperatura de saída dos cabos de força (< 45°C)', completed: false },
        { id: 'chk-r1-4', text: 'Inspecionar exaustão de gases e captores de fumos', completed: false },
      ]),
      comments: JSON.stringify([]),
    },
    {
      id: 'rot-balanca-02',
      title: 'Aferição Matinal com Peso Padrão da Balança Rodoviária 80T',
      project: 'Portaria & Metrologia',
      assignee: 'Marcos Oliveira',
      assigneeId: 'usr-balanca',
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
      checklists: JSON.stringify([
        { id: 'chk-r2-1', text: 'Limpeza dos batentes e células de carga da plataforma', completed: true },
        { id: 'chk-r2-2', text: 'Zeramento de tara do indicador eletrônico Toledo', completed: true },
        { id: 'chk-r2-3', text: 'Posicionamento dos blocos de 5.000 kg nas 4 extremidades', completed: true },
        { id: 'chk-r2-4', text: 'Emissão e arquivamento do ticket de calibração diária', completed: false },
      ]),
      comments: JSON.stringify([]),
    },
    // Tarefas Reais de Trabalho (Work Tasks) distribuídas para os 4 perfis do piloto
    {
      id: 'tsk-ceo-01',
      title: 'Aprovação de Alçada Executiva: Compra Lote 45T Sucata Cobre Mel 1A',
      project: 'Diretoria & Compras LME',
      assignee: 'André Francisco',
      assigneeId: 'usr-ceo',
      dueDate: today,
      priority: 'Urgente',
      status: 'Em andamento',
      companyId: 'emp-copper-group',
      isDaily: false,
      assignedBy: 'Controladoria & Compras',
      routineDescription:
        'Validação de spread LME e hedge cambial para aquisição de 45 toneladas de Cobre Mel 99,9% destinado à corrida de fundição da semana.',
      checklists: JSON.stringify([
        { id: 'chk-c1', text: 'Conferir cotação oficial LME Cash Settlement do dia', completed: true },
        { id: 'chk-c2', text: 'Revisar laudo de impureza do fornecedor MetalSul (< 0.1%)', completed: true },
        { id: 'chk-c3', text: 'Assinar liberação financeira no ERP', completed: false },
      ]),
      comments: JSON.stringify([
        {
          id: 'cmt-ceo-1',
          author: 'Carlos Alberto Mendes',
          authorRole: 'Supervisor de PCP',
          content: 'Estoque atual de Cobre Mel no Box 02 cobre apenas 48h de forno contínuo. Prioridade máxima.',
          type: 'FEEDBACK',
          createdAt: new Date().toISOString(),
        },
      ]),
    },
    {
      id: 'tsk-ceo-02',
      title: 'Revisão do DRE Industrial e Eficiência Energética dos Fornos (Mês Atual)',
      project: 'Governança & Diretoria',
      assignee: 'André Francisco',
      assigneeId: 'usr-ceo',
      dueDate: tomorrow,
      priority: 'Alta',
      status: 'Pendente',
      companyId: 'emp-copper-group',
      isDaily: false,
      assignedBy: 'Diretoria Financeira',
      routineDescription:
        'Análise do consumo específico kWh/tonelada fundida entre Matriz São Paulo e Usina Sertãozinho.',
      checklists: JSON.stringify([
        { id: 'chk-c4', text: 'Auditar indicador kWh/t do Forno Indução 10T', completed: false },
        { id: 'chk-c5', text: 'Validar meta de perda metálica por escorificação (< 1.2%)', completed: false },
      ]),
      comments: JSON.stringify([]),
    },
    {
      id: 'tsk-pcp-01',
      title: 'Sequenciamento de Corridas de Fusão #CR-2026-08 e #CR-2026-09',
      project: 'Operação Fundição',
      assignee: 'Carlos Alberto Mendes',
      assigneeId: 'usr-pcp',
      dueDate: today,
      priority: 'Urgente',
      status: 'Em andamento',
      companyId: 'emp-copper-group',
      isDaily: false,
      assignedBy: 'André Francisco',
      routineDescription:
        'Balanceamento de carga metálica (70% Cobre Mel + 30% Catodo Eletrolítico) para atendimento do pedido de vergalhão 8mm.',
      checklists: JSON.stringify([
        { id: 'chk-p1', text: 'Reservar 14T de sucata mel triada no Almoxarifado', completed: true },
        { id: 'chk-p2', text: 'Confirmar disponibilidade da ponte rolante 15T', completed: true },
        { id: 'chk-p3', text: 'Liberar Ordem de Produção para o Turno B', completed: false },
      ]),
      comments: JSON.stringify([]),
    },
    {
      id: 'tsk-op-01',
      title: 'Aferição Matinal com Peso Padrão da Balança Rodoviária 80T',
      project: 'Portaria & Metrologia',
      assignee: 'Marcos Oliveira',
      assigneeId: 'usr-balanca',
      sourceRoutineId: 'rot-balanca-02',
      dueDate: today,
      priority: 'Alta',
      status: 'Em andamento',
      companyId: 'emp-copper-group',
      isDaily: false,
      assignedBy: 'Dra. Fernanda Lemos',
      routineDescription:
        'Execução diária obrigatória de verificação metrológica da Balança Rodoviária 80T antes da entrada das carretas de sucata.',
      checklists: JSON.stringify([
        { id: 'chk-o1', text: 'Limpeza dos batentes e células de carga da plataforma', completed: true },
        { id: 'chk-o2', text: 'Zeramento de tara do indicador eletrônico Toledo', completed: true },
        { id: 'chk-o3', text: 'Posicionamento dos blocos de 5.000 kg nas 4 extremidades', completed: false },
        { id: 'chk-o4', text: 'Emissão e arquivamento do ticket de calibração diária', completed: false },
      ]),
      comments: JSON.stringify([
        {
          id: 'cmt-op-1',
          author: 'Marcos Oliveira',
          authorRole: 'Operador de Balança',
          content: 'Tara zerada com desvio 0,0 kg. Posicionando pesos padrão com empilhadeira.',
          type: 'FEEDBACK',
          createdAt: new Date().toISOString(),
        },
      ]),
    },
    {
      id: 'tsk-op-02',
      title: 'Bloqueio e Isolamento Físico da Balança de Carga Forno 10T (RN-16)',
      project: 'Portaria & Metrologia',
      assignee: 'Marcos Oliveira',
      assigneeId: 'usr-balanca',
      dueDate: today,
      priority: 'Urgente',
      status: 'Pendente',
      companyId: 'emp-copper-group',
      isDaily: false,
      assignedBy: 'Engenharia de Metrologia',
      routineDescription:
        'Balança BAL-FUN-02 encontra-se com certificado RBC vencido. Afixar etiqueta de bloqueio físico até conclusão da recalibração pelo laboratório acreditado.',
      checklists: JSON.stringify([
        { id: 'chk-o5', text: 'Confirmar bloqueio lógico no terminal de pesagem', completed: true },
        { id: 'chk-o6', text: 'Acompanhar técnico do laboratório RBC na aferição', completed: false },
      ]),
      comments: JSON.stringify([]),
    },
    {
      id: 'tsk-qual-01',
      title: 'Laudo Espectrométrico da Liga ASTM B49 (Corrida 2026-07)',
      project: 'Controle de Qualidade',
      assignee: 'Dra. Fernanda Lemos',
      assigneeId: 'usr-qualidade',
      dueDate: today,
      priority: 'Alta',
      status: 'Concluída',
      companyId: 'emp-copper-group',
      isDaily: false,
      assignedBy: 'Garantia da Qualidade',
      routineDescription:
        'Coleta de amostra em concha na bica do forno Crisol 5T e análise por espectrometria de emissão óptica (Cu mín 99,96%).',
      checklists: JSON.stringify([
        { id: 'chk-q1', text: 'Fundir botão de teste e fresar superfície plana', completed: true },
        { id: 'chk-q2', text: 'Executar 3 centelhamentos espectrométricos', completed: true },
        { id: 'chk-q3', text: 'Verificar Teores: Oxigênio < 250 ppm, Chumbo < 5 ppm', completed: true },
        { id: 'chk-q4', text: 'Assinar certificado digital do lote', completed: true },
      ]),
      comments: JSON.stringify([
        {
          id: 'cmt-qual-1',
          author: 'Dra. Fernanda Lemos',
          authorRole: 'Química Chefe',
          content:
            'Resultado do ensaio: Pureza Cu = 99,968%, Oxigênio = 180 ppm. Lote aprovado conforme ASTM B49 para trefilação.',
          type: 'CONCLUSAO',
          createdAt: new Date().toISOString(),
        },
      ]),
    },
    {
      id: 'tsk-manut-01',
      title: 'Inspeção Termográfica de Barramentos e Cabos Refrigerados do Forno 10T',
      project: 'Manutenção Eletromecânica',
      assignee: 'Edson Lima',
      dueDate: yesterday,
      priority: 'Urgente',
      status: 'Pendente',
      companyId: 'emp-copper-group',
      isDaily: false,
      assignedBy: 'Carlos Alberto Mendes',
      routineDescription:
        'Verificação com câmera termográfica Flir nas conexões de alta corrente do banco de capacitores do forno de indução.',
      checklists: JSON.stringify([
        { id: 'chk-m1', text: 'Medir delta T nos barramentos de cobre eletrolítico', completed: false },
        { id: 'chk-m2', text: 'Reapertar isoladores com torquímetro calibrado', completed: false },
      ]),
      comments: JSON.stringify([]),
    },
    {
      id: 'tsk-fisc-01',
      title: 'Auditoria de Diferimento de ICMS sobre Sucata de Cobre (Art. 392 RICMS)',
      project: 'Controladoria & Fiscal',
      assignee: 'Lucas Tributário',
      dueDate: nextWeek,
      priority: 'Média',
      status: 'Pendente',
      companyId: 'emp-copper-group',
      isDaily: false,
      assignedBy: 'André Francisco',
      routineDescription:
        'Cruzamento dos XMLs de entrada de sucata com os tickets de pesagem da Balança Rodoviária 80T.',
      checklists: JSON.stringify([
        { id: 'chk-f1', text: 'Validar CFOP 1.102 vs 1.901 das notas do mês', completed: true },
        { id: 'chk-f2', text: 'Vincular tickets metrológicos às NF-es de entrada', completed: false },
      ]),
      comments: JSON.stringify([]),
    },
    {
      id: 'tsk-sem-01',
      title: 'Conferência e Pesagem de 38T de Catodo de Cobre 99,99% (Porto de Santos)',
      project: 'Portaria & Metrologia',
      assignee: 'Marcos Oliveira',
      assigneeId: 'usr-balanca',
      dueDate: twoDaysAgo,
      priority: 'Alta',
      status: 'Concluída',
      companyId: 'emp-copper-group',
      isDaily: false,
      assignedBy: 'Carlos Alberto Mendes',
      routineDescription: 'Conferência de lacre aduaneiro e pesagem rodoviária de 2 carretas de catodo importado.',
      checklists: JSON.stringify([
        { id: 'chk-s1', text: 'Conferir DI e nota fiscal de entrada', completed: true },
        { id: 'chk-s2', text: 'Pesar bruto e tara na BAL-ROD-01', completed: true },
      ]),
      comments: JSON.stringify([]),
    },
    {
      id: 'tsk-sem-02',
      title: 'Homologação de Fornecedor de Refratário Alumina-Carbeto para Forno 10T',
      project: 'Operação Fundição',
      assignee: 'Carlos Alberto Mendes',
      assigneeId: 'usr-pcp',
      dueDate: fourDaysAgo,
      priority: 'Alta',
      status: 'Concluída',
      companyId: 'emp-copper-group',
      isDaily: false,
      assignedBy: 'André Francisco',
      routineDescription: 'Avaliação técnica e aprovação de lote piloto de massa refratária de alta densidade.',
      checklists: JSON.stringify([
        { id: 'chk-s3', text: 'Validar curva de sinterização térmica', completed: true },
        { id: 'chk-s4', text: 'Aprovar pedido anual de fornecimento', completed: true },
      ]),
      comments: JSON.stringify([]),
    },
    // Tarefas da 2ª Empresa: Fundição & Transformação SP (emp-fundicao-sp)
    {
      id: 'tsk-ft-01',
      title: 'Inspeção de Cadinho de Grafite-Carbeto do Forno Basculante #02',
      project: 'Fornos Basculantes Mauá',
      assignee: 'Carlos Alberto Mendes',
      assigneeId: 'usr-pcp',
      dueDate: today,
      priority: 'Urgente',
      status: 'Em andamento',
      companyId: 'emp-fundicao-sp',
      isDaily: false,
      assignedBy: 'André Francisco',
      routineDescription: 'Verificação dimensional e inspeção de trincas térmicas antes da fusão de liga bronze-alumínio.',
      checklists: JSON.stringify([
        { id: 'chk-ft1', text: 'Medir parede útil do cadinho', completed: true },
        { id: 'chk-ft2', text: 'Verificar bico vertedor e sistema hidráulico', completed: false },
      ]),
      comments: JSON.stringify([]),
    },
    {
      id: 'tsk-ft-02',
      title: 'Prensagem e Enfardamento de 15T de Cavaco de Cobre Mel em Sorocaba',
      project: 'Triagem & Sucata Sorocaba',
      assignee: 'Marcos Oliveira',
      assigneeId: 'usr-balanca',
      dueDate: today,
      priority: 'Alta',
      status: 'Concluída',
      companyId: 'emp-fundicao-sp',
      isDaily: false,
      assignedBy: 'Carlos Alberto Mendes',
      routineDescription: 'Compactação hidráulica e identificação com etiqueta QR de rastreabilidade.',
      checklists: JSON.stringify([
        { id: 'chk-ft3', text: 'Separar impurezas ferrosas no separador magnético', completed: true },
        { id: 'chk-ft4', text: 'Emitir romaneio de transferência para Mauá', completed: true },
      ]),
      comments: JSON.stringify([]),
    },
  ];

  for (const item of tasksSeed) {
    await prisma.task.create({ data: item });
  }

  // 5. Parque Metrológico & Balanças (Trava RN-16 INMETRO)
  const equipmentsSeed = [
    {
      id: 'eqp-bal-rod-01',
      companyId: 'emp-copper-group',
      codigo: 'BAL-ROD-01',
      nome: 'Balança Rodoviária Principal Portaria 01 (80 Toneladas)',
      tipo: 'BALANCA_RODOVIARIA',
      capacidadeMaxKg: 80000,
      precisaoKg: 10,
      localizacao: 'Portaria Logística Norte — Pátio de Carretas',
      marcaModelo: 'Toledo Prix 9094 Digital 21m',
      ultimaCalibracao: '2026-08-15',
      validadeCalibracao: '2027-08-15',
      certificadoNumero: 'RBC-INMETRO-88412/2026',
      orgaoCertificador: 'IPEM-SP / Labmetro RBC',
      status: 'CALIBRADO_ATIVO',
      bloqueadoOperacionalmente: false,
    },
    {
      id: 'eqp-bal-fun-02',
      companyId: 'emp-copper-group',
      codigo: 'BAL-FUN-02',
      nome: 'Balança de Carga de Cadinho — Forno de Indução 10T',
      tipo: 'BALANCA_PISO',
      capacidadeMaxKg: 5000,
      precisaoKg: 0.5,
      localizacao: 'Nave de Fundição — Plataforma de Carga Forno 01',
      marcaModelo: 'Mettler Toledo PBA655 Industrial',
      ultimaCalibracao: '2025-10-01',
      validadeCalibracao: '2026-10-01',
      certificadoNumero: 'RBC-44910/2025 (VENCIDO)',
      orgaoCertificador: 'IPT / Rede Brasileira de Calibração',
      status: 'CALIBRACAO_VENCIDA_BLOQUEADO',
      bloqueadoOperacionalmente: true,
      motivoBloqueio:
        'Validade do Certificado RBC expirada em 01/10/2026. Bloqueio automático imposto pela Trava Operacional RN-16 (Portaria INMETRO / ISO 9001).',
    },
    {
      id: 'eqp-esp-lab-01',
      companyId: 'emp-copper-group',
      codigo: 'ESP-LAB-01',
      nome: 'Espectrômetro de Emissão Óptica de Cobre ASTM B49',
      tipo: 'ESPECTROMETRO',
      capacidadeMaxKg: 5,
      precisaoKg: 0.001,
      localizacao: 'Laboratório Central de Qualidade Metalúrgica',
      marcaModelo: 'Thermo Scientific ARL iSpark 8860',
      ultimaCalibracao: '2026-09-20',
      validadeCalibracao: '2027-03-20',
      certificadoNumero: 'RBC-QUIM-99201/2026',
      orgaoCertificador: 'IPT / Padrão Primário ASTM',
      status: 'CALIBRADO_ATIVO',
      bloqueadoOperacionalmente: false,
    },
    {
      id: 'eqp-bal-exp-03',
      companyId: 'emp-copper-group',
      codigo: 'BAL-EXP-03',
      nome: 'Balança Plataforma de Expedição de Bobinas e Vergalhões',
      tipo: 'BALANCA_PLATAFORMA',
      capacidadeMaxKg: 10000,
      precisaoKg: 1,
      localizacao: 'Doca de Expedição 04 — Produto Acabado',
      marcaModelo: 'Filizola Platô Siderúrgico 10T',
      ultimaCalibracao: '2026-07-10',
      validadeCalibracao: '2027-07-10',
      certificadoNumero: 'RBC-INMETRO-77319/2026',
      orgaoCertificador: 'IPEM-SP / Labmetro RBC',
      status: 'CALIBRADO_ATIVO',
      bloqueadoOperacionalmente: false,
    },
  ];

  for (const eq of equipmentsSeed) {
    await prisma.equipment.create({ data: eq });
  }

  // 6. Fechamentos de Expediente (RDO) e Diário de Bordo
  const shiftReportsSeed = [
    {
      id: 'rdo-seed-01',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-qualidade',
      departmentName: 'Qualidade & Laboratório ASTM B49',
      dateKey: today,
      turno: 'TURNO_A',
      metodo: 'HIBRIDO',
      userId: 'usr-qualidade',
      userName: 'Dra. Fernanda Lemos',
      userEmail: 'fernanda.lemos@coppergroup.com.br',
      userRole: 'MANAGER',
      pergunta1:
        'Concluída a análise espectrométrica da Corrida #2026-07 com pureza Cu de 99,968% e oxigênio em 180 ppm. Liberados 18 lotes de vergalhão 8mm para expedição.',
      pergunta2:
        'Balança de carga do Forno 10T (BAL-FUN-02) segue bloqueada pela trava RN-16 aguardando recalibração RBC; pesagens de carga redirecionadas para a balança reserva.',
      pergunta3:
        'Acompanhar calibração acreditada da BAL-FUN-02 e iniciar ensaio de condutividade elétrica (%IACS) da Corrida #2026-08.',
      answersJson: JSON.stringify([
        {
          questionId: 'q-qual-1',
          questionTextSnapshot: 'Quais ensaios laboratoriais, laudos ASTM B49 e liberações foram concluídos hoje?',
          order: 1,
          required: true,
          answerText: 'Concluída a análise espectrométrica da Corrida #2026-07 com pureza Cu de 99,968% e oxigênio em 180 ppm. Liberados 18 lotes de vergalhão 8mm para expedição.',
          inputMethod: 'voice',
        },
        {
          questionId: 'q-qual-2',
          questionTextSnapshot: 'Houve alguma não-conformidade (RNC), bloqueio metrológico (RN-16) ou desvio químico?',
          order: 2,
          required: true,
          answerText: 'Balança de carga do Forno 10T (BAL-FUN-02) segue bloqueada pela trava RN-16 aguardando recalibração RBC; pesagens de carga redirecionadas para a balança reserva.',
          inputMethod: 'text',
        },
        {
          questionId: 'q-qual-3',
          questionTextSnapshot: 'Quais lotes ou calibrações seguem pendentes para o próximo expediente?',
          order: 3,
          required: true,
          answerText: 'Acompanhar calibração acreditada da BAL-FUN-02 e iniciar ensaio de condutividade elétrica (%IACS) da Corrida #2026-08.',
          inputMethod: 'text',
        },
      ]),
      resumoAutomatico:
        'Turno A com 100% de aprovação metalúrgica ASTM B49 (Cu 99,968%). Contingência metrológica ativa na BAL-FUN-02 sem impacto no ritmo de fusão.',
      aiIndividualSummary:
        'Turno A com 100% de aprovação metalúrgica ASTM B49 (Cu 99,968%). Contingência metrológica ativa na BAL-FUN-02 sem impacto no ritmo de fusão.',
      metricas: JSON.stringify({
        tarefasConcluidas: 4,
        totalTarefas: 5,
        horasTrabalhadas: 8,
        pesoProcessadoKg: 18400,
        statusGeral: 'REGULAR',
      }),
      emailSentTo: 'andre@coppergroup.com.br',
    },
    {
      id: 'rdo-seed-02',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-pcp',
      departmentName: 'Planejamento, PCP & MRP',
      dateKey: today,
      turno: 'TURNO_B',
      metodo: 'VOZ',
      userId: 'usr-pcp',
      userName: 'Carlos Alberto Mendes',
      userEmail: 'carlos.mendes@coppergroup.com.br',
      userRole: 'MANAGER',
      pergunta1:
        'Sequenciadas as corridas #CR-2026-08 e #CR-2026-09 e realizada a triagem de 22 toneladas de sucata de cobre mel no Box 02.',
      pergunta2:
        'Identificado aquecimento no barramento secundário do Forno 10T; aberta ordem urgente de termografia para a equipe de manutenção.',
      pergunta3:
        'Concluir inspeção termográfica antes da partida da corrida noturna e validar recebimento de 2 carretas na portaria.',
      answersJson: JSON.stringify([
        {
          questionId: 'q-pcp-1',
          questionTextSnapshot: 'Quais ordens de produção e sequenciamentos foram cumpridos hoje?',
          order: 1,
          required: true,
          answerText: 'Sequenciadas as corridas #CR-2026-08 e #CR-2026-09 e realizada a triagem de 22 toneladas de sucata de cobre mel no Box 02.',
          inputMethod: 'voice',
        },
        {
          questionId: 'q-pcp-2',
          questionTextSnapshot: 'Houve falta de matéria-prima, sucata ou gargalo entre setores?',
          order: 2,
          required: true,
          answerText: 'Identificado aquecimento no barramento secundário do Forno 10T; aberta ordem urgente de termografia para a equipe de manutenção.',
          inputMethod: 'voice',
        },
        {
          questionId: 'q-pcp-3',
          questionTextSnapshot: 'Quais prioridades e reprogramações ficam para amanhã?',
          order: 3,
          required: true,
          answerText: 'Concluir inspeção termográfica antes da partida da corrida noturna e validar recebimento de 2 carretas na portaria.',
          inputMethod: 'voice',
        },
      ]),
      resumoAutomatico:
        'Sequenciamento PCP cumprido com 22t triadas. Atenção preventiva solicitada à manutenção elétrica para termografia nos barramentos do Forno 10T.',
      aiIndividualSummary:
        'Sequenciamento PCP cumprido com 22t triadas. Atenção preventiva solicitada à manutenção elétrica para termografia nos barramentos do Forno 10T.',
      metricas: JSON.stringify({
        tarefasConcluidas: 3,
        totalTarefas: 4,
        horasTrabalhadas: 8,
        pesoProcessadoKg: 22000,
        statusGeral: 'ATENCAO',
      }),
      emailSentTo: 'andre@coppergroup.com.br',
    },
    {
      id: 'rdo-seed-03',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-logistica',
      departmentName: 'Logística & Balança Rodoviária',
      dateKey: yesterday,
      turno: 'TURNO_A',
      metodo: 'TEXTO',
      userId: 'usr-balanca',
      userName: 'Marcos Oliveira',
      userEmail: 'marcos.oliveira@coppergroup.com.br',
      userRole: 'OPERATOR',
      pergunta1:
        'Pesadas 7 carretas de matéria-prima na Balança Rodoviária 80T totalizando 34.500 kg líquidos de Cobre Mel e Catodo.',
      pergunta2:
        'Sem desvios na balança rodoviária. Identificado vencimento do certificado RBC da balança interna BAL-FUN-02 no final do expediente.',
      pergunta3:
        'Manter aferição matinal de 5.000 kg na portaria e isolar fisicamente a BAL-FUN-02 até recalibração.',
      answersJson: JSON.stringify([
        {
          questionId: 'q-log-1',
          questionTextSnapshot: 'Quantas pesagens/carretas de recebimento e expedição foram processadas hoje?',
          order: 1,
          required: true,
          answerText: 'Pesadas 7 carretas de matéria-prima na Balança Rodoviária 80T totalizando 34.500 kg líquidos de Cobre Mel e Catodo.',
          inputMethod: 'text',
        },
        {
          questionId: 'q-log-2',
          questionTextSnapshot: 'Houve divergência de peso na balança rodoviária, fila no pátio ou falha de equipamento?',
          order: 2,
          required: true,
          answerText: 'Sem desvios na balança rodoviária. Identificado vencimento do certificado RBC da balança interna BAL-FUN-02 no final do expediente.',
          inputMethod: 'text',
        },
        {
          questionId: 'q-log-3',
          questionTextSnapshot: 'Quais cargas ou conferências ficaram pendentes para amanhã?',
          order: 3,
          required: true,
          answerText: 'Manter aferição matinal de 5.000 kg na portaria e isolar fisicamente a BAL-FUN-02 até recalibração.',
          inputMethod: 'text',
        },
      ]),
      resumoAutomatico:
        'Expediente logístico de ontem concluído com 34,5t recebidas em 7 carretas e acionamento preventivo da trava RN-16 na BAL-FUN-02.',
      aiIndividualSummary:
        'Expediente logístico de ontem concluído com 34,5t recebidas em 7 carretas e acionamento preventivo da trava RN-16 na BAL-FUN-02.',
      metricas: JSON.stringify({
        tarefasConcluidas: 5,
        totalTarefas: 5,
        horasTrabalhadas: 8,
        pesoProcessadoKg: 34500,
        statusGeral: 'REGULAR',
      }),
      emailSentTo: 'andre@coppergroup.com.br',
    },
    {
      id: 'rdo-seed-04',
      companyId: 'emp-copper-group',
      departmentId: 'dep-cg-financeiro',
      departmentName: 'Administrativo & Financeiro',
      dateKey: twoDaysAgo,
      turno: 'ADMINISTRATIVO',
      metodo: 'HIBRIDO',
      userId: 'usr-ceo',
      userName: 'André Francisco',
      userEmail: 'ceo@coppergroup.com.br',
      userRole: 'CEO',
      pergunta1:
        'Fechamento da programação semanal de compras LME (38t de catodo) e revisão das metas de eficiência energética da planta.',
      pergunta2:
        'Nenhum impedimento crítico; custo de energia ponta dentro da margem orçada.',
      pergunta3:
        'Validar relatório consolidado semanal junto aos gestores de Fundição, Qualidade e Metrologia.',
      answersJson: JSON.stringify([
        {
          questionId: 'q-adm-1',
          questionTextSnapshot: 'Quais atividades foram realizadas hoje?',
          order: 1,
          required: true,
          answerText: 'Fechamento da programação semanal de compras LME (38t de catodo) e revisão das metas de eficiência energética da planta.',
          inputMethod: 'text',
        },
        {
          questionId: 'q-adm-2',
          questionTextSnapshot: 'Houve alguma dificuldade ou bloqueio em aprovações/processos?',
          order: 2,
          required: true,
          answerText: 'Nenhum impedimento crítico; custo de energia ponta dentro da margem orçada.',
          inputMethod: 'text',
        },
        {
          questionId: 'q-adm-3',
          questionTextSnapshot: 'Quais pendências ficaram para amanhã?',
          order: 3,
          required: true,
          answerText: 'Validar relatório consolidado semanal junto aos gestores de Fundição, Qualidade e Metrologia.',
          inputMethod: 'text',
        },
      ]),
      resumoAutomatico:
        'Diretoria aprovou lote de 38t de catodo e validou indicadores semanais de produtividade e consumo energético.',
      aiIndividualSummary:
        'Diretoria aprovou lote de 38t de catodo e validou indicadores semanais de produtividade e consumo energético.',
      metricas: JSON.stringify({
        tarefasConcluidas: 4,
        totalTarefas: 4,
        horasTrabalhadas: 8,
        pesoProcessadoKg: 38000,
        statusGeral: 'REGULAR',
      }),
      emailSentTo: 'andre@coppergroup.com.br',
    },
  ];

  for (const rdo of shiftReportsSeed) {
    await prisma.shiftReport.create({ data: rdo });
  }

  await prisma.dailyNote.createMany({
    data: [
      {
        companyId: 'emp-copper-group',
        dateKey: today,
        content:
          '📌 DIÁRIO OPERACIONAL DA PLANTA (HOJE) — Operação em regime contínuo nos fornos de fusão. Lote #2026-07 certificado pela Qualidade (99,968% Cu). Balança BAL-FUN-02 bloqueada preventivamente pela trava RN-16 para aferição RBC; demais balanças operando normalmente.',
        updatedBy: 'Carlos Alberto Mendes',
      },
      {
        companyId: 'emp-copper-group',
        dateKey: yesterday,
        content:
          '📌 DIÁRIO OPERACIONAL (ONTEM) — Recebimento de 34,5t de sucata e catodos na Portaria 01. Forno Indução 10T operou 3 corridas completas sem intercorrências refratárias.',
        updatedBy: 'Marcos Oliveira',
      },
      {
        companyId: 'emp-copper-group',
        dateKey: twoDaysAgo,
        content:
          '📌 DIÁRIO OPERACIONAL — Desembaraço e entrada do lote de 38t de catodo 99,99% vindo de Santos. Aferição espectrométrica padrão primário concluída.',
        updatedBy: 'Dra. Fernanda Lemos',
      },
    ],
  });

  // 7. Trilha Inicial de Auditoria (AuditLog)
  const auditSeed = [
    {
      action: 'SYSTEM_PILOT_SEED',
      entity: 'System',
      module: 'GOVERNANCA',
      companyId: 'emp-copper-group',
      userId: 'usr-ceo',
      userName: 'André Francisco',
      userEmail: 'ceo@coppergroup.com.br',
      userRole: 'CEO',
      description: 'Base de dados SQLite inicializada e auditada para Testes Piloto do CopperOS',
    },
    {
      action: 'RN16_METROLOGY_LOCK',
      entity: 'Equipment',
      entityId: 'eqp-bal-fun-02',
      module: 'METROLOGIA_RN16',
      companyId: 'emp-copper-group',
      userId: 'usr-qualidade',
      userName: 'Dra. Fernanda Lemos',
      userEmail: 'fernanda.lemos@coppergroup.com.br',
      userRole: 'MANAGER',
      description:
        'Trava Metrológica RN-16 acionada automaticamente para [BAL-FUN-02] "Balança de Carga de Cadinho — Forno de Indução 10T" (Certificado RBC vencido)',
    },
    {
      action: 'FECHAMENTO_EXPEDIENTE',
      entity: 'FechamentoExpediente',
      entityId: 'rdo-seed-01',
      module: 'RDO_FECHAMENTO',
      companyId: 'emp-copper-group',
      userId: 'usr-qualidade',
      userName: 'Dra. Fernanda Lemos',
      userEmail: 'fernanda.lemos@coppergroup.com.br',
      userRole: 'MANAGER',
      description: 'Fechamento de expediente (TURNO_A) registrado por Dra. Fernanda Lemos e enviado para diretoria',
    },
  ];

  for (const log of auditSeed) {
    await prisma.auditLog.create({ data: log });
  }

  console.log('✅ Seed Piloto concluído com sucesso:');
  console.log(`   • ${companiesSeed.length} Empresas Multi-Tenant com Filiais`);
  console.log(`   • ${usersSeed.length} Perfis RBAC (CEO, Gestores e Operador)`);
  console.log(`   • ${tasksSeed.length} Tarefas e Rotinas Diárias`);
  console.log(`   • ${equipmentsSeed.length} Equipamentos Metrológicos (incluindo teste de Trava RN-16)`);
  console.log(`   • ${shiftReportsSeed.length} Fechamentos de Expediente (RDO) + Diário de Bordo`);
}

main()
  .catch(e => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
