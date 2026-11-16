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
      lucide-react הוסר מ-package.json יחד עם השחרור הנייטיבי (הסרה משנה
      את טביעת הנייטיב), אבל ייבוא ממנו אחרי התקנה חוזרת היה מחזיר אייקון
      בקו עבה אחר באמצע מסך של Phosphor.
    */
    const offenders = sources(SRC).filter((file) =>
      /from\s+['"]lucide-react['"]/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('has no brand, and no hard-coded interface colors', () => {
    /*
      `brand` היה שם ישן ל-`inverse`, ונמחק בשלב הניקוי - מחלקה שעוד
      משתמשת בו פשוט אינה מייצרת CSS, בלי שגיאה. וצבע ממשק שנכתב ביד,
      `[rgb(240_118_149)]` או `[rgb(var(--c-shabbat))]`, עוקף את הטוקן:
      הראשון אינו מתהפך במצב לילה, והשני מכפיל שם שכבר יש לו מחלקה.
    */
    const brand = /\b[a-z-]+-brand\b|--c-brand|tone=["']brand/;
    const arbitrary = /\[(?:rgb|rgba|hsl)\(/;
    const offenders = sources(SRC).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return brand.test(text) || arbitrary.test(text);
    });
    expect(offenders).toEqual([]);
    const css = readFileSync(join(SRC, 'index.css'), 'utf8');
    expect(css).not.toMatch(/--c-brand/);
  });

  it('has no vertical accent bar', () => {
    /*
      פס צבע דק לצד טקסט - בכרטיס, בשורה או בין שעות - הוא קישוט שאינו
      אומר דבר: הצבע כבר יושב ברקע הפסטל. הוא הוסר מכל מקום, והבדיקה
      תופסת את החזרה שלו: המחלקה הישנה, ופס צר שנמתח לגובה השורה.
    */
    const thin = String.raw`\bw-(?:0\.5|1\.5|1|\[[1-4]px\])(?![\w.\-\]])`;
    const tall = String.raw`\b(?:self-stretch|flex-1|h-full)\b`;
    const bar = new RegExp(
      String.raw`\bev-bar\b|\bborder-[se]-[2-8]\b|` +
        `${thin}[^"'\`]*${tall}|${tall}[^"'\`]*${thin}`,
    );
    const offenders = sources(join(SRC, 'components')).filter((file) =>
      bar.test(readFileSync(file, 'utf8')),
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
