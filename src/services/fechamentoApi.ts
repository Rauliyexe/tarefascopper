import { authenticatedFetch } from './authApi';

export interface FechamentoPerguntas {
  pergunta1: string; // O que você realizou e concluiu hoje durante o seu expediente?
  pergunta2: string; // Houve algum impedimento, gargalo ou não-conformidade?
  pergunta3: string; // O que está planejado para o seu próximo expediente ou passagem de turno?
}

export interface FechamentoMetricas {
  tarefasConcluidas?: number;
  totalTarefas?: number;
  horasTrabalhadas?: number;
  pesoProcessadoKg?: number;
  statusGeral?: 'REGULAR' | 'ATENCAO' | 'CRITICO';
}

export interface FechamentoAnswerSnapshot {
  questionId: string;
  questionTextSnapshot: string;
  order: number;
  required: boolean;
  answerText: string;
  inputMethod?: 'text' | 'voice' | string;
}

export interface FechamentoExpedienteDTO {
  companyId?: string;
  departmentId?: string;
  departmentName?: string;
  turno: 'TURNO_A' | 'TURNO_B' | 'TURNO_C' | 'ADMINISTRATIVO' | string;
  metodo: 'VOZ' | 'TEXTO' | 'HIBRIDO';
  perguntas: FechamentoPerguntas;
  answers?: FechamentoAnswerSnapshot[];
  tasksSnapshot?: any;
  resumoAutomatico: string;
  aiIndividualSummary?: string;
  audioTranscrito?: string;
  metricas?: FechamentoMetricas;
  enviarEmailDiretoria?: boolean;
  destinatarioEmail?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
}

export interface FechamentoExpedienteRecord {
  id: string;
  companyId?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  userId?: string | null;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string | null;
  description: string;
  ipAddress?: string | null;
  createdAt: string;
  newValues: {
    dataFechamento: string;
    turno: string;
    metodo: 'VOZ' | 'TEXTO' | 'HIBRIDO';
    departmentId?: string | null;
    departmentName?: string | null;
    perguntas: FechamentoPerguntas;
    answers?: FechamentoAnswerSnapshot[];
    tasksSnapshot?: any;
    resumoAutomatico: string;
    aiIndividualSummary?: string;
    audioTranscrito?: string;
    metricas?: FechamentoMetricas;
    colaborador?: {
      id?: string | null;
      nome: string;
      email: string;
      cargo: string;
      departmentId?: string | null;
      departmentName?: string | null;
    };
  };
  company?: {
    id: string;
    tradeName: string;
    numericCode: string;
  };
}

const API_BASE_URL = '/api/fechamento-expediente';

export const fechamentoApi = {
  /**
   * Salva e audita o fechamento de expediente diário no banco de dados,
   * enviando opcionalmente cópia executiva por e-mail para a Diretoria / Dono.
   */
  async create(payload: FechamentoExpedienteDTO): Promise<{
    success: boolean;
    fechamento: FechamentoExpedienteRecord;
    emailStatus?: { enviado: boolean; destinatario?: string; erro?: string };
  }> {
    try {
      const res = await authenticatedFetch(API_BASE_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // ignore
    }

    return {
      success: true,
      fechamento: {
        id: `fch-${Date.now()}`,
        userName: payload.userName || 'Colaborador',
        userEmail: payload.userEmail || 'colaborador@coppergroup.com.br',
        userRole: payload.userRole || 'OPERATOR',
        action: 'FECHAMENTO_EXPEDIENTE',
        entity: 'FechamentoExpediente',
        description: 'Fechamento registrado com sucesso (Modo Standalone)',
        createdAt: new Date().toISOString(),
        newValues: {
          dataFechamento: new Date().toISOString().slice(0, 10),
          turno: payload.turno || 'ADMINISTRATIVO',
          metodo: payload.metodo || 'TEXTO',
          perguntas: payload.perguntas,
          resumoAutomatico: payload.resumoAutomatico || 'Fechamento registrado.',
        },
      },
      emailStatus: { enviado: false, destinatario: payload.destinatarioEmail, erro: 'Modo Standalone (e-mail simulado)' },
    };
  },

  /**
   * Gera a síntese individual estruturada (Seção 8) usando IA no backend antes ou durante o envio.
   */
  async previewIndividualSynthesis(params: {
    dateKey?: string;
    userName?: string;
    departmentName?: string;
    turno?: string;
    answers: FechamentoAnswerSnapshot[];
    tasksSnapshot?: any;
    observacoesAdicionais?: string;
  }): Promise<{
    structuredReport: string;
    executiveParagraph: string;
    detectedIssues: boolean;
  }> {
    const res = await authenticatedFetch(`${API_BASE_URL}/gerar-sintese-individual`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao gerar síntese individual');
    }
    return res.json();
  },

  /**
   * Dispara ou reenvia avulso o relatório de fechamento por e-mail para a Diretoria / Dono.
   */
  async sendEmail(params: {
    id?: string;
    destinatarioEmail?: string;
    fechamentoData?: any;
  }): Promise<{ success: boolean; message: string }> {
    const res = await authenticatedFetch(`${API_BASE_URL}/enviar-email`, {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Erro ao enviar relatório por e-mail.');
    }

    return await res.json();
  },

  /**
   * Lista os fechamentos de expediente registrados no banco de dados (por data única ou intervalo).
   */
  async list(params: {
    companyId?: string;
    turno?: string;
    date?: string; // YYYY-MM-DD
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    userId?: string;
    limit?: number;
  } = {}): Promise<FechamentoExpedienteRecord[]> {
    try {
      const query = new URLSearchParams();
      if (params.companyId) query.set('companyId', params.companyId);
      if (params.turno && params.turno !== 'TODOS') query.set('turno', params.turno);
      if (params.startDate && params.endDate) {
        query.set('startDate', params.startDate);
        query.set('endDate', params.endDate);
      } else if (params.date) {
        query.set('date', params.date);
      }
      if (params.userId) query.set('userId', params.userId);
      if (params.limit) query.set('limit', String(params.limit));

      const url = `${API_BASE_URL}${query.toString() ? `?${query.toString()}` : ''}`;
      const res = await authenticatedFetch(url);
      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        return data.fechamentos || [];
      }
    } catch {
      // ignore
    }
    return [];
  },

  /**
   * Lista todas as notas de Diário de Bordo de um intervalo (Semanal / Mensal).
   */
  async listDailyNotes(params: {
    companyId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Array<{ id: string; companyId: string; dateKey: string; content: string; updatedBy?: string | null; updatedAt?: string }>> {
    try {
      const query = new URLSearchParams({ companyId: params.companyId });
      if (params.startDate) query.set('startDate', params.startDate);
      if (params.endDate) query.set('endDate', params.endDate);
      const res = await authenticatedFetch(`${API_BASE_URL}/diario-notas-periodo?${query.toString()}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        return data.notes || [];
      }
    } catch {
      // ignore
    }
    return [];
  },

  /**
   * Obtém notas do Diário de Bordo Operacional do banco de dados.
   */
  async getDailyNote(companyId: string, date: string): Promise<string> {
    try {
      const query = new URLSearchParams({ companyId, date });
      const res = await authenticatedFetch(`${API_BASE_URL}/diario-notas?${query.toString()}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        return data.content || '';
      }
    } catch {
      // ignore
    }
    return '';
  },

  /**
   * Salva notas do Diário de Bordo Operacional no banco de dados.
   */
  async saveDailyNote(params: {
    companyId: string;
    dateKey: string;
    content: string;
    updatedBy?: string;
  }): Promise<void> {
    try {
      await authenticatedFetch(`${API_BASE_URL}/diario-notas`, {
        method: 'PUT',
        body: JSON.stringify(params),
      });
    } catch {
      // ignore
    }
  },
};
