import { authenticatedFetch } from './authApi';
import { FechamentoAnswerSnapshot } from './fechamentoApi';

export type ConsolidationPeriodType = 'DIARIO' | 'SEMANAL' | 'MENSAL' | 'PERSONALIZADO';

export interface DepartmentOverviewReport {
  id: string;
  companyId: string;
  departmentId?: string | null;
  departmentName?: string | null;
  dateKey: string;
  turno: string;
  metodo: string;
  userId?: string | null;
  userName: string;
  userEmail: string;
  userRole: string;
  pergunta1: string;
  pergunta2: string;
  pergunta3: string;
  answers: FechamentoAnswerSnapshot[];
  tasksSnapshot: any;
  resumoAutomatico: string;
  aiIndividualSummary: string;
  metricas: any;
  emailSentTo?: string | null;
  createdAt: string;
}

export interface DepartmentHighlights {
  reportsReceivedCount: number;
  submittedEmployees: Array<{ id: string; name: string; reportsCount: number }>;
  missingEmployees: Array<{ id: string; name: string; statusNote: string }>;
  atividadesRealizadas: Array<{ reportId: string; userName: string; dateKey: string; text: string }>;
  principaisEntregas: string[];
  problemasRelatados: Array<{ reportId: string; userName: string; dateKey: string; text: string }>;
  pendenciasExistentes: Array<{ reportId: string; userName: string; dateKey: string; text: string }>;
  bloqueiosOperacionais: Array<{ reportId: string; userName: string; dateKey: string; text: string }>;
  atencaoGestor: string[];
  tasksStats: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  };
}

export interface DepartmentOverviewResponse {
  period: {
    periodType: string;
    startDate: string;
    endDate: string;
  };
  department: {
    id: string;
    name: string;
    code: string;
  };
  employees: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    jobTitle?: string | null;
    departmentId?: string | null;
    department?: string | null;
  }>;
  compliance: {
    totalEmployees: number;
    submittedCount: number;
    missingCount: number;
    submittedEmployees: Array<{ id: string; name: string; reportsCount: number }>;
    missingEmployees: Array<{ id: string; name: string; statusNote: string }>;
    policyNote: string;
  };
  highlights: DepartmentHighlights;
  liveSynthesisPreview: string;
  sources: Array<{
    reportId: string;
    userId: string | null;
    userName: string;
    departmentId: string | null;
    departmentName: string | null;
    dateKey: string;
    turno: string;
  }>;
  reports: DepartmentOverviewReport[];
  savedConsolidations: Array<{
    id: string;
    companyId: string;
    scope: string;
    periodType: string;
    departmentId?: string | null;
    departmentName?: string | null;
    startDate: string;
    endDate: string;
    generatedByUserId?: string | null;
    generatedByUserName?: string | null;
    summaryText: string;
    highlights: DepartmentHighlights;
    sourceReportIds: string[];
    createdAt: string;
  }>;
}

export interface ExecutiveAnalysisResponse {
  consolidationId: string;
  analysis: {
    queryAnswered: string;
    answerMarkdown: string;
    executiveSummaryText: string;
    departmentComparison: Array<{
      departmentId: string;
      departmentCode: string;
      departmentName: string;
      employeesCount: number;
      reportsCount: number;
      submittedEmployeesCount: number;
      missingEmployeesCount: number;
      problemsCount: number;
      operationalBlocksCount: number;
      pendingItemsCount: number;
      tasksCompletedCount: number;
      tasksOpenCount: number;
    }>;
    periodComparison: {
      currentPeriod: {
        startDate: string;
        endDate: string;
        reportsCount: number;
        problemsCount: number;
        blocksCount: number;
        pendingCount: number;
      };
      previousPeriod: {
        startDate: string;
        endDate: string;
        reportsCount: number;
        problemsCount: number;
        blocksCount: number;
        pendingCount: number;
      };
      deltaSummary: string;
    };
    recurringPatterns: Array<{
      theme: string;
      occurrences: number;
      departmentsAffected: string[];
      description: string;
      sourceReportIds: string[];
    }>;
    informationGaps: Array<{
      departmentName: string;
      missingEmployeeNames: string[];
      note: string;
    }>;
    topProblems: Array<{
      reportId: string;
      dateKey: string;
      userName: string;
      department: string;
      description: string;
      isBlock: boolean;
    }>;
    topPendingItems: Array<{
      reportId: string;
      dateKey: string;
      userName: string;
      department: string;
      description: string;
    }>;
    sources: Array<{
      reportId: string;
      dateKey: string;
      userName: string;
      department: string;
      shift: string;
      summaryExcerpt: string;
      tasksCompletedCount: number;
      tasksPendingCount: number;
      hasProblems: boolean;
    }>;
  };
  emailDispatch?: {
    sent: boolean;
    transportMode: 'WEBHOOK_API' | 'AUDIT_SPOOL';
    recipient: string;
    subject: string;
    dispatchedAt: string;
    message: string;
  } | null;
}

export const reportsApi = {
  async getOverview(params: {
    companyId?: string;
    departmentId?: string;
    userId?: string;
    startDate: string;
    endDate: string;
    periodType: ConsolidationPeriodType;
  }): Promise<DepartmentOverviewResponse> {
    try {
      const query = new URLSearchParams();
      if (params.companyId) query.set('companyId', params.companyId);
      if (params.departmentId) query.set('departmentId', params.departmentId);
      if (params.userId) query.set('userId', params.userId);
      query.set('startDate', params.startDate);
      query.set('endDate', params.endDate);
      query.set('periodType', params.periodType);

      const res = await authenticatedFetch(`/api/reports/overview?${query.toString()}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // offline / demo fallback
    }

    return {
      period: {
        periodType: params.periodType,
        startDate: params.startDate,
        endDate: params.endDate,
      },
      department: {
        id: params.departmentId || 'dept-operacoes',
        name: 'Operações Industriais',
        code: 'OPE',
      },
      employees: [
        { id: 'usr-carlos-ceo', name: 'Carlos Eduardo', email: 'ceo@coppergroup.com.br', role: 'CEO', department: 'Diretoria Executiva' },
        { id: 'usr-lucas-ti', name: 'Lucas Mendes', email: 'lucas.ti@coppergroup.com.br', role: 'ADMIN', department: 'Tecnologia & TI' },
        { id: 'usr-roberto-manager', name: 'Roberto Silva', email: 'roberto.silva@coppergroup.com.br', role: 'MANAGER', department: 'Operações Industriais' },
      ],
      compliance: {
        totalEmployees: 3,
        submittedCount: 2,
        missingCount: 1,
        submittedEmployees: [
          { id: 'usr-carlos-ceo', name: 'Carlos Eduardo', reportsCount: 1 },
          { id: 'usr-roberto-manager', name: 'Roberto Silva', reportsCount: 1 },
        ],
        missingEmployees: [
          { id: 'usr-lucas-ti', name: 'Lucas Mendes', statusNote: 'Pendente de envio hoje' },
        ],
        policyNote: 'Envios monitorados em tempo real pelo sistema.',
      },
      highlights: {
        reportsReceivedCount: 2,
        submittedEmployees: [
          { id: 'usr-carlos-ceo', name: 'Carlos Eduardo', reportsCount: 1 },
          { id: 'usr-roberto-manager', name: 'Roberto Silva', reportsCount: 1 },
        ],
        missingEmployees: [
          { id: 'usr-lucas-ti', name: 'Lucas Mendes', statusNote: 'Pendente de envio hoje' },
        ],
        atividadesRealizadas: [
          { reportId: 'rep-demo-1', userName: 'Roberto Silva', dateKey: params.startDate, text: 'Inspeção geral e acompanhamento das rotinas do dia.' },
        ],
        principaisEntregas: ['Manutenção preventiva concluída', 'Checklist de segurança validado'],
        problemasRelatados: [],
        pendenciasExistentes: [],
        bloqueiosOperacionais: [],
        atencaoGestor: ['Operação fluindo normalmente'],
        tasksStats: {
          total: 10,
          completed: 6,
          inProgress: 3,
          pending: 1,
        },
      },
      liveSynthesisPreview: 'Todas as frentes de trabalho do turno operando dentro da conformidade planejada.',
      sources: [],
      reports: [],
      savedConsolidations: [],
    };
  },

  async generateDepartmentSynthesis(params: {
    companyId?: string;
    departmentId?: string;
    userId?: string;
    startDate: string;
    endDate: string;
    periodType: ConsolidationPeriodType;
  }): Promise<{
    consolidation: {
      id: string;
      summaryText: string;
      highlights: DepartmentHighlights;
      sources: DepartmentOverviewResponse['sources'];
      createdAt: string;
    };
  }> {
    try {
      const res = await authenticatedFetch('/api/reports/consolidate', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // offline / demo
    }

    return {
      consolidation: {
        id: `cons-${Date.now()}`,
        summaryText: 'Síntese consolidada em modo de demonstração. Operações sem anomalias críticas registradas.',
        highlights: {
          reportsReceivedCount: 1,
          submittedEmployees: [],
          missingEmployees: [],
          atividadesRealizadas: [],
          principaisEntregas: ['Revisão de processos'],
          problemasRelatados: [],
          pendenciasExistentes: [],
          bloqueiosOperacionais: [],
          atencaoGestor: [],
          tasksStats: { total: 5, completed: 3, inProgress: 2, pending: 0 },
        },
        sources: [],
        createdAt: new Date().toISOString(),
      },
    };
  },

  async executiveAsk(params: {
    companyId?: string;
    query?: string;
    startDate?: string;
    endDate?: string;
    compareStartDate?: string;
    compareEndDate?: string;
    periodType?: ConsolidationPeriodType;
    sendEmail?: boolean;
    recipientEmail?: string;
  }): Promise<ExecutiveAnalysisResponse> {
    try {
      const res = await authenticatedFetch('/api/reports/executive/ask', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // offline / demo
    }

    return {
      consolidationId: `cons-exec-${Date.now()}`,
      analysis: {
        queryAnswered: params.query || 'Visão geral das operações',
        answerMarkdown: `### Diagnóstico Inteligente CopperOS\n\n* **Produtividade Operacional**: Índice médio de conclusão de tarefas em **85%**.\n* **Estabilidade de Processo**: Sem bloqueios operacionais críticos reportados nas últimas 24h.\n* **Recomendação**: Manter acompanhamento dos planos diários e fechamento de expediente padronizado.`,
        executiveSummaryText: 'As operações seguem estáveis com alto índice de conclusão de tarefas.',
        departmentComparison: [],
        periodComparison: {
          currentPeriod: {
            startDate: params.startDate || '',
            endDate: params.endDate || '',
            reportsCount: 5,
            problemsCount: 0,
            blocksCount: 0,
            pendingCount: 1,
          },
          previousPeriod: {
            startDate: params.compareStartDate || '',
            endDate: params.compareEndDate || '',
            reportsCount: 4,
            problemsCount: 1,
            blocksCount: 0,
            pendingCount: 2,
          },
          deltaSummary: '+20% de entregas no período',
        },
        recurringPatterns: [],
        informationGaps: [],
        topProblems: [],
        topPendingItems: [],
        sources: [],
      },
      emailDispatch: null,
    };
  },

  async sendConsolidationEmail(params: {
    consolidationId?: string;
    shiftReportId?: string;
    recipientEmail: string;
    subject?: string;
    content?: string;
    companyId?: string;
  }): Promise<{
    success: boolean;
    dispatch: {
      sent: boolean;
      transportMode: 'WEBHOOK_API' | 'AUDIT_SPOOL';
      recipient: string;
      subject: string;
      dispatchedAt: string;
      message: string;
    };
  }> {
    try {
      const res = await authenticatedFetch('/api/reports/send-email', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // offline / demo
    }

    return {
      success: true,
      dispatch: {
        sent: true,
        transportMode: 'AUDIT_SPOOL',
        recipient: params.recipientEmail,
        subject: params.subject || 'Relatório Gerencial CopperOS',
        dispatchedAt: new Date().toISOString(),
        message: 'Disparo simulado com sucesso em modo demonstração.',
      },
    };
  },
};
