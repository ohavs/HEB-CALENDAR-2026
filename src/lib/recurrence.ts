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
  /**
   * מיקום היום המוצג בתוך אירוע רב־יומי: 0 ביום הראשון.
   * `spanLength` הוא 1 באירוע של יום אחד, ולכן ברוב האירועים אין לזה
   * משמעות - אבל הוא מה שמאפשר לצייר פס רציף על פני התאים.
   */
  spanIndex: number;
  spanLength: number;
  /** היום הראשון של הפרישה */
  spanStart: DateKey;
  /** המופע סומן כבוצע */
  done: boolean;
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
  'endDate',
  'title',
  'startTime',
  'endTime',
  'allDay',
  'location',
  'placeId',
  'placeTrigger',
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
  spanStart: DateKey,
  renderKey: DateKey,
  exception: EventException | undefined,
  spanIndex: number,
  spanLength: number,
): Occurrence {
  const recurring = sourceKey !== ev.date;
  return {
    ...applyException(ev, exception),
    date: renderKey,
    occurrenceId: recurring ? `${ev.id}@${sourceKey}` : ev.id,
    baseId: ev.id,
    isRecurring: recurring,
    sourceKey,
    hasException: Boolean(exception),
    done: exception?.done === true,
    spanIndex,
    spanLength,
    spanStart,
  };
}

export function sortOccurrences(a: Occurrence, b: Occurrence): number {
  // אירוע רב־יומי מתנהג כמו אירוע של כל היום: הוא מתאר את היום כולו
  const aWide = a.allDay || a.spanLength > 1;
  const bWide = b.allDay || b.spanLength > 1;
  if (aWide !== bWide) return aWide ? -1 : 1;
  if (a.spanLength !== b.spanLength) return b.spanLength - a.spanLength;
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

  /** יום הסיום של פרישה שמתחילה ב-firstKey, לפי אורך הפרישה של האירוע. */
  const spanEndFor = (ev: UserEvent, firstKey: DateKey): DateKey | undefined => {
    const length = spanLengthOf(ev);
    if (length <= 1) return undefined;
    return dateKey(addDays(keyToDate(firstKey), length - 1));
  };

  /**
   * פולט את המופע לכל ימי הפרישה שנופלים בתוך הטווח. אירוע של יום אחד
   * הוא המקרה הפרטי שבו הפרישה היא יום אחד בלבד.
   */
  const emit = (
    ev: UserEvent,
    sourceKey: DateKey,
    firstKey: DateKey,
    exception?: EventException,
  ) => {
    const length = spanLengthOf({
      date: firstKey,
      endDate: exception?.endDate ?? spanEndFor(ev, firstKey),
    });
    const firstDate = keyToDate(firstKey);
    for (let i = 0; i < length; i += 1) {
      const key = dateKey(addDays(firstDate, i));
      if (key < startKey) continue;
      if (key > endKey) break;
      push(key, toOccurrence(ev, sourceKey, firstKey, key, exception, i, length));
    }
  };

  for (const ev of events) {
    if (ev.deleted) continue;
    const exceptions = ev.exceptions;

    /* ---------- מעבר ראשון: מופעים במקומם הטבעי ---------- */
    if (ev.repeat === 'none') {
      const exception = exceptions?.[ev.date];
      if (!exception?.cancelled && !exception?.movedTo) emit(ev, ev.date, ev.date, exception);
    } else {
      const baseDate = keyToDate(ev.date);
      // אירוע רב־יומי שהתחיל לפני החלון עדיין נמשך לתוכו, ולכן הסריקה
      // מתחילה מוקדם יותר באורך הפרישה
      const scanStart = addDays(start, -(maxSpanDays(ev) - 1));
      for (let d = scanStart; d <= end; d = addDays(d, 1)) {
        const key = dateKey(d);
        if (key !== ev.date && !occursOn(ev, d, baseDate)) continue;
        const exception = exceptions?.[key];
        // מופע שבוטל נעלם; מופע שהוזז ייפלט במעבר השני, ביעד שלו
        if (exception?.cancelled || exception?.movedTo) continue;
        emit(ev, key, key, exception);
      }
    }

    /* ---------- מעבר שני: מופעים שהוזזו לתוך הטווח ---------- */
    if (!exceptions) continue;
    for (const [sourceKey, exception] of Object.entries(exceptions)) {
      const target = exception.movedTo;
      if (!target || exception.cancelled) continue;
      if (!isOccurrenceKey(ev, sourceKey)) continue;
      emit(ev, sourceKey, target, exception);
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

/* ==========================================================================
   אירועים רב־יומיים
   ========================================================================== */

/** כמה ימים האירוע נמשך. 1 לאירוע רגיל. */
export function spanLengthOf(ev: { date: DateKey; endDate?: DateKey }): number {
  if (!ev.endDate || ev.endDate <= ev.date) return 1;
  const days = Math.round(
    (keyToDate(ev.endDate).getTime() - keyToDate(ev.date).getTime()) / 86_400_000,
  );
  return Math.max(1, days + 1);
}

/** האם היום הזה הוא היום האחרון בפרישה. */
export function isSpanEnd(occ: Occurrence): boolean {
  return occ.spanIndex === occ.spanLength - 1;
}

/**
 * הפרישה הארוכה ביותר שהאירוע יכול לייצר, כולל חריגים שהאריכו מופע
 * יחיד. זה מה שקובע כמה אחורה צריך לסרוק כדי לא לפספס פרישה שהתחילה
 * לפני החלון ונמשכת לתוכו.
 */
function maxSpanDays(ev: UserEvent): number {
  let longest = spanLengthOf(ev);
  if (!ev.exceptions) return longest;
  for (const [sourceKey, exception] of Object.entries(ev.exceptions)) {
    if (!exception.endDate) continue;
    longest = Math.max(
      longest,
      spanLengthOf({ date: exception.movedTo ?? sourceKey, endDate: exception.endDate }),
    );
  }
  return longest;
}
