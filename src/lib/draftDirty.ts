/**
 * האם בטופס יש מה לאבד.
 *
 * הצורך: לחלונית יש ארבעה מוצאים - גרירה למטה, הקשה על הרקע, Esc
 * וכפתור החזרה - וכולם שקטים. אצבע שהחליקה קצת יותר מדי מחקה טופס
 * שמולא, בלי שום סימן שמשהו אבד. השאלה נשאלת רק כשבאמת יש מה לאבד,
 * אחרת היא הופכת לרעש שלוחצים עליו בלי לקרוא.
 *
 * טהור, כדי שהכלל ייבדק בלי דפדפן - וכדי שכל טופס ישאל את אותה שאלה.
 */

/**
 * ריק לצורך ההשוואה.
 *
 * `undefined`, `null` ומחרוזת ריקה מתארים כולם "לא מולא", והם מתחלפים
 * זה בזה לאורך הקוד: שדה רשות נמחק ל-`undefined` לפני כתיבה לענן,
 * ושעות נשמרות כ-`null` באירוע של כל היום. `false` ו-`0` אינם ברשימה
 * בכוונה - הם ערכים לכל דבר.
 */
function empty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function same(a: unknown, b: unknown): boolean {
  if (empty(a) && empty(b)) return true;
  return Object.is(a, b);
}

/** האם הטיוטה שונה ממה שהייתה כשהטופס נפתח. */
export function isDraftDirty<T extends object>(draft: T, baseline: T): boolean {
  const keys = new Set([...Object.keys(draft), ...Object.keys(baseline)]);
  for (const key of keys) {
    const a = (draft as Record<string, unknown>)[key];
    const b = (baseline as Record<string, unknown>)[key];
    if (same(a, b)) continue;

    /*
      שדה מקונן אחד קיים בטיוטות שלנו - מפת החריגים - והשוואה לפי
      זהות הייתה מסמנת אותה כשינוי בכל רינדור. השוואת JSON מספיקה:
      המפות קטנות והמפתחות נוצרים בסדר קבוע.
    */
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
    }
    return true;
  }
  return false;
}
