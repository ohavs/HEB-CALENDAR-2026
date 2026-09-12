/** אירועי המשתמש - מאוחסנים מקומית ומסונכרנים לענן כשמתחברים. */
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DateKey, EventColor, UserEvent } from '@/types';

const STORAGE_KEY = 'heb-cal:events';

export type EventDraft = {
  title: string;
  date: DateKey;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location?: string;
  notes?: string;
  color: EventColor;
  reminderMinutes: number | null;
  repeat: UserEvent['repeat'];
};

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

type EventsStore = {
  byId: Record<string, UserEvent>;
  /** עולה בכל שינוי מקומי, כדי שהסנכרון והתזכורות יידעו להתעדכן */
  revision: number;
  add: (draft: EventDraft) => UserEvent;
  update: (id: string, patch: Partial<EventDraft>) => void;
  /** מעביר אירוע ליום אחר (גרירה בלוח) */
  move: (id: string, to: DateKey) => void;
  remove: (id: string) => void;
  /** מיזוג נתונים מהענן - מנצח ה-updatedAt המאוחר */
  mergeRemote: (remote: UserEvent[]) => void;
  /** מחיקת כל הנתונים המקומיים (יציאה מהחשבון) */
  clearLocal: () => void;
};

export const useEventsStore = create<EventsStore>()(
  persist(
    (setState, getState) => ({
      byId: {},
      revision: 0,

      add: (draft) => {
        const now = Date.now();
        const ev: UserEvent = { id: newId(), ...draft, createdAt: now, updatedAt: now };
        setState((s) => ({ byId: { ...s.byId, [ev.id]: ev }, revision: s.revision + 1 }));
        return ev;
      },

      update: (id, patch) =>
        setState((s) => {
          const existing = s.byId[id];
          if (!existing) return s;
          return {
            byId: { ...s.byId, [id]: { ...existing, ...patch, updatedAt: Date.now() } },
            revision: s.revision + 1,
          };
        }),

      move: (id, to) => {
        const existing = getState().byId[id];
        if (!existing || existing.date === to) return;
        setState((s) => ({
          byId: { ...s.byId, [id]: { ...existing, date: to, updatedAt: Date.now() } },
          revision: s.revision + 1,
        }));
      },

      remove: (id) =>
        setState((s) => {
          const existing = s.byId[id];
          if (!existing) return s;
          // משאירים סימן מחיקה כדי שהסנכרון ימחק גם בענן ובמכשירים אחרים
          return {
            byId: {
              ...s.byId,
              [id]: { ...existing, deleted: true, updatedAt: Date.now() },
            },
            revision: s.revision + 1,
          };
        }),

      mergeRemote: (remote) =>
        setState((s) => {
          const next = { ...s.byId };
          let changed = false;
          for (const r of remote) {
            const local = next[r.id];
            if (!local || r.updatedAt > local.updatedAt) {
              next[r.id] = r;
              changed = true;
            }
          }
          return changed ? { byId: next, revision: s.revision + 1 } : s;
        }),

      clearLocal: () => setState((s) => ({ byId: {}, revision: s.revision + 1 })),
    }),
    { name: STORAGE_KEY, version: 1 },
  ),
);

/**
 * הוק לקבלת האירועים החיים.
 * בוחרים את המפה עצמה (הפניה יציבה) וגוזרים מערך ב-useMemo, כדי לא להחזיר
 * מערך חדש בכל קריאה ל-getSnapshot.
 */
export function useEvents(): UserEvent[] {
  const byId = useEventsStore((s) => s.byId);
  return useMemo(() => Object.values(byId).filter((e) => !e.deleted), [byId]);
}

/** כולל מסומנים למחיקה - לשימוש הסנכרון בלבד. */
export function allIncludingDeleted(): UserEvent[] {
  return Object.values(useEventsStore.getState().byId);
}

export const EVENT_COLORS: { id: EventColor; label: string }[] = [
  { id: 'violet', label: 'סגול' },
  { id: 'mint', label: 'ירוק' },
  { id: 'rose', label: 'ורוד' },
  { id: 'peach', label: 'כתום' },
  { id: 'sky', label: 'כחול' },
  { id: 'slate', label: 'אפור' },
];

export const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'בלי תזכורת' },
  { value: 0, label: 'בזמן האירוע' },
  { value: 5, label: '5 דקות לפני' },
  { value: 10, label: '10 דקות לפני' },
  { value: 15, label: '15 דקות לפני' },
  { value: 30, label: '30 דקות לפני' },
  { value: 60, label: 'שעה לפני' },
  { value: 120, label: 'שעתיים לפני' },
  { value: 1440, label: 'יום לפני' },
];
