import React, { useEffect, useState } from 'react';
import { Mic, X, Clock } from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import { fechamentoApi } from '../../services/fechamentoApi';
import { dateKey } from '../../domain/recurrence';

/** U3 — Lembrete de fechamento de turno a partir do horário configurado (padrão 17:00). */
export const ShiftReminderBanner: React.FC = () => {
  const { user, currentCompany, setIsFechamentoModalOpen, isFechamentoModalOpen } = useCopperOS();
  const [visible, setVisible] = useState(false);
  const today = dateKey(new Date());
  const dismissKey = `copperos_reminder_dismissed_${user.id}_${today}`;

  useEffect(() => {
    let active = true;
    const check = async () => {
      const enabled = localStorage.getItem('copperos_cfg_rdo_reminder') !== 'false';
      const hourCfg = Number(localStorage.getItem('copperos_cfg_reminder_hour') || 17);
      if (!enabled || localStorage.getItem(dismissKey) || new Date().getHours() < hourCfg) {
        if (active) setVisible(false);
        return;
      }
      try {
        const list: any = await (fechamentoApi as any).list({ companyId: currentCompany.id, date: today, userId: user.id });
        const arr = Array.isArray(list) ? list : list?.fechamentos || list?.records || [];
        if (active) setVisible(arr.length === 0);
      } catch {
        if (active) setVisible(true);
      }
    };
    check();
    const t = setInterval(check, 5 * 60_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [user.id, currentCompany.id, today, dismissKey, isFechamentoModalOpen]);

  if (!visible) return null;

  return (
    <div className="mb-4 px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-center gap-3 text-xs">
      <Clock className="w-4 h-4 shrink-0" />
      <span className="flex-1 font-semibold">Você ainda não enviou o fechamento de turno de hoje.</span>
      <button
        onClick={() => setIsFechamentoModalOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
      >
        <Mic className="w-3.5 h-3.5" /> Fazer agora
      </button>
      <button
        onClick={() => {
          localStorage.setItem(dismissKey, '1');
          setVisible(false);
        }}
        className="opacity-60 hover:opacity-100 cursor-pointer"
        title="Lembrar amanhã"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
