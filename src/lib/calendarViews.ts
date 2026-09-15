/**
 * אילו תצוגות לוח זמינות, ומה הבאה במחזור.
 *
 * למה זה מודול טהור ולא שלוש שורות בתוך הכפתור: שלושה מקומות שואלים
 * את אותה שאלה - הכפתור שמחליף, המסך שמחליט מה לצייר, והכותרת שמחליטה
 * אם להראות את הכפתור בכלל. שלוש תשובות נפרדות היו נפרדות גם בתוצאה
 * ביום שמישהו ישנה אחת מהן.
 *
 * **חודש אינו ניתן לכיבוי.** הוא התצוגה הראשית, וכיבוי של כל השלוש היה
 * משאיר מסך בלי לוח.
 */
import type { CalendarView, Settings } from '@/types';

/** הסדר הקבוע. הוא גם סדר המחזור של הכפתור. */
export const ALL_VIEWS: CalendarView[] = ['month', 'week', 'agenda'];

type ViewSettings = Pick<Settings, 'showWeekView' | 'showAgendaView'>;

/** התצוגות שהמשתמש השאיר דלוקות, בסדר הקבוע. */
export function availableViews(settings: ViewSettings): CalendarView[] {
  const out: CalendarView[] = ['month'];
  if (settings.showWeekView) out.push('week');
  if (settings.showAgendaView) out.push('agenda');
  return out;
}

/**
 * התצוגה שבאמת תוצג.
 *
 * ההגדרה השמורה אינה נמחקת כשמכבים תצוגה - מי שיחזיר אותה יחזור אליה.
 * עד אז המסך נופל לחודש.
 */
export function resolveView(stored: CalendarView, available: CalendarView[]): CalendarView {
  return available.includes(stored) ? stored : 'month';
}

/** התצוגה הבאה במחזור. */
export function nextView(current: CalendarView, available: CalendarView[]): CalendarView {
  if (available.length === 0) return 'month';
  const at = available.indexOf(current);
  // תצוגה שכובתה אינה במחזור, ולכן ההמשך הטבעי הוא מתחילתו
  if (at === -1) return available[0];
  return available[(at + 1) % available.length];
}

/** האם יש בכלל בין מה להחליף. */
export function canSwitchViews(available: CalendarView[]): boolean {
  return available.length > 1;
}
