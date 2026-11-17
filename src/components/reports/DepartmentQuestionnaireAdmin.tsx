import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Plus,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Sparkles,
  Building2,
  Pencil,
  Save,
  X,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import {
  DepartmentQuestionItem,
  DepartmentWithQuestionnaireStats,
  questionnaireApi,
} from '../../services/questionnaireApi';
import { soundEngine } from '../../services/soundEngine';

export const DepartmentQuestionnaireAdmin: React.FC = () => {
  const { user, currentCompanyId } = useCopperOS();
  const isCeo = user.role === 'CEO';

  const [departments, setDepartments] = useState<DepartmentWithQuestionnaireStats[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(
    user.departmentId || 'dep-cg-producao'
  );
  const [questions, setQuestions] = useState<DepartmentQuestionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Formulário de nova pergunta
  const [newPrompt, setNewPrompt] = useState<string>('');
  const [newRequired, setNewRequired] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Edição inline de pergunta
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<string>('');

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3200);
  };

  const loadDepartments = async () => {
    try {
      const res = await questionnaireApi.listDepartments(currentCompanyId || 'emp-copper-group');
      setDepartments(res.departments || []);
      if (res.departments && res.departments.length > 0) {
        const accessible = isCeo
          ? res.departments
          : res.departments.filter(d => d.id === user.departmentId);
        const firstValid =
          accessible.find(d => d.id === selectedDeptId) || accessible[0] || res.departments[0];
        if (firstValid && firstValid.id !== selectedDeptId) {
          setSelectedDeptId(firstValid.id);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao carregar departamentos.');
    }
  };

  const loadQuestions = async (deptId: string) => {
    if (!deptId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await questionnaireApi.getDepartmentQuestions(deptId, isCeo);
      setQuestions(res.questions || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sem permissão ou erro ao carregar questionário do setor.');
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, [currentCompanyId, user.id, user.role]);

  useEffect(() => {
    if (selectedDeptId) {
      loadQuestions(selectedDeptId);
    }
  }, [selectedDeptId, user.id, user.role]);

  const selectedDept = departments.find(d => d.id === selectedDeptId);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCeo || !newPrompt.trim() || !selectedDeptId) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await questionnaireApi.createQuestion(selectedDeptId, {
        prompt: newPrompt.trim(),
        required: newRequired,
        active: true,
      });
      soundEngine.playSuccess();
      setQuestions(prev => [...prev, created].sort((a, b) => a.order - b.order));
      setNewPrompt('');
      setNewRequired(true);
      loadDepartments();
      showToast('Nova pergunta adicionada ao questionário do departamento.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao cadastrar pergunta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (q: DepartmentQuestionItem) => {
    if (!isCeo) return;
    try {
      const updated = await questionnaireApi.updateQuestion(q.id, {
        active: !q.active,
      });
      soundEngine.playClick();
      setQuestions(prev => prev.map(item => (item.id === q.id ? updated : item)));
      loadDepartments();
      showToast(
        updated.active
          ? 'Pergunta reativada no questionário diário.'
          : 'Pergunta desativada (respostas históricas permanecem preservadas).'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao alterar status da pergunta.');
    }
  };

  const handleToggleRequired = async (q: DepartmentQuestionItem) => {
    if (!isCeo) return;
    try {
      const updated = await questionnaireApi.updateQuestion(q.id, {
        required: !q.required,
      });
      soundEngine.playClick();
      setQuestions(prev => prev.map(item => (item.id === q.id ? updated : item)));
      showToast(
        updated.required
          ? 'Marcada como pergunta obrigatória.'
          : 'Marcada como pergunta opcional.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao atualizar obrigatoriedade.');
    }
  };

  const handleSaveEdit = async (questionId: string) => {
    if (!isCeo || !editingPrompt.trim()) return;
    try {
      const updated = await questionnaireApi.updateQuestion(questionId, {
        prompt: editingPrompt.trim(),
      });
      soundEngine.playSuccess();
      setQuestions(prev => prev.map(item => (item.id === questionId ? updated : item)));
      setEditingId(null);
      setEditingPrompt('');
      showToast('Enunciado atualizado (relatórios anteriores mantêm o texto histórico original).');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao salvar edição.');
    }
  };

  const handleMoveOrder = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!isCeo) return;
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    const reordered = [...questions];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    const orderedIds = reordered.map(q => q.id);
    // Atualização otimista
    setQuestions(reordered.map((q, idx) => ({ ...q, order: idx + 1 })));
    soundEngine.playClick();

    try {
      const res = await questionnaireApi.reorderQuestions(selectedDeptId, orderedIds);
      if (res.questions) {
        setQuestions(res.questions);
      }
      showToast('Ordem das perguntas atualizada.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao reordenar perguntas.');
      loadQuestions(selectedDeptId);
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho Explicativo + Selo RBAC */}
      <div className="bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
                  Questionários Dinâmicos por Departamento
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isCeo ? 'Nível 3 — Administração André (CEO)' : `Leitura (${user.role})`}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Personalize as perguntas de final de expediente de cada departamento. Alterações futuras preservam 100% do histórico já respondido.
              </p>
            </div>
          </div>

          {feedbackMsg && (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}
        </div>

        {!isCeo && (
          <div className="mt-4 flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              A criação e personalização de questionários por departamento é restrita ao <strong>André (CEO)</strong> e validada no backend. Você está visualizando o questionário ativo do seu setor.
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Coluna Esquerda: Lista de Departamentos */}
        <div className="lg:col-span-4 bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-500" />
              Departamentos ({departments.length})
            </span>
          </div>

          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
            {departments.map(dep => {
              const isSelected = dep.id === selectedDeptId;
              const isLockedForUser = !isCeo && dep.id !== user.departmentId;

              return (
                <button
                  key={dep.id}
                  type="button"
                  disabled={isLockedForUser}
                  onClick={() => {
                    soundEngine.playClick();
                    setSelectedDeptId(dep.id);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-white shadow-2xs'
                      : isLockedForUser
                        ? 'opacity-45 cursor-not-allowed bg-gray-50 dark:bg-night-950 border-gray-200/60 dark:border-night-800/60'
                        : 'bg-gray-50/70 dark:bg-night-950/60 border-gray-200/70 dark:border-night-800 hover:border-emerald-500/30 cursor-pointer'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-200/70 dark:bg-night-800 text-gray-600 dark:text-gray-400">
                        {dep.code}
                      </span>
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {dep.name}
                      </p>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      {dep.activeQuestionsCount} ativa(s) de {dep.totalQuestionsCount} • {dep.employeesCount} colab.
                    </p>
                  </div>

                  {isLockedForUser ? (
                    <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-200 dark:bg-night-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {dep.activeQuestionsCount}Q
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Coluna Direita: Perguntas do Departamento Selecionado */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-night-800 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Questionário Ativo do Setor
                </span>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                  {selectedDept?.name || 'Departamento Selecionado'}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>
                  {questions.filter(q => q.active).length} perguntas ativas •{' '}
                  {questions.filter(q => q.active && q.required).length} obrigatórias
                </span>
              </div>
            </div>

            {/* Formulário de Nova Pergunta (Somente André / CEO) */}
            {isCeo && (
              <form
                onSubmit={handleAddQuestion}
                className="p-4 rounded-xl bg-gray-50 dark:bg-night-950 border border-gray-200/80 dark:border-night-800 space-y-3"
              >
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Adicionar nova pergunta para {selectedDept?.name}
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={newPrompt}
                    onChange={e => setNewPrompt(e.target.value)}
                    placeholder="Ex: Algum equipamento apresentou parada ou anomalia hoje?"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newRequired}
                      onChange={e => setNewRequired(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <span>Obrigatória</span>
                  </label>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newPrompt.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Pergunta</span>
                  </button>
                </div>
              </form>
            )}

            {/* Lista Ordenada de Perguntas */}
            {isLoading ? (
              <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                Carregando perguntas do departamento...
              </div>
            ) : questions.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                Nenhuma pergunta cadastrada para este departamento.
              </div>
            ) : (
              <div className="space-y-2.5">
                {questions.map((q, idx) => {
                  const isEditing = editingId === q.id;

                  return (
                    <div
                      key={q.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        q.active
                          ? 'bg-white dark:bg-night-900 border-gray-200 dark:border-night-800'
                          : 'bg-gray-50/70 dark:bg-night-950/50 border-dashed border-gray-200 dark:border-night-800 opacity-65'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingPrompt}
                                onChange={e => setEditingPrompt(e.target.value)}
                                className="flex-1 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-night-950 border border-emerald-500 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(q.id)}
                                className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                                title="Salvar enunciado"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingPrompt('');
                                }}
                                className="p-1.5 rounded-lg bg-gray-200 dark:bg-night-800 text-gray-600 dark:text-gray-300 cursor-pointer"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                              {q.prompt}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                q.required
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                  : 'bg-gray-100 dark:bg-night-800 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {q.required ? 'Obrigatória' : 'Opcional'}
                            </span>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                q.active
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-gray-200 dark:bg-night-800 text-gray-500'
                              }`}
                            >
                              {q.active ? 'Ativa no expediente' : 'Inativa (Histórico preservado)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controles de Edição e Ordem (Somente André / CEO) */}
                      {isCeo && (
                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveOrder(idx, 'UP')}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-night-800 hover:border-emerald-500 disabled:opacity-30 text-gray-600 dark:text-gray-300 cursor-pointer"
                            title="Mover para cima"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === questions.length - 1}
                            onClick={() => handleMoveOrder(idx, 'DOWN')}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-night-800 hover:border-emerald-500 disabled:opacity-30 text-gray-600 dark:text-gray-300 cursor-pointer"
                            title="Mover para baixo"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(q.id);
                              setEditingPrompt(q.prompt);
                            }}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-night-800 hover:border-emerald-500 text-gray-600 dark:text-gray-300 cursor-pointer"
                            title="Editar texto da pergunta"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleRequired(q)}
                            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-night-800 hover:border-emerald-500 text-[11px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer"
                            title="Alternar entre obrigatória e opcional"
                          >
                            {q.required ? 'Tornar Opcional' : 'Tornar Obrig.'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(q)}
                            className={`p-1.5 rounded-lg border cursor-pointer ${
                              q.active
                                ? 'border-gray-200 dark:border-night-800 text-emerald-600 hover:border-red-400'
                                : 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                            }`}
                            title={q.active ? 'Desativar pergunta' : 'Reativar pergunta'}
                          >
                            {q.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
