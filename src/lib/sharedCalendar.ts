/**
 * פריטים משותפים על גבי הלוח.
 *
 * `SharedItem` הוא `UserEvent` בתוספת שני שדות, ולכן `expandEvents`
 * עובד עליו כמות שהוא - חזרות, פרישה רב־יומית וחריגים כולל "בוצע".
 * מה שנוסף כאן הוא רק שתי שאלות שהמנוע אינו יכול לענות עליהן:
 *
 * 1. **מה שייך ללוח שלי** - פריט בלי תאריך אינו בלוח, וכך גם פריט
 *    שהמשתמש הזה בחר להסתיר (ראו `calendarItems`).
 * 2. **מאיפה הוא הגיע** - הסימון `shared` נושא את שם הרשימה, כי בלוח
 *    "לחם" בלי הקשר נראה כמו אירוע שהמשתמש שכח שיצר.
 *
 * טהור בכוונה: אין כאן גישה לחנות ואין React, ולכן אפשר לבדוק את
 * המיזוג בלי רשת ובלי דפדפן.
 */
import type { DateKey } from '@/types';
import type { SharedItem, SharedList } from './sharedLists';
import { calendarItems } from './sharedLists';
import { expandEvents, sortOccurrences, type Occurrence } from './recurrence';

/** המופעים המשותפים בטווח, מקובצים לפי יום. */
export function sharedOccurrences(
  lists: SharedList[],
  itemsByList: Record<string, SharedItem[]>,
  uid: string | null,
  start: Date,
  end: Date,
): Map<DateKey, Occurrence[]> {
  const out = new Map<DateKey, Occurrence[]>();

  for (const list of lists) {
    const mine = calendarItems(itemsByList[list.id] ?? [], uid);
    if (!mine.length) continue;

    const expanded = expandEvents(mine, start, end);
    for (const [key, occurrences] of expanded) {
      const tagged = occurrences.map((occ) => ({
        ...occ,
        shared: { listId: list.id, listName: list.name },
      }));
      const existing = out.get(key);
      if (existing) existing.push(...tagged);
      else out.set(key, tagged);
    }
  }

  return out;
}

/**
 * מיזוג המופעים האישיים והמשותפים.
 *
 * מחזיר מפה חדשה ואינו נוגע בנתונים שנכנסו: המפה האישית מגיעה ממטמון
 * שמשותף לכל התצוגות, ודחיפה לתוכה הייתה מזהמת גם את מי שלא ביקש
 * פריטים משותפים.
 *
 * כשאין מה למזג מוחזרת המפה האישית עצמה, כדי שהשוואת הזהות במעלה
 * הזרם תמשיך לחסוך רינדורים.
 */
export function mergeOccurrences(
  personal: Map<DateKey, Occurrence[]>,
  shared: Map<DateKey, Occurrence[]>,
): Map<DateKey, Occurrence[]> {
  if (shared.size === 0) return personal;

  const out = new Map(personal);
  for (const [key, occurrences] of shared) {
    const existing = out.get(key);
    const merged = existing ? [...existing, ...occurrences] : [...occurrences];
    out.set(key, merged.sort(sortOccurrences));
  }
  return out;
}
