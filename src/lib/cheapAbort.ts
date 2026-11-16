/**
 * ביטול של AbortController בלי לבנות שגיאה חדשה בכל פעם.
 *
 * `abort()` בלי סיבה יוצר `DOMException` חדש בשם AbortError, וכרום לוכד
 * בו את מחסנית הקריאות. מחוץ ל-React זה זול, אבל framer מבטל כך כל
 * מחווה (`whileTap`) כשהרכיב שלה מתפרק - כלומר בתוך הרקורסיה העמוקה של
 * ה-commit, ושם כל ביטול יקר פי מאות. מסך התזכורות נושא שלושה כפתורים
 * כאלה בכל שורה, ופירוק שלו במעבר לשונית היה כמאה מילישניות בהאטת מעבד
 * פי 4 - בדיוק באמצע אנימציית הכניסה של המסך הבא.
 *
 * הסיבה המשותפת היא עדיין `DOMException` בשם AbortError, כמו שהתקן אומר,
 * ולכן מי שבודק `name === 'AbortError'` (fetch, Firebase) אינו מרגיש
 * בהבדל. סיבה שנמסרה במפורש עוברת כמות שהיא.
 */
let installed = false;

export function installCheapAbort(): void {
  if (installed || typeof AbortController === 'undefined' || typeof DOMException === 'undefined') {
    return;
  }
  installed = true;
  const reason = new DOMException('signal is aborted without reason', 'AbortError');
  const abort = AbortController.prototype.abort;
  AbortController.prototype.abort = function (this: AbortController, why?: unknown) {
    abort.call(this, why === undefined ? reason : why);
  };
}
