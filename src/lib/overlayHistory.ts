/**
 * כפתור החזרה של אנדרואיד, דרך היסטוריית הדפדפן.
 *
 * הבעיה: כל החלוניות באפליקציה הן מצב של React ולא כתובת. במצב הזה
 * לחיצה על "חזרה" באנדרואיד סוגרת את האפליקציה כולה, גם כשפתוח גיליון
 * עריכת אירוע - וזו ההתנהגות שהופכת אפליקציה עטופה להרגיש שבורה.
 *
 * הפתרון: כל שכבה שנפתחת דוחפת רשומה להיסטוריה, ונשמרת במחסנית LIFO.
 * לחיצה על "חזרה" סוגרת את העליונה. סגירה מהקוד (כפתור X, שמירה, בחירה
 * מרשימה) מסלקת את הרשומה מההיסטוריה כדי שהיא לא תישאר תלויה שם.
 *
 * הלולאה שצריך להיזהר ממנה: הסגירה מהקוד קוראת ל-history.back(), שמפעיל
 * popstate, שהיה סוגר עוד שכבה. `selfInitiated` סופר את הקריאות שלנו,
 * וה-listener מדלג עליהן.
 *
 * אותו מנגנון משרת גם את דפדפן הנייד, שבו החלקת "חזרה" התנהגה עד כה
 * בדיוק כמו באנדרואיד.
 */
import { useEffect, useRef } from 'react';

/** `close` מחזירה false כששכבה סירבה להיסגר - למשל כי היא שאלה קודם */
type Entry = { id: number; close: () => boolean };

const stack: Entry[] = [];
let nextId = 1;
/** כמה קריאות history.back() יזמנו בעצמנו וטרם נצרכו */
let selfInitiated = 0;
let listening = false;

function onPopState(): void {
  if (selfInitiated > 0) {
    selfInitiated -= 1;
    return;
  }
  const entry = stack.pop();
  if (!entry) return;
  if (entry.close()) return;

  /*
    השכבה סירבה להיסגר - יש בה מה לאבד, והיא שאלה קודם. הרשומה חייבת
    לחזור: ה"חזרה" כבר צרכה אותה מההיסטוריה, ובלי דחיפה מחדש הלחיצה
    הבאה הייתה יוצאת מהאפליקציה בזמן שהגיליון עוד פתוח.

    `pushState` אינו מפעיל popstate, ולכן אין כאן מה לספור ב-selfInitiated.
  */
  stack.push(entry);
  window.history.pushState({ overlay: entry.id }, '');
}

function ensureListening(): void {
  if (listening || typeof window === 'undefined') return;
  window.addEventListener('popstate', onPopState);
  listening = true;
}

/** כמה שכבות פתוחות כרגע. לשימוש בדיקות ואבחון. */
export function overlayDepth(): number {
  return stack.length;
}

/** מאפס את המחסנית. לשימוש בדיקות בלבד. */
export function resetOverlayHistory(): void {
  stack.length = 0;
  selfInitiated = 0;
}

/**
 * מחבר שכבה להיסטוריה.
 *
 * @param open   האם השכבה פתוחה כרגע
 * @param onClose מה לעשות כשכפתור החזרה נלחץ. `false` פירושו שהשכבה
 *                בחרה להישאר פתוחה, והרשומה תידחף חזרה להיסטוריה.
 */
export function useOverlayHistory(open: boolean, onClose: () => boolean | void): void {
  // שומרים את הקולבק ב-ref כדי שהאפקט לא ייבנה מחדש בכל רינדור
  const closeRef = useRef<() => boolean | void>(onClose);
  closeRef.current = onClose;
  const activeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    ensureListening();

    const id = nextId;
    nextId += 1;
    activeRef.current = id;

    stack.push({
      id,
      close: () => {
        const closed = closeRef.current() !== false;
        // מסמנים שהרשומה ירדה מההיסטוריה רק אם באמת נסגרה. אחרת היא
        // נדחפת חזרה ב-onPopState, והניקוי עוד יצטרך להסיר אותה.
        if (closed) activeRef.current = null;
        return closed;
      },
    });
    window.history.pushState({ overlay: id }, '');

    return () => {
      if (activeRef.current !== id) return; // נסגר בכפתור החזרה - ההיסטוריה כבר התקדמה
      const index = stack.findIndex((e) => e.id === id);
      if (index >= 0) stack.splice(index, 1);
      activeRef.current = null;
      selfInitiated += 1;
      window.history.back();
    };
  }, [open]);
}
