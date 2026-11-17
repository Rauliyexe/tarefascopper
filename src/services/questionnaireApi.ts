import { authenticatedFetch } from './authApi';
import { standaloneStore, DEFAULT_DEPARTMENTS } from './standaloneStore';

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

const DEFAULT_QUESTIONS: DepartmentQuestionItem[] = [
  {
    id: 'q-1',
    companyId: 'emp-copper-group',
    departmentId: 'dept-operacoes',
    prompt: 'O que você realizou e concluiu hoje durante o seu expediente?',
    order: 1,
    required: true,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'q-2',
    companyId: 'emp-copper-group',
    departmentId: 'dept-operacoes',
    prompt: 'Houve algum impedimento, gargalo ou não-conformidade operacional?',
    order: 2,
    required: false,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'q-3',
    companyId: 'emp-copper-group',
    departmentId: 'dept-operacoes',
    prompt: 'O que está planejado para o seu próximo expediente ou passagem de turno?',
    order: 3,
    required: true,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const questionnaireApi = {
  async listDepartments(companyId = 'emp-copper-group'): Promise<{ departments: DepartmentWithQuestionnaireStats[] }> {
    try {
      const res = await authenticatedFetch(
        `/api/questionnaires/departments?companyId=${encodeURIComponent(companyId)}`
      );
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // offline / demo
    }

    const depts = DEFAULT_DEPARTMENTS.map((d, idx) => ({
      id: d.id,
      companyId: d.companyId,
      code: d.code,
      name: d.name,
      managerUserId: null,
      managerName: 'Gestor Responsável',
      active: true,
      totalQuestionsCount: 3,
      activeQuestionsCount: 3,
      employeesCount: 4,
      canAccessReports: true,
      canEditQuestionnaire: true,
    }));
    return { departments: depts };
  },

  async getMyQuestionnaire(params?: {
    companyId?: string;
    departmentId?: string;
    date?: string;
  }): Promise<MyQuestionnaireResponse> {
    try {
      const search = new URLSearchParams();
      if (params?.companyId) search.set('companyId', params.companyId);
      if (params?.departmentId) search.set('departmentId', params.departmentId);
      if (params?.date) search.set('date', params.date);
      const qs = search.toString();

      const res = await authenticatedFetch(`/api/questionnaires/my${qs ? `?${qs}` : ''}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // offline / demo
    }

    const users = standaloneStore.getUsers();
    const currentUser = users[0];
    const tasks = standaloneStore.getTasks();
    const completedTasks = tasks.filter(t => t.status === 'Concluída');
    const inProgressTasks = tasks.filter(t => t.status === 'Em andamento');
    const pendingTasks = tasks.filter(t => t.status === 'Pendente');

    return {
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        departmentId: currentUser.department || 'dept-operacoes',
        departmentName: currentUser.department || 'Operações Industriais',
      },
      department: {
        id: 'dept-operacoes',
        companyId: 'emp-copper-group',
        code: 'OPE',
        name: 'Operações Industriais',
      },
      dateKey: params?.date || new Date().toISOString().split('T')[0],
      questions: DEFAULT_QUESTIONS,
      tasksContext: {
        totalAssigned: tasks.length,
        completedCount: completedTasks.length,
        inProgressCount: inProgressTasks.length,
        pendingCount: pendingTasks.length,
        completed: completedTasks.slice(0, 5).map(t => ({
          id: t.id,
          title: t.title,
          project: t.project || 'Operação',
          priority: t.priority,
          dueDate: t.dueDate,
          status: t.status,
        })),
        inProgress: inProgressTasks.slice(0, 5).map(t => ({
          id: t.id,
          title: t.title,
          project: t.project || 'Operação',
          priority: t.priority,
          dueDate: t.dueDate,
          status: t.status,
        })),
        pending: pendingTasks.slice(0, 5).map(t => ({
          id: t.id,
          title: t.title,
          project: t.project || 'Operação',
          priority: t.priority,
          dueDate: t.dueDate,
          status: t.status,
        })),
      },
    };
  },

  async getDepartmentQuestions(
    departmentId: string,
    includeInactive = true
  ): Promise<{ department: any; questions: DepartmentQuestionItem[] }> {
    try {
      const res = await authenticatedFetch(
        `/api/questionnaires/department/${encodeURIComponent(departmentId)}?includeInactive=${includeInactive}`
      );
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // offline / demo
    }

    const dept = DEFAULT_DEPARTMENTS.find(d => d.id === departmentId) || DEFAULT_DEPARTMENTS[0];
    return {
      department: dept,
      questions: DEFAULT_QUESTIONS,
    };
  },

  async createQuestion(
    departmentId: string,
    payload: { prompt: string; required?: boolean; active?: boolean; order?: number }
  ): Promise<DepartmentQuestionItem> {
    try {
      const res = await authenticatedFetch(
        `/api/questionnaires/department/${encodeURIComponent(departmentId)}/questions`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // offline / demo
    }

    const newQ: DepartmentQuestionItem = {
      id: `q-${Date.now()}`,
      companyId: 'emp-copper-group',
      departmentId,
      prompt: payload.prompt,
      order: payload.order ?? 4,
      required: payload.required ?? true,
      active: payload.active ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return newQ;
  },

  async updateQuestion(
    questionId: string,
    payload: { prompt?: string; required?: boolean; active?: boolean; order?: number }
  ): Promise<DepartmentQuestionItem> {
    try {
      const res = await authenticatedFetch(
        `/api/questionnaires/questions/${encodeURIComponent(questionId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // offline / demo
    }

    return {
      id: questionId,
      companyId: 'emp-copper-group',
      departmentId: 'dept-operacoes',
      prompt: payload.prompt || 'Pergunta atualizada',
      order: payload.order ?? 1,
      required: payload.required ?? true,
      active: payload.active ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  async reorderQuestions(
    departmentId: string,
    orderedIds: string[]
  ): Promise<{ questions: DepartmentQuestionItem[] }> {
    try {
      const res = await authenticatedFetch(
        `/api/questionnaires/department/${encodeURIComponent(departmentId)}/reorder`,
        {
          method: 'PATCH',
          body: JSON.stringify({ orderedIds }),
        }
      );
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // offline / demo
    }

    return { questions: DEFAULT_QUESTIONS };
  },
};
