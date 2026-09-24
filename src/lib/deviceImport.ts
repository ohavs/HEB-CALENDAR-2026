/**
 * העתקה חד־פעמית של אירועים מהיומן של המכשיר (סמסונג, גוגל) אל האפליקציה.
 *
 * העתקה ולא תצוגה חיה: אחרי שהועתק, האירוע שלנו לכל דבר - נערך, זז
 * ומסתנכרן לחשבון. ייבוא חוזר אינו משכפל, כי הוא עובר את כלל הכפילויות
 * של `importEvents`.
 *
 * הקושי הוא בסדרות. ספק היומן שומר סדרה כשורה אחת עם RRULE, ומופע שנערך
 * או בוטל כשורה נפרדת שמצביעה עליה (`originalId`). אצלנו יש ארבע חזרות
 * בלבד, בלי מרווח ובלי סוף - ולכן:
 *
 * - **סדרה פשוטה** (שבועי, חודשי, שנתי, בלי INTERVAL/COUNT/UNTIL) הופכת
 *   לסדרה שלנו. מופע שבוטל הוא חריג `cancelled`; מופע שנערך מבטל את
 *   מקומו המקורי ומופיע כאירוע בודד - אחרת הוא היה מופיע פעמיים.
 * - **כל סדרה אחרת** נפרשת למופעים בודדים בחלון, מתוך טבלת Instances,
 *   שכבר מגלמת את כל החריגים. סדרה של "כל שבועיים" שהייתה הופכת
 *   ל"כל שבוע" הייתה גרועה מסדרה שנפרשה.
 */
import type { DateKey, EventColor, UserEvent } from '@/types';
import { allDayKey, externalToDraft } from './externalEvent';
import { dateKey } from './dates';
import type { ImportResult } from './ics';

/** שורה מטבלת Events, כפי ש-`HebCalendarPlugin.readDevice` מחזיר. */
export type DeviceRow = {
  id: number;
  originalId?: number;
  originalInstanceTime?: number;
  cancelled?: boolean;
  title: string;
  begin: number;
  end?: number;
  duration?: string;
  allDay: boolean;
  location?: string;
  notes?: string;
  rrule?: string;
};

/** מופע מטבלת Instances - רק לסדרות שאינן פשוטות. */
export type DeviceInstance = {
  eventId: number;
  originalId?: number;
  title: string;
  begin: number;
  end: number;
  allDay: boolean;
  location?: string;
  notes?: string;
};

type Draft = ImportResult['events'][number];

const RRULE_REPEAT: Record<string, UserEvent['repeat']> = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

/** החזרה שלנו ל-RRULE, או `null` כשאין לה מקבילה נאמנה. */
export function simpleRepeat(rrule: string): UserEvent['repeat'] | null {
  const parts = Object.fromEntries(
    rrule
      .split(';')
      .map((p) => p.split('='))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k.trim().toUpperCase(), v.trim().toUpperCase()]),
  );
  const repeat = RRULE_REPEAT[parts.FREQ];
  if (!repeat) return null;
  if (parts.COUNT || parts.UNTIL) return null;
  if (parts.INTERVAL && parts.INTERVAL !== '1') return null;
  // "כל שני ורביעי" אינו שבועי אחד
  if (parts.BYDAY && parts.BYDAY.includes(',')) return null;
  if (parts.BYSETPOS || parts.BYWEEKNO || parts.BYYEARDAY) return null;
  // "יום שלישי השני בחודש" אינו "ה-10 בכל חודש"
  if (repeat !== 'weekly' && parts.BYDAY) return null;
  return repeat;
}

/** משך בפורמט של ספק היומן: `P3600S`, `PT1H30M`, `P1D`. */
export function durationMs(duration: string | undefined): number {
  if (!duration) return 0;
  const unit: Record<string, number> = {
    W: 7 * 86_400_000,
    D: 86_400_000,
    H: 3_600_000,
    M: 60_000,
    S: 1000,
  };
  let total = 0;
  for (const [, n, u] of duration.toUpperCase().matchAll(/(\d+)([WDHMS])/g)) {
    total += Number(n) * unit[u];
  }
  return total;
}

function toDraft(
  item: { title: string; begin: number; end?: number; allDay: boolean; location?: string; notes?: string },
  color: EventColor,
  now: Date,
): Draft {
  const draft = externalToDraft(
    {
      title: item.title,
      begin: item.begin,
      end: item.end,
      allDay: item.allDay,
      location: item.location,
      notes: item.notes,
    },
    color,
    now,
  );
  // היומן המקורי כבר מתריע עליהם; שתי התראות על אותו אירוע הן רעש
  const { location, notes, ...rest } = draft;
  return {
    ...rest,
    reminderMinutes: null,
    ...(location ? { location } : {}),
    ...(notes ? { notes } : {}),
  };
}

function occurrenceKey(ms: number, allDay: boolean): DateKey {
  return allDay ? allDayKey(ms) : dateKey(new Date(ms));
}

export function deviceToDrafts(
  rows: DeviceRow[],
  instances: DeviceInstance[],
  options: { color: EventColor; now: Date; from: number },
): Draft[] {
  const { color, now, from } = options;
  const out: Draft[] = [];
  const titled = (r: { title: string }) => r.title.trim().length > 0;

  const masters = new Map<number, DeviceRow>();
  for (const row of rows) if (row.rrule && row.originalId === undefined) masters.set(row.id, row);

  const simple = new Map<number, UserEvent['repeat']>();
  for (const master of masters.values()) {
    const repeat = simpleRepeat(master.rrule ?? '');
    if (repeat) simple.set(master.id, repeat);
  }

  // סדרות פשוטות: שורה אחת עם חזרה, והחריגים שלה
  for (const [id, repeat] of simple) {
    const master = masters.get(id)!;
    if (!titled(master)) continue;
    const end = master.end ?? master.begin + durationMs(master.duration);
    const draft: Draft = { ...toDraft({ ...master, end }, color, now), repeat };
    const exceptions: NonNullable<UserEvent['exceptions']> = {};
    for (const row of rows) {
      if (row.originalId !== id || row.originalInstanceTime === undefined) continue;
      exceptions[occurrenceKey(row.originalInstanceTime, master.allDay)] = { cancelled: true };
    }
    out.push(Object.keys(exceptions).length ? { ...draft, exceptions } : draft);
  }

  // סדרות אחרות: המופעים כפי שספק היומן כבר חישב אותם
  for (const inst of instances) {
    const series = masters.has(inst.eventId)
      ? inst.eventId
      : inst.originalId !== undefined && masters.has(inst.originalId)
        ? inst.originalId
        : undefined;
    if (series === undefined || simple.has(series) || !titled(inst)) continue;
    out.push(toDraft(inst, color, now));
  }

  // אירועים בודדים, וגם מופע שנערך מתוך סדרה פשוטה
  for (const row of rows) {
    if (row.rrule || row.cancelled || !titled(row)) continue;
    if (row.originalId !== undefined && masters.has(row.originalId) && !simple.has(row.originalId)) {
      continue; // כבר הגיע מ-Instances
    }
    const end = row.end ?? row.begin + durationMs(row.duration);
    if (end < from && row.begin < from) continue;
    out.push(toDraft({ ...row, end }, color, now));
  }

  return out;
}
