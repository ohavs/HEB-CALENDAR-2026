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

/** התזכורות שאינן משויכות ליום, החדשות למעלה. */
export function undatedReminders(events: UserEvent[]): ReminderItem[] {
  return events
    .filter((ev) => ev.undated && !ev.deleted)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(itemFromEvent);
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
    const items = (occurrences.get(key) ?? []).map(itemFromOccurrence);
    if (!items.length && key !== todayKey) continue;
    groups.push({
      key,
      label: relativeDayLabel(date, now),
      hebrew: days.get(key)?.hebrewFull ?? '',
      droppable: true,
      items,
    });
  }

  return groups;
}

/** כמה פריטים פתוחים בסך הכול, לכותרת המסך. */
export function openCount(groups: ReminderGroup[]): number {
  let open = 0;
  for (const group of groups) {
    for (const item of group.items) if (!item.done) open += 1;
  }
  return open;
}
