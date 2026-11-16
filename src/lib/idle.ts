/**
 * עבודת רקע שמחכה לרגע שבו המסך אינו זז.
 *
 * פרסום הוידג׳טים, תזמון ההתראות וכתיבה ליומן של המכשיר רצים אחרי כל
 * שינוי, על השרשור הראשי, ובטלפון כל אחד מהם הוא עשרות עד מאות
 * מילישניות. כשהם היו יושבים על טיימר קבוע הם נחתו בדיוק כשהמשתמש כבר
 * עבר לדבר הבא - גלילה, החלקת חודש, גיליון שנפתח - וזה היה הגמגום
 * ש"קורה מדי פעם": לא האנימציה עצמה, אלא מה שנזרק עליה מאחור.
 *
 * `requestIdleCallback` מריץ רק כשאין פריים שממתין. התקרה (`timeout`)
 * מבטיחה שהעבודה לא תידחה לנצח במסך שזז כל הזמן; WebView ישן או Safari
 * בלי התמיכה נופלים לטיימר רגיל.
 */

type Cancel = () => void;

/** ברירת המחדל: עד שתי שניות של המתנה לרגע שקט */
const DEFAULT_TIMEOUT_MS = 2000;

export function whenIdle(task: () => void, timeout = DEFAULT_TIMEOUT_MS): Cancel {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => task(), { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(task, 1);
  return () => clearTimeout(id);
}

/**
 * השהיה ואז המתנה לרגע שקט: מאחד פרסומים צפופים (שינוי אחד מרעיד כמה
 * עדכוני חנות), ורק אחר כך מחכה שהמסך יתפנה. ביטול עוצר את שני השלבים.
 */
export function debounceIdle(task: () => void, delayMs: number, timeout?: number): Cancel {
  let cancelIdle: Cancel | null = null;
  const timer = setTimeout(() => {
    cancelIdle = whenIdle(task, timeout);
  }, delayMs);
  return () => {
    clearTimeout(timer);
    cancelIdle?.();
  };
}
