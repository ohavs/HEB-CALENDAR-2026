/** אירועי המשתמש - מאוחסנים מקומית ומסונכרנים לענן כשמתחברים. */
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DateKey, EventColor, EventException, PlaceTrigger, UserEvent } from '@/types';

const STORAGE_KEY = 'heb-cal:events';

/**
 * שתי גרסאות של אותו אירוע ששונו בשני מכשירים ללא קשר זו לזו.
 * הסנכרון הוא last-write-wins, ולכן אחת מהן כבר נדחתה - אבל היא נשמרת
 * כאן כדי שהמשתמש יוכל להחזיר אותה במקום לגלות שהיא נעלמה.
 */
export type SyncConflict = {
  id: string;
  /** הגרסה המקומית שהפסידה */
  local: UserEvent;
  /** הגרסה שהתקבלה מהענן וניצחה */
  remote: UserEvent;
  detectedAt: number;
};

/** יותר מזה זו כבר ערמה ולא התראה */
const MAX_CONFLICTS = 20;

export type EventDraft = {
  title: string;
  date: DateKey;
  /** יום סיום לאירוע רב־יומי; חסר באירוע של יום אחד */
  endDate?: DateKey;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location?: string;
  placeId?: string;
  placeTrigger?: PlaceTrigger;
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

  /* ---------- מופע יחיד בסדרה חוזרת ---------- */
  /** משנה מופע אחד בלבד, בלי לגעת בשאר הסדרה */
  updateOccurrence: (id: string, sourceKey: DateKey, patch: EventException) => void;
  /** מעביר מופע אחד ליום אחר */
  moveOccurrence: (id: string, sourceKey: DateKey, to: DateKey) => void;
  /** מבטל מופע אחד */
  cancelOccurrence: (id: string, sourceKey: DateKey) => void;
  /** מחזיר מופע שבוטל או שהוזז למקומו המקורי */
  restoreOccurrence: (id: string, sourceKey: DateKey) => void;
  /**
   * מיזוג נתונים מהענן - מנצח ה-updatedAt המאוחר.
   * `unpushed` הוא קבוצת המזהים שיש להם שינוי מקומי שטרם נדחף. אירוע
   * כזה שנדרס על ידי הענן הוא התנגשות אמיתית, ולא סתם עדכון.
   */
  mergeRemote: (remote: UserEvent[], unpushed?: Set<string>) => void;

  /* ---------- התנגשויות סנכרון ---------- */
  conflicts: SyncConflict[];
  /** מחזיר את הגרסה המקומית שהפסידה, עם חותמת זמן חדשה כדי שתנצח */
  keepLocalVersion: (id: string) => void;
  /** מוותר על הגרסה המקומית ומשאיר את זו שהגיעה מהענן */
  dismissConflict: (id: string) => void;
  clearConflicts: () => void;
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
          const next: UserEvent = { ...existing, ...patch, updatedAt: Date.now() };
          // שינוי יום הבסיס או כלל החזרה מזיז את כל הסדרה, והחריגים
          // הישנים מצביעים על תאריכים שכבר לא קיימים בה
          if (
            (patch.date !== undefined && patch.date !== existing.date) ||
            (patch.repeat !== undefined && patch.repeat !== existing.repeat)
          ) {
            delete next.exceptions;
          }
          return { byId: { ...s.byId, [id]: next }, revision: s.revision + 1 };
        }),

      move: (id, to) => {
        const existing = getState().byId[id];
        if (!existing || existing.date === to) return;
        setState((s) => ({
          byId: { ...s.byId, [id]: { ...existing, date: to, updatedAt: Date.now() } },
          revision: s.revision + 1,
        }));
      },

      updateOccurrence: (id, sourceKey, patch) =>
        setState((s) => {
          const existing = s.byId[id];
          if (!existing) return s;
          const exceptions = {
            ...existing.exceptions,
            [sourceKey]: { ...existing.exceptions?.[sourceKey], ...patch },
          };
          return {
            byId: { ...s.byId, [id]: { ...existing, exceptions, updatedAt: Date.now() } },
            revision: s.revision + 1,
          };
        }),

      moveOccurrence: (id, sourceKey, to) => {
        // הזזה חזרה למקום המקורי מוחקת את החריג במקום לשמור אותו כזהות
        if (sourceKey === to) getState().restoreOccurrence(id, sourceKey);
        else getState().updateOccurrence(id, sourceKey, { movedTo: to });
      },

      cancelOccurrence: (id, sourceKey) =>
        getState().updateOccurrence(id, sourceKey, { cancelled: true }),

      restoreOccurrence: (id, sourceKey) =>
        setState((s) => {
          const existing = s.byId[id];
          if (!existing?.exceptions?.[sourceKey]) return s;
          const exceptions = { ...existing.exceptions };
          delete exceptions[sourceKey];
          const next: UserEvent = { ...existing, updatedAt: Date.now() };
          if (Object.keys(exceptions).length) next.exceptions = exceptions;
          else delete next.exceptions;
          return { byId: { ...s.byId, [id]: next }, revision: s.revision + 1 };
        }),

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

      conflicts: [],

      mergeRemote: (remote, unpushed) =>
        setState((s) => {
          const next = { ...s.byId };
          const found: SyncConflict[] = [];
          let changed = false;
          for (const r of remote) {
            const local = next[r.id];
            if (local && r.updatedAt <= local.updatedAt) continue;
            // המקומי מפסיד. אם היה בו שינוי שטרם נדחף, המשתמש עומד לאבד
            // עבודה אמיתית - שומרים את הגרסה שנדחתה ומדווחים.
            if (local && unpushed?.has(r.id) && !local.deleted) {
              found.push({ id: r.id, local, remote: r, detectedAt: Date.now() });
            }
            next[r.id] = r;
            changed = true;
          }
          if (!changed) return s;
          return {
            byId: next,
            revision: s.revision + 1,
            conflicts: found.length
              ? [...found, ...s.conflicts.filter((c) => !found.some((f) => f.id === c.id))].slice(
                  0,
                  MAX_CONFLICTS,
                )
              : s.conflicts,
          };
        }),

      keepLocalVersion: (id) =>
        setState((s) => {
          const conflict = s.conflicts.find((c) => c.id === id);
          if (!conflict) return s;
          return {
            byId: { ...s.byId, [id]: { ...conflict.local, updatedAt: Date.now() } },
            revision: s.revision + 1,
            conflicts: s.conflicts.filter((c) => c.id !== id),
          };
        }),

      dismissConflict: (id) =>
        setState((s) => ({ conflicts: s.conflicts.filter((c) => c.id !== id) })),

      clearConflicts: () => setState(() => ({ conflicts: [] })),

      clearLocal: () =>
        setState((s) => ({ byId: {}, revision: s.revision + 1, conflicts: [] })),
    }),
    { name: STORAGE_KEY, version: 2 },
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
