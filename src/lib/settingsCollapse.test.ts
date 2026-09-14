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

  it('ערך פגום באחסון לא מפיל - הכול פתוח', () => {
    localStorage.setItem(KEY, '{לא JSON');
    resetCollapseCache();
    expect(isGroupCollapsed('display')).toBe(false);
    setGroupCollapsed('display', true);
    expect(isGroupCollapsed('display')).toBe(true);
  });
});
