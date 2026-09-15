/**
 * שדה קלט חייב לשבת במעטפת.
 *
 * הבאג הזה חזר שלוש פעמים: שדה החיפוש, שם האירוע, ושם הרשימה המשותפת.
 * בכל פעם אותו שורש - ל-`field-reset` יש טבעת מיקוד משלה, והיא מלבנית
 * כי היא עוטפת את תיבת הטקסט ולא את הקופסה המעוגלת שסביבה. התוצאה היא
 * מלבן חד בתוך שדה מעוגל, ובשדה שנפתח ממוקד (`autoFocus`) זה הדבר
 * הראשון שהמשתמש רואה.

 * `.field-shell` מכבה את הטבעת הפנימית ומצייר אחת משלה על הצורה הנכונה.
 *
 * מה הבדיקה תופסת: קובץ שמוסיף שדה בלי מעטפת בכלל - וזה בדיוק המקרה
 * שחזר. מה שהיא לא תופסת: שדה שני באותו קובץ שנשכח מחוץ למעטפת
 * הקיימת, כי ייחוס בין אלמנטים ב-JSX אינו נקרא מטקסט בלי מנתח מלא.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

const files = walk('src/components').map((path) => ({
  path,
  source: readFileSync(path, 'utf8'),
}));

describe('מעטפת שדה', () => {
  it('הכלל עצמו קיים ב-CSS, ומכבה את הטבעת הפנימית', () => {
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toContain('.field-shell');
    // שתי הצורות: מעטפת סביב השדה, והשדה שהוא עצמו המעטפת
    expect(css).toContain('.field-shell .field-reset:focus-visible');
    expect(css).toContain('.field-shell.field-reset:focus-visible');
  });

  it('יש בכלל קבצים עם שדות - אחרת הבדיקה עוברת על ריק', () => {
    const withFields = files.filter((f) => f.source.includes('field-reset'));
    expect(withFields.length).toBeGreaterThan(5);
  });

  it('כל קובץ שיש בו שדה יש בו גם מעטפת', () => {
    const missing = files
      .filter((f) => f.source.includes('field-reset') && !f.source.includes('field-shell'))
      .map((f) => f.path);
    expect(missing).toEqual([]);
  });

  it('אין יותר שכפול ידני של טבעת המיקוד', () => {
    // מי שמעתיק את מחלקות Tailwind במקום להשתמש במעטפת מפספס את כיבוי
    // הטבעת הפנימית, וזה בדיוק המלבן
    const copied = files
      .filter((f) => f.source.includes('focus-within:ring-brand'))
      .map((f) => f.path);
    expect(copied).toEqual([]);
  });
});
