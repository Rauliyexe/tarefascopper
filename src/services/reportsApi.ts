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
    const query = new URLSearchParams();
    if (params.companyId) query.set('companyId', params.companyId);
    if (params.departmentId) query.set('departmentId', params.departmentId);
    if (params.userId) query.set('userId', params.userId);
    query.set('startDate', params.startDate);
    query.set('endDate', params.endDate);
    query.set('periodType', params.periodType);

    const res = await authenticatedFetch(`/api/reports/overview?${query.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao consultar relatórios do setor.' }));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return res.json();
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
    const res = await authenticatedFetch('/api/reports/consolidate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao gerar síntese departamental.' }));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return res.json();
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
    const res = await authenticatedFetch('/api/reports/executive/ask', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao consultar IA Executiva.' }));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return res.json();
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
    const res = await authenticatedFetch('/api/reports/send-email', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao enviar e-mail.' }));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return res.json();
  },
};
