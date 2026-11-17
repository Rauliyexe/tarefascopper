import React, { useState, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Image as ImageIcon,
  Trash2,
  X,
  User,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { TarefaItem, TaskAttachment } from '../../types';
import { soundEngine } from '../../services/soundEngine';
import { useCopperOS } from '../../context/CopperOSContext';

interface FeedbackModalProps {
  task: TarefaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddComment: (
    taskId: string,
    comment: {
      author: string;
      authorRole?: string;
      authorEmail?: string;
      content: string;
      attachments?: TaskAttachment[];
    }
  ) => void;
}

/**
 * Processamento e compressão de foto para anexar a um feedback.
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
            id: `att-fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
        const approximateSize = Math.round((compressedDataUrl.length * 3) / 4);

        resolve({
          id: `att-fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          url: compressedDataUrl,
          size: approximateSize,
          type: 'image/jpeg',
          createdAt: new Date().toISOString(),
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

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  task,
  isOpen,
  onClose,
  onAddComment,
}) => {
  const { user } = useCopperOS();
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<TaskAttachment[]>([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<TaskAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setContent('');
      setPhotos([]);
    }
  }, [isOpen]);

  if (!isOpen || !task) return null;

  const comments = task.comments || [];

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
      setPhotos(prev => [...prev, ...processed]);
    } catch (err) {
      console.error('[FeedbackModal] Erro ao carregar fotos:', err);
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (id: string) => {
    soundEngine.playClick();
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && photos.length === 0) return;

    soundEngine.playClick();
    onAddComment(task.id, {
      author: user?.name || user?.email?.split('@')[0] || 'Operador',
      authorRole: user?.role || 'OPERATOR',
      authorEmail: user?.email,
      content: content.trim() || 'Evidência fotográfica registrada.',
      attachments: photos,
    });

    setContent('');
    setPhotos([]);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Feedbacks & Acompanhamento de Andamento"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs max-h-[75vh] flex flex-col">
          {/* Cabeçalho da Tarefa */}
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200/80 dark:border-night-800 shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  {task.project}
                </span>
                <h4 className="font-bold text-xs text-gray-900 dark:text-white mt-0.5">
                  {task.title}
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Responsável: <strong className="text-gray-700 dark:text-gray-300">{task.assignee}</strong>
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  task.status === 'Concluída'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : task.status === 'Em andamento'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {task.status}
              </span>
            </div>
          </div>

          {/* Linha do Tempo de Feedbacks */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[140px] max-h-[280px]">
            {comments.length === 0 ? (
              <div className="py-8 text-center text-gray-400 space-y-1">
                <MessageSquare className="w-6 h-6 mx-auto opacity-40" />
                <p>Nenhum feedback registrado ainda para esta tarefa.</p>
                <p className="text-[11px]">Utilize o campo abaixo para relatar o andamento ou ocorrências.</p>
              </div>
            ) : (
              comments.map(c => {
                const isConclusion = c.type === 'CONCLUSAO';
                return (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl border text-xs ${
                      isConclusion
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-white dark:bg-night-900 border-gray-200/80 dark:border-night-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-micro text-gray-500 mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200">
                        {isConclusion ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-indigo-500" />
                        )}
                        <span>{c.author}</span>
                        {c.authorRole && (
                          <span className="text-[10px] font-normal text-gray-400">({c.authorRole})</span>
                        )}
                      </div>
                      <span className="font-mono text-gray-400">
                        {new Date(c.createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {c.content}
                    </p>

                    {/* Fotos anexadas a este feedback */}
                    {c.attachments && c.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 mt-2 border-t border-gray-100 dark:border-night-800">
                        {c.attachments.map(att => (
                          <div
                            key={att.id}
                            className="relative group rounded-lg overflow-hidden border border-gray-200 w-24 h-16 bg-gray-100 cursor-pointer"
                            onClick={() => setPreviewPhoto(att)}
                          >
                            <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-night-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px]">
                              Ver
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Formulário para Enviar Novo Feedback */}
          <form onSubmit={handleSubmit} className="space-y-2 pt-3 border-t border-gray-100 dark:border-night-800 shrink-0">
            <div>
              <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                💬 Registrar Feedback ou Atualização de Andamento
              </label>
              <textarea
                rows={2}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Ex: Peça recebida, iniciando a montagem / Aguardando laudo laboratorial..."
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>

            {/* Fotos selecionadas antes de enviar */}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map(p => (
                  <div
                    key={p.id}
                    className="relative group rounded-lg overflow-hidden border border-gray-200 w-20 h-14 bg-gray-100"
                  >
                    <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(p.id)}
                      className="absolute top-1 right-1 p-0.5 rounded bg-rose-600 text-white cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-night-800 hover:border-purple-500 text-gray-600 dark:text-gray-300 hover:text-purple-600 text-xs cursor-pointer transition-colors"
                title="Anexar foto ao feedback"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => handleFiles(e.target.files)}
                />
                <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                <span>{isProcessingPhoto ? 'Processando...' : '+ Foto de Evidência'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-night-800 text-gray-600 dark:text-gray-400 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() && photos.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Feedback</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </Modal>

      {/* Lightbox da Foto */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-night-950/85 backdrop-blur-sm"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-2xl max-h-[85vh] bg-night-900 border border-night-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
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
