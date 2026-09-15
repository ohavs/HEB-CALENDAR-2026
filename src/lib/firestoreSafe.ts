/**
 * ניקוי ערכי `undefined` לפני כתיבה ל-Firestore.
 *
 * Firestore דוחה מסמך שיש בו ערך `undefined` - לא מתעלם ממנו, *דוחה*
 * את כל הכתיבה: `Unsupported field value: undefined`. וזה קל במיוחד
 * ליפול לזה כי `JSON.stringify` דווקא מוריד את השדות האלה בשקט, ולכן
 * האחסון המקומי נראה תקין והבאג מופיע רק מול הענן.
 *
 * זה קרה: `normalizeTemplate` כתב `location: undefined` לתבנית בלי
 * מקום, והתבניות נוסעות בתוך מסמך ההגדרות - כך שכל דחיפה של ההגדרות
 * נכשלה, והמשתמש ראה "הסנכרון לענן נכשל" בלי קשר נראה לעין לתבניות.
 *
 * תוקן במקור, אבל התיקון במקור מגן רק על השדה שכבר ידוע. השכבה הזו
 * מגנה על השדה הבא: כל שדה רשות חדש שיתווסף להגדרות לא יוכל להפיל את
 * הסנכרון.
 *
 * מה *לא* נעשה כאן: `null` נשאר `null`. הוא ערך תקין ב-Firestore, ויש
 * לו משמעות - "אין שעה" שונה מ"לא נשמר".
 */

/** האם זה אובייקט רגיל שאפשר לרדת לתוכו */
function isPlain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * מחזיר עותק בלי אף ערך `undefined`, בכל עומק - כולל בתוך מערכים,
 * ששם יושבות התבניות והמקומות השמורים.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (isPlain(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      out[key] = stripUndefined(item);
    }
    return out as T;
  }
  return value;
}
