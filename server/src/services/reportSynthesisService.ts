export interface AnswerSnapshotItem {
  questionId: string;
  questionTextSnapshot: string;
  order: number;
  required: boolean;
  answerText: string;
  inputMethod?: 'text' | 'voice' | string;
}

export interface TaskSnapshotSummary {
  totalAssigned?: number;
  completedCount?: number;
  inProgressCount?: number;
  pendingCount?: number;
  completed?: Array<{ id: string; title: string; project: string; dueDate?: string; priority?: string }>;
  inProgress?: Array<{ id: string; title: string; project: string; dueDate?: string; priority?: string }>;
  pending?: Array<{ id: string; title: string; project: string; dueDate?: string; priority?: string }>;
}

export interface IndividualSynthesisInput {
  dateKey: string;
  userName: string;
  departmentName: string;
  turno: string;
  answers: AnswerSnapshotItem[];
  tasksSnapshot?: TaskSnapshotSummary;
  observacoesAdicionais?: string;
}

/**
 * Gera a síntese estruturada do Relatório Individual (Seção 8).
 * Se houver GEMINI_API_KEY ou OPENAI_API_KEY no ambiente, enriquece o parágrafo final de síntese via LLM
 * sem jamás inventar informações; caso contrário, produz síntese analítica estruturada e determinística.
 */
export async function generateIndividualSynthesis(input: IndividualSynthesisInput): Promise<{
  structuredReport: string;
  executiveParagraph: string;
  detectedIssues: boolean;
}> {
  const {
    dateKey,
    userName,
    departmentName,
    turno,
    answers = [],
    tasksSnapshot = {},
    observacoesAdicionais = '',
  } = input;

  const sortedAnswers = [...answers].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Identifica respostas por semântica da pergunta ou posição
  const findAnswerByKeywords = (keywords: string[], fallbackIndex: number): string => {
    const matched = sortedAnswers.find(a => {
      const q = (a.questionTextSnapshot || '').toLowerCase();
      return keywords.some(k => q.includes(k));
    });
    if (matched && matched.answerText?.trim()) return matched.answerText.trim();
    return sortedAnswers[fallbackIndex]?.answerText?.trim() || 'Não informado pelo colaborador.';
  };

  const atividadesRelatadas = findAnswerByKeywords(
    ['atividade', 'realizad', 'executad', 'ordem', 'corrida', 'ensaio', 'pesage', 'manuten'],
    0
  );
  const problemasRelatados = findAnswerByKeywords(
    ['dificuldade', 'problema', 'atraso', 'impedimento', 'gargalo', 'bloqueio', 'divergencia', 'parada', 'falha', 'desvio'],
    1
  );
  const pendenciasRelatadas = findAnswerByKeywords(
    ['pendenc', 'amanha', 'proximo', 'programad', 'passagem'],
    sortedAnswers.length > 2 ? sortedAnswers.length - 1 : 2
  );

  //Respostas extras (ex: departamentos com 4+ perguntas)
  const extraAnswers = sortedAnswers
    .filter(
      a =>
        a.answerText?.trim() &&
        a.answerText.trim() !== atividadesRelatadas &&
        a.answerText.trim() !== problemasRelatados &&
        a.answerText.trim() !== pendenciasRelatadas
    )
    .map(a => `${a.questionTextSnapshot}: ${a.answerText.trim()}`);

  const completedSys = tasksSnapshot.completed || [];
  const inProgressSys = tasksSnapshot.inProgress || [];
  const pendingSys = tasksSnapshot.pending || [];

  const completedTasksText =
    completedSys.length > 0
      ? completedSys.map(t => `• ${t.title} (${t.project})`).join('\n')
      : 'Nenhuma tarefa marcada como concluída no sistema neste período.';

  const openTasksList = [
    ...inProgressSys.map(t => `• [Em andamento] ${t.title} (${t.project})`),
    ...pendingSys.map(t => `• [Pendente] ${t.title} (${t.project})`),
  ];
  const pendingTasksText =
    openTasksList.length > 0
      ? openTasksList.join('\n')
      : 'Nenhuma tarefa aberta/pendente registrada no sistema para o colaborador.';

  const issueRegex =
    /parada|falha|defeito|diverg[eê]ncia|quebra|atraso|bloqueio|bloquead|problema|aquecimento|venci|urgente|interrup/i;
  const noIssueRegex = /^s\/?\s*impedimento|^sem\s+(impedimento|problema|dificuldade|atraso)|^nenhum|^nada\s+a\s+relatar|^ok\b/i;

  const detectedIssues =
    !noIssueRegex.test(problemasRelatados) && issueRegex.test(problemasRelatados);

  let executiveParagraph =
    `${userName} (${departmentName}, turno ${turno}) registrou expediente em ${dateKey}. ` +
    `Relatou como principais entregas: "${atividadesRelatadas}". ` +
    `No CopperOS constam ${completedSys.length} tarefa(s) concluída(s) e ${inProgressSys.length + pendingSys.length} tarefa(s) em aberto/andamento (mantidas distintas do relato individual). ` +
    (detectedIssues
      ? `Atenção operacional reportada: "${problemasRelatados}". `
      : `Sem impedimentos críticos reportados (${problemasRelatados}). `) +
    `Encaminhamentos para o próximo período: "${pendenciasRelatadas}".`;

  // Tenta usar LLM se chave de API estiver configurada no ambiente
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    try {
      const prompt = [
        'Você é o Copiloto Operacional do CopperOS. Gere APENAS um parágrafo executivo objetivo (máximo 4 frases, em português profissional) sintetizando o relatório individual abaixo.',
        'Regras estritas: NÃO invente informações, NÃO assuma que tarefas em aberto no sistema foram concluídas, distinga claramente o relato do funcionário dos registros do sistema.',
        `Funcionário: ${userName} | Departamento: ${departmentName} | Data: ${dateKey}`,
        `Respostas do questionário: ${JSON.stringify(sortedAnswers.map(a => ({ pergunta: a.questionTextSnapshot, resposta: a.answerText })))}`,
        `Tarefas no CopperOS: ${completedSys.length} concluídas, ${inProgressSys.length} em andamento, ${pendingSys.length} pendentes.`,
      ].join('\n');

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 250 },
          }),
        }
      );
      if (resp.ok) {
        const data: any = await resp.json();
        const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidate) {
          executiveParagraph = candidate;
        }
      }
    } catch {
      // Fallback silencioso para síntese determinística
    }
  } else if (openaiKey) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                'Você é o Copiloto Operacional do CopperOS. Produza apenas um parágrafo de síntese objetiva e fiel aos dados fornecidos, sem inventar fatos e distinguindo atividades declaradas pelo funcionário das tarefas registradas no sistema.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                dateKey,
                userName,
                departmentName,
                answers: sortedAnswers,
                systemTasks: {
                  completed: completedSys.length,
                  inProgress: inProgressSys.length,
                  pending: pendingSys.length,
                },
              }),
            },
          ],
        }),
      });
      if (resp.ok) {
        const data: any = await resp.json();
        const candidate = data?.choices?.[0]?.message?.content?.trim();
        if (candidate) {
          executiveParagraph = candidate;
        }
      }
    } catch {
      // Fallback silencioso
    }
  }

  const obsLines = [
    ...(extraAnswers.length > 0 ? extraAnswers : []),
    ...(observacoesAdicionais?.trim() ? [observacoesAdicionais.trim()] : []),
    `Encaminhamento / Próximo expediente: ${pendenciasRelatadas}`,
  ].join('\n');

  const structuredReport = [
    `RELATÓRIO INDIVIDUAL — FUNCIONÁRIO`,
    `• Data do expediente: ${dateKey} (${turno})`,
    `• Nome do funcionário: ${userName}`,
    `• Departamento: ${departmentName}`,
    ``,
    `1. Atividades realizadas (Informadas pelo funcionário):`,
    `${atividadesRelatadas}`,
    ``,
    `2. Tarefas concluídas (Registradas no CopperOS):`,
    `${completedTasksText}`,
    ``,
    `3. Tarefas pendentes / em andamento (Registradas no CopperOS):`,
    `${pendingTasksText}`,
    ``,
    `4. Problemas encontrados:`,
    `${problemasRelatados}`,
    ``,
    `5. Observações adicionais e pendências declaradas:`,
    `${obsLines}`,
    ``,
    `6. Síntese produzida pela IA:`,
    `${executiveParagraph}`,
  ].join('\n');

  return {
    structuredReport,
    executiveParagraph,
    detectedIssues,
  };
}

export interface DepartmentConsolidationInput {
  companyId: string;
  departmentId: string;
  departmentName: string;
  userId?: string | null;
  startDate: string;
  endDate: string;
  periodType: 'DIARIO' | 'SEMANAL' | 'MENSAL' | 'PERSONALIZADO' | string;
  requesterRole: string;
  reports: any[];
  departmentUsers: Array<{ id: string; name: string; email: string; role: string; jobTitle?: string | null }>;
  departmentTasks: Array<{ id: string; title: string; status: string; priority: string; assignee: string; dueDate: string }>;
}

export interface DepartmentConsolidationResult {
  summaryText: string;
  highlights: {
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
  };
  sources: Array<{
    reportId: string;
    userId: string | null;
    userName: string;
    departmentId: string | null;
    departmentName: string | null;
    dateKey: string;
    turno: string;
  }>;
}

const safeParseJsonArray = (raw: any): AnswerSnapshotItem[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const isNeutralProblemText = (text: string): boolean => {
  const clean = text.trim();
  if (!clean) return true;
  return /^s\/?\s*impedimento|^sem\s+(impedimento|problema|dificuldade|atraso|desvio)|^nenhum|^nada\s+a\s+relatar|^normal|^ok\b/i.test(
    clean
  );
};

const isOperationalBlockText = (text: string): boolean => {
  return /bloquead|bloqueio|parada|interromp|interrup|trava\s*rn-16|quebra|inoperante|aguardando\s+(pe[cç]a|recalibra|manuten)/i.test(
    text
  );
};

/**
 * Motor Único de Consolidação (Seções 9 e 11):
 * Atende intervalos Diário, Semanal, Mensal e Personalizado com os mesmos parâmetros,
 * distinguindo ausência de informação de ausência de trabalho e mantendo rastreabilidade das fontes.
 */
export async function consolidateDepartmentPeriod(
  input: DepartmentConsolidationInput
): Promise<DepartmentConsolidationResult> {
  const {
    departmentId,
    departmentName,
    startDate,
    endDate,
    periodType,
    reports,
    departmentUsers,
    departmentTasks,
  } = input;

  // 1. Mapeia quem enviou e quem não enviou no período (Seção 9)
  const countsByUser = new Map<string, number>();
  const namesSubmitted = new Set<string>();

  for (const r of reports) {
    if (r.userId) {
      countsByUser.set(r.userId, (countsByUser.get(r.userId) || 0) + 1);
    }
    if (r.userName) {
      namesSubmitted.add(r.userName.toLowerCase());
    }
  }

  const submittedEmployees = departmentUsers
    .filter(u => countsByUser.has(u.id) || namesSubmitted.has(u.name.toLowerCase()))
    .map(u => ({
      id: u.id,
      name: u.name,
      reportsCount: countsByUser.get(u.id) || 1,
    }));

  const missingEmployees = departmentUsers
    .filter(u => !countsByUser.has(u.id) && !namesSubmitted.has(u.name.toLowerCase()))
    .map(u => ({
      id: u.id,
      name: u.name,
      statusNote: 'Ausência de relatório enviado no período (ausência de informação, não de trabalho)',
    }));

  // 2. Extrai atividades, entregas, problemas, bloqueios e pendências dos relatórios recebidos
  const atividadesRealizadas: Array<{ reportId: string; userName: string; dateKey: string; text: string }> = [];
  const problemasRelatados: Array<{ reportId: string; userName: string; dateKey: string; text: string }> = [];
  const pendenciasExistentes: Array<{ reportId: string; userName: string; dateKey: string; text: string }> = [];
  const bloqueiosOperacionais: Array<{ reportId: string; userName: string; dateKey: string; text: string }> = [];

  for (const r of reports) {
    const answers = safeParseJsonArray(r.answersJson);
    let actText = r.pergunta1 || '';
    let probText = r.pergunta2 || '';
    let pendText = r.pergunta3 || '';

    if (answers.length > 0) {
      const sorted = [...answers].sort((a, b) => (a.order || 0) - (b.order || 0));
      actText =
        sorted.find(a =>
          /atividade|realizad|executad|ordem|corrida|ensaio|pesage|manuten/i.test(a.questionTextSnapshot || '')
        )?.answerText ||
        sorted[0]?.answerText ||
        actText;

      probText =
        sorted.find(a =>
          /dificuldade|problema|atraso|impedimento|gargalo|bloqueio|divergencia|parada|falha|desvio/i.test(
            a.questionTextSnapshot || ''
          )
        )?.answerText ||
        sorted[1]?.answerText ||
        probText;

      pendText =
        sorted.find(a =>
          /pendenc|amanha|proximo|programad|passagem/i.test(a.questionTextSnapshot || '')
        )?.answerText ||
        sorted[sorted.length - 1]?.answerText ||
        pendText;
    }

    if (actText && actText.trim()) {
      atividadesRealizadas.push({
        reportId: r.id,
        userName: r.userName,
        dateKey: r.dateKey,
        text: actText.trim(),
      });
    }

    if (probText && !isNeutralProblemText(probText)) {
      problemasRelatados.push({
        reportId: r.id,
        userName: r.userName,
        dateKey: r.dateKey,
        text: probText.trim(),
      });

      if (isOperationalBlockText(probText)) {
        bloqueiosOperacionais.push({
          reportId: r.id,
          userName: r.userName,
          dateKey: r.dateKey,
          text: probText.trim(),
        });
      }
    }

    if (pendText && pendText.trim()) {
      pendenciasExistentes.push({
        reportId: r.id,
        userName: r.userName,
        dateKey: r.dateKey,
        text: pendText.trim(),
      });
    }
  }

  // 3. Estatísticas das tarefas registradas no CopperOS para o setor
  const tasksStats = {
    total: departmentTasks.length,
    completed: departmentTasks.filter(t => t.status === 'Concluída').length,
    inProgress: departmentTasks.filter(t => t.status === 'Em andamento').length,
    pending: departmentTasks.filter(t => t.status === 'Pendente').length,
  };

  const principaisEntregas = [
    ...atividadesRealizadas.slice(0, 6).map(a => `${a.userName} (${a.dateKey}): ${a.text}`),
    ...(tasksStats.completed > 0
      ? [`${tasksStats.completed} tarefa(s) concluída(s) no sistema CopperOS no período.`]
      : []),
  ];

  const atencaoGestor: string[] = [];
  if (bloqueiosOperacionais.length > 0) {
    for (const b of bloqueiosOperacionais) {
      atencaoGestor.push(`Bloqueio operacional relatado por ${b.userName} (${b.dateKey}): ${b.text}`);
    }
  }
  if (problemasRelatados.length > bloqueiosOperacionais.length) {
    atencaoGestor.push(
      `${problemasRelatados.length} ocorrência(s)/dificuldade(s) relatada(s) no período exigem acompanhamento.`
    );
  }
  if (missingEmployees.length > 0) {
    atencaoGestor.push(
      `Ausência de informação: ${missingEmployees.map(m => m.name).join(', ')} ainda não enviou(aram) relatório no período.`
    );
  }
  if (atencaoGestor.length === 0) {
    atencaoGestor.push('Nenhum bloqueio crítico ou desvio operacional pendente de escalonamento.');
  }

  const periodLabel =
    startDate === endDate ? `${startDate} (${periodType})` : `${startDate} a ${endDate} (${periodType})`;

  let summaryText = [
    `SÍNTESE DEPARTAMENTAL — ${departmentName.toUpperCase()}`,
    `• Período analisado: ${periodLabel}`,
    `• Relatórios recebidos: ${reports.length} registro(s) de ${submittedEmployees.length} colaborador(es)`,
    `• Cobertura de informação: ${
      missingEmployees.length === 0
        ? '100% dos colaboradores do setor enviaram relatório no período.'
        : `Ausência de informação registrada para ${missingEmployees.length} colaborador(es): ${missingEmployees
            .map(m => m.name)
            .join(', ')} (observação: ausência de envio não significa ausência de trabalho).`
    }`,
    ``,
    `1. Principais Entregas e Atividades Realizadas:`,
    principaisEntregas.length > 0
      ? principaisEntregas.map(e => `   • ${e}`).join('\n')
      : '   • Nenhuma atividade relatada no intervalo selecionado.',
    ``,
    `2. Problemas Relatados:`,
    problemasRelatados.length > 0
      ? problemasRelatados.map(p => `   • [${p.dateKey} — ${p.userName}] ${p.text}`).join('\n')
      : '   • Nenhum problema ou desvio operacional relatado.',
    ``,
    `3. Bloqueios Operacionais:`,
    bloqueiosOperacionais.length > 0
      ? bloqueiosOperacionais.map(b => `   • [${b.dateKey} — ${b.userName}] ${b.text}`).join('\n')
      : '   • Nenhum bloqueio operacional ativo.',
    ``,
    `4. Pendências Existentes (Passagem de Turno / Próximo Período):`,
    pendenciasExistentes.length > 0
      ? pendenciasExistentes.map(p => `   • [${p.dateKey} — ${p.userName}] ${p.text}`).join('\n')
      : '   • Sem pendências abertas declaradas nos relatórios.',
    ``,
    `5. Informações que Exigem Atenção do Gestor:`,
    atencaoGestor.map(a => `   • ${a}`).join('\n'),
  ].join('\n');

  // Enriquecimento opcional por LLM quando GEMINI_API_KEY estiver configurada
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && reports.length > 0) {
    try {
      const prompt = [
        `Você é o Copiloto Operacional do CopperOS. Gere um parágrafo executivo inicial (máximo 4 frases) para a Síntese Departamental do setor "${departmentName}" no período ${periodLabel}.`,
        `Regras: Use apenas os dados reais abaixo. Se houver funcionários sem envio (${missingEmployees.map(m => m.name).join(', ')}), trate estritamente como ausência de informação e nunca como ausência de trabalho.`,
        `Atividades: ${JSON.stringify(atividadesRealizadas)}`,
        `Problemas: ${JSON.stringify(problemasRelatados)}`,
        `Pendências: ${JSON.stringify(pendenciasExistentes)}`,
      ].join('\n');

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 280 },
          }),
        }
      );
      if (resp.ok) {
        const data: any = await resp.json();
        const aiIntro = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (aiIntro) {
          summaryText += `\n\n6. Análise Sintética da IA:\n   ${aiIntro}`;
        }
      }
    } catch {
      // Mantém o resumo estruturado determinístico
    }
  }

  const sources = reports.map(r => ({
    reportId: r.id,
    userId: r.userId || null,
    userName: r.userName,
    departmentId: r.departmentId || departmentId,
    departmentName: r.departmentName || departmentName,
    dateKey: r.dateKey,
    turno: r.turno,
  }));

  return {
    summaryText,
    highlights: {
      reportsReceivedCount: reports.length,
      submittedEmployees,
      missingEmployees,
      atividadesRealizadas,
      principaisEntregas,
      problemasRelatados,
      pendenciasExistentes,
      bloqueiosOperacionais,
      atencaoGestor,
      tasksStats,
    },
    sources,
  };
}

export interface ExecutiveAnalysisInput {
  companyId: string;
  query?: string;
  startDate: string;
  endDate: string;
  compareStartDate: string;
  compareEndDate: string;
  periodType: string;
  departments: Array<{ id: string; code: string; name: string }>;
  allUsers: Array<{ id: string; name: string; email: string; role: string; departmentId?: string | null; department?: string | null }>;
  currentReports: any[];
  previousReports: any[];
  allTasks: Array<{ id: string; title: string; status: string; priority: string; dueDate: string; departmentId?: string | null; targetDepartmentId?: string | null }>;
}

export interface ExecutiveAnalysisResult {
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
    departmentId: string;
    departmentName: string;
    missingEmployees: string[];
    note: string;
  }>;
  sources: Array<{
    reportId: string;
    userId: string | null;
    userName: string;
    departmentId: string | null;
    departmentName: string;
    dateKey: string;
    turno: string;
    excerpt: string;
  }>;
}

/**
 * Motor Analítico Executivo Exclusivo do André (Seção 10):
 * - Consolida todos os departamentos da empresa
 * - Identifica padrões recorrentes, problemas importantes e pendências
 * - Compara períodos e departamentos
 * - Informa dados ausentes/insuficientes sem avaliação subjetiva de produtividade individual
 * - Mantém rastreabilidade completa dos relatórios originais utilizados (sources)
 */
export async function generateExecutiveAnalytics(
  input: ExecutiveAnalysisInput
): Promise<ExecutiveAnalysisResult> {
  const {
    companyId,
    query = 'Faça uma síntese executiva consolidada do período',
    startDate,
    endDate,
    compareStartDate,
    compareEndDate,
    periodType,
    departments,
    allUsers,
    currentReports,
    previousReports,
    allTasks,
  } = input;

  // 1. Consolida cada departamento individualmente
  const departmentComparison: ExecutiveAnalysisResult['departmentComparison'] = [];
  const informationGaps: ExecutiveAnalysisResult['informationGaps'] = [];

  const allCurrentProblems: Array<{
    reportId: string;
    userName: string;
    departmentName: string;
    dateKey: string;
    text: string;
    isBlock: boolean;
  }> = [];

  const allCurrentPendings: Array<{
    reportId: string;
    userName: string;
    departmentName: string;
    dateKey: string;
    text: string;
  }> = [];

  const allCurrentActivities: Array<{
    reportId: string;
    userName: string;
    departmentName: string;
    dateKey: string;
    text: string;
  }> = [];

  for (const dep of departments) {
    const depUsers = allUsers.filter(u => u.departmentId === dep.id);
    const depReports = currentReports.filter(r => r.departmentId === dep.id);
    const depTasks = allTasks.filter(
      t => t.departmentId === dep.id || t.targetDepartmentId === dep.id
    );

    const cons = await consolidateDepartmentPeriod({
      companyId,
      departmentId: dep.id,
      departmentName: dep.name,
      startDate,
      endDate,
      periodType,
      requesterRole: 'CEO',
      reports: depReports,
      departmentUsers: depUsers,
      departmentTasks: depTasks,
    });

    for (const p of cons.highlights.problemasRelatados) {
      allCurrentProblems.push({
        ...p,
        departmentName: dep.name,
        isBlock: cons.highlights.bloqueiosOperacionais.some(b => b.reportId === p.reportId),
      });
    }
    for (const pend of cons.highlights.pendenciasExistentes) {
      allCurrentPendings.push({
        ...pend,
        departmentName: dep.name,
      });
    }
    for (const act of cons.highlights.atividadesRealizadas) {
      allCurrentActivities.push({
        ...act,
        departmentName: dep.name,
      });
    }

    departmentComparison.push({
      departmentId: dep.id,
      departmentCode: dep.code,
      departmentName: dep.name,
      employeesCount: depUsers.length,
      reportsCount: depReports.length,
      submittedEmployeesCount: cons.highlights.submittedEmployees.length,
      missingEmployeesCount: cons.highlights.missingEmployees.length,
      problemsCount: cons.highlights.problemasRelatados.length,
      operationalBlocksCount: cons.highlights.bloqueiosOperacionais.length,
      pendingItemsCount: cons.highlights.pendenciasExistentes.length,
      tasksCompletedCount: cons.highlights.tasksStats.completed,
      tasksOpenCount: cons.highlights.tasksStats.inProgress + cons.highlights.tasksStats.pending,
    });

    if (depUsers.length > 0 && cons.highlights.missingEmployees.length > 0) {
      informationGaps.push({
        departmentId: dep.id,
        departmentName: dep.name,
        missingEmployees: cons.highlights.missingEmployees.map(m => m.name),
        note:
          depReports.length === 0
            ? 'Setor sem relatórios enviados neste intervalo (ausência de informação).'
            : `${cons.highlights.missingEmployees.length} colaborador(es) sem envio registrado no período.`,
      });
    }
  }

  // Ordena departamentos por quantidade de impedimentos/problemas relatados
  departmentComparison.sort(
    (a, b) =>
      b.operationalBlocksCount - a.operationalBlocksCount ||
      b.problemsCount - a.problemsCount ||
      b.reportsCount - a.reportsCount
  );

  // 2. Contabiliza o período anterior para comparação
  let prevProblemsCount = 0;
  let prevBlocksCount = 0;
  let prevPendingCount = 0;

  for (const r of previousReports) {
    const prob = r.pergunta2 || '';
    const pend = r.pergunta3 || '';
    if (prob && !isNeutralProblemText(prob)) {
      prevProblemsCount++;
      if (isOperationalBlockText(prob)) prevBlocksCount++;
    }
    if (pend && pend.trim()) {
      prevPendingCount++;
    }
  }

  const currentProblemsCount = allCurrentProblems.length;
  const currentBlocksCount = allCurrentProblems.filter(p => p.isBlock).length;
  const currentPendingCount = allCurrentPendings.length;

  const diffProblems = currentProblemsCount - prevProblemsCount;
  const deltaSummary =
    previousReports.length === 0
      ? `Período atual (${startDate} a ${endDate}) possui ${currentReports.length} relatório(s) e ${currentProblemsCount} problema(s) relatado(s). Não há registros suficientes no período anterior (${compareStartDate} a ${compareEndDate}) para comparação histórica direta.`
      : `Comparando ${startDate}..${endDate} (${currentReports.length} relatórios, ${currentProblemsCount} impedimentos) com ${compareStartDate}..${compareEndDate} (${previousReports.length} relatórios, ${prevProblemsCount} impedimentos): variação de ${diffProblems >= 0 ? `+${diffProblems}` : diffProblems} ocorrência(s) operacional(is).`;

  // 3. Detecta padrões recorrentes e gargalos entre relatórios e departamentos
  const patternDefinitions = [
    {
      theme: 'Metrologia / Balanças / Trava RN-16 (BAL-FUN-02)',
      regex: /bal-fun-02|rn-16|recalibra|rbc|balan[cç]a|inmetro/i,
    },
    {
      theme: 'Fornos de Indução / Aquecimento / Barramentos',
      regex: /forno|barramento|termografia|refrat[aá]rio|aquecimento|fus[aã]o/i,
    },
    {
      theme: 'Fluxo de Pátio / Carretas / Triagem de Sucata',
      regex: /carreta|fila|sucata|cobre\s*mel|catodo|triagem|p[aá]tio/i,
    },
    {
      theme: 'Qualidade Metalúrgica / Ensaios ASTM B49 / Condutividade',
      regex: /astm\s*b49|espectrometr|iacs|oxig[eê]nio|pureza|corrida/i,
    },
  ];

  const recurringPatterns: ExecutiveAnalysisResult['recurringPatterns'] = [];

  for (const pat of patternDefinitions) {
    const matchedReports = currentReports.filter(r => {
      const combined = `${r.pergunta1 || ''} ${r.pergunta2 || ''} ${r.pergunta3 || ''} ${r.answersJson || ''}`;
      return pat.regex.test(combined);
    });

    if (matchedReports.length > 0) {
      const depts = Array.from(
        new Set(matchedReports.map(r => r.departmentName || 'Setor Operacional'))
      );
      recurringPatterns.push({
        theme: pat.theme,
        occurrences: matchedReports.length,
        departmentsAffected: depts,
        description: `Identificado em ${matchedReports.length} relatório(s) abrangendo ${depts.join(', ')}.`,
        sourceReportIds: matchedReports.map(r => r.id),
      });
    }
  }

  recurringPatterns.sort((a, b) => b.occurrences - a.occurrences);

  // 4. Fontes rastreáveis com trecho (excerpt) real
  const sources: ExecutiveAnalysisResult['sources'] = currentReports.map(r => ({
    reportId: r.id,
    userId: r.userId || null,
    userName: r.userName,
    departmentId: r.departmentId || null,
    departmentName: r.departmentName || 'Setor Operacional',
    dateKey: r.dateKey,
    turno: r.turno,
    excerpt:
      r.aiIndividualSummary ||
      r.resumoAutomatico ||
      `${r.pergunta1 || ''} | ${r.pergunta2 || ''}`.slice(0, 180),
  }));

  // 5. Constrói a resposta fundamentada para a pergunta analítica do André
  const qNorm = query.toLowerCase();
  const deptsWithProblems = departmentComparison.filter(d => d.problemsCount > 0);

  let answerMarkdown = [
    `### Análise Executiva Fundamentada — CopperOS`,
    `**Consulta:** *"${query}"*`,
    `**Janela analisada:** \`${startDate}\` a \`${endDate}\` (${currentReports.length} relatórios originais auditados em ${departments.length} departamentos).`,
    ``,
    `#### 1. Principais Problemas e Bloqueios Operacionais`,
    allCurrentProblems.length > 0
      ? allCurrentProblems
          .map(
            p =>
              `- **[${p.departmentName} — ${p.dateKey}]** (${p.userName}): ${p.text} ${
                p.isBlock ? '`[BLOQUEIO OPERACIONAL]`' : ''
              }`
          )
          .join('\n')
      : `- Nenhum impedimento ou problema operacional foi relatado nos relatórios enviados neste intervalo.`,
    ``,
    `#### 2. Departamentos com Mais Impedimentos no Período`,
    deptsWithProblems.length > 0
      ? deptsWithProblems
          .map(
            d =>
              `- **${d.departmentName} (${d.departmentCode}):** ${d.problemsCount} impedimento(s), sendo ${d.operationalBlocksCount} bloqueio(s) operacional(is) (${d.reportsCount} relatório(s) recebido(s)).`
          )
          .join('\n')
      : `- Nenhum departamento registrou impedimentos no período selecionado.`,
    ``,
    `#### 3. Padrões Recorrentes e Pendências que se Repetiram`,
    recurringPatterns.length > 0
      ? recurringPatterns
          .map(
            rp =>
              `- **${rp.theme}:** ${rp.occurrences} ocorrência(s) transversal(is) nos setores *${rp.departmentsAffected.join(', ')}*.`
          )
          .join('\n')
      : `- Sem padrões críticos repetidos detectados no intervalo.`,
    allCurrentPendings.length > 0
      ? `\n**Pendências declaradas para continuidade:**\n` +
        allCurrentPendings
          .map(p => `- **[${p.departmentName} — ${p.dateKey}]** (${p.userName}): ${p.text}`)
          .join('\n')
      : '',
    ``,
    `#### 4. Comparativo entre Períodos`,
    `- ${deltaSummary}`,
    ``,
    `#### 5. Dados Ausentes / Cobertura de Informação`,
    informationGaps.length > 0
      ? informationGaps
          .map(
            g =>
              `- **${g.departmentName}:** ${g.note} Colaboradores sem envio no intervalo: ${g.missingEmployees.join(', ')}. *(Nota: tratado estritamente como ausência de informação, sem juízo subjetivo de produtividade).*`
          )
          .join('\n')
      : `- Cobertura completa: todos os colaboradores ativos com perfil nos setores analisados enviaram relatório.`,
  ]
    .filter(Boolean)
    .join('\n');

  // Se houver GEMINI_API_KEY ou OPENAI_API_KEY, gera resposta analítica customizada mantendo as citações reais
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && (currentReports.length > 0 || previousReports.length > 0)) {
    try {
      const llmPrompt = [
        'Você é o Copiloto Executivo exclusivo do André (CEO da Copper Group). Responda em português de forma executiva, objetiva e estritamente fundamentada nos dados reais abaixo.',
        'Regras obrigatórias:',
        '1. Nunca invente fatos; cite sempre a data, o departamento e o nome do autor do relatório.',
        '2. Identifique padrões recorrentes, gargalos operacionais e pendências.',
        '3. Informe explicitamente dados ausentes ou departamentos sem relatórios como AUSÊNCIA DE INFORMAÇÃO, nunca como ausência de trabalho.',
        '4. PROIBIDO emitir avaliações subjetivas sobre produtividade individual ou ranking de funcionários.',
        `Pergunta do André: "${query}"`,
        `Período atual (${startDate} a ${endDate}): ${JSON.stringify(sources)}`,
        `Problemas extraídos: ${JSON.stringify(allCurrentProblems)}`,
        `Pendências extraídas: ${JSON.stringify(allCurrentPendings)}`,
        `Comparativo com período anterior (${compareStartDate} a ${compareEndDate}): ${deltaSummary}`,
        `Lacunas de informação: ${JSON.stringify(informationGaps)}`,
      ].join('\n');

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: llmPrompt }] }],
            generationConfig: { temperature: 0.15, maxOutputTokens: 700 },
          }),
        }
      );
      if (resp.ok) {
        const data: any = await resp.json();
        const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (aiText) {
          answerMarkdown = aiText + '\n\n---\n' + answerMarkdown;
        }
      }
    } catch {
      // Mantém resposta analítica estruturada determinística
    }
  } else if (qNorm.includes('ontem') && allCurrentActivities.length > 0) {
    answerMarkdown =
      `### Síntese Direta das Atividades (${startDate} a ${endDate})\n` +
      allCurrentActivities
        .map(a => `- **[${a.departmentName}] ${a.userName} (${a.dateKey}):** ${a.text}`)
        .join('\n') +
      `\n\n` +
      answerMarkdown;
  }

  return {
    queryAnswered: query,
    answerMarkdown,
    executiveSummaryText: answerMarkdown.replace(/[#*`]/g, ''),
    departmentComparison,
    periodComparison: {
      currentPeriod: {
        startDate,
        endDate,
        reportsCount: currentReports.length,
        problemsCount: currentProblemsCount,
        blocksCount: currentBlocksCount,
        pendingCount: currentPendingCount,
      },
      previousPeriod: {
        startDate: compareStartDate,
        endDate: compareEndDate,
        reportsCount: previousReports.length,
        problemsCount: prevProblemsCount,
        blocksCount: prevBlocksCount,
        pendingCount: prevPendingCount,
      },
      deltaSummary,
    },
    recurringPatterns,
    informationGaps,
    sources,
  };
}
