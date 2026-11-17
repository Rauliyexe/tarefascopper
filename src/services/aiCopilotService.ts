import { TarefaItem, Company, CompanyBranch, User } from '../types';
import { voiceTtsService } from './voiceTtsService';

export interface CopilotAction {
  id: string;
  label: string;
  description: string;
  type:
    | 'NAVIGATE_TAB'
    | 'SWITCH_COMPANY'
    | 'SWITCH_BRANCH'
    | 'OPEN_CREATE_TASK'
    | 'OPEN_CREATE_ROUTINE'
    | 'CREATE_TASK_NOW'
    | 'SWITCH_USER'
    | 'OPEN_SETTINGS'
    | 'OPEN_COMPANY_SELECTOR'
    | 'OPEN_FECHAMENTO_MODAL'
    | 'TOGGLE_THEME';
  payload?: {
    tab?: string;
    companyId?: string;
    branchId?: string;
    taskTitle?: string;
    userId?: string;
    startVoiceWizard?: boolean;
  };
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actions?: CopilotAction[];
  executedAction?: CopilotAction;
  dataCard?: {
    title: string;
    badge?: string;
    stats?: { label: string; value: string }[];
  };
  suggestions?: string[];
}

export interface CopilotContext {
  user: User;
  currentCompany: Company;
  activeBranch: CompanyBranch | null;
  companies: Company[];
  tasks: TarefaItem[];
  activeTab: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export class AICopilotService {
  processQuery(rawQuery: string, ctx: CopilotContext): {
    replyText: string;
    actions: CopilotAction[];
    executedAction?: CopilotAction;
    dataCard?: CopilotMessage['dataCard'];
    suggestions: string[];
  } {
    const q = normalize(rawQuery);
    const { user, currentCompany, activeBranch, tasks } = ctx;

    const workTasks = tasks.filter(t => !t.isDaily);
    const totalTasks = workTasks.length;
    const pendingTasks = workTasks.filter(t => t.status === 'Pendente').length;
    const inProgressTasks = workTasks.filter(t => t.status === 'Em andamento').length;
    const doneTasks = workTasks.filter(t => t.status === 'Concluída').length;
    const urgentTasks = workTasks.filter(t => t.status !== 'Concluída' && (t.priority === 'Urgente' || t.priority === 'Alta'));
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueTasks = workTasks.filter(t => t.status !== 'Concluída' && t.dueDate && t.dueDate < todayStr);
    const routineCount = tasks.filter(t => t.isDaily).length;

    // 0. Criação de Rotina Diária ("criar rotina", "nova rotina")
    if (
      q.includes('criar rotina') ||
      q.includes('nova rotina') ||
      q.includes('cadastrar rotina') ||
      q.includes('programar rotina')
    ) {
      return {
        replyText: `Abrindo o configurador de **Nova Rotina Diária** para a **${currentCompany.tradeName}**. Você pode definir horário de lançamento automático e distribuir por departamento ou colaborador.`,
        executedAction: {
          id: 'act-create-routine',
          label: 'Nova Rotina Diária',
          description: 'Abre o formulário em modo de rotina automática',
          type: 'OPEN_CREATE_ROUTINE',
        },
        actions: [],
        suggestions: ['Ver rotinas diárias', 'Quantas tarefas estão pendentes?', 'Me leva ao Kanban'],
      };
    }

    // 0.1 Criação de Tarefa ("criar tarefa", "nova tarefa", "adicionar tarefa")
    if (
      q.includes('criar tarefa') ||
      q.includes('nova tarefa') ||
      q.includes('criar nova tarefa') ||
      q.includes('adicionar tarefa') ||
      q.includes('cadastrar tarefa')
    ) {
      // Verifica se o usuário já ditou o título da tarefa (ex: "Criar tarefa: Inspecionar forno 2" ou "Criar tarefa verificar balança")
      const matchTitle = rawQuery.match(/(?:criar nova tarefa|criar tarefa|nova tarefa|adicionar tarefa|cadastrar tarefa)\s*[:\-]?\s*(.+)/i);
      const extractedTitle = matchTitle?.[1]?.trim();

      if (extractedTitle && extractedTitle.length > 3) {
        return {
          replyText: `Registrando imediatamente a tarefa **"${extractedTitle}"** na unidade **${activeBranch?.name || currentCompany.tradeName}** com prazo para hoje.`,
          executedAction: {
            id: 'act-create-task-now',
            label: `Criar: "${extractedTitle}"`,
            description: 'Registra a tarefa diretamente no banco',
            type: 'CREATE_TASK_NOW',
            payload: { taskTitle: extractedTitle },
          },
          actions: [
            {
              id: 'act-go-kanban-after-create',
              label: 'Ver no Kanban',
              description: 'Visualizar tarefa criada',
              type: 'NAVIGATE_TAB',
              payload: { tab: 'Kanban' },
            },
          ],
          suggestions: ['Como estão as tarefas hoje?', 'Me leva ao Kanban', 'Criar outra tarefa'],
        };
      }

      return {
        replyText: `Abrindo o formulário de **Nova Tarefa** na unidade **${activeBranch?.name || currentCompany.tradeName}**. Você também pode ditar diretamente, por exemplo: *"Criar tarefa: Inspecionar forno de indução"*.`,
        executedAction: {
          id: 'act-open-create-task',
          label: 'Abrir Nova Tarefa',
          description: 'Abre o modal completo de criação de tarefa',
          type: 'OPEN_CREATE_TASK',
        },
        actions: [],
        suggestions: ['Criar tarefa: Inspecionar balança rodoviária', 'Ver Kanban', 'Ver rotinas diárias'],
      };
    }

    // 1. Navegação para Kanban
    if (q.includes('kanban') || q.includes('quadro')) {
      return {
        replyText: `Abrindo o **Quadro Kanban** da ${currentCompany.tradeName}. Aqui você pode arrastar e soltar os cartões entre as colunas *Pendente*, *Em Andamento* e *Concluída*.`,
        executedAction: {
          id: 'act-kanban',
          label: 'Ir para o Kanban',
          description: 'Abre o quadro visual de cartões',
          type: 'NAVIGATE_TAB',
          payload: { tab: 'Kanban' },
        },
        actions: [],
        suggestions: ['Quantas tarefas estão pendentes?', 'Criar nova tarefa', 'Ver rotinas diárias'],
      };
    }

    // 1.1 Navegação para Calendário
    if (q.includes('calendario') || q.includes('agenda') || q.includes('cronograma')) {
      return {
        replyText: `Abrindo o **Calendário Operacional** da ${currentCompany.tradeName} para visualização mensal e por prazos de entrega.`,
        executedAction: {
          id: 'act-calendario',
          label: 'Abrir Calendário',
          description: 'Abre a visão de calendário de tarefas',
          type: 'NAVIGATE_TAB',
          payload: { tab: 'Calendário' },
        },
        actions: [],
        suggestions: ['Quais tarefas estão atrasadas?', 'Ir para o Kanban', 'Criar nova tarefa'],
      };
    }

    // 1.2 Navegação para Projetos
    if (q.includes('projeto') || q.includes('projetos')) {
      return {
        replyText: `Exibindo a visão agrupada por **Projetos & Centros de Custo** da ${currentCompany.tradeName}.`,
        executedAction: {
          id: 'act-projetos',
          label: 'Abrir Projetos',
          description: 'Agrupa as tarefas por projeto',
          type: 'NAVIGATE_TAB',
          payload: { tab: 'Projetos' },
        },
        actions: [],
        suggestions: ['Me leva ao Kanban', 'Como estão as tarefas hoje?', 'Criar nova tarefa'],
      };
    }

    // 1.3 Navegação para Equipe
    if (q.includes('equipe') || q.includes('time') || q.includes('colaboradores') || q.includes('delegada')) {
      return {
        replyText: `Abrindo a aba **Equipe**, listando as tarefas atribuídas aos demais colaboradores e departamentos da unidade.`,
        executedAction: {
          id: 'act-equipe',
          label: 'Ver Tarefas da Equipe',
          description: 'Mostra tarefas da equipe',
          type: 'NAVIGATE_TAB',
          payload: { tab: 'Equipe' },
        },
        actions: [],
        suggestions: ['Ver minhas tarefas', 'Quais tarefas estão atrasadas?', 'Ir para o Kanban'],
      };
    }

    // 1.4 Navegação para Minhas Tarefas
    if (q.includes('minhas tarefas') || q.includes('minha lista') || q.includes('para mim')) {
      return {
        replyText: `Exibindo a aba **Minhas Tarefas** atribuídas a **${user.name}**.`,
        executedAction: {
          id: 'act-minhas',
          label: 'Minhas Tarefas',
          description: 'Mostra suas tarefas individuais',
          type: 'NAVIGATE_TAB',
          payload: { tab: 'Minhas tarefas' },
        },
        actions: [],
        suggestions: ['Criar nova tarefa', 'Ver tarefas da equipe', 'Me leva ao Kanban'],
      };
    }

    // 2. Navegação para Calibração de Balanças
    if (q.includes('balanca') || q.includes('calibracao') || q.includes('metrologia') || q.includes('inmetro')) {
      return {
        replyText: `Navegando para o submódulo de **Calibração de Balanças & Metrologia**. Aqui você acompanha as aferições obrigatórias pelo IPEM/INMETRO e a trava operacional RN-16.`,
        executedAction: {
          id: 'act-calib',
          label: 'Ver Balanças & Calibração',
          description: 'Abre a tela de metrologia',
          type: 'NAVIGATE_TAB',
          payload: { tab: 'Calibração' },
        },
        actions: [],
        suggestions: ['Voltar ao Kanban', 'Ver rotinas diárias', 'Gravar fechamento de turno'],
      };
    }

    // 3. Navegação para Rotinas Diárias
    if (q.includes('rotina') || q.includes('recorrente') || q.includes('diaria')) {
      return {
        replyText: `Exibindo as **Rotinas Diárias Industriais**. Atualmente temos **${routineCount} rotinas programadas** que distribuem checklists automáticos aos departamentos da fábrica.`,
        executedAction: {
          id: 'act-rotinas',
          label: 'Rotinas Diárias',
          description: 'Abre o submódulo de rotinas automáticas',
          type: 'NAVIGATE_TAB',
          payload: { tab: 'Rotinas Diárias' },
        },
        actions: [],
        suggestions: ['Criar rotina diária', 'Ver tarefas da equipe', 'Abrir relatório diário'],
      };
    }

    // 4.0 Preenchimento do Relatório de Hoje ("Quero fazer meu relatório de hoje", "fazer meu relatório")
    if (
      q.includes('quero fazer meu relatorio') ||
      q.includes('fazer meu relatorio') ||
      q.includes('meu relatorio de hoje') ||
      q.includes('preencher relatorio') ||
      q.includes('iniciar relatorio') ||
      q.includes('responder relatorio') ||
      q.includes('fechamento') ||
      q.includes('gravar fechamento') ||
      q.includes('ata')
    ) {
      return {
        replyText: `Iniciando agora o seu **Relatório de Expediente de Hoje** para o setor **${user.department || 'Operacional'}**. Vou apresentar as perguntas do seu departamento uma a uma.`,
        executedAction: {
          id: 'act-fechamento',
          label: 'Fazer Meu Relatório de Hoje',
          description: 'Abre o questionário do departamento com preenchimento por voz e texto',
          type: 'OPEN_FECHAMENTO_MODAL',
          payload: { startVoiceWizard: true },
        },
        actions: [],
        suggestions: ['Ver Relatório Diário', 'Ver tarefas pendentes', 'Alternar filial'],
      };
    }

    // 4. Navegação para Relatório Diário / RDO
    if (q.includes('rdo') || q.includes('relatorio diario') || q.includes('diario de bordo') || q.includes('passagem de turno')) {
      return {
        replyText: `Acessando o **Relatório Diário de Operações (RDO)** e passagem de turno para a filial **${activeBranch?.name || currentCompany.tradeName}**.`,
        executedAction: {
          id: 'act-rdo',
          label: 'Relatório Diário (RDO)',
          description: 'Abre o diário de bordo e atas de fechamento',
          type: 'NAVIGATE_TAB',
          payload: { tab: 'Relatório Diário' },
        },
        actions: [],
        suggestions: ['Quero fazer meu relatório de hoje', 'Ver equipe', 'Voltar ao Kanban'],
      };
    }

    // 6. Escolha de Empresa e Filiais (direto pelo nome da cidade/unidade ou comando de filial)
    if (q.includes('sertaozinho')) {
      return {
        replyText: `Alternando imediatamente para a filial **Usina de Fusão & Sucata (Sertãozinho - SP)** da Copper Group Holding.`,
        executedAction: {
          id: 'act-sertaozinho',
          label: 'Mudar para Sertãozinho',
          description: 'Filial 02 - Usina de Fusão',
          type: 'SWITCH_BRANCH',
          payload: { companyId: 'emp-copper-group', branchId: 'br-cg-sertaozinho' },
        },
        actions: [],
        suggestions: ['Como estão as tarefas hoje?', 'Como está a calibração?', 'Voltar à Matriz SP'],
      };
    }

    if (q.includes('joinville')) {
      return {
        replyText: `Alternando para a filial **Laminação & Trefilação (Joinville - SC)**.`,
        executedAction: {
          id: 'act-joinville',
          label: 'Mudar para Joinville',
          description: 'Filial 03 - Laminação',
          type: 'SWITCH_BRANCH',
          payload: { companyId: 'emp-copper-group', branchId: 'br-cg-joinville' },
        },
        actions: [],
        suggestions: ['Como estão as tarefas hoje?', 'Abrir Projetos', 'Voltar à Matriz SP'],
      };
    }

    if (q.includes('matriz') || q.includes('sao paulo')) {
      return {
        replyText: `Alternando para a **Matriz Principal (São Paulo - SP)** da Copper Group Holding.`,
        executedAction: {
          id: 'act-matriz',
          label: 'Mudar para Matriz SP',
          description: 'Matriz 01 - São Paulo',
          type: 'SWITCH_BRANCH',
          payload: { companyId: 'emp-copper-group', branchId: 'br-cg-matriz' },
        },
        actions: [],
        suggestions: ['Como estão as tarefas hoje?', 'Me leva ao Kanban', 'Mudar para Sertãozinho'],
      };
    }

    if (q.includes('fundicao sp') || q.includes('maua')) {
      return {
        replyText: `Alternando empresa ativa para **Fundição & Transformação SP** (Unidade Mauá).`,
        executedAction: {
          id: 'act-fundicao',
          label: 'Mudar para Fundição SP',
          description: 'Unidade Mauá - Fornos & Cadinhos',
          type: 'SWITCH_COMPANY',
          payload: { companyId: 'emp-fundicao-sp', branchId: 'br-ft-maua' },
        },
        actions: [],
        suggestions: ['Como estão as tarefas hoje?', 'Mudar para Campinas', 'Voltar para Copper Group'],
      };
    }

    if (q.includes('campinas')) {
      return {
        replyText: `Alternando para o **Centro de Distribuição & Pátio (Campinas - SP)** da Fundição & Transformação SP.`,
        executedAction: {
          id: 'act-campinas',
          label: 'Mudar para Campinas',
          description: 'CD 02 - Campinas',
          type: 'SWITCH_BRANCH',
          payload: { companyId: 'emp-fundicao-sp', branchId: 'br-ft-campinas' },
        },
        actions: [],
        suggestions: ['Como estão as tarefas hoje?', 'Voltar à Matriz SP'],
      };
    }

    if (q.includes('santos') || q.includes('ligas especiais')) {
      return {
        replyText: `Alternando empresa ativa para **Ligas Especiais & Metrologia** (Planta Santos - SP).`,
        executedAction: {
          id: 'act-santos',
          label: 'Mudar para Ligas Especiais (Santos)',
          description: 'Laboratório ASTM B49 - Santos',
          type: 'SWITCH_COMPANY',
          payload: { companyId: 'emp-ligas-especiais', branchId: 'br-le-santos' },
        },
        actions: [],
        suggestions: ['Calibração de Balanças', 'Como estão as tarefas hoje?', 'Voltar à Matriz SP'],
      };
    }

    if (q.includes('filial') || q.includes('empresa') || q.includes('trocar filial') || q.includes('mudar empresa') || q.includes('unidade')) {
      return {
        replyText: `Abrindo o seletor completo de **Empresas e Filiais**. Temos 3 empresas registradas e 6 unidades operacionais ativas no grupo.`,
        executedAction: {
          id: 'act-open-company-sel',
          label: 'Abrir Seletor de Empresas',
          description: 'Abre o modal de escolha de filiais',
          type: 'OPEN_COMPANY_SELECTOR',
        },
        actions: [],
        suggestions: ['Mudar para filial Sertãozinho', 'Mudar para filial Joinville', 'Mudar para Fundição SP'],
      };
    }

    // 6.5 Troca de Perfil / Usuário (CEO, Gestor PCP, Operador, Qualidade)
    if (
      q.includes('trocar usuario') ||
      q.includes('mudar usuario') ||
      q.includes('trocar perfil') ||
      q.includes('mudar perfil') ||
      q.includes('operador marcos') ||
      q.includes('supervisor carlos') ||
      q.includes('ceo andre') ||
      q.includes('fernanda')
    ) {
      if (q.includes('marcos') || q.includes('operador')) {
        return {
          replyText: `Alternando perfil de acesso para **Marcos Oliveira** (*Operador Líder de Balança Rodoviária*).`,
          executedAction: {
            id: 'act-usr-marcos',
            label: 'Perfil: Marcos (Operador)',
            description: 'Troca para visão de Operador',
            type: 'SWITCH_USER',
            payload: { userId: 'usr-balanca' },
          },
          actions: [],
          suggestions: ['Ver minhas tarefas', 'Calibração de Balanças', 'Voltar para CEO André'],
        };
      }
      if (q.includes('carlos') || q.includes('pcp') || q.includes('supervisor')) {
        return {
          replyText: `Alternando perfil de acesso para **Carlos Alberto Mendes** (*Supervisor de Planejamento PCP*).`,
          executedAction: {
            id: 'act-usr-carlos',
            label: 'Perfil: Carlos (Gestor PCP)',
            description: 'Troca para visão de Supervisor',
            type: 'SWITCH_USER',
            payload: { userId: 'usr-pcp' },
          },
          actions: [],
          suggestions: ['Ver tarefas da equipe', 'Rotinas Diárias', 'Voltar para CEO André'],
        };
      }
      if (q.includes('fernanda') || q.includes('qualidade')) {
        return {
          replyText: `Alternando perfil de acesso para **Dra. Fernanda Lemos** (*Química Chefe & Garantia da Qualidade*).`,
          executedAction: {
            id: 'act-usr-fernanda',
            label: 'Perfil: Dra. Fernanda (Qualidade)',
            description: 'Troca para visão da Qualidade',
            type: 'SWITCH_USER',
            payload: { userId: 'usr-qualidade' },
          },
          actions: [],
          suggestions: ['Calibração de Balanças', 'Como estão as tarefas hoje?', 'Voltar para CEO André'],
        };
      }
      if (q.includes('andre') || q.includes('ceo') || q.includes('diretor')) {
        return {
          replyText: `Alternando perfil de acesso para **André Francisco** (*CEO / Diretor Geral de Operações*).`,
          executedAction: {
            id: 'act-usr-ceo',
            label: 'Perfil: André Francisco (CEO)',
            description: 'Troca para visão da Diretoria',
            type: 'SWITCH_USER',
            payload: { userId: 'usr-ceo' },
          },
          actions: [],
          suggestions: ['Como estão as tarefas hoje?', 'Escolher filial', 'Me leva ao Kanban'],
        };
      }
    }

    // 7. Configurações
    if (q.includes('configuraco') || q.includes('configuracoes') || q.includes('preferencias') || q.includes('ajustes')) {
      return {
        replyText: `Abrindo o painel de **Configurações do CopperOS**. Você pode gerenciar seu perfil, parâmetros de automação, filiais e privacidade LGPD.`,
        executedAction: {
          id: 'act-settings',
          label: 'Abrir Configurações',
          description: 'Painel de configurações do sistema',
          type: 'OPEN_SETTINGS',
        },
        actions: [],
        suggestions: ['Mudar tema claro/escuro', 'Escolher filial', 'Ver tarefas'],
      };
    }

    // 8. Tarefas atrasadas, urgentes ou críticas
    if (q.includes('atrasada') || q.includes('urgente') || q.includes('critica') || q.includes('prazo')) {
      const topUrgent = [...overdueTasks, ...urgentTasks]
        .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
        .slice(0, 3);

      const listText =
        topUrgent.length > 0
          ? topUrgent.map(t => `• **${t.title}** (${t.assignee} · ${t.priority})`).join('\n')
          : '• Nenhuma tarefa crítica ou em atraso no momento.';

      return {
        replyText:
          `Na unidade **${activeBranch?.name || currentCompany.tradeName}**, temos **${overdueTasks.length} tarefa(s) em atraso** e **${urgentTasks.length} de prioridade Alta/Urgente** em aberto:\n\n` +
          `${listText}`,
        dataCard: {
          title: `Alertas de Prazo · ${currentCompany.monogram || 'CG'}`,
          badge: overdueTasks.length > 0 ? `${overdueTasks.length} Atrasada(s)` : 'Em Dia',
          stats: [
            { label: 'Atrasadas', value: String(overdueTasks.length) },
            { label: 'Alta / Urgente', value: String(urgentTasks.length) },
            { label: 'Pendentes', value: String(pendingTasks) },
            { label: 'Em Andamento', value: String(inProgressTasks) },
          ],
        },
        actions: [
          {
            id: 'act-urgent-kanban',
            label: 'Ver no Kanban',
            description: 'Abre o quadro Kanban',
            type: 'NAVIGATE_TAB',
            payload: { tab: 'Kanban' },
          },
          {
            id: 'act-urgent-new',
            label: '+ Nova Tarefa',
            description: 'Criar ordem de serviço',
            type: 'OPEN_CREATE_TASK',
          },
        ],
        suggestions: ['Me leva ao Kanban', 'Criar nova tarefa', 'Ver tarefas da equipe'],
      };
    }

    // 9. Resumo geral das tarefas
    if (
      q.includes('tarefa') ||
      q.includes('resumo') ||
      q.includes('status') ||
      q.includes('como estao') ||
      q.includes('pendente') ||
      q.includes('quantas')
    ) {
      return {
        replyText: `Atualmente na empresa **${currentCompany.tradeName}** (${activeBranch?.name || 'Matriz'}):\n\n` +
          `• **Total de Tarefas**: ${totalTasks}\n` +
          `• **Pendentes / A Fazer**: ${pendingTasks}\n` +
          `• **Em Andamento**: ${inProgressTasks}\n` +
          `• **Concluídas**: ${doneTasks}\n` +
          `• **Rotinas Diárias Ativas**: ${routineCount}\n\n` +
          `Como posso apoiar você agora?`,
        dataCard: {
          title: `Status Operacional · ${currentCompany.monogram || 'CG'}`,
          badge: 'Tempo Real',
          stats: [
            { label: 'Total', value: String(totalTasks) },
            { label: 'Pendentes', value: String(pendingTasks) },
            { label: 'Em Andamento', value: String(inProgressTasks) },
            { label: 'Concluídas', value: String(doneTasks) },
          ],
        },
        actions: [
          {
            id: 'act-view-kanban',
            label: 'Ver no Kanban',
            description: 'Abre o quadro',
            type: 'NAVIGATE_TAB',
            payload: { tab: 'Kanban' },
          },
          {
            id: 'act-new-task',
            label: '+ Nova Tarefa',
            description: 'Cadastra nova ordem de serviço',
            type: 'OPEN_CREATE_TASK',
          },
        ],
        suggestions: ['Quais tarefas estão atrasadas?', 'Criar nova tarefa', 'Ver rotinas diárias', 'Gravar fechamento'],
      };
    }

    // 10. Tema escuro / claro
    if (q.includes('tema') || q.includes('escuro') || q.includes('claro') || q.includes('dark')) {
      return {
        replyText: `Alternando o modo de visualização (Claro / Escuro).`,
        executedAction: {
          id: 'act-theme',
          label: 'Alternar Tema',
          description: 'Muda entre tema claro e escuro',
          type: 'TOGGLE_THEME',
        },
        actions: [],
        suggestions: ['Voltar ao Kanban', 'Abrir configurações'],
      };
    }

    // Resposta padrão inteligente
    return {
      replyText: `Olá, **${user.name.split(' ')[0]}**! Sou o seu **Copilot Operacional do CopperOS Tarefas**.\n\n` +
        `Posso alternar empresas e filiais, navegar pelos submódulos (Kanban, Rotinas, Calendário, Projetos, Calibração, RDO), resumir prazos e registrar tarefas diretamente.\n\n` +
        `Experimente um dos comandos abaixo:`,
      actions: [
        {
          id: 'act-def-kanban',
          label: 'Quadro Kanban',
          description: 'Navegar para o Kanban',
          type: 'NAVIGATE_TAB',
          payload: { tab: 'Kanban' },
        },
        {
          id: 'act-def-create',
          label: '+ Nova Tarefa',
          description: 'Abrir criador de tarefas',
          type: 'OPEN_CREATE_TASK',
        },
        {
          id: 'act-def-calib',
          label: 'Calibração de Balanças',
          description: 'Ver parque metrológico',
          type: 'NAVIGATE_TAB',
          payload: { tab: 'Calibração' },
        },
        {
          id: 'act-def-comp',
          label: 'Escolher Empresa / Filial',
          description: 'Trocar unidade operacional',
          type: 'OPEN_COMPANY_SELECTOR',
        },
      ],
      suggestions: [
        'Como estão as tarefas hoje?',
        'Quais tarefas estão atrasadas?',
        'Me leva ao Kanban',
        'Mudar para filial Sertãozinho',
        'Criar nova tarefa',
        'Gravar fechamento de turno',
      ],
    };
  }

  speakText(text: string, onEnd?: () => void) {
    voiceTtsService.speak(text, onEnd);
  }

  stopSpeaking() {
    voiceTtsService.stop();
  }
}

export const aiCopilotService = new AICopilotService();

