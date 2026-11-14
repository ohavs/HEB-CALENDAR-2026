/**
 * שמירה על מערכת אחת: מה שעוקף את הרכיבים המשותפים נראה תקין לבדו,
 * ונקרא כחלק ממערכת אחרת רק כשהוא ליד השאר. אלה הבדיקות שתופסות את זה.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

describe('design system', () => {
  it('takes icons only from ui/icons', () => {
    /*
      lucide-react עדיין ב-package.json, כי הסרה שלו משנה את טביעת הקוד
      הנייטיבי (CLAUDE.md, "עדכונים") - ולכן ייבוא ממנו יעבוד, ויחזיר
      אייקון בקו עבה אחר באמצע מסך של Phosphor.
    */
    const offenders = sources(SRC).filter((file) =>
      /from\s+['"]lucide-react['"]/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('has no Segmented-like pill outside the shared lens', () => {
    // גלולה שמחליקה בקפיץ משלה היא בדיוק מה ש-useLens החליף
    const offenders = sources(join(SRC, 'components')).filter((file) =>
      /layoutId=["'{][^}]*(tab|seg|pill|indicator)/i.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
