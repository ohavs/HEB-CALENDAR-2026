/**
 * רשימות תזכורות משותפות.
 *
 * ההבדל המהותי מהתזכורות האישיות אינו בתוכן אלא בבעלות, וממנו נגזר הכול:
 *
 * התזכורות האישיות הן local-first. הן חיות במכשיר, נדחפות לענן כגיבוי,
 * והמיזוג הוא last-write-wins מול מכשירים אחרים של *אותו* משתמש - שם
 * התנגשות היא נדירה ולא מזיקה.
 *
 * רשימה משותפת היא ההפך: היא חיה בענן, ושני אנשים יכולים לכתוב אליה
 * באותה שנייה. לכן היא אינה עוברת דרך `persist` של zustand ואינה
 * ממוזגת מקומית - היא נקראת ב-`onSnapshot` וכתיבה נשלחת ישירות. מטמון
 * ה-SDK מחזיק אותה לקריאה בלי רשת, וכתיבות ממתינות בתור עד שהיא חוזרת.
 *
 * הקובץ הזה הוא המודל הטהור בלבד: טיפוסים, מפתחות ונרמול. כל מה שנוגע
 * ל-Firestore יושב ב-`sharedSync.ts`, וכך אפשר לבדוק את ההיגיון בלי רשת.
 */
import type { DateKey, EventColor, UserEvent } from '@/types';

/** תפקיד ברשימה. הבעלים היחיד שיכול למחוק אותה ולהסיר אחרים. */
export type ListRole = 'owner' | 'member';

export type ListMember = {
  uid: string;
  name: string;
  email: string;
  role: ListRole;
  joinedAt: number;
};

/**
 * קטגוריה בתוך רשימה.
 *
 * הקטגוריות יושבות על מסמך הרשימה ולא באוסף משלהן: הן בודדות, נקראות
 * תמיד יחד עם הרשימה, ומסמך אחד חוסך מאזין שני על כל רשימה.
 */
export type ListCategory = {
  id: string;
  name: string;
  color: EventColor;
};

export type SharedList = {
  id: string;
  name: string;
  color: EventColor;
  ownerUid: string;
  /** מי חבר - משוכפל כמערך כדי שאפשר יהיה לשאול `array-contains` */
  memberUids: string[];
  members: Record<string, ListMember>;
  categories: ListCategory[];
  createdAt: number;
  updatedAt: number;
};

/**
 * פריט ברשימה משותפת.
 *
 * אותם שדות של תזכורת אישית, בתוספת שניים: לאיזו קטגוריה הוא שייך ומי
 * יצר אותו. זה מה שמאפשר לשאר המנוע - חזרות, חריגים, תזכורות בזמן -
 * לעבוד עליו בלי לדעת שהוא משותף.
 */
export type SharedItem = UserEvent & {
  categoryId?: string;
  createdBy: string;
  /**
   * מי בחר לא לראות את הפריט בלוח שלו.
   *
   * התאריך משותף - זו כל הנקודה - אבל "שיהיה גם בלוח שלי" הוא עניין
   * אישי: שניים שקונים יחד רוצים את אותה רשימה, ולא בהכרח את אותן
   * תזכורות. לכן הסתרה אינה מוחקת ואינה נוגעת בתאריך; היא אומרת רק
   * "לא אצלי".
   *
   * המפה יושבת על הפריט המשותף ולא בהגדרות של כל משתמש, משתי סיבות:
   * היא נוסעת עם הפריט (מכשיר חדש מקבל אותה בלי סנכרון נוסף), והכתיבה
   * היא לשדה בודד בנתיב מנוקד - `hiddenBy.<uid>` - כך ששני אנשים
   * שמסתירים באותה שנייה אינם דורסים זה את זה.
   */
  hiddenBy?: Record<string, boolean>;
};

/** הזמנה ממתינה. מזוהה לפי הרשימה והנמען, ולכן אין כפילויות. */
export type ListInvite = {
  id: string;
  listId: string;
  listName: string;
  fromUid: string;
  fromName: string;
  toEmail: string;
  createdAt: number;
};

/* ==========================================================================
   מפתחות
   ========================================================================== */

/**
 * מזהה ההזמנה נגזר מהרשימה ומהנמען, ואינו אקראי.
 *
 * זו לא נוחות אלא מה שמאפשר לכלל האבטחה לאשר הצטרפות: הכלל אינו יכול
 * לחפש מסמך, רק לבדוק קיום של נתיב ידוע. מזהה נגזר פירושו שהכלל יכול
 * להרכיב אותו מ-`listId` ומהאימייל שבטוקן, ולוודא שההזמנה באמת קיימת.
 *
 * הצד השני של אותו מטבע: הזמנה חוזרת לאותו אדם דורסת את הקודמת במקום
 * לייצר שנייה.
 */
export function inviteId(listId: string, email: string): string {
  return `${listId}__${normalizeEmail(email)}`;
}

/** אימייל מנורמל. הכלל משווה ל-`.lower()`, ולכן גם הכתיבה חייבת. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/* ==========================================================================
   שאילתות על המודל
   ========================================================================== */

export function isMember(list: SharedList, uid: string | null): boolean {
  return Boolean(uid) && list.memberUids.includes(uid!);
}

export function isOwner(list: SharedList, uid: string | null): boolean {
  return Boolean(uid) && list.ownerUid === uid;
}

/** שם להצגה של מי שיצר פריט. נופל לאימייל, ואז ל"חבר". */
export function memberLabel(list: SharedList, uid: string): string {
  const member = list.members[uid];
  if (!member) return 'חבר';
  return member.name?.trim() || member.email || 'חבר';
}

export function findCategory(
  list: SharedList,
  categoryId: string | undefined,
): ListCategory | undefined {
  if (!categoryId) return undefined;
  return list.categories.find((c) => c.id === categoryId);
}

/**
 * סינון לפי קטגוריה. `null` פירושו הכול, ו-`'none'` הוא מה שאין לו
 * קטגוריה - מצב אמיתי ולא היעדר בחירה, ולכן הוא ערך ולא undefined.
 */
export type CategoryFilter = string | 'none' | null;

export function matchesCategory(item: SharedItem, filter: CategoryFilter): boolean {
  if (filter === null) return true;
  if (filter === 'none') return !item.categoryId;
  return item.categoryId === filter;
}

/** כמה פריטים פתוחים בכל קטגוריה, לתגיות שעל הצ׳יפים. */
export function countByCategory(
  items: SharedItem[],
  todayKey: DateKey,
): Map<CategoryFilter, number> {
  const out = new Map<CategoryFilter, number>();
  const bump = (key: CategoryFilter) => out.set(key, (out.get(key) ?? 0) + 1);
  for (const item of items) {
    if (item.deleted) continue;
    if (item.exceptions?.[item.date]?.done) continue;
    // פריט עתידי אינו "פתוח" - הוא פשוט עוד לא הגיע
    if (!item.undated && item.date > todayKey) continue;
    bump(null);
    bump(item.categoryId ?? 'none');
  }
  return out;
}

/** מזהה קצר וייחודי מספיק לקטגוריה או לרשימה. */
export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}


/* ==========================================================================
   מה נכנס ללוח
   ========================================================================== */

/** האם המשתמש הזה בחר להסתיר את הפריט מהלוח שלו */
export function isHiddenFor(item: SharedItem, uid: string | null): boolean {
  if (!uid) return false;
  return item.hiddenBy?.[uid] === true;
}

/**
 * הפריטים שצריכים להופיע בלוח של המשתמש הזה.
 *
 * שלושה סינונים, וכל אחד מהם מסיבה אחרת:
 * - `undated` - אין לו יום, ולכן אין לו מקום בלוח. זה בדיוק הכלל של
 *   `expandEvents` בתזכורות האישיות.
 * - `deleted` - סימן מחיקה, לא פריט.
 * - `hiddenBy[uid]` - הוא בלוח של מישהו אחר, ולא בשלי.
 */
export function calendarItems(items: SharedItem[], uid: string | null): SharedItem[] {
  return items.filter(
    (item) => !item.undated && !item.deleted && !isHiddenFor(item, uid),
  );
}
