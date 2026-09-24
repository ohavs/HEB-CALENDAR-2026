/**
 * טוקני תנועה וגדלים.
 *
 * לפני הקובץ הזה כל רכיב הגדיר לעצמו קפיץ - שבעה־עשר קפיצים שונים על פני
 * שנים־עשר קבצים, שנבחרו בתחושה. שלושת הטוקנים כאן מכסים את כל המקרים,
 * וההבדל ביניהם הוא מה זז ולא כמה חזק:
 *
 *   tap    - תגובה לאצבע. חייבת להסתיים לפני שהאצבע עוזבת.
 *   snap   - רכיב קטן שמקבל מקום חדש: צ׳יפ, גלולה, טוסט, מתג.
 *   glide  - משטח גדול שנכנס או יוצא: חלונית, גיליון, מסך.
 *
 * שינוי התחושה של האפליקציה כולה נעשה כאן, במקום אחד.
 */
import type { Transition } from 'framer-motion';

/** עקומת ההאצה של האפליקציה - יציאה מהירה ונחיתה רכה. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const TAP: Transition = { type: 'spring', stiffness: 620, damping: 34, mass: 0.6 };
export const SNAP: Transition = { type: 'spring', stiffness: 480, damping: 34, mass: 0.7 };
export const GLIDE: Transition = { type: 'spring', stiffness: 440, damping: 40, mass: 0.8 };

/** כניסה ויציאה של שקיפות - לא קפיץ, כי לשקיפות אין מומנטום. */
export const ENTER: Transition = { duration: 0.22, ease: EASE };
export const EXIT: Transition = { duration: 0.16, ease: EASE };

/** קנה המידה ללחיצה. אחיד לכל מה שאפשר ללחוץ עליו. */
export const TAP_SCALE = { scale: 0.97 } as const;
/** לחיצה על משטח גדול - הקטנה עדינה יותר, אחרת זה נראה כמו קפיצה. */
export const TAP_SCALE_LG = { scale: 0.985 } as const;

/* ==========================================================================
   סקאלת גדלים לאייקונים
   ========================================================================== */

/**
 * גודל אייקון נבחר לפי התפקיד ולא לפי מספר. הסקאלה הזו כבר הייתה קיימת
 * בפועל בקוד - היא פשוט לא הייתה כתובה בשום מקום, ולכן לא הייתה אכיפה.
 */
export const ICON = {
  /** מטא־מידע לצד טקסט קטן */
  xs: 14,
  /** אייקון בתוך שדה או תווית */
  sm: 16,
  /** ברירת המחדל: פעולות ברשימות ובשורות הגדרה */
  md: 18,
  /** פעולה ראשית, ניווט, כותרות */
  lg: 20,
  /** אייקון שהוא עצמו האלמנט המרכזי */
  xl: 22,
} as const;

/** עובי הקו האחיד של האייקונים. */
export const STROKE = 2.3;

/* ==========================================================================
   סקאלת גובה
   ========================================================================== */

/**
 * שלוש דרגות גובה, וכלל אחד לכל אחת:
 *   raised   - יושב על הקנבס (כרטיס, עמודה קבועה)
 *   floating - מרחף מעל התוכן (גרירה, טוסט, כפתור צף)
 *   overlay  - נכנס מקצה המסך (גיליון, חלונית תחתונה)
 * שמות המחלקות מוגדרים ב-tailwind.config תחת boxShadow.
 */
export const ELEVATION = {
  raised: 'shadow-raised',
  floating: 'shadow-floating',
  overlay: 'shadow-overlay',
} as const;

/* ==========================================================================
   כותרת שלא נכנסת בשורה
   ========================================================================== */

/**
 * גלילה איטית של כותרת ארוכה, במקום שלוש נקודות.
 *
 * שורה שנייה ושלישית היו משנות את גובה הכרטיס והופכות רשימה אחידה
 * לגבשושית, והקטנת הגופן הייתה מוותרת על מה שהכרטיס בא להגיד. כאן
 * הכותרת נשארת שורה אחת בגודלה, ונחשפת עד סופה בקצב קריאה.
 *
 * העצירות ארוכות מהתנועה בכוונה: עין שמתחילה לקרוא צריכה זמן לפני
 * שהטקסט זז, וזמן בסוף כדי לסיים את המילה האחרונה.
 */
export const MARQUEE = {
  /** פיקסלים בשנייה - קצב קריאה, לא אנימציה */
  speed: 34,
  /** עצירה בתחילה, לפני שהטקסט זז */
  holdStart: 1800,
  /** עצירה בסוף, על המילה האחרונה */
  holdEnd: 1600,
  /** החזרה להתחלה מהירה יותר - אין בה מה לקרוא */
  returnFactor: 3,
  /** רוחב הדהייה בקצוות, במקום חיתוך חד */
  fade: 14,
} as const;

/** ציר הזמן של גלילה אחת הלוך וחזור, למרחק נתון בפיקסלים. */
export function marqueeTimeline(distance: number): {
  duration: number;
  keyframes: { offset: number; shift: number }[];
} {
  const travel = (distance / MARQUEE.speed) * 1000;
  const back = travel / MARQUEE.returnFactor;
  const duration = MARQUEE.holdStart + travel + MARQUEE.holdEnd + back;
  const at = (ms: number) => ms / duration;
  return {
    duration,
    keyframes: [
      { offset: 0, shift: 0 },
      { offset: at(MARQUEE.holdStart), shift: 0 },
      { offset: at(MARQUEE.holdStart + travel), shift: distance },
      { offset: at(MARQUEE.holdStart + travel + MARQUEE.holdEnd), shift: distance },
      { offset: 1, shift: 0 },
    ],
  };
}
