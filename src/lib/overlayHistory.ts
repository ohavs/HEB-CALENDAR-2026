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

type Entry = { id: number; close: () => void };

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
  stack.pop()?.close();
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
 * @param onClose מה לעשות כשכפתור החזרה נלחץ
 */
export function useOverlayHistory(open: boolean, onClose: () => void): void {
  // שומרים את הקולבק ב-ref כדי שהאפקט לא ייבנה מחדש בכל רינדור
  const closeRef = useRef(onClose);
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
        // מסמנים שהרשומה כבר ירדה מההיסטוריה, כדי שהניקוי לא יחזור אחורה שוב
        activeRef.current = null;
        closeRef.current();
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
