/**
 * הכללים של הוספת תזכורת מהירה.
 *
 * טהור בכוונה, ולא בתוך המסך: מה שנקבע כאן - האם יש שעה, מהי, ומה
 * המשך - הוא בדיוק מה שהמשתמש רואה אחר כך בעורך. כשהשניים נקבעו בשני
 * מקומות הם נפרדו, והתזכורת נפתחה עם "כל היום" דלוק אחרי שנבחרה לה שעה.
 */
import type { DateKey, EventColor } from '@/types';
import type { EventDraft } from '@/store/events';
import { dateKey, minutesToTime, timeToMinutes } from './dates';

/** השעה שמוצעת לתזכורת שנקבעת ליום אחר. בוקר, ולא "עכשיו" של אתמול. */
export const DEFAULT_REMINDER_TIME = '09:00';
/** משך של תזכורת עם שעה. היא נקודה בזמן, ולא פגישה. */
export const REMINDER_LENGTH = 30;
/** הקפיצה שאליה מעגלים את "השעה הבאה" */
const STEP = 30;
/** אחרי זה כבר אין חצי שעה עגולה היום */
const LAST = 23 * 60 + 30;

/**
 * השעה שתוצע לתזכורת חדשה.
 *
 * ליום אחר - בוקר. להיום - חצי השעה העגולה הבאה, כי תזכורת שנקבעת
 * לשעה שכבר עברה לא תצלצל לעולם. מאוחר בלילה נעצרים ב-23:30 במקום
 * לגלוש ליום הבא, שהוא כבר לא היום שהמשתמש בחר.
 */
export function suggestReminderTime(now: Date, today: boolean): string {
  if (!today) return DEFAULT_REMINDER_TIME;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const next = Math.ceil((minutes + 1) / STEP) * STEP;
  return minutesToTime(Math.min(LAST, next));
}

/** שעת הסיום שנגזרת משעת ההתחלה, בלי לגלוש ליום הבא. */
export function reminderEndTime(start: string): string {
  return minutesToTime(Math.min(23 * 60 + 59, timeToMinutes(start) + REMINDER_LENGTH));
}

export type ReminderComposeInput = {
  title: string;
  color: EventColor;
  /** היום שנבחר, או null כשהתזכורת בלי תאריך */
  date: DateKey | null;
  /** השעה שנבחרה, או null ל"כל היום" */
  time: string | null;
  now: Date;
};

/**
 * הטיוטה שנשמרת.
 *
 * `allDay` נגזר מהשעה ולא מוגדר בנפרד: קודם הוא היה `true` תמיד, ולכן
 * כל תזכורת נפתחה בעורך כשהמתג דלוק והשעות מעומעמות - גם כשהמשתמש בא
 * במפורש לקבוע שעה. תזכורת בלי תאריך אינה יכולה לשאת שעה, ולכן שם
 * `allDay` נשאר דלוק.
 */
export function buildReminderDraft(input: ReminderComposeInput): EventDraft {
  const { title, color, date, now } = input;
  // אין יום - אין שעה. "מחר ב-10" בלי מחר הוא לא כלום
  const time = date ? input.time : null;

  return {
    title: title.trim(),
    // התאריך נשמר גם בפריט בלי תאריך, כדי שיהיה לו לאן לחזור
    date: date ?? dateKey(now),
    startTime: time,
    endTime: time ? reminderEndTime(time) : null,
    allDay: time === null,
    color,
    // בלי שעה אין רגע להתריע בו; עם שעה, ההתראה היא השעה עצמה
    reminderMinutes: time ? 0 : null,
    repeat: 'none',
    ...(date ? {} : { undated: true as const }),
  };
}

/**
 * שעת הסיום אחרי שההתחלה זזה.
 *
 * שומרת על המשך האירוע במקום על השעה עצמה: מי שמזיז פגישה בת שעה
 * מ-09:00 ל-14:00 מתכוון לפגישה בת שעה ב-14:00.
 *
 * שתי מלכודות שהפונקציה הזו קיימת בשבילן. `minutesToTime` מגלגל מודולו
 * יממה, ולכן 22:00 ועוד שלוש שעות היה מחזיר 01:00 - סיום לפני ההתחלה.
 * ומשך שלילי (סיום שקדם להתחלה, אחרי עריכה ידנית) היה מכווץ עוד, ולכן
 * הוא נחסם באפס.
 */
export function shiftEndWithStart(from: string, end: string, to: string): string {
  const length = Math.max(0, timeToMinutes(end) - timeToMinutes(from));
  return minutesToTime(Math.min(23 * 60 + 59, timeToMinutes(to) + length));
}
