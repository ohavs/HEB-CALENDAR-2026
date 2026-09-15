import { beforeEach, describe, expect, it } from 'vitest';
import { isGroupCollapsed, resetCollapseCache, setGroupCollapsed } from './settingsCollapse';

const KEY = 'heb-cal:settings-collapsed';

beforeEach(() => {
  localStorage.removeItem(KEY);
  resetCollapseCache();
});

describe('settingsCollapse', () => {
  it('קטגוריה שלא נגעו בה פתוחה', () => {
    expect(isGroupCollapsed('display')).toBe(false);
  });

  it('זוכר קיפול גם אחרי טעינה מחדש', () => {
    setGroupCollapsed('display', true);
    resetCollapseCache(); // כמו פתיחה מחדש של האפליקציה
    expect(isGroupCollapsed('display')).toBe(true);
    expect(isGroupCollapsed('account')).toBe(false);
  });

  it('פתיחה מוחקת את הקיפול', () => {
    setGroupCollapsed('display', true);
    setGroupCollapsed('display', false);
    resetCollapseCache();
    expect(isGroupCollapsed('display')).toBe(false);
  });

  // קטגוריה חדשה צריכה להופיע פתוחה גם אצל מי ששמר העדפה מזמן
  it('שומר את המקופלות ולא את הפתוחות', () => {
    setGroupCollapsed('display', true);
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual(['display']);
  });

  /* ---------------- קבוצה שברירת המחדל שלה מקופלת ---------------- */

  it('בלי העדפה שמורה - מקבלים את ברירת המחדל שנשלחה', () => {
    expect(isGroupCollapsed('shared-categories', true)).toBe(true);
    expect(isGroupCollapsed('shared-categories', false)).toBe(false);
  });

  /*
    זה הבאג שהזיכרון ההפוך מונע: הרשימה שומרת רק את המקופלות, ולכן
    בלעדיו "פתחתי אותה" לא היה מיוצג כלל - והקבוצה הייתה נסגרת מחדש
    בכל פתיחה של המסך, מול משתמש שכבר אמר שהוא רוצה אותה פתוחה.
  */
  it('פתיחה ידנית גוברת על ברירת מחדל מקופלת, גם אחרי טעינה מחדש', () => {
    setGroupCollapsed('shared-categories', false);
    resetCollapseCache();
    expect(isGroupCollapsed('shared-categories', true)).toBe(false);
  });

  it('קיפול ידני מנקה את הסימון ההפוך', () => {
    setGroupCollapsed('shared-categories', false);
    setGroupCollapsed('shared-categories', true);
    resetCollapseCache();
    expect(isGroupCollapsed('shared-categories', true)).toBe(true);
    expect(isGroupCollapsed('shared-categories', false)).toBe(true);
  });

  it('הסימון ההפוך אינו משפיע על קבוצה אחרת', () => {
    setGroupCollapsed('shared-categories', false);
    expect(isGroupCollapsed('display', true)).toBe(true);
    expect(isGroupCollapsed('display')).toBe(false);
  });

  it('ערך פגום באחסון לא מפיל - הכול פתוח', () => {
    localStorage.setItem(KEY, '{לא JSON');
    resetCollapseCache();
    expect(isGroupCollapsed('display')).toBe(false);
    setGroupCollapsed('display', true);
    expect(isGroupCollapsed('display')).toBe(true);
  });
});
