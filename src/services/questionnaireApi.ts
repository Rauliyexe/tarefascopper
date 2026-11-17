import { authenticatedFetch } from './authApi';

export interface DepartmentQuestionItem {
  id: string;
  companyId: string;
  departmentId: string;
  prompt: string;
  order: number;
  required: boolean;
  active: boolean;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentWithQuestionnaireStats {
  id: string;
  companyId: string;
  code: string;
  name: string;
  managerUserId?: string | null;
  managerName?: string | null;
  active: boolean;
  totalQuestionsCount: number;
  activeQuestionsCount: number;
  employeesCount: number;
  canAccessReports: boolean;
  canEditQuestionnaire: boolean;
}

export interface PeriodTaskItem {
  id: string;
  title: string;
  project: string;
  priority: string;
  dueDate: string;
  status: string;
}

export interface MyQuestionnaireResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    departmentId: string;
    departmentName: string;
  };
  department: {
    id: string;
    companyId: string;
    code: string;
    name: string;
  };
  dateKey: string;
  questions: DepartmentQuestionItem[];
  tasksContext: {
    totalAssigned: number;
    completedCount: number;
    inProgressCount: number;
    pendingCount: number;
    completed: PeriodTaskItem[];
    inProgress: PeriodTaskItem[];
    pending: PeriodTaskItem[];
  };
}

export const questionnaireApi = {
  async listDepartments(companyId = 'emp-copper-group'): Promise<{ departments: DepartmentWithQuestionnaireStats[] }> {
    const res = await authenticatedFetch(
      `/api/questionnaires/departments?companyId=${encodeURIComponent(companyId)}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao carregar departamentos' }));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return res.json();
  },

  async getMyQuestionnaire(params?: {
    companyId?: string;
    departmentId?: string;
    date?: string;
  }): Promise<MyQuestionnaireResponse> {
    const search = new URLSearchParams();
    if (params?.companyId) search.set('companyId', params.companyId);
    if (params?.departmentId) search.set('departmentId', params.departmentId);
    if (params?.date) search.set('date', params.date);
    const qs = search.toString();

    const res = await authenticatedFetch(`/api/questionnaires/my${qs ? `?${qs}` : ''}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao carregar questionário ativo' }));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return res.json();
  },

  async getDepartmentQuestions(
    departmentId: string,
    includeInactive = true
  ): Promise<{ department: any; questions: DepartmentQuestionItem[] }> {
    const res = await authenticatedFetch(
      `/api/questionnaires/department/${encodeURIComponent(departmentId)}?includeInactive=${includeInactive}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Acesso negado ou falha ao buscar perguntas' }));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return res.json();
  },

  async createQuestion(
    departmentId: string,
    payload: { prompt: string; required?: boolean; active?: boolean; order?: number }
  ): Promise<DepartmentQuestionItem> {
    const res = await authenticatedFetch(
      `/api/questionnaires/department/${encodeURIComponent(departmentId)}/questions`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao criar pergunta' }));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return res.json();
  },

  async updateQuestion(
    questionId: string,
    payload: { prompt?: string; required?: boolean; active?: boolean; order?: number }
  ): Promise<DepartmentQuestionItem> {
    const res = await authenticatedFetch(
      `/api/questionnaires/questions/${encodeURIComponent(questionId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao atualizar pergunta' }));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return res.json();
  },

  async reorderQuestions(
    departmentId: string,
    orderedIds: string[]
  ): Promise<{ questions: DepartmentQuestionItem[] }> {
    const res = await authenticatedFetch(
      `/api/questionnaires/department/${encodeURIComponent(departmentId)}/reorder`,
      {
        method: 'PATCH',
        body: JSON.stringify({ orderedIds }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao reordenar perguntas' }));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return res.json();
  },
};
