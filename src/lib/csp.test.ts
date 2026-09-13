/**
 * ה-CSP מרשה סקריפט מוטמע אחד בלבד: הסקריפט ב-index.html שמחיל ערכת
 * נושא לפני הצביעה הראשונה, כדי שלא יהיה הבהוב לבן במצב לילה. הוא חייב
 * להיות מוטמע - קובץ חיצוני היה מוסיף בקשה חוסמת.
 *
 * ההרשאה היא לפי חתימת תוכן. אם מישהו יערוך את הסקריפט ולא יעדכן את
 * החתימה, הדפדפן פשוט לא יריץ אותו - בלי שגיאה, רק הבהוב לבן שקשה לאתר.
 * הבדיקה הזו הופכת את הכשל השקט לכשל רועש.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const firebaseJson = readFileSync('firebase.json', 'utf8');

/** כל סקריפט מוטמע (כזה שאין לו src) */
const inlineScripts = [
  ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
].map((m) => m[1]);

function sha256(text: string): string {
  return `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;
}

describe('CSP', () => {
  it('יש בדיוק סקריפט מוטמע אחד', () => {
    expect(inlineScripts).toHaveLength(1);
  });

  it('החתימה שב-firebase.json תואמת לסקריפט בפועל', () => {
    const actual = sha256(inlineScripts[0]);
    expect(firebaseJson).toContain(actual);
  });

  it("אין 'unsafe-inline' ב-script-src", () => {
    const policy = /"Content-Security-Policy[^"]*",\s*"value":\s*"([^"]+)"/.exec(firebaseJson)?.[1];
    expect(policy).toBeDefined();
    const scriptSrc = /script-src ([^;]+)/.exec(policy!)?.[1] ?? '';
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
  });

  it('ההנחיות שמונעות הזרקה קיימות', () => {
    for (const directive of ["object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
      expect(firebaseJson).toContain(directive);
    }
  });

  it('הכותרות הבסיסיות מוגדרות', () => {
    for (const header of [
      'X-Content-Type-Options',
      'Referrer-Policy',
      'X-Frame-Options',
      'Permissions-Policy',
      'Cross-Origin-Opener-Policy',
    ]) {
      expect(firebaseJson).toContain(header);
    }
  });

  it('מיקום מותר לאפליקציה עצמה, והשאר סגור', () => {
    expect(firebaseJson).toContain('geolocation=(self)');
    expect(firebaseJson).toContain('camera=()');
    expect(firebaseJson).toContain('microphone=()');
  });
});
