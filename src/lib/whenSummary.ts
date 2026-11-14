/**
 * המשפטים שמסכמים "מתי" בטופס האירוע.
 *
 * שורת הסיכום מתחת לשעות והכיתוב על הכפתור הראשי. טהור ובלי React, כי
 * הוא נשען על חשבון ימים - והחשבון הזה הוא בדיוק מה שנשבר בערב, כשמישהו
 * מחשב בשעון UTC (CLAUDE.md, "תאריכים הם מקומיים").
 */
import type { DateKey } from '@/types';
import { WEEKDAYS_SHORT_HE, keyToDate, startOfDay, weekdayDateLabel } from './dates';
import { hebrewDateParts } from './hebrew';

/** כמה ימים מהיום אל התאריך. שלילי לעבר. */
export function daysFromToday(key: DateKey, now = new Date()): number {
  // עיגול ולא חיתוך: ביום המעבר לשעון קיץ יש ביממה 23 שעות
  return Math.round((keyToDate(key).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

/** "היום", "מחר", "בעוד 3 ימים", "לפני שבוע" */
export function relativeDaysLabel(key: DateKey, now = new Date()): string {
  const n = daysFromToday(key, now);
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  if (n === 2) return 'מחרתיים';
  if (n === -1) return 'אתמול';
  if (n === -2) return 'שלשום';
  const abs = Math.abs(n);
  const span = abs === 7 ? 'שבוע' : abs === 14 ? 'שבועיים' : `${abs} ימים`;
  return n > 0 ? `בעוד ${span}` : `לפני ${span}`;
}

/** "כ״ב בכסלו" */
function hebrewDay(key: DateKey): string {
  const h = hebrewDateParts(keyToDate(key));
  return `${h.day} ב${h.month}`;
}

/**
 * "בעוד 3 ימים · ראשון, 22 בנובמבר · ב׳ בכסלו".
 *
 * שלוש תשובות לאותה שאלה, כי כל אחד שואל אותה אחרת: מי שמתכנן סופר
 * ימים, מי שקובע פגישה חושב בתאריך, ומי שמתאם עם בית הכנסת - בעברי.
 * באירוע רב־יומי מתווסף אורכו ויום הסיום, בקיצור - שורה שנשברת לשתיים
 * דוחפת את השעות מעלה בכל פעם שמישהו מוסיף יום.
 */
export function whenSummary(
  timing: { date: DateKey; endDate?: DateKey },
  now = new Date(),
): string {
  const parts = [
    relativeDaysLabel(timing.date, now),
    weekdayDateLabel(keyToDate(timing.date)),
    hebrewDay(timing.date),
  ];
  if (timing.endDate && timing.endDate > timing.date) {
    const days = daysFromToday(timing.endDate, keyToDate(timing.date)) + 1;
    parts.push(`${days} ימים, עד ${shortDateLabel(timing.endDate)}`);
  }
  return parts.join(' · ');
}

/** "א׳ 22/11" - יום ותאריך בקיצור, לכפתור ולתוויות צרות */
export function shortDateLabel(key: DateKey): string {
  const d = keyToDate(key);
  return `${WEEKDAYS_SHORT_HE[d.getDay()]}׳ ${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * "א׳ 22/11 · 09:00", או בלי שעה לאירוע של כל היום.
 *
 * הכיתוב על הכפתור הראשי אומר את התוצאה: מי שלוחץ רואה בדיוק מה ייכתב,
 * ולא צריך לגלול חזרה למעלה כדי לוודא שהיום הוא הנכון.
 */
export function shortWhenLabel(key: DateKey, startTime: string | null): string {
  return startTime ? `${shortDateLabel(key)} · ${startTime}` : shortDateLabel(key);
}
