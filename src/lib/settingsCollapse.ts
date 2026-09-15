/**
 * אילו קטגוריות בהגדרות מקופלות.
 *
 * מסך ההגדרות ארוך: שמונה קבוצות, ומי שמחפש שורה אחת גולל דרך כולן.
 * קיפול קבוצה מצמצם אותה לכותרת, והבחירה נזכרת - אחרת היא הייתה מתאפסת
 * בכל פתיחה של המסך, וזה בדיוק המצב שממנו ניסינו לברוח.
 *
 * זה מצב של המכשיר הזה ולא של המשתמש, ולכן הוא לא נכנס ל-Settings
 * המסונכרנות: כל קיפול היה מרים `revision`, מפרסם מחדש את הוידג׳טים
 * ודוחף כתיבה לענן - הרבה רעש בשביל חץ.
 *
 * נשמר כרשימת המקופלות ולא של הפתוחות, כדי שקטגוריה שתתווסף בעתיד תופיע
 * פתוחה כברירת מחדל ולא תיעלם אצל מי שכבר שמר העדפה.
 */
const KEY = 'heb-cal:settings-collapsed';

/** מטמון בזיכרון: הקריאה קורית בכל רינדור של כל קבוצה. */
let cache: Set<string> | null = null;

function load(): Set<string> {
  if (cache) return cache;
  cache = new Set<string>();
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      for (const id of parsed) if (typeof id === 'string') cache.add(id);
    }
  } catch {
    /* מצב פרטי, או ערך פגום - מתחילים מהכול פתוח */
  }
  return cache;
}

/**
 * קבוצה שברירת המחדל שלה מקופלת צריכה גם זיכרון הפוך.
 *
 * הרשימה שומרת רק את המקופלות, ולכן "פתחתי אותה" אינו מיוצג בה כלל -
 * והקבוצה הייתה נסגרת מחדש בכל פתיחה של המסך, מול משתמש שכבר אמר
 * שהוא רוצה אותה פתוחה. הקידומת הזו היא הזיכרון ההפוך.
 */
const OPENED = 'open:';

/**
 * `whenUnset` הוא מה שמחזירים לקבוצה שהמשתמש עוד לא נגע בה. ברוב
 * הקבוצות זה `false` - פתוחה - וקבוצה שברירת המחדל שלה מקופלת מעבירה
 * `true`.
 */
export function isGroupCollapsed(id: string, whenUnset = false): boolean {
  const set = load();
  if (set.has(id)) return true;
  if (set.has(OPENED + id)) return false;
  return whenUnset;
}

export function setGroupCollapsed(id: string, collapsed: boolean): void {
  const set = load();
  if (collapsed) {
    set.add(id);
    set.delete(OPENED + id);
  } else {
    set.delete(id);
    set.add(OPENED + id);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* מצב פרטי - הקיפול יעבוד עד הפתיחה הבאה */
  }
}

/** לבדיקות בלבד: מאפס את המטמון שנקרא פעם אחת. */
export function resetCollapseCache(): void {
  cache = null;
}
