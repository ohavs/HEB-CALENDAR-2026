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
