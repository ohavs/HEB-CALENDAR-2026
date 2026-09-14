/**
 * הגשר אל הוידג׳טים במסך הבית.
 *
 * הזרימה היא בשני כיוונים, ושניהם עוברים דרך אותו קובץ SharedPreferences:
 *
 * - **החוצה:** האפליקציה מפרסמת JSON מוכן לציור. הוידג׳ט אינו מריץ שום
 *   קוד שלנו, ולכן כל חישוב נעשה כאן.
 * - **פנימה:** סימון "בוצע" או הוספת תזכורת מהוידג׳ט נרשמים בתור, כי
 *   האפליקציה עשויה להיות סגורה לגמרי. הוידג׳ט מעדכן בינתיים את התצוגה
 *   שלו בעצמו, והאפליקציה מיישמת את התור בפעם הבאה שהיא עולה.
 *
 * הפלאגין הוא מקומי ולא חבילה: כל מה שהוא עושה הוא לכתוב, לקרוא ולבקש
 * מהמערכת לצייר מחדש - ולזה לא צריך תלות חיצונית.
 */
import { registerPlugin } from '@capacitor/core';
import { isNative } from './native';
import {
  parseInbox,
  type CalendarWidgetData,
  type RemindersWidgetData,
  type WidgetAction,
} from './widgetData';

type HebWidgetsPlugin = {
  /** כותב את שני המסמכים ומבקש מהמערכת לצייר את הוידג׳טים מחדש */
  publish(options: { calendar: string; reminders: string }): Promise<void>;
  /** מחזיר את תור הפעולות שהוידג׳ט צבר, ומרוקן אותו */
  takeInbox(): Promise<{ actions: string }>;
};

const HebWidgets = registerPlugin<HebWidgetsPlugin>('HebWidgets');

/** מפרסם את מצב הוידג׳טים. נכשל בשקט - וידג׳ט אינו קריטי לאפליקציה. */
export async function publishWidgets(
  calendar: CalendarWidgetData,
  reminders: RemindersWidgetData,
): Promise<void> {
  if (!isNative()) return;
  try {
    await HebWidgets.publish({
      calendar: JSON.stringify(calendar),
      reminders: JSON.stringify(reminders),
    });
  } catch {
    /* אין וידג׳טים במכשיר הזה, או שהפלאגין אינו זמין */
  }
}

/**
 * שולף את הפעולות שהוידג׳ט צבר ומרוקן את התור.
 *
 * הריקון הוא חלק מהקריאה ולא פעולה נפרדת: שתי קריאות נפרדות היו יוצרות
 * חלון שבו פעולה חדשה נמחקת בלי שיושמה.
 */
export async function takeWidgetActions(): Promise<WidgetAction[]> {
  if (!isNative()) return [];
  try {
    const { actions } = await HebWidgets.takeInbox();
    return parseInbox(actions);
  } catch {
    return [];
  }
}
