/**
 * באיזו לשונית של מסך התזכורות היינו - "שלי" או "משותף".
 *
 * מצב של המכשיר הזה ולא של המשתמש, ולכן הוא לא נכנס ל-Settings
 * המסונכרנות: מעבר לשונית היה מרים `revision`, מפרסם מחדש את הוידג׳טים
 * ודוחף כתיבה לענן. אותו שיקול כמו ב-settingsCollapse.
 *
 * ברירת המחדל היא "שלי": למי שעוד לא יצר רשימה משותפת, פתיחה על לשונית
 * ריקה הייתה נראית כאילו התזכורות שלו נעלמו.
 */
const KEY = 'heb-cal:reminders-view';

export type RemindersView = 'mine' | 'shared';

export function readRemindersView(): RemindersView {
  try {
    return localStorage.getItem(KEY) === 'shared' ? 'shared' : 'mine';
  } catch {
    return 'mine';
  }
}

export function writeRemindersView(view: RemindersView): void {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    /* מצב פרטי - הבחירה תחזיק עד הפתיחה הבאה */
  }
}
