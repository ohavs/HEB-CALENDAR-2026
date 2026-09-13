/**
 * פריסת אירועים חוזרים על טווח תאריכים.
 * הפריסה נעשית על חלון קטן (בדרך כלל 42 ימי הרשת), ולכן די בבדיקה יומית
 * פשוטה במקום מנוע RRULE מלא.
 *
 * חריגים למופע יחיד
 * ------------------
 * מופע בודד יכול להיות מבוטל, מוזז ליום אחר, או שונה בשדה כלשהו, בלי
 * שהסדרה כולה תושפע. החריגים נשמרים על האירוע לפי *התאריך המקורי* של
 * המופע, גם אחרי שהוזז - כך אפשר להזיז אותו שוב או להחזיר אותו למקומו,
 * במקום ליצור חריג חדש בכל הזזה.
 *
 * מכאן נובעות שתי מעברות בפריסה: אחת על הימים שבטווח, ואחת על מפת
 * החריגים - כי מופע שהוזז *לתוך* הטווח מיום שמחוצה לו לא ייתפס בראשונה.
 */
import { HDate } from '@hebcal/core';
import type { DateKey, EventException, UserEvent } from '@/types';
import { addDays, dateKey, keyToDate, timeToMinutes } from './dates';

export type Occurrence = UserEvent & {
  /** מזהה ייחודי למופע (עבור React ולגרירה) */
  occurrenceId: string;
  /** מזהה האירוע המקורי */
  baseId: string;
  /** האם זה מופע של אירוע חוזר (ולא האירוע המקורי) */
  isRecurring: boolean;
  /**
   * התאריך שבו המופע היה אמור לחול. שווה ל-date אלא אם המופע הוזז,
   * וזהו המפתח שבו נשמר החריג.
   */
  sourceKey: DateKey;
  /** האם למופע הזה יש חריג משלו */
  hasException: boolean;
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

/**
 * האם המפתח הנתון הוא מופע לגיטימי של האירוע.
 * שומר מפני חריג יתום שנשאר אחרי ששינו את כלל החזרה.
 */
export function isOccurrenceKey(ev: UserEvent, key: DateKey): boolean {
  if (key === ev.date) return true;
  if (ev.repeat === 'none') return false;
  return occursOn(ev, keyToDate(key), keyToDate(ev.date));
}

/** השדות שחריג יכול לדרוס במופע. */
const OVERRIDE_FIELDS = [
  'title',
  'startTime',
  'endTime',
  'allDay',
  'location',
  'notes',
  'color',
  'reminderMinutes',
] as const;

function applyException(base: UserEvent, exception: EventException | undefined): UserEvent {
  if (!exception) return base;
  const out = { ...base };
  for (const field of OVERRIDE_FIELDS) {
    const value = exception[field];
    if (value !== undefined) (out as Record<string, unknown>)[field] = value;
  }
  return out;
}

function toOccurrence(
  ev: UserEvent,
  sourceKey: DateKey,
  outKey: DateKey,
  exception?: EventException,
): Occurrence {
  const recurring = sourceKey !== ev.date;
  return {
    ...applyException(ev, exception),
    date: outKey,
    occurrenceId: recurring ? `${ev.id}@${sourceKey}` : ev.id,
    baseId: ev.id,
    isRecurring: recurring,
    sourceKey,
    hasException: Boolean(exception),
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
    const exceptions = ev.exceptions;

    /* ---------- מעבר ראשון: מופעים במקומם הטבעי ---------- */
    if (ev.repeat === 'none') {
      const exception = exceptions?.[ev.date];
      if (!exception?.cancelled && !exception?.movedTo && ev.date >= startKey && ev.date <= endKey) {
        push(ev.date, toOccurrence(ev, ev.date, ev.date, exception));
      }
    } else {
      const baseDate = keyToDate(ev.date);
      for (let d = start; d <= end; d = addDays(d, 1)) {
        const key = dateKey(d);
        if (key !== ev.date && !occursOn(ev, d, baseDate)) continue;
        const exception = exceptions?.[key];
        // מופע שבוטל נעלם; מופע שהוזז ייפלט במעבר השני, ביעד שלו
        if (exception?.cancelled || exception?.movedTo) continue;
        push(key, toOccurrence(ev, key, key, exception));
      }
    }

    /* ---------- מעבר שני: מופעים שהוזזו לתוך הטווח ---------- */
    if (!exceptions) continue;
    for (const [sourceKey, exception] of Object.entries(exceptions)) {
      const target = exception.movedTo;
      if (!target || exception.cancelled) continue;
      if (target < startKey || target > endKey) continue;
      if (!isOccurrenceKey(ev, sourceKey)) continue;
      push(target, toOccurrence(ev, sourceKey, target, exception));
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
