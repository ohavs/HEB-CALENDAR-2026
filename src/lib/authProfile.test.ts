/**
 * הזהות השמורה היא לתצוגה בלבד.
 *
 * `profile` ב-store/auth מחזיק את מי שהיה מחובר בפעם הקודמת, כדי שהכותרת
 * תציג תמונה ושם מיד בכניסה קרה - עוד לפני ש-Firebase שחזר את החיבור.
 * הוא לא אומת. סנכרון, רשימות משותפות או כל קריאה לענן שיתחילו לפיו
 * ירוצו בלי אסימון, וייכשלו בהרשאות - ובמסך זה ייראה כמו "הסנכרון
 * נכשל" אצל מי שלא עשה שום דבר רע.
 *
 * הבדיקה סורקת את הקוד ומוודאת שרק מקומות התצוגה המוכרים קוראים אותו.
 * מקום חדש שצריך אותו לתצוגה - מוסיפים לרשימה, בכוונה ובעין פקוחה.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** מי שמותר לו: המקור עצמו, ושני מקומות שמציירים בלבד */
const DISPLAY_ONLY = new Set([
  'src/store/auth.ts',
  'src/App.tsx',
  'src/components/SettingsScreen.tsx',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** קריאה של `profile` מהחנות: `s.profile`, `state.profile`, `{ profile }` מהחנות */
const READS_PROFILE = /\b(?:s|state|get\(\))\.profile\b|useAuthStore\([^)]*profile/;

describe('הזהות השמורה', () => {
  const readers = walk('src').filter((path) => READS_PROFILE.test(readFileSync(path, 'utf8')));

  it('רק מקומות התצוגה המוכרים קוראים אותה', () => {
    const unexpected = readers.filter((path) => !DISPLAY_ONLY.has(path));
    expect(unexpected).toEqual([]);
  });

  /* אחרת הבדיקה הייתה עוברת גם אם הביטוי הרגולרי לא תפס כלום */
  it('הבדיקה אכן מוצאת את מי שקורא אותה', () => {
    expect(readers).toContain('src/App.tsx');
    expect(readers).toContain('src/components/SettingsScreen.tsx');
  });

  /* הסנכרון מאזין ל-user, ומאזין ל-profile היה מתחיל בלי אסימון */
  it('הסנכרון מאזין לזהות המאומתת', () => {
    const sync = readFileSync('src/lib/sync.ts', 'utf8');
    expect(sync).toMatch(/s\.user\?\.uid/);
    expect(sync).not.toMatch(/profile/);
  });
});
