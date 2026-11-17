import React, { useState, useRef } from 'react';
import {
  Repeat,
  UserCheck,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Image as ImageIcon,
  UploadCloud,
  X,
  Maximize2,
  Download,
  MessageSquare,
  Send,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { RoutineTargetMode, TaskPriority, TaskStatus, TaskChecklistItem, TaskAttachment, TaskComment } from '../../types';
import { TarefasController } from './useTarefas';
import { soundEngine } from '../../services/soundEngine';
import { useCopperOS } from '../../context/CopperOSContext';
import { tasksApi } from '../../services/tasksApi';

const FIELD =
  'w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white focus:outline-none';
const ROUTINE_FIELD =
  'w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-night-800 bg-white dark:bg-night-900 text-gray-900 dark:text-white';
const LABEL = 'block font-medium text-gray-700 dark:text-gray-300 mb-1';

const TARGET_MODES: { mode: RoutineTargetMode; label: string; hint: string }[] = [
  { mode: 'DEPARTMENT', label: 'Todo o departamento', hint: 'Uma tarefa por colaborador ativo' },
  { mode: 'EMPLOYEE', label: 'Um colaborador', hint: 'Somente a pessoa informada acima' },
];

/** Presets industriais rápidos para checklists do chão de fábrica e fundição */
export const CHECKLIST_PRESETS = [
  'Inspeção da espessura do revestimento refratário do forno',
  'Teste de zero e calibração da balança rodoviária com peso-padrão',
  'Checagem de EPIs térmicos da equipe de vazamento',
  'Conferência de teor metálico e lote de sucata',
];

/**
 * Redimensiona e comprime uma foto via HTML5 Canvas para manter alta resolução
 * industrial (~1280px) sem estourar o limite de payload.
 */
export async function processImageFile(file: File): Promise<TaskAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            url: e.target?.result as string,
            size: file.size,
            type: file.type,
            createdAt: new Date().toISOString(),
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        tasksApi
          .uploadAttachment(compressedDataUrl, file.name)
          .then(uploaded => {
            resolve({
              id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: uploaded.name || file.name,
              url: uploaded.url,
              size: uploaded.size,
              type: 'image/jpeg',
              createdAt: new Date().toISOString(),
            });
          })
          .catch(() => {
            const approximateSize = Math.round((compressedDataUrl.length * 3) / 4);
            resolve({
              id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              url: compressedDataUrl,
              size: approximateSize,
              type: 'image/jpeg',
              createdAt: new Date().toISOString(),
            });
          });
      };
      img.onerror = () => reject(new Error('Falha ao processar arquivo de imagem'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Modal de criação/edição de tarefa, incluindo configuração de rotina, checklists e anexos de imagens. */
export const TaskFormModal: React.FC<{ controller: TarefasController }> = ({ controller }) => {
  const {
    isFormOpen,
    editingId,
    form,
    setForm,
    departments,
    companyEmployees,
    formDepartmentTargets,
    closeForm,
    submitForm,
  } = controller;

  const { user } = useCopperOS();
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<TaskAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isFormOpen) return null;

  const isDepartmentRoutine = form.isDaily && form.routineTargetMode === 'DEPARTMENT';

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    soundEngine.playClick();
    const comment: TaskComment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      author: user?.name || user?.email?.split('@')[0] || 'Operador',
      authorRole: user?.role,
      authorEmail: user?.email,
      content: newCommentText.trim(),
      type: 'FEEDBACK',
      createdAt: new Date().toISOString(),
    };
    setForm(prev => ({
      ...prev,
      comments: [...(prev.comments || []), comment],
    }));
    setNewCommentText('');
  };

  // Métricas do Checklist
  const totalChecklist = form.checklists?.length || 0;
  const completedChecklist = form.checklists?.filter(item => item.completed).length || 0;
  const checklistProgress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  // Ações de Checklist
  const handleAddChecklist = (customText?: string) => {
    const textToAdd = (customText || newChecklistText).trim();
    if (!textToAdd) return;

    soundEngine.playClick();
    const newItem: TaskChecklistItem = {
      id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: textToAdd,
      completed: false,
    };

    setForm(prev => ({
      ...prev,
      checklists: [...(prev.checklists || []), newItem],
    }));

    if (!customText) {
      setNewChecklistText('');
    }
  };

  const handleToggleChecklist = (id: string) => {
    soundEngine.playSwitch();
    setForm(prev => ({
      ...prev,
      checklists: (prev.checklists || []).map(item =>
        item.id === id
          ? {
              ...item,
              completed: !item.completed,
              completedAt: !item.completed ? new Date().toISOString() : undefined,
            }
          : item
      ),
    }));
  };

  const handleRemoveChecklist = (id: string) => {
    soundEngine.playClick();
    setForm(prev => ({
      ...prev,
      checklists: (prev.checklists || []).filter(item => item.id !== id),
    }));
  };

  // Ações de Anexo de Imagem
  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    soundEngine.playSwitch();

    try {
      const processed: TaskAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const attachment = await processImageFile(file);
          processed.push(attachment);
        }
      }

      setForm(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...processed],
      }));
    } catch (err) {
      console.error('[TaskFormModal] Erro ao carregar imagens:', err);
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    soundEngine.playClick();
    setForm(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter(att => att.id !== id),
    }));
  };

  return (
    <>
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingId ? 'Editar Tarefa & Checklists' : form.isDaily ? 'Nova Rotina Diária' : 'Nova Tarefa'}
        maxWidth="2xl"
      >
        <form onSubmit={submitForm} className="space-y-5 text-xs max-h-[75vh] overflow-y-auto pr-1">
          {/* Título Principal */}
          <div>
            <label className={LABEL}>Título da Tarefa *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Checklist matinal de segurança / Relatório diário de produção"
              className={`${FIELD} focus:border-emerald-500 font-semibold`}
            />
          </div>

          {/* Projeto e Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Projeto / Departamento</label>
              <input
                type="text"
                value={form.project}
                onChange={e => setForm({ ...form, project: e.target.value })}
                placeholder="Ex: Operações / Compras / Financeiro"
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL}>
                {isDepartmentRoutine ? 'Responsável (definido pelo departamento)' : 'Colaborador Responsável *'}
              </label>
              {isDepartmentRoutine ? (
                <div className="w-full px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-night-900 border border-gray-200 dark:border-night-800 text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Cada colaborador ativo do departamento</span>
                </div>
              ) : (
                <input
                  type="text"
                  required
                  value={form.assignee}
                  onChange={e => setForm({ ...form, assignee: e.target.value })}
                  placeholder="Nome do colaborador (ex: João Pedro)"
                  list="colaboradores-empresa"
                  className={FIELD}
                />
              )}
              <datalist id="colaboradores-empresa">
                <option value="Você" />
                {companyEmployees
                  .filter(employee => employee.active)
                  .map(employee => (
                    <option key={employee.id} value={employee.name}>
                      {employee.role}
                    </option>
                  ))}
              </datalist>
            </div>
          </div>

          {/* ── CARD DESTACADO: AUTOMAÇÃO DE ROTINA DIÁRIA DO GESTOR ── */}
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setForm({ ...form, isDaily: !form.isDaily })}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white text-xs flex items-center gap-1.5">
                    <span>Repetir Diariamente (Rotina Diária do Gestor)</span>
                    <span className="text-[10px] font-semibold bg-emerald-500 text-night-950 px-1.5 py-0.2 rounded">
                      Automação
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    O gestor programa uma vez e a tarefa é atribuída e cobrada todos os dias
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.isDaily}
                onChange={e => setForm({ ...form, isDaily: e.target.checked })}
                onClick={e => e.stopPropagation()}
                className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
              />
            </div>

            {form.isDaily && (
              <div className="pt-3 border-t border-emerald-500/20 space-y-3 animate-in fade-in duration-200">
                {/* ── Quem recebe a rotina ── */}
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    👥 Lançar a tarefa para
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TARGET_MODES.map(option => (
                      <button
                        key={option.mode}
                        type="button"
                        onClick={() => setForm({ ...form, routineTargetMode: option.mode })}
                        className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          form.routineTargetMode === option.mode
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-gray-200 dark:border-night-800 bg-white dark:bg-night-900 hover:border-emerald-500/40'
                        }`}
                      >
                        <div className="font-bold text-gray-900 dark:text-white text-[11px]">{option.label}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{option.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {form.routineTargetMode === 'DEPARTMENT' && (
                  <div>
                    <label className={LABEL}>🏭 Departamento de destino *</label>
                    {departments.length === 0 ? (
                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                        Esta empresa ainda não tem departamentos cadastrados.
                      </div>
                    ) : (
                      <>
                        <select
                          value={form.targetDepartmentId}
                          onChange={e => setForm({ ...form, targetDepartmentId: e.target.value })}
                          className={ROUTINE_FIELD}
                        >
                          {departments.map(department => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                        </select>

                        {formDepartmentTargets.length === 0 ? (
                          <div className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                            Nenhum colaborador ativo neste departamento — nenhuma tarefa será lançada.
                          </div>
                        ) : (
                          <div className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {formDepartmentTargets.length} colaborador(es)
                            </strong>{' '}
                            receberão esta tarefa todos os dias:{' '}
                            {formDepartmentTargets.map(target => target.name).join(' · ')}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>⏰ Horário Diário de Envio / Notificação</label>
                    <input
                      type="time"
                      value={form.dailyTime}
                      onChange={e => setForm({ ...form, dailyTime: e.target.value })}
                      className={`${ROUTINE_FIELD} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>📅 Frequência de Disparo</label>
                    <select
                      value={form.dailyWeekdaysOnly ? 'weekdays' : 'all'}
                      onChange={e => setForm({ ...form, dailyWeekdaysOnly: e.target.value === 'weekdays' })}
                      className={ROUTINE_FIELD}
                    >
                      <option value="weekdays">Dias úteis (Segunda a Sexta)</option>
                      <option value="all">Todos os dias (Inclui Fim de Semana)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={LABEL}>🛡️ Gestor Responsável pela Atribuição</label>
                  <input
                    type="text"
                    value={form.assignedBy}
                    onChange={e => setForm({ ...form, assignedBy: e.target.value })}
                    placeholder="Ex: Carlos Alencar (Gestor Operacional)"
                    className={ROUTINE_FIELD}
                  />
                </div>

                <div>
                  <label className={LABEL}>📝 Instruções Diárias / Procedimento para o Colaborador</label>
                  <textarea
                    rows={2}
                    value={form.routineDescription}
                    onChange={e => setForm({ ...form, routineDescription: e.target.value })}
                    placeholder="Ex: Realizar a contagem até às 09h e validar com os relatórios de expedição..."
                    className={ROUTINE_FIELD}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── SEÇÃO: CHECKLISTS OPERACIONAIS ── */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-night-800 bg-white dark:bg-night-900 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-bold text-xs text-gray-900 dark:text-white">
                  Checklist de Conformidade & Itens de Verificação
                </h4>
              </div>
              {totalChecklist > 0 && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {completedChecklist} de {totalChecklist} concluído(s) ({checklistProgress}%)
                </span>
              )}
            </div>

            {totalChecklist > 0 && (
              <div className="w-full h-1.5 bg-gray-100 dark:bg-night-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${checklistProgress}%` }}
                />
              </div>
            )}

            {/* Lista de itens do checklist */}
            <div className="space-y-1.5">
              {(form.checklists || []).map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-gray-50 dark:bg-night-850 border border-gray-200/60 dark:border-night-800 hover:border-emerald-500/40 transition-colors group"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleChecklist(item.id)}
                    className="flex items-center gap-2 flex-1 text-left cursor-pointer"
                  >
                    {item.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400 hover:text-gray-600 shrink-0" />
                    )}
                    <span
                      className={`text-xs ${
                        item.completed
                          ? 'line-through text-gray-400 dark:text-gray-500'
                          : 'text-gray-800 dark:text-gray-200 font-medium'
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveChecklist(item.id)}
                    className="text-gray-400 hover:text-rose-500 p-1 rounded-md opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Remover item do checklist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Input para adicionar novo item */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newChecklistText}
                onChange={e => setNewChecklistText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklist();
                  }
                }}
                placeholder="Adicionar novo item de verificação..."
                className="flex-1 px-3 py-1.5 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleAddChecklist()}
                disabled={!newChecklistText.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>

            {/* Presets Industriais Rápidos */}
            <div className="pt-2 border-t border-gray-100 dark:border-night-800">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium block mb-1.5">
                ⚡ Sugestões Rápidas de Chão de Fábrica:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CHECKLIST_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddChecklist(preset)}
                    className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-emerald-50 dark:bg-night-800 dark:hover:bg-emerald-950/40 border border-gray-200 dark:border-night-700 text-gray-600 hover:text-emerald-700 dark:text-gray-300 dark:hover:text-emerald-400 text-[10px] font-medium transition-colors cursor-pointer text-left"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── SEÇÃO: ANEXOS & EVIDÊNCIAS FOTOGRÁFICAS ── */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-night-800 bg-white dark:bg-night-900 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h4 className="font-bold text-xs text-gray-900 dark:text-white">
                  Evidências Fotográficas & Anexos de Imagem
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                {(form.attachments || []).length} imagem(ns) anexada(s)
              </span>
            </div>

            {/* Dropzone / Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 dark:border-night-800 hover:border-purple-500 dark:hover:border-purple-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-night-850/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleImageFiles(e.target.files)}
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {isUploadingImage ? 'Processando imagem...' : 'Clique ou arraste imagens aqui'}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Suporta JPEG, PNG, WebP de inspeção de forno, bilhetes de pesagem ou calibração
                </p>
              </div>
            </div>

            {/* Galeria de Thumbnails */}
            {(form.attachments || []).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {form.attachments?.map(att => (
                  <div
                    key={att.id}
                    className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-night-800 bg-gray-100 dark:bg-night-850 aspect-video flex flex-col justify-end"
                  >
                    <img
                      src={att.url}
                      alt={att.name}
                      className="absolute inset-0 w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-200"
                      onClick={() => setPreviewImage(att)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-night-950/80 via-transparent to-transparent opacity-80 pointer-events-none" />

                    <div className="relative z-10 p-1.5 flex items-center justify-between text-white text-[10px]">
                      <span className="truncate max-w-[90px] font-medium" title={att.name}>
                        {att.name}
                      </span>
                      <span className="font-mono text-gray-300">{formatBytes(att.size)}</span>
                    </div>

                    {/* Botões de Ação na Imagem */}
                    <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => setPreviewImage(att)}
                        className="p-1 rounded-md bg-night-900/80 hover:bg-night-900 text-white cursor-pointer"
                        title="Visualizar em tela cheia"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="p-1 rounded-md bg-rose-600/90 hover:bg-rose-600 text-white cursor-pointer"
                        title="Remover imagem"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prazo, Prioridade e Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Data Inicial / Prazo</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL}>Prioridade</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as TaskPriority })}
                className={FIELD}
              >
                <option value="Urgente">Urgente</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Status Inicial</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as TaskStatus })}
                className={FIELD}
              >
                <option value="Pendente">Pendente</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluída">Concluída</option>
              </select>
            </div>
          </div>

          {/* ── SEÇÃO: FEEDBACKS E HISTÓRICO DE ANDAMENTO ── */}
          {editingId && (
            <div className="p-4 rounded-xl border border-gray-200 dark:border-night-800 bg-white dark:bg-night-900 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white">
                    Feedbacks & Histórico de Andamento
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-gray-500">
                  {(form.comments || []).length} feedback(s)
                </span>
              </div>

              {/* Lista de Feedbacks */}
              {(form.comments || []).length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {form.comments?.map(c => (
                    <div
                      key={c.id}
                      className={`p-2.5 rounded-lg border text-xs ${
                        c.type === 'CONCLUSAO'
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30'
                          : 'bg-gray-50/70 dark:bg-night-850/60 border-gray-200/60 dark:border-night-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-micro text-gray-500 mb-0.5">
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {c.author} {c.authorRole && `(${c.authorRole})`}
                        </span>
                        <span className="font-mono text-gray-400">
                          {new Date(c.createdAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 py-1">
                  Nenhum feedback registrado ainda. Relate o andamento abaixo.
                </p>
              )}

              {/* Campo para Adicionar Novo Feedback */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  placeholder="Escrever feedback sobre o andamento..."
                  className="flex-1 px-3 py-1.5 text-xs bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={!newCommentText.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </div>
            </div>
          )}

          {/* Rodapé com botões de ação */}
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-night-800">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-night-800 text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-night-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold cursor-pointer shadow-xs transition-colors"
            >
              {editingId ? 'Salvar Alterações' : form.isDaily ? 'Salvar Rotina Diária' : 'Salvar Tarefa'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── LIGHTBOX / MODAL DE VISUALIZAÇÃO DE IMAGEM EM TELA CHEIA ── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-night-950/85 backdrop-blur-sm animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-night-900 border border-night-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 border-b border-night-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <span className="font-semibold text-xs truncate max-w-md">{previewImage.name}</span>
                <span className="text-[11px] font-mono text-gray-400">({formatBytes(previewImage.size)})</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.url}
                  download={previewImage.name}
                  className="p-1.5 rounded-lg bg-night-800 hover:bg-night-700 text-gray-300 hover:text-white transition-colors"
                  title="Baixar imagem"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg bg-night-800 hover:bg-rose-600/80 text-gray-300 hover:text-white transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-2 flex items-center justify-center bg-night-950 overflow-auto">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
