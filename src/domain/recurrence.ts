/**
 * Regras puras de recorrência das rotinas diárias.
 *
 * Ficam separadas da UI para poderem ser testadas isoladamente: decidir se uma
 * rotina venceu é a parte que erra silenciosamente (fuso, virada do dia,
 * horário ainda não alcançado, dias sem disparo).
 */

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
export const BUSINESS_DAYS = [1, 2, 3, 4, 5];

/** Máximo de dias em atraso que uma rotina recupera ao reabrir o sistema. */
export const MAX_CATCH_UP_DAYS = 7;

/** Campos de agendamento que a recorrência precisa conhecer. */
export interface RoutineSchedule {
  id: string;
  /** "HH:mm" local. Ausente = 08:00. */
  dailyTime?: string;
  /** true = só Seg–Sex; false/ausente = todos os dias. */
  dailyWeekdaysOnly?: boolean;
  /** Ausente conta como ativa (compatível com rotinas antigas). */
  dailyActive?: boolean;
  /** Data (YYYY-MM-DD) do último disparo materializado. */
  lastDispatchedDate?: string;
}

export const DEFAULT_ROUTINE_TIME = '08:00';

/** Chave de data local (YYYY-MM-DD) — nunca UTC, para "hoje" bater com o relógio do usuário. */
export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Meia-noite local da data informada. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Meia-noite local da chave de data. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** "08:30" → 510 */
export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesNow(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function weekdaysOf(routine: RoutineSchedule): number[] {
  return routine.dailyWeekdaysOnly ? BUSINESS_DAYS : ALL_WEEKDAYS;
}

export function isRoutineActive(routine: RoutineSchedule): boolean {
  return routine.dailyActive !== false;
}

export function routineTime(routine: RoutineSchedule): string {
  return routine.dailyTime || DEFAULT_ROUTINE_TIME;
}

/**
 * Datas que a rotina ainda deve lançar: cada dia elegível depois do último
 * disparo até hoje, e hoje só depois que o horário passou. Limitado a
 * MAX_CATCH_UP_DAYS para o sistema não despejar semanas de tarefas de uma vez;
 * uma rotina que nunca rodou começa hoje, sem inventar histórico.
 */
export function pendingRunKeys(routine: RoutineSchedule, now: Date, maxCatchUpDays = MAX_CATCH_UP_DAYS): string[] {
  if (!isRoutineActive(routine)) return [];

  const weekdays = weekdaysOf(routine);
  const time = minutesOfDay(routineTime(routine));
  const todayKey = dateKey(now);

  const firstCandidate = routine.lastDispatchedDate
    ? addDays(parseDateKey(routine.lastDispatchedDate), 1)
    : parseDateKey(todayKey);
  const earliest = addDays(parseDateKey(todayKey), -maxCatchUpDays);

  const keys: string[] = [];
  for (
    let cursor = firstCandidate < earliest ? earliest : firstCandidate;
    dateKey(cursor) <= todayKey;
    cursor = addDays(cursor, 1)
  ) {
    const key = dateKey(cursor);
    if (!weekdays.includes(cursor.getDay())) continue;
    if (key === todayKey && minutesNow(now) < time) continue;
    keys.push(key);
  }

  return keys;
}

/** Próximo momento em que a rotina dispara, ou null se estiver pausada. */
export function nextRunAt(routine: RoutineSchedule, from: Date): Date | null {
  if (!isRoutineActive(routine)) return null;

  const weekdays = weekdaysOf(routine);
  const time = routineTime(routine);
  const timeMinutes = minutesOfDay(time);

  for (let offset = 0; offset <= 7; offset++) {
    const day = addDays(from, offset);
    if (!weekdays.includes(day.getDay())) continue;
    if (offset === 0 && minutesNow(from) >= timeMinutes) continue;
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours || 0, minutes || 0, 0, 0);
  }
  return null;
}

/** "Hoje às 07:00" / "Amanhã às 07:00" / "Seg, 07/09 às 07:00" */
export function describeNextRun(routine: RoutineSchedule, now: Date): string {
  const next = nextRunAt(routine, now);
  if (!next) return 'Pausada';

  const nextKey = dateKey(next);
  const time = routineTime(routine);
  if (nextKey === dateKey(now)) return `Hoje às ${time}`;
  if (nextKey === dateKey(addDays(now, 1))) return `Amanhã às ${time}`;

  const [, month, day] = nextKey.split('-');
  return `${WEEKDAY_LABELS[next.getDay()]}, ${day}/${month} às ${time}`;
}

/**
 * Id determinístico da tarefa gerada. Depende só de (rotina, dia, destinatário),
 * então repetir a varredura nunca duplica a tarefa do dia.
 */
export function generatedTaskId(routineId: string, dateKeyValue: string, targetId: string): string {
  return `rot:${routineId}:${dateKeyValue}:${targetId}`;
}
