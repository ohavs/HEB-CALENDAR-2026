/** עזרי תאריכים לועזיים - הכול בשעון המקומי של המשתמש, בלי UTC. */
import type { DateKey } from '@/types';

export const GREG_MONTHS_HE = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
] as const;

export const WEEKDAYS_SHORT_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] as const;
export const WEEKDAYS_HE = [
  'ראשון',
  'שני',
  'שלישי',
  'רביעי',
  'חמישי',
  'שישי',
  'שבת',
] as const;

/** מפתח לוקאלי YYYY-MM-DD. חובה להשתמש בזה ולא ב-toISOString (שהוא UTC). */
export function dateKey(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function keyToDate(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** מזהה חודש יציב לצורך אנימציות ומפתחות React. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(d: Date): string {
  return `${GREG_MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * מייצר את תאי הרשת של החודש - 6 שורות של 7 ימים, כולל ימי גלישה
 * מהחודש הקודם והבא, כדי שגובה הלוח יישאר קבוע בכל החודשים.
 */
export function monthGridDays(month: Date, weekStart: 0 | 1 = 0): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** שמות הימים בסדר המתאים לתחילת השבוע שנבחרה. */
export function orderedWeekdays(weekStart: 0 | 1 = 0): readonly string[] {
  if (weekStart === 0) return WEEKDAYS_SHORT_HE;
  return [...WEEKDAYS_SHORT_HE.slice(1), WEEKDAYS_SHORT_HE[0]];
}

/** "12 בספטמבר 2026" */
export function longDateLabel(d: Date): string {
  return `${d.getDate()} ב${GREG_MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}

/** "יום שבת, 12 בספטמבר" */
export function dayTitleLabel(d: Date): string {
  return `יום ${WEEKDAYS_HE[d.getDay()]}, ${d.getDate()} ב${GREG_MONTHS_HE[d.getMonth()]}`;
}

/**
 * "חמישי, 17 בספטמבר" - אותו דבר בלי המילה "יום".
 *
 * בכותרת מסך "יום חמישי" נקרא נכון, אבל ברשימה שבה הכותרות הקודמות הן
 * "היום", "מחר" ו"מחרתיים" המילה הזו מאריכה את השורה הרביעית פי שלושה
 * ושוברת את הקצב.
 */
export function weekdayDateLabel(d: Date): string {
  return `${WEEKDAYS_HE[d.getDay()]}, ${d.getDate()} ב${GREG_MONTHS_HE[d.getMonth()]}`;
}

/**
 * "היום" / "מחר" / "אתמול" או תאריך.
 *
 * `short` משמיט את המילה "יום" מהתאריך. ברשימה שכותרותיה הראשונות הן
 * "היום", "מחר" ו"מחרתיים", "יום חמישי, 17 בספטמבר" ארוך פי שלושה
 * מקודמו ושובר את הקצב; בכותרת מסך בודדת דווקא "יום חמישי" נקרא נכון.
 */
export function relativeDayLabel(d: Date, now = new Date(), short = false): string {
  const diff = Math.round(
    (startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === -1) return 'אתמול';
  if (diff === 2) return 'מחרתיים';
  return short ? weekdayDateLabel(d) : dayTitleLabel(d);
}

/** HH:mm בשעון המקום של אזור הזמן הנתון (מטפל אוטומטית בשעון קיץ/חורף). */
export function formatTimeInZone(at: Date | number, tzid: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: tzid,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
}

/** HH:mm בשעון המקומי של המכשיר. */
export function formatTime(at: Date | number): string {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
}

/** ממיר "HH:mm" לדקות מתחילת היום. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** משלב מפתח תאריך ושעה לאובייקט Date בשעון המקומי. */
export function combineDateTime(key: DateKey, hhmm: string | null): Date {
  const d = keyToDate(key);
  if (!hhmm) return d;
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** משך בעברית: "שעה", "1.5 שעות", "45 דקות" */
export function durationLabel(startTime: string, endTime: string): string {
  let mins = timeToMinutes(endTime) - timeToMinutes(startTime);
  if (mins < 0) mins += 1440;
  if (mins === 0) return '';
  if (mins < 60) return `${mins} דקות`;
  const hours = mins / 60;
  if (mins === 60) return 'שעה';
  if (mins === 120) return 'שעתיים';
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} שעות`;
}
