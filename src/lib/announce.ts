/**
 * הכרזות לקורא מסך.
 *
 * פעולה שמשנה משהו במסך בלי לשנות את המיקוד - הזזת אירוע בחיצים, מעבר
 * חודש, ביטול מופע - לא מדווחת לקורא מסך בשום צורה. אזור ה-live היחיד
 * באפליקציה יושב ב-App, וכאן נמצאת הדרך לכתוב אליו מכל מקום.
 */
type Listener = (message: string) => void;

let listener: Listener | null = null;

export function setAnnouncer(fn: Listener | null): void {
  listener = fn;
}

/** מכריז הודעה. בטוח לקריאה גם כשאין מאזין. */
export function announce(message: string): void {
  listener?.(message);
}
