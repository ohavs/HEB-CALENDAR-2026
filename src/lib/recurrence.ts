/**
 * פריסת אירועים חוזרים על טווח תאריכים.
 * הפריסה נעשית על חלון קטן (בדרך כלל 42 ימי הרשת), ולכן די בבדיקה יומית
 * פשוטה במקום מנוע RRULE מלא.
 */
import { HDate } from '@hebcal/core';
import type { DateKey, UserEvent } from '@/types';
import { addDays, dateKey, keyToDate, timeToMinutes } from './dates';

export type Occurrence = UserEvent & {
  /** מזהה ייחודי למופע (עבור React ולגרירה) */
  occurrenceId: string;
  /** מזהה האירוע המקורי */
  baseId: string;
  /** האם זה מופע של אירוע חוזר (ולא האירוע המקורי) */
  isRecurring: boolean;
};

function hebrewMonthMatches(baseMonth: number, baseLeap: boolean, hd: HDate): boolean {
  const leap = HDate.isLeapYear(hd.getFullYear());
  let target = baseMonth;
  if (baseLeap && !leap && (baseMonth === 12 || baseMonth === 13)) {
    target = 12; // אדר א׳/ב׳ בשנה מעוברת → אדר בשנה פשוטה
  } else if (!baseLeap && leap && baseMonth === 12) {
    target = 13; // אדר בשנה פשוטה → אדר ב׳ בשנה מעוברת
  }
  return hd.getMonth() === target;
}

/** האם לאירוע יש מופע בתאריך הנתון. */
function occursOn(ev: UserEvent, day: Date, baseDate: Date): boolean {
  if (day < baseDate) return false;
  switch (ev.repeat) {
    case 'none':
      return false; // מטופל בנפרד
    case 'weekly':
      return day.getDay() === baseDate.getDay();
    case 'monthly':
      return day.getDate() === baseDate.getDate();
    case 'yearly':
      return day.getDate() === baseDate.getDate() && day.getMonth() === baseDate.getMonth();
    case 'hebrew-yearly': {
      const baseH = new HDate(baseDate);
      const h = new HDate(day);
      return (
        h.getDate() === baseH.getDate() &&
        hebrewMonthMatches(baseH.getMonth(), HDate.isLeapYear(baseH.getFullYear()), h)
      );
    }
    default:
      return false;
  }
}

function toOccurrence(ev: UserEvent, key: DateKey, recurring: boolean): Occurrence {
  return {
    ...ev,
    date: key,
    occurrenceId: recurring ? `${ev.id}@${key}` : ev.id,
    baseId: ev.id,
    isRecurring: recurring,
  };
}

export function sortOccurrences(a: Occurrence, b: Occurrence): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.startTime && b.startTime) {
    const diff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (diff !== 0) return diff;
  }
  return a.createdAt - b.createdAt;
}

/**
 * מחזיר מפה של מפתח תאריך → מופעי אירועים, לטווח [start, end] כולל.
 */
export function expandEvents(
  events: UserEvent[],
  start: Date,
  end: Date,
): Map<DateKey, Occurrence[]> {
  const out = new Map<DateKey, Occurrence[]>();
  const push = (key: DateKey, occ: Occurrence) => {
    const arr = out.get(key);
    if (arr) arr.push(occ);
    else out.set(key, [occ]);
  };

  const startKey = dateKey(start);
  const endKey = dateKey(end);

  for (const ev of events) {
    if (ev.deleted) continue;
    if (ev.repeat === 'none') {
      if (ev.date >= startKey && ev.date <= endKey) push(ev.date, toOccurrence(ev, ev.date, false));
      continue;
    }
    const baseDate = keyToDate(ev.date);
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const key = dateKey(d);
      if (key === ev.date) {
        push(key, toOccurrence(ev, key, false));
      } else if (occursOn(ev, d, baseDate)) {
        push(key, toOccurrence(ev, key, true));
      }
    }
  }

  for (const arr of out.values()) arr.sort(sortOccurrences);
  return out;
}

/** מופעי אירועים ליום בודד. */
export function eventsOnDay(events: UserEvent[], day: Date): Occurrence[] {
  return expandEvents(events, day, day).get(dateKey(day)) ?? [];
}

export const REPEAT_LABELS: Record<UserEvent['repeat'], string> = {
  none: 'ללא חזרה',
  weekly: 'כל שבוע',
  monthly: 'כל חודש',
  yearly: 'כל שנה (לועזי)',
  'hebrew-yearly': 'כל שנה (עברי)',
};
