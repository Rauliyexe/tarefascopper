import { CheckCircle2, Pencil, Play, Send, ToggleLeft, ToggleRight, Trash2, UserPlus, MessageSquare, PanelRightOpen } from 'lucide-react';
import { RowAction } from '../../components/common/RowActions';
import { TarefaItem } from '../../types';
import { TarefasController } from './useTarefas';

/**
 * Menu de ações de uma tarefa. Fica fora do hook para que ele não dependa de
 * ícones, e fora das abas para que tabela e calendário ofereçam o mesmo menu.
 */
export function buildTaskRowActions(task: TarefaItem, controller: TarefasController): RowAction[] {
  const {
    openTaskDetail,
    openEdit,
    dispatchRoutine,
    toggleDailyActive,
    changeStatus,
    toggleComplete,
    openReassign,
    setPendingDelete,
  } = controller;

  return [
    { label: 'Detalhes & Checklist', icon: PanelRightOpen, onClick: () => openTaskDetail(task) },
    { label: 'Editar Formulário', icon: Pencil, onClick: () => openEdit(task) },
    { label: 'Feedbacks & Andamento', icon: MessageSquare, onClick: () => controller.openFeedback(task) },
    ...(task.isDaily
      ? [
          {
            label: 'Disparar para Hoje',
            icon: Send,
            onClick: () => dispatchRoutine(task),
          },
          {
            label: task.dailyActive ? 'Pausar Rotina' : 'Ativar Rotina',
            icon: task.dailyActive ? ToggleRight : ToggleLeft,
            onClick: () => toggleDailyActive(task),
          },
        ]
      : []),
    {
      label: task.status === 'Em andamento' ? 'Voltar p/ pendente' : 'Iniciar tarefa',
      icon: Play,
      onClick: () => changeStatus(task, task.status === 'Em andamento' ? 'Pendente' : 'Em andamento'),
    },
    {
      label: task.status === 'Concluída' ? 'Reabrir' : 'Concluir',
      icon: CheckCircle2,
      onClick: () => toggleComplete(task),
    },
    {
      label: 'Delegar',
      icon: UserPlus,
      onClick: () => openReassign(task),
    },
    { label: 'Excluir', icon: Trash2, variant: 'danger', onClick: () => setPendingDelete(task) },
  ];
}
