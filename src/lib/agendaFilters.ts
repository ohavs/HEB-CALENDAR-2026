/**
 * מה מוצג בסדר היום.
 *
 * בתשרי יש מועד כמעט בכל יום, ובלי סינון האירועים של המשתמש נבלעים בין
 * צום גדליה, שבת שובה, ערב יום כיפור וערב סוכות. הפילטרים כאן הם עדשה
 * על התצוגה הזו בלבד: הם לא משנים את הלוח עצמו, ולכן אפשר לראות סדר יום
 * נקי של אירועים אישיים בלי לוותר על המועדים ברשת החודש.
 *
 * הקטגוריות גסות בכוונה. ההגדרות כבר מציעות שליטה מדויקת לפי סוג מועד,
 * וכאן צריך שש החלטות מהירות שאפשר לקבל בלי לחשוב - לא שכפול של אותה
 * רשימה.
 *
 * המצב נשמר כרשימת מה ש*מוסתר*, ולא של מה שמוצג: כך קטגוריה שתתווסף
 * בעתיד תופיע כברירת מחדל, במקום להיעלם אצל מי שכבר שמר העדפה.
 */
import type { AgendaCategory, DayInfo, HolidayItem, HolidayKind } from '@/types';
import type { Occurrence } from './recurrence';

export type { AgendaCategory };

export const AGENDA_CATEGORIES: { id: AgendaCategory; label: string }[] = [
  { id: 'events', label: 'האירועים שלי' },
  { id: 'holidays', label: 'חגים ומועדים' },
  { id: 'fasts', label: 'צומות' },
  { id: 'modern', label: 'מועדי ישראל' },
  { id: 'roshchodesh', label: 'ראש חודש' },
  { id: 'times', label: 'זמני שבת' },
];

/**
 * לאיזו קטגוריה שייך מועד.
 * מחזיר null למה שממילא אינו מוצג ברשימה (פרשה, ספירת העומר).
 */
export function categoryOfHoliday(kind: HolidayKind): AgendaCategory | null {
  switch (kind) {
    case 'yomtov':
    case 'cholhamoed':
    case 'erev':
    case 'minor':
    case 'specialshabbat':
      return 'holidays';
    case 'majorfast':
    case 'minorfast':
      return 'fasts';
    case 'modern':
      return 'modern';
    case 'roshchodesh':
      return 'roshchodesh';
    default:
      return null;
  }
}

export function isHidden(hidden: AgendaCategory[], category: AgendaCategory): boolean {
  return hidden.includes(category);
}

/** מוסיף או מסיר קטגוריה מרשימת המוסתרים. */
export function toggleCategory(
  hidden: AgendaCategory[],
  category: AgendaCategory,
): AgendaCategory[] {
  return hidden.includes(category)
    ? hidden.filter((c) => c !== category)
    : [...hidden, category];
}

export type AgendaDay = {
  day: DayInfo;
  occurrences: Occurrence[];
};

/**
 * מחיל את הפילטרים על יום אחד.
 * מחזיר null כשלא נשאר בו כלום - יום ריק בסדר יום הוא רעש.
 */
export function filterAgendaDay(
  day: DayInfo,
  occurrences: Occurrence[],
  hidden: AgendaCategory[],
): AgendaDay | null {
  const holidays: HolidayItem[] = day.holidays.filter((h) => {
    const category = categoryOfHoliday(h.kind);
    return category !== null && !hidden.includes(category);
  });

  const times = hidden.includes('times')
    ? []
    : day.times.filter((t) => t.kind === 'candles' || t.kind === 'havdalah');

  const events = hidden.includes('events') ? [] : occurrences;

  if (!holidays.length && !times.length && !events.length) return null;
  return { day: { ...day, holidays, times }, occurrences: events };
}

/** כמה קטגוריות פעילות, לחיווי "מסונן" בכותרת. */
export function activeCount(hidden: AgendaCategory[]): number {
  return AGENDA_CATEGORIES.length - hidden.length;
}
