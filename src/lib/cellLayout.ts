/**
 * חלוקת הגובה של תא בלוח החודש בין האירועים, המועדים וזמן ההדלקה.
 *
 * החשבון בפיקסלים ולא ב"שורות": שורת המשך של כותרת עולה רק את גובה
 * השורה, בלי הריפוד והמרווח שהבלוק הראשון לוקח. כשהכול נספר בשורות
 * שלמות, כל אירוע קיבל שורה אחת והכותרת נחתכה אחרי מילה - בזמן שבתא
 * היה מקום לשתיים או שלוש.
 *
 * המידות נמדדות ברכיב (`MonthGrid`) מול הגופן בפועל, כי הטיפוגרפיה
 * נוזלית. כאן רק החשבון, ולכן הוא נבדק בלי דפדפן.
 */

export type CellMetrics = {
  /** הגובה שנשאר בתא מתחת למספר היום */
  space: number;
  /** רוחב הטקסט בתוך בלוק של אירוע */
  textWidth: number;
  /** הבלוק הראשון של אירוע: שורה, ריפוד ומרווח מהבא */
  firstLine: number;
  /** כל שורה נוספת של אותה כותרת */
  extraLine: number;
  /** שורת מועד או זמן הדלקה, כולל המרווח */
  row: number;
  /** רוחב ממוצע של תו בכותרת */
  charWidth: number;
};

export type CellItem = {
  title: string;
  /** פס רב־יומי נשאר בשורה אחת, כדי שגובהו יהיה זהה בכל הימים שהוא חוצה */
  multiDay: boolean;
  /** סימון רשימה משותפת לפני הכותרת */
  icon?: boolean;
};

/** יותר מזה כבר אינו תקציר, וחלונית היום מראה את הכול */
export const MAX_EVENT_LINES = 4;

/**
 * כמה שורות הכותרת צריכה ברוחב הנתון.
 *
 * שבירה במילים ולא חלוקה של האורך: בתא של טלפון נכנסים כשבעה תווים
 * בשורה, ו"יום הולדת" (9) כבר אינו נכנס - כל מילה בשורה משלה. חלוקה
 * פשוטה של האורך העריכה שלוש שורות לכותרת שצריכה ארבע.
 */
export function linesNeeded(item: CellItem, m: CellMetrics): number {
  if (item.multiDay || m.textWidth <= 0 || m.charWidth <= 0) return 1;
  const perLine = Math.max(1, Math.floor(m.textWidth / m.charWidth));
  const words = item.title.trim().split(/\s+/).filter(Boolean);
  // הסימון של רשימה משותפת תופס כשני תווים לפני המילה הראשונה
  let used = item.icon ? 2 : 0;
  let lines = 1;
  for (const word of words) {
    const need = used === 0 ? word.length : used + 1 + word.length;
    if (need <= perLine) {
      used = need;
      continue;
    }
    if (used > 0) lines++;
    // מילה ארוכה מהשורה נשברת באמצע (break-words)
    lines += Math.ceil(word.length / perLine) - 1;
    used = word.length % perLine || perLine;
  }
  return lines;
}

export type CellPlan = {
  /** כמה שורות לכל אירוע שמוצג, לפי הסדר */
  eventLines: number[];
  /** כמה מועדים נכנסים */
  holidays: number;
};

/**
 * מה שהמשתמש הכניס קודם למועדים: כל אירוע מקבל קודם בלוק אחד, ורק מה
 * שנשאר אחרי שמובטח בלוק לכל אירוע שעוד ממתין הולך לשורות נוספות -
 * אחרת הראשון היה בולע את המקום של השני. המועדים לוקחים את השארית.
 *
 * תמיד מוצג לפחות פריט אחד, גם בתא נמוך מדי: תא ריק נראה כיום ריק.
 */
export function planCell(
  events: CellItem[],
  holidayCount: number,
  hasTime: boolean,
  m: CellMetrics,
): CellPlan {
  let left = Math.max(m.firstLine, m.space - (hasTime ? m.row : 0));
  const eventLines: number[] = [];

  for (let i = 0; i < events.length; i++) {
    if (left < m.firstLine && eventLines.length > 0) break;
    left -= m.firstLine;
    const waiting = events.length - i - 1;
    const spare = left - waiting * m.firstLine;
    const want = Math.min(MAX_EVENT_LINES, linesNeeded(events[i], m)) - 1;
    const extra = spare > 0 ? Math.min(want, Math.floor(spare / m.extraLine)) : 0;
    eventLines.push(1 + extra);
    left -= extra * m.extraLine;
  }

  const holidays = Math.min(holidayCount, Math.max(0, Math.floor(left / m.row)));
  return { eventLines, holidays };
}
