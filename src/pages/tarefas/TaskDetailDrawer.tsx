import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Image as ImageIcon,
  UploadCloud,
  Maximize2,
  Download,
  MessageSquare,
  Send,
  Calendar as CalendarIcon,
  UserPlus,
  Pencil,
  CheckCircle2,
  Play,
  RotateCcw,
  Repeat,
  Flame,
  AlertTriangle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Paperclip,
} from 'lucide-react';
import { TaskPriority, TaskStatus, TaskAttachment } from '../../types';
import { TarefasController } from './useTarefas';
import { formatDate, isOverdue, statusBadgeClass } from './taskModel';
import { dateKey, routineTime } from '../../domain/recurrence';
import { processImageFile, formatBytes, CHECKLIST_PRESETS } from './TaskFormModal';
import { soundEngine } from '../../services/soundEngine';
import { useCopperOS } from '../../context/CopperOSContext';

const prioritySelectClass = (priority: TaskPriority) => {
  switch (priority) {
    case 'Urgente':
      return 'bg-fuchsia-50 dark:bg-fuchsia-950/70 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300 dark:border-fuchsia-800/60';
    case 'Alta':
      return 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
    case 'Média':
      return 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
    default:
      return 'bg-gray-100 dark:bg-night-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-night-700';
  }
};

export const TaskDetailDrawer: React.FC<{ controller: TarefasController }> = ({ controller }) => {
  const {
    selectedTask: task,
    closeTaskDetail,
    openEdit,
    openReassign,
    setPendingDelete,
    changeStatus,
    changePriority,
    toggleChecklistItem,
    addChecklistItemToTask,
    removeChecklistItemFromTask,
    addAttachmentsToTask,
    removeAttachmentFromTask,
    openCompleteModal,
    submitFeedback,
  } = controller;

  const { user } = useCopperOS();
  const [newChecklistText, setNewChecklistText] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<TaskAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxList, setLightboxList] = useState<TaskAttachment[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!task) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxIndex !== null) {
          setLightboxIndex(null);
        } else {
          closeTaskDetail();
        }
      } else if (lightboxIndex !== null && lightboxList.length > 1) {
        if (e.key === 'ArrowRight') {
          setLightboxIndex(prev => (prev !== null ? (prev + 1) % lightboxList.length : null));
        } else if (e.key === 'ArrowLeft') {
          setLightboxIndex(prev =>
            prev !== null ? (prev - 1 + lightboxList.length) % lightboxList.length : null
          );
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [task, lightboxIndex, lightboxList.length, closeTaskDetail]);

  if (!task) return null;

  const today = dateKey(new Date());
  const overdue = isOverdue(task);
  const checklists = task.checklists || [];
  const completedCount = checklists.filter(c => c.completed).length;
  const checklistPct = checklists.length > 0 ? Math.round((completedCount / checklists.length) * 100) : 0;
  const attachments = task.attachments || [];
  const comments = task.comments || [];

  const openLightbox = (list: TaskAttachment[], index: number) => {
    soundEngine.playClick();
    setLightboxList(list);
    setLightboxIndex(index);
  };

  const handleToggleItem = (itemId: string) => {
    soundEngine.playSwitch();
    toggleChecklistItem(task.id, itemId);
  };

  const handleAddChecklist = async (textOverride?: string) => {
    const text = (textOverride ?? newChecklistText).trim();
    if (!text) return;
    soundEngine.playClick();
    await addChecklistItemToTask(task.id, text);
    if (!textOverride) setNewChecklistText('');
  };

  const handleUploadEvidence = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    soundEngine.playSwitch();
    try {
      const processed: TaskAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          const att = await processImageFile(files[i]);
          processed.push(att);
        }
      }
      if (processed.length > 0) {
        await addAttachmentsToTask(task.id, processed);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCommentFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const processed: TaskAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          const att = await processImageFile(files[i]);
          processed.push(att);
        }
      }
      setCommentAttachments(prev => [...prev, ...processed]);
    } finally {
      setIsUploading(false);
      if (commentFileInputRef.current) commentFileInputRef.current.value = '';
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && commentAttachments.length === 0) return;
    setIsSendingComment(true);
    soundEngine.playSuccess();
    try {
      await submitFeedback(task.id, {
        author: user?.name || user?.email?.split('@')[0] || 'Operador',
        authorRole: user?.role || 'Equipe',
        authorEmail: user?.email,
        content: commentText.trim() || 'Evidência anexada ao histórico.',
        attachments: commentAttachments,
      });
      setCommentText('');
      setCommentAttachments([]);
    } finally {
      setIsSendingComment(false);
    }
  };

  const currentLightboxItem =
    lightboxIndex !== null && lightboxList[lightboxIndex] ? lightboxList[lightboxIndex] : null;

  return (
    <>
      <div
        className="fixed inset-0 z-[90] flex justify-end bg-night-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={closeTaskDetail}
      >
        <aside
          aria-label={`Detalhes da tarefa: ${task.title}`}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-white dark:bg-night-900 border-l border-gray-200 dark:border-night-800 h-full flex flex-col shadow-2xl overflow-hidden"
        >
          {/* ── Cabeçalho Superior Fixo ── */}
          <div className="px-5 py-4 border-b border-gray-200/80 dark:border-night-800 flex items-center justify-between gap-3 bg-gray-50/60 dark:bg-night-950/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg text-micro font-bold bg-gray-200/70 dark:bg-night-800 text-gray-700 dark:text-gray-300">
                {task.project}
              </span>

              {(task.isDaily || task.sourceRoutineId) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-micro font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <Repeat className="w-3 h-3" />
                  <span>{task.isDaily ? `Rotina (${routineTime(task)})` : 'Gerada por Rotina'}</span>
                </span>
              )}

              {/* Seletor Rápido de Status */}
              <select
                value={task.status}
                onChange={e => changeStatus(task, e.target.value as TaskStatus)}
                aria-label="Status da tarefa"
                className={`px-2.5 py-1 rounded-lg text-micro font-bold border cursor-pointer focus:outline-none ${statusBadgeClass(
                  task.status
                )}`}
              >
                <option value="Pendente">Pendente</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluída">Concluída</option>
              </select>

              {/* Seletor Rápido de Prioridade */}
              <select
                value={task.priority}
                onChange={e => changePriority(task, e.target.value as TaskPriority)}
                aria-label="Prioridade da tarefa"
                className={`px-2.5 py-1 rounded-lg text-micro font-bold border cursor-pointer focus:outline-none ${prioritySelectClass(
                  task.priority
                )}`}
              >
                <option value="Urgente">🚨 Urgente</option>
                <option value="Alta">🔥 Alta</option>
                <option value="Média">⚡ Média</option>
                <option value="Baixa">Baixa</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => openEdit(task)}
                title="Abrir editor completo"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-night-800 hover:border-emerald-500 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-colors cursor-pointer bg-white dark:bg-night-850"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Editar</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(task)}
                title="Excluir tarefa"
                className="p-1.5 rounded-xl border border-gray-200 dark:border-night-800 hover:border-rose-500 hover:text-rose-500 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer bg-white dark:bg-night-850"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={closeTaskDetail}
                title="Fechar painel (Esc)"
                className="p-1.5 rounded-xl border border-gray-200 dark:border-night-800 hover:bg-gray-100 dark:hover:bg-night-800 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Corpo Rolável do Drawer ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
            {/* Título & Metadados Principais */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h2
                  className={`text-base sm:text-lg font-black leading-snug text-gray-900 dark:text-white ${
                    task.status === 'Concluída' ? 'line-through text-gray-400 dark:text-gray-500' : ''
                  }`}
                >
                  {task.title}
                </h2>
                {task.priority === 'Urgente' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-fuchsia-600 text-white shadow-sm animate-pulse shrink-0">
                    <Flame className="w-3.5 h-3.5" />
                    <span>URGENTE</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-gray-50/80 dark:bg-night-850/70 border border-gray-200/70 dark:border-night-800">
                {/* Responsável */}
                <div className="flex items-center justify-between sm:block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Responsável
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                      {task.assignee.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white truncate">{task.assignee}</span>
                    <button
                      type="button"
                      onClick={() => openReassign(task)}
                      title="Delegar para outra pessoa"
                      className="text-emerald-600 dark:text-emerald-400 hover:underline text-[11px] font-semibold inline-flex items-center gap-0.5 cursor-pointer ml-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Delegar</span>
                    </button>
                  </div>
                </div>

                {/* Prazo */}
                <div className="flex items-center justify-between sm:block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Prazo Limite
                  </span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <CalendarIcon
                      className={`w-3.5 h-3.5 ${
                        overdue ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    />
                    <span
                      className={`font-bold ${
                        overdue
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {task.dueDate === today ? 'Hoje' : formatDate(task.dueDate)}
                    </span>
                    {overdue && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Atrasada
                      </span>
                    )}
                  </div>
                </div>

                {/* Gestor / Origem */}
                <div className="flex items-center justify-between sm:block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Atribuído por
                  </span>
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-semibold truncate">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">{task.assignedBy || 'Gestão Operacional'}</span>
                  </div>
                </div>
              </div>

              {task.routineDescription && (
                <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 text-gray-700 dark:text-gray-200 leading-relaxed">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">
                    📋 Procedimento / Instrução Operacional:
                  </span>
                  {task.routineDescription}
                </div>
              )}
            </div>

            {/* ── SEÇÃO 1: CHECKLIST INTERATIVO 1-CLIQUE ── */}
            <div className="p-4 rounded-2xl border border-gray-200/80 dark:border-night-800 bg-white dark:bg-night-900 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-xs">
                    Checklist de Execução (1-Clique)
                  </h3>
                </div>
                <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {completedCount}/{checklists.length} ({checklistPct}%)
                </span>
              </div>

              {checklists.length > 0 && (
                <div className="w-full h-2 bg-gray-100 dark:bg-night-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${checklistPct}%` }}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                {checklists.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all group ${
                      item.completed
                        ? 'bg-emerald-50/30 dark:bg-emerald-950/15 border-emerald-500/25'
                        : 'bg-gray-50/70 dark:bg-night-850 border-gray-200/70 dark:border-night-800 hover:border-emerald-500/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleItem(item.id)}
                      className="flex items-start gap-2.5 flex-1 text-left cursor-pointer"
                    >
                      {item.completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span
                          className={`block leading-snug ${
                            item.completed
                              ? 'line-through text-gray-400 dark:text-gray-500'
                              : 'text-gray-900 dark:text-gray-100 font-medium'
                          }`}
                        >
                          {item.text}
                        </span>
                        {item.completed && item.completedAt && (
                          <span className="text-[10px] font-mono text-emerald-600/80 dark:text-emerald-400/80">
                            Verificado às{' '}
                            {new Date(item.completedAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => removeChecklistItemFromTask(task.id, item.id)}
                      title="Remover item"
                      className="p-1 rounded-lg text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {checklists.length === 0 && (
                  <p className="text-[11px] text-gray-400 py-2 text-center font-mono">
                    Nenhum item de verificação cadastrado ainda. Adicione abaixo.
                  </p>
                )}
              </div>

              {/* Adicionar novo item rápido direto no Drawer */}
              <div className="pt-1 space-y-2">
                <div className="flex items-center gap-2">
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
                    placeholder="Adicionar item ao checklist e pressionar Enter..."
                    className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddChecklist()}
                    disabled={!newChecklistText.trim()}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Incluir</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowPresets(prev => !prev)}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
                  >
                    {showPresets ? 'Ocultar sugestões industriais' : '⚡ Ver sugestões rápidas de chão de fábrica'}
                  </button>
                </div>

                {showPresets && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {CHECKLIST_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAddChecklist(preset)}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-emerald-50 dark:bg-night-850 dark:hover:bg-emerald-950/40 border border-gray-200 dark:border-night-800 text-gray-600 hover:text-emerald-700 dark:text-gray-300 dark:hover:text-emerald-400 text-[10px] font-medium transition-colors cursor-pointer text-left"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── SEÇÃO 2: GALERIA DE EVIDÊNCIAS COM LIGHTBOX ── */}
            <div className="p-4 rounded-2xl border border-gray-200/80 dark:border-night-800 bg-white dark:bg-night-900 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-xs">
                    Evidências Fotográficas ({attachments.length})
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50 font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Processando...' : 'Anexar Foto'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => handleUploadEvidence(e.target.files)}
                />
              </div>

              {attachments.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {attachments.map((att, index) => (
                    <div
                      key={att.id}
                      className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-night-800 bg-gray-100 dark:bg-night-850 aspect-video flex flex-col justify-end"
                    >
                      <img
                        src={att.url}
                        alt={att.name}
                        onClick={() => openLightbox(attachments, index)}
                        className="absolute inset-0 w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-night-950/85 via-transparent to-transparent opacity-80 pointer-events-none" />
                      <div className="relative z-10 p-2 flex items-center justify-between text-white text-[10px]">
                        <span className="truncate max-w-[110px] font-medium" title={att.name}>
                          {att.name}
                        </span>
                        <span className="font-mono text-gray-300">{formatBytes(att.size)}</span>
                      </div>

                      <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openLightbox(attachments, index)}
                          className="p-1.5 rounded-lg bg-night-900/80 hover:bg-night-900 text-white cursor-pointer"
                          title="Ampliar no Lightbox"
                        >
                          <Maximize2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAttachmentFromTask(task.id, att.id)}
                          className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white cursor-pointer"
                          title="Excluir evidência"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 dark:border-night-800 hover:border-purple-500/60 rounded-xl p-4 text-center cursor-pointer transition-colors bg-gray-50/40 dark:bg-night-850/40"
                >
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Nenhuma foto anexada. Clique aqui para enviar foto de inspeção, pesagem ou laudo.
                  </p>
                </div>
              )}
            </div>

            {/* ── SEÇÃO 3: TIMELINE DE COMENTÁRIOS E AUDITORIA ── */}
            <div className="p-4 rounded-2xl border border-gray-200/80 dark:border-night-800 bg-white dark:bg-night-900 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-xs">
                    Timeline de Andamento & Pareceres ({comments.length})
                  </h3>
                </div>
              </div>

              {comments.length > 0 ? (
                <div className="relative pl-4 border-l-2 border-gray-200 dark:border-night-800 space-y-3">
                  {comments.map(c => {
                    const isConclusion = c.type === 'CONCLUSAO';
                    return (
                      <div
                        key={c.id}
                        className={`relative p-3 rounded-xl border ${
                          isConclusion
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-500/30'
                            : 'bg-gray-50/80 dark:bg-night-850/70 border-gray-200/70 dark:border-night-800'
                        }`}
                      >
                        <span
                          className={`absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-night-900 ${
                            isConclusion ? 'bg-emerald-500' : 'bg-indigo-500'
                          }`}
                        />
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-gray-900 dark:text-white">{c.author}</span>
                            {c.authorRole && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-200/70 dark:bg-night-800 text-gray-600 dark:text-gray-400">
                                {c.authorRole}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                isConclusion
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                              }`}
                            >
                              {isConclusion ? 'Parecer de Conclusão' : 'Feedback'}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-gray-400 shrink-0">
                            {new Date(c.createdAt).toLocaleDateString('pt-BR')}{' '}
                            {new Date(c.createdAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                          {c.content}
                        </p>

                        {c.attachments && c.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-200/50 dark:border-night-800">
                            {c.attachments.map((att, i) => (
                              <img
                                key={att.id}
                                src={att.url}
                                alt={att.name}
                                onClick={() => openLightbox(c.attachments || [], i)}
                                className="w-16 h-12 object-cover rounded-lg border border-gray-200 dark:border-night-700 cursor-pointer hover:opacity-90 transition-opacity"
                                title="Clique para ampliar no Lightbox"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 text-center py-2 font-mono">
                  Nenhuma ocorrência ou parecer registrado na linha do tempo.
                </p>
              )}

              {/* Formulário de Novo Comentário na Timeline */}
              <form onSubmit={handleSendComment} className="space-y-2 pt-2 border-t border-gray-100 dark:border-night-800">
                {commentAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    {commentAttachments.map(att => (
                      <div key={att.id} className="relative group">
                        <img
                          src={att.url}
                          alt={att.name}
                          className="w-14 h-10 object-cover rounded-lg border border-indigo-500/40"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCommentAttachments(prev => prev.filter(item => item.id !== att.id))
                          }
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => commentFileInputRef.current?.click()}
                    title="Anexar foto ao comentário"
                    className="p-2 rounded-xl border border-gray-200 dark:border-night-800 hover:border-indigo-500 text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    ref={commentFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => handleCommentFiles(e.target.files)}
                  />
                  <input
                    type="text"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Registrar andamento, observação ou ocorrência..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isSendingComment || (!commentText.trim() && commentAttachments.length === 0)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Registrar</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* ── Rodapé Fixo de Ação Rápida ── */}
          <div className="px-5 py-3.5 border-t border-gray-200/80 dark:border-night-800 bg-gray-50/80 dark:bg-night-950/80 flex items-center justify-between gap-3">
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              Pressione <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-night-800 font-mono text-[10px]">Esc</kbd> para fechar
            </div>

            <div className="flex items-center gap-2">
              {task.status === 'Pendente' && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSwitch();
                    changeStatus(task, 'Em andamento');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Iniciar Tarefa</span>
                </button>
              )}

              {task.status !== 'Concluída' ? (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSuccess();
                    openCompleteModal(task);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Concluir com Evidência</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSwitch();
                    changeStatus(task, 'Em andamento');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-300 dark:border-night-700 hover:bg-gray-100 dark:hover:bg-night-800 text-gray-700 dark:text-gray-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reabrir Tarefa</span>
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── LIGHTBOX DE TELA CHEIA COM NAVEGAÇÃO ── */}
      {currentLightboxItem && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-night-950/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] bg-night-900 border border-night-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-night-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="font-semibold text-xs truncate">{currentLightboxItem.name}</span>
                <span className="text-[11px] font-mono text-gray-400 shrink-0">
                  ({formatBytes(currentLightboxItem.size)})
                </span>
                {lightboxList.length > 1 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-night-800 text-[10px] font-mono text-gray-300">
                    {(lightboxIndex ?? 0) + 1} / {lightboxList.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={currentLightboxItem.url}
                  download={currentLightboxItem.name}
                  className="p-1.5 rounded-lg bg-night-800 hover:bg-night-700 text-gray-300 hover:text-white transition-colors"
                  title="Baixar imagem original"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  className="p-1.5 rounded-lg bg-night-800 hover:bg-rose-600 text-gray-300 hover:text-white transition-colors cursor-pointer"
                  title="Fechar (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative p-3 flex items-center justify-center bg-night-950 min-h-[320px] max-h-[80vh] overflow-auto">
              {lightboxList.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIndex(prev =>
                      prev !== null ? (prev - 1 + lightboxList.length) % lightboxList.length : null
                    )
                  }
                  className="absolute left-3 p-2 rounded-full bg-night-900/80 hover:bg-night-800 text-white border border-night-700 cursor-pointer shadow-lg"
                  title="Foto anterior (←)"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              <img
                src={currentLightboxItem.url}
                alt={currentLightboxItem.name}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />

              {lightboxList.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIndex(prev => (prev !== null ? (prev + 1) % lightboxList.length : null))
                  }
                  className="absolute right-3 p-2 rounded-full bg-night-900/80 hover:bg-night-800 text-white border border-night-700 cursor-pointer shadow-lg"
                  title="Próxima foto (→)"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

