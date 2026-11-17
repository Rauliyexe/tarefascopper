import React, { useState, useRef } from 'react';
import {
  CheckCircle2,
  X,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { TarefaItem, TaskAttachment } from '../../types';
import { soundEngine } from '../../services/soundEngine';
import { tasksApi } from '../../services/tasksApi';

interface ConcluirTarefaModalProps {
  task: TarefaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    notes: string;
    attachments: TaskAttachment[];
    completedChecklistIds: string[];
  }) => void;
}

/**
 * Comprime e redimensiona imagem via Canvas para evidência final de conclusão.
 */
async function processImageFile(file: File): Promise<TaskAttachment> {
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
            id: `att-close-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
              id: `att-close-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
              id: `att-close-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: file.name,
              url: compressedDataUrl,
              size: approximateSize,
              type: 'image/jpeg',
              createdAt: new Date().toISOString(),
            });
          });
      };
      img.onerror = () => reject(new Error('Falha ao processar arquivo'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ConcluirTarefaModal: React.FC<ConcluirTarefaModalProps> = ({
  task,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [notes, setNotes] = useState('');
  const [newPhotos, setNewPhotos] = useState<TaskAttachment[]>([]);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<TaskAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicializa checklist marcado a partir da tarefa
  React.useEffect(() => {
    if (task) {
      setNotes('');
      setNewPhotos([]);
      setCheckedIds(
        (task.checklists || []).filter(item => item.completed).map(item => item.id)
      );
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const totalChecklists = task.checklists?.length || 0;
  const pendingChecklistsCount = totalChecklists - checkedIds.length;

  const handleToggleChecklist = (id: string) => {
    soundEngine.playSwitch();
    setCheckedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCheckAll = () => {
    soundEngine.playClick();
    if (task.checklists) {
      setCheckedIds(task.checklists.map(c => c.id));
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessingPhoto(true);
    soundEngine.playSwitch();
    try {
      const processed: TaskAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const att = await processImageFile(file);
          processed.push(att);
        }
      }
      setNewPhotos(prev => [...prev, ...processed]);
    } catch (err) {
      console.error('[ConcluirTarefaModal] Erro ao carregar fotos:', err);
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (id: string) => {
    soundEngine.playClick();
    setNewPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playSuccess();
    onConfirm({
      notes: notes.trim(),
      attachments: newPhotos,
      completedChecklistIds: checkedIds,
    });
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Conclusão de Tarefa & Registro Operacional"
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
          {/* Card Resumo da Tarefa */}
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {task.project}
                </span>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">
                  {task.title}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Responsável: <strong className="text-gray-700 dark:text-gray-300">{task.assignee}</strong>
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Finalização
              </span>
            </div>
          </div>

          {/* Validação de Checklist (se houver) */}
          {totalChecklists > 0 && (
            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-night-800 bg-white dark:bg-night-900 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900 dark:text-white">
                  <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Itens do Checklist de Conformidade</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold ${
                      pendingChecklistsCount === 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {checkedIds.length} de {totalChecklists} checados
                  </span>
                  {pendingChecklistsCount > 0 && (
                    <button
                      type="button"
                      onClick={handleCheckAll}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 underline font-semibold cursor-pointer"
                    >
                      Marcar todos
                    </button>
                  )}
                </div>
              </div>

              {pendingChecklistsCount > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>
                    Existem {pendingChecklistsCount} item(ns) pendentes no checklist antes do fechamento.
                  </span>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                {task.checklists?.map(item => {
                  const isChecked = checkedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggleChecklist(item.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-night-850 border border-gray-200/60 dark:border-night-800 text-left cursor-pointer hover:border-emerald-500/40 transition-colors"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span
                        className={`text-xs ${
                          isChecked
                            ? 'line-through text-gray-400 dark:text-gray-500'
                            : 'text-gray-800 dark:text-gray-200 font-medium'
                        }`}
                      >
                        {item.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observações de Conclusão / Parecer Técnico */}
          <div>
            <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
              📝 Observações de Conclusão / Parecer Técnico *
            </label>
            <textarea
              required
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Descreva o serviço executado, parâmetros apurados, medições obtidas e ressalvas para o supervisor ou próximo turno..."
              className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 text-xs"
            />
          </div>

          {/* Fotos de Evidência da Conclusão */}
          <div className="p-3.5 rounded-xl border border-gray-200 dark:border-night-800 bg-white dark:bg-night-900 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900 dark:text-white">
                <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Fotos de Evidência da Conclusão</span>
              </div>
              <span className="text-[11px] font-semibold text-gray-500">
                {newPhotos.length} foto(s) anexada(s)
              </span>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 dark:border-night-800 hover:border-purple-500 rounded-xl p-3 text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-night-850/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
              <div className="flex flex-col items-center justify-center gap-1">
                <UploadCloud className="w-5 h-5 text-purple-500" />
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {isProcessingPhoto ? 'Processando fotos...' : 'Anexar fotos comprobatórias do trabalho'}
                </span>
                <span className="text-[10px] text-gray-500">
                  Fotos de revestimento, ticket de balança, manômetros ou painel
                </span>
              </div>
            </div>

            {newPhotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                {newPhotos.map(photo => (
                  <div
                    key={photo.id}
                    className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-night-800 aspect-video bg-gray-100 dark:bg-night-850"
                  >
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setPreviewPhoto(photo)}
                    />
                    <div className="absolute top-1 right-1 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo.id)}
                        className="p-1 rounded bg-rose-600 text-white cursor-pointer"
                        title="Remover foto"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botões do Rodapé */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-night-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-night-800 text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-night-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar e Concluir Tarefa</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Lightbox da Foto */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-night-950/85 backdrop-blur-sm"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] bg-night-900 border border-night-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 border-b border-night-800 flex items-center justify-between text-white">
              <span className="font-semibold text-xs truncate max-w-sm">{previewPhoto.name}</span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1 rounded bg-night-800 hover:bg-rose-600 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-night-950">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

