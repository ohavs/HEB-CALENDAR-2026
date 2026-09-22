/**
 * מסך התזכורות.
 *
 * תזכורת היא אירוע - אותה ישות בדיוק. זו לא קיצור דרך אלא ההחלטה
 * המרכזית כאן: "לקנות חלב מחר ב-18:00" ו"תזכורת לקנות חלב" הם אותו דבר
 * מנקודת מבט של המשתמש, ולהחזיק להם שני מודלים נפרדים היה מכפיל את
 * החזרתיות, את החריגים, את הגדר הגאוגרפית, את התזכורות ואת הסנכרון -
 * פעמיים כל אחד, ועם שני מקומות להישבר בהם.
 *
 * ההבדל היחיד הוא הדגל `undated`: פריט שאינו משויך ליום. הוא לא מופיע
 * בלוח כלל (`expandEvents` מדלג עליו), והוא נאסף כאן לקבוצה אחת בראש
 * הרשימה. שיוך ליום הוא כיבוי הדגל, וביטול שיוך הוא הדלקה שלו.
 */
import type { DateKey, DayInfo, UserEvent } from '@/types';
import type { Occurrence } from './recurrence';
import { addDays, dateKey, relativeDayLabel, startOfDay } from './dates';

/** כמה ימים קדימה נאספים פריטים משויכים */
export const HORIZON_DAYS = 120;

/** פריט ברשימה: מופע מהלוח, או תזכורת בלי תאריך. */
export type ReminderItem = {
  /** מזהה יציב לרשימה ולגרירה */
  key: string;
  /** מזהה האירוע המקורי */
  baseId: string;
  /** התאריך שבו המופע היה אמור לחול - המפתח שבו נשמר חריג */
  sourceKey: DateKey;
  title: string;
  /** שעה, או ריק לפריט של כל היום */
  time: string;
  done: boolean;
  color: UserEvent['color'];
  /** יש לו התראה מבוססת מיקום */
  hasPlace: boolean;
  /** יש לו תזכורת בזמן */
  hasAlarm: boolean;
  repeating: boolean;
  /** המופע עצמו, למסך העריכה. חסר בתזכורת בלי תאריך. */
  occurrence?: Occurrence;
  /** האירוע עצמו, לתזכורת בלי תאריך */
  event?: UserEvent;
};

export type ReminderGroup = {
  /** מפתח היום, או `undated` לקבוצה שאין לה תאריך */
  key: DateKey | 'undated';
  /** "בלי תאריך", "היום", "יום שני, 21 בספטמבר" */
  label: string;
  /** התאריך העברי, שורה משנית. ריק בקבוצה שאין לה תאריך. */
  hebrew: string;
  /** האם אפשר להפיל לכאן פריט בגרירה */
  droppable: boolean;
  items: ReminderItem[];
};

function itemFromOccurrence(occ: Occurrence): ReminderItem {
  return {
    key: occ.occurrenceId,
    baseId: occ.baseId,
    sourceKey: occ.sourceKey,
    title: occ.title,
    time: occ.allDay ? '' : (occ.startTime ?? ''),
    done: occ.done,
    color: occ.color,
    hasPlace: Boolean(occ.placeId && occ.placeTrigger),
    hasAlarm: occ.reminderMinutes !== null,
    repeating: occ.repeat !== 'none',
    occurrence: occ,
  };
}

function itemFromEvent(ev: UserEvent): ReminderItem {
  return {
    key: ev.id,
    baseId: ev.id,
    sourceKey: ev.date,
    title: ev.title,
    time: ev.allDay ? '' : (ev.startTime ?? ''),
    done: ev.exceptions?.[ev.date]?.done === true,
    color: ev.color,
    hasPlace: Boolean(ev.placeId && ev.placeTrigger),
    hasAlarm: ev.reminderMinutes !== null,
    repeating: ev.repeat !== 'none',
    event: ev,
  };
}

/**
 * מה שסומן "בוצע" יורד לתחתית הקבוצה שלו.
 *
 * חלוקה יציבה ולא מיון: הסדר בין הפתוחות נקבע כבר - לפי שעה ביום, לפי
 * זמן יצירה בקבוצה שאין לה תאריך - ומיון לפי `done` היה מערבב אותו.
 * מה שנשאר לעשות מבקש את תשומת הלב, ומה שנגמר רק צריך להיות נגיש
 * לביטול.
 *
 * מחזירה את המערך עצמו כשאין מה להזיז, כדי לא ליצור זהות חדשה בכל ציור.
 */
function sinkDone(items: ReminderItem[]): ReminderItem[] {
  const open = items.filter((i) => !i.done);
  if (open.length === items.length) return items;
  return [...open, ...items.filter((i) => i.done)];
}

/** התזכורות שאינן משויכות ליום, החדשות למעלה והבוצעו בתחתית. */
export function undatedReminders(events: UserEvent[]): ReminderItem[] {
  return sinkDone(
    events
      .filter((ev) => ev.undated && !ev.deleted)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(itemFromEvent),
  );
}

/**
 * בונה את רשימת התזכורות: קבוצה ללא תאריך בראש, ואחריה הימים לפי סדרם.
 *
 * ימים ריקים אינם מוצגים - רשימה ארוכה של כותרות בלי תוכן היא רעש -
 * אבל היום עצמו תמיד מוצג, גם כשאין בו כלום, כדי שתמיד יהיה לאן לגרור.
 */
export function buildReminderGroups(
  events: UserEvent[],
  occurrences: Map<DateKey, Occurrence[]>,
  days: Map<DateKey, DayInfo>,
  now = new Date(),
  horizon = HORIZON_DAYS,
): ReminderGroup[] {
  const groups: ReminderGroup[] = [];

  const undated = undatedReminders(events);
  if (undated.length) {
    groups.push({
      key: 'undated',
      label: 'בלי תאריך',
      hebrew: '',
      droppable: true,
      items: undated,
    });
  }

  const from = startOfDay(now);
  const todayKey = dateKey(from);

  for (let i = 0; i < horizon; i += 1) {
    const date = addDays(from, i);
    const key = dateKey(date);
    const items = sinkDone((occurrences.get(key) ?? []).map(itemFromOccurrence));
    if (!items.length && key !== todayKey) continue;
    groups.push({
      key,
      label: relativeDayLabel(date, now, true),
      hebrew: days.get(key)?.hebrewFull ?? '',
      droppable: true,
      items,
    });
  }

  return groups;
}

/**
 * כמה פריטים מבקשים תשומת לב עכשיו: בלי תאריך, ומה שנשאר פתוח היום.
 *
 * הספירה הקודמת רצה על כל האופק - 120 יום - ולכן שיעור שבועי אחד תרם
 * לה שבעה־עשר "פתוחים" ויום הולדת שנתי נספר כמשימה. המספר היה נכון
 * טכנית וחסר משמעות: הוא תיאר כמה אירועים יש ביומן, לא כמה דברים
 * ממתינים, והפך מסך רגיל למסך מאיים.
 */
export function pendingCount(
  groups: ReminderGroup[],
  todayKey: DateKey,
): { undated: number; today: number } {
  let undated = 0;
  let today = 0;
  for (const group of groups) {
    if (group.key !== 'undated' && group.key !== todayKey) continue;
    for (const item of group.items) {
      if (item.done) continue;
      if (group.key === 'undated') undated += 1;
      else today += 1;
    }
  }
  return { undated, today };
}

/* ==========================================================================
   ניקוי אוטומטי של מה שבוצע
   ========================================================================== */

/** כמה ימים אחרי הסימון הפריט נמחק. 0 מכבה את הניקוי. */
export const CLEANUP_CHOICES = [0, 1, 3, 7] as const;
export type CleanupDays = (typeof CLEANUP_CHOICES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * אילו תזכורות אפשר למחוק, אחרי שסומנו ועבר זמן.
 *
 * מה שבוצע לפני יומיים אינו מידע, הוא רק אורך רשימה - אבל מחיקה היא
 * פעולה שאין ממנה דרך חזרה במסך, ולכן היא מצומצמת בכוונה:
 *
 * - **רק אירוע שאינו חוזר.** מחיקת סדרה בגלל שמופע אחד בוצע הייתה
 *   מוחקת גם את כל מה שעוד לא קרה. מופע בסדרה נושר מהרשימה מעצמו
 *   כשהיום עובר.
 * - **רק מה שיש לו `doneAt`.** אבל סימון שנעשה לפני שהשדה קיים אינו
 *   מאבד את תורו: `updatedAt` של האירוע הוא קירוב סביר במקרה הזה, כי
 *   הסימון היה השינוי האחרון בו.
 *
 * המחיקה עצמה היא `remove` הרגיל, כלומר סימון מחיקה שמסתנכרן - ולא
 * הסרה מקומית שהענן יחזיר.
 */
export function sweepDone(events: UserEvent[], days: number, now = Date.now()): string[] {
  if (days <= 0) return [];
  const cutoff = now - days * DAY_MS;
  const ids: string[] = [];

  for (const ev of events) {
    if (ev.deleted || ev.repeat !== 'none') continue;
    const exception = ev.exceptions?.[ev.date];
    if (!exception?.done) continue;
    const at = exception.doneAt ?? ev.updatedAt;
    if (at <= cutoff) ids.push(ev.id);
  }

  return ids;
}
