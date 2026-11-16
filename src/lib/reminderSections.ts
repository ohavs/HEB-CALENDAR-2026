/**
 * חלוקה של רשימת התזכורות לפי קטגוריה.
 *
 * רכיב אחד לשתי הרשימות: קטגוריה של תזכורת אישית יושבת בהגדרות,
 * וקטגוריה של רשימה משותפת על מסמך הרשימה - אבל שתיהן `{ id, name }`,
 * והפריט נושא `categoryId` בשני המקרים. לכן החלוקה נכתבת פעם אחת.
 *
 * בתוך כל קטגוריה הקבוצות לפי יום נשארות כמו שהן: הקטגוריה עונה על
 * "מה", היום על "מתי", ולוותר על אחד מהם היה מעלים מידע שכבר קיים.
 */
import type { ReminderGroup } from './reminders';

export type CategoryRef = { id: string; name: string };

export type ReminderSection = {
  /** מזהה הקטגוריה, או `none` לפריטים בלי קטגוריה */
  id: string;
  name: string;
  groups: ReminderGroup[];
  /** כמה פתוחות - מה שמוצג בכותרת גם כשהקבוצה מקופלת */
  open: number;
};

export const NO_CATEGORY = 'none';

/**
 * מקבץ את הקבוצות לפי קטגוריה, בסדר של הקטגוריות ו"בלי קטגוריה" בסוף.
 *
 * קטגוריה ריקה אינה מוצגת: כותרת עם חץ ובלי כלום מתחתיה היא רעש, והצ׳יפ
 * שלה עדיין קיים למעלה. מזהה של קטגוריה שנמחקה נקרא כ"בלי קטגוריה" -
 * אחרת פריט היה נעלם מהרשימה יחד עם הקטגוריה שלו.
 */
export function sectionByCategory(
  groups: ReminderGroup[],
  categories: CategoryRef[],
): ReminderSection[] {
  const known = new Set(categories.map((c) => c.id));
  const order = [...categories, { id: NO_CATEGORY, name: 'בלי קטגוריה' }];

  return order
    .map((category) => {
      const inCategory = groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            const id = item.categoryId && known.has(item.categoryId) ? item.categoryId : NO_CATEGORY;
            return id === category.id;
          }),
        }))
        .filter((group) => group.items.length > 0);
      return {
        id: category.id,
        name: category.name,
        groups: inCategory,
        open: inCategory.reduce((n, g) => n + g.items.filter((i) => !i.done).length, 0),
      };
    })
    .filter((section) => section.groups.length > 0);
}

/*
  ההתחלה של רשימה ארוכה, כדי לצייר אותה עם המסך ואת השאר רגע אחר כך.

  במעבר לשונית מסך התזכורות בנה את כל השורות של ארבעה חודשים בבת אחת,
  והחלק היקר לא היה החישוב אלא יצירת האלמנטים ב-commit - עשרות
  מילישניות בטלפון, בדיוק בפריים שבו המסך אמור להופיע. רוב השורות ממילא
  מתחת לקצה. קבוצה נכנסת שלמה או לא נכנסת, כדי שיום לא ייחתך באמצע;
  קבוצה ריקה ("אין תזכורות") היא שורה.
*/
export function firstRows(groups: ReminderGroup[], rows: number): ReminderGroup[] {
  let count = 0;
  const out: ReminderGroup[] = [];
  for (const group of groups) {
    if (count >= rows) break;
    out.push(group);
    count += Math.max(1, group.items.length);
  }
  return out;
}

/** אותו דבר כשהרשימה מחולקת לקטגוריות: התקציב עובר מקטגוריה לקטגוריה */
export function firstSectionRows(sections: ReminderSection[], rows: number): ReminderSection[] {
  let left = rows;
  const out: ReminderSection[] = [];
  for (const section of sections) {
    if (left <= 0) break;
    const groups = firstRows(section.groups, left);
    out.push(groups.length === section.groups.length ? section : { ...section, groups });
    left -= groups.reduce((n, g) => n + Math.max(1, g.items.length), 0);
  }
  return out;
}
