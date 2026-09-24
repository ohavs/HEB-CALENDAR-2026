/**
 * "הוספת אירוע" שהגיעה מאפליקציה אחרת.
 *
 * באנדרואיד אין "לוח שנה ברירת מחדל" אחד: כל פעולה נבחרת בנפרד. מייל,
 * דפדפן או הודעה שמציעים "הוסף ליומן" שולחים `ACTION_INSERT` עם השדות
 * של `CalendarContract`, ו-`MainActivity` מתרגמת אותם לשאילתה שנכנסת
 * באותו מסלול של כל קישור עמוק. כאן השאילתה הופכת לטיוטה - ולא לאירוע:
 * העורך נפתח מולא, והמשתמש הוא שמחליט לשמור.
 */
import type { DateKey, EventColor } from '@/types';
import { addDays, dateKey, minutesToTime, timeToMinutes } from './dates';
import { suggestReminderTime } from './reminderCompose';

/** מה ש-`MainActivity` מעבירה, כמות שהוא. כל שדה רשות. */
export type ExternalEvent = {
  title?: string;
  begin?: number;
  end?: number;
  allDay?: boolean;
  location?: string;
  notes?: string;
};

/** אותה צורה של `EventDraft`, בלי לייבא מהחנות. */
export type ExternalDraft = {
  title: string;
  date: DateKey;
  endDate?: DateKey;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string;
  notes: string;
  color: EventColor;
  reminderMinutes: number | null;
  repeat: 'none';
};

// החסמים של כלל האבטחה. טיוטה שחורגת מהם הייתה נשמרת במכשיר ונדחית בענן.
const MAX_TITLE = 300;
const MAX_LOCATION = 300;
const MAX_NOTES = 4000;
const DEFAULT_LENGTH = 60;
const LAST_MINUTE = 23 * 60 + 59;
const DAY_MS = 24 * 60 * 60 * 1000;

function finiteMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** קורא את השדות מהשאילתה. `null` כשזו לא הוספה חיצונית. */
export function parseExternalEvent(params: URLSearchParams): ExternalEvent | null {
  if (params.get('ext') !== 'insert') return null;
  const text = (key: string) => params.get(key)?.trim() || undefined;
  return {
    title: text('title'),
    begin: finiteMs(params.get('begin')),
    end: finiteMs(params.get('end')),
    allDay: params.get('allDay') === '1',
    location: text('loc'),
    notes: text('notes'),
  };
}

function hhmm(d: Date): string {
  return minutesToTime(d.getHours() * 60 + d.getMinutes());
}

/**
 * יום של אירוע "כל היום".
 *
 * `CalendarContract` שומר אותו בחצות UTC, ולכן בישראל 1 באוקטובר מגיע
 * כ-1 באוקטובר 03:00 - אבל באזור זמן מערבי הוא היה נופל ליום הקודם.
 * חצות UTC מדויקת נקראת ברכיבי UTC; כל ערך אחר הוא שעה מקומית של שולח
 * שלא הקפיד, ונקרא כמקומי.
 */
function allDayKey(ms: number): DateKey {
  if (ms % DAY_MS !== 0) return dateKey(new Date(ms));
  const d = new Date(ms);
  return dateKey(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * היום האחרון של אירוע "כל היום".
 *
 * הסיום ב-CalendarContract בלעדי: אירוע של יום אחד נגמר בחצות שאחריו.
 * חצות - של UTC או מקומית - שייכת ליום שלפניה; כל שעה אחרת היא סיום
 * כולל של שולח שלא הקפיד.
 */
function allDayLastKey(ms: number): DateKey {
  const d = new Date(ms);
  const utcMidnight = ms % DAY_MS === 0;
  const localMidnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  if (!utcMidnight && !localMidnight) return dateKey(d);
  const day = utcMidnight
    ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return dateKey(addDays(day, -1));
}

export function externalToDraft(
  ext: ExternalEvent,
  color: EventColor,
  now: Date,
): ExternalDraft {
  const base = {
    title: (ext.title ?? '').slice(0, MAX_TITLE),
    location: (ext.location ?? '').slice(0, MAX_LOCATION),
    notes: (ext.notes ?? '').slice(0, MAX_NOTES),
    color,
    repeat: 'none' as const,
  };

  // בלי זמן בכלל: היום, בחצי השעה העגולה הבאה - כמו הוספה מהירה
  if (ext.begin === undefined) {
    const start = suggestReminderTime(now, true);
    return {
      ...base,
      date: dateKey(now),
      startTime: start,
      endTime: minutesToTime(Math.min(LAST_MINUTE, timeToMinutes(start) + DEFAULT_LENGTH)),
      allDay: false,
      reminderMinutes: 15,
    };
  }

  if (ext.allDay) {
    const date = allDayKey(ext.begin);
    const last = ext.end !== undefined && ext.end > ext.begin ? allDayLastKey(ext.end) : date;
    return {
      ...base,
      date,
      ...(last > date ? { endDate: last } : {}),
      startTime: null,
      endTime: null,
      allDay: true,
      reminderMinutes: null,
    };
  }

  const start = new Date(ext.begin);
  const date = dateKey(start);
  const startTime = hhmm(start);
  if (ext.end === undefined || ext.end <= ext.begin) {
    return {
      ...base,
      date,
      startTime,
      endTime: minutesToTime(Math.min(LAST_MINUTE, timeToMinutes(startTime) + DEFAULT_LENGTH)),
      allDay: false,
      reminderMinutes: 15,
    };
  }

  const end = new Date(ext.end);
  const endKey = dateKey(end);
  return {
    ...base,
    date,
    ...(endKey > date ? { endDate: endKey } : {}),
    startTime,
    endTime: hhmm(end),
    allDay: false,
    reminderMinutes: 15,
  };
}
