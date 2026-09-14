/**
 * השוואת גרסאות.
 *
 * הבדיקות כאן שומרות על שני דברים שקל לשבור: שההשוואה היא מספרית ולא
 * לקסיקוגרפית, ושהודעה שנסגרה לא חוזרת.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  dismissUpdate,
  isDismissed,
  isNewer,
  parseRelease,
  type UpdateManifest,
} from './appUpdate';

const manifest = (versionCode: number): UpdateManifest => ({
  versionCode,
  versionName: `1.0.${versionCode}`,
  apk: 'https://example.invalid/app.apk',
});

beforeEach(() => localStorage.clear());

describe('isNewer', () => {
  it('גרסה גבוהה יותר היא עדכון', () => {
    expect(isNewer(manifest(8), 7)).toBe(true);
  });

  it('אותה גרסה אינה עדכון', () => {
    expect(isNewer(manifest(7), 7)).toBe(false);
  });

  it('גרסה ישנה יותר אינה עדכון', () => {
    expect(isNewer(manifest(6), 7)).toBe(false);
  });

  it('10 גדול מ-9, ולא להפך', () => {
    // השוואת מחרוזות הייתה נכשלת כאן בדיוק
    expect(isNewer(manifest(10), 9)).toBe(true);
    expect(isNewer(manifest(9), 10)).toBe(false);
  });

  it('מניפסט פגום אינו עדכון', () => {
    expect(isNewer({ ...manifest(1), versionCode: NaN }, 1)).toBe(false);
  });
});

describe('סגירת ההודעה', () => {
  it('גרסה שנסגרה נשארת סגורה', () => {
    dismissUpdate(12);
    expect(isDismissed(12)).toBe(true);
  });

  it('גרסה חדשה יותר תוצג שוב', () => {
    dismissUpdate(12);
    expect(isDismissed(13)).toBe(false);
  });
});

describe('parseRelease', () => {
  const release = (name: string) => ({
    body: 'גרסה 1.0.7',
    assets: [{ name, browser_download_url: `https://example.invalid/${name}` }],
  });

  it('מוציא שם גרסה ומספר גרסה משם הקובץ', () => {
    const out = parseRelease(release('heb-calendar-1.0.7.apk'));
    expect(out).toMatchObject({ versionName: '1.0.7', versionCode: 7 });
  });

  it('המספר האחרון הוא הקובע, גם בדו-ספרתי', () => {
    expect(parseRelease(release('heb-calendar-1.0.42.apk'))?.versionCode).toBe(42);
  });

  it('מדלג על נכסים שאינם APK', () => {
    const out = parseRelease({
      assets: [
        { name: 'notes.txt', browser_download_url: 'https://example.invalid/notes.txt' },
        { name: 'heb-calendar-1.0.3.apk', browser_download_url: 'https://example.invalid/a.apk' },
      ],
    });
    expect(out?.versionCode).toBe(3);
  });

  it('בוחר את הגרסה הגבוהה ביותר, גם כשהיא אחרונה ברשימה', () => {
    // בשחרור נשארים קבצים של בניות קודמות, והסדר אינו מובטח
    const out = parseRelease({
      assets: [
        { name: 'heb-calendar-1.0.1.apk', browser_download_url: 'https://example.invalid/1.apk' },
        { name: 'heb-calendar-1.0.12.apk', browser_download_url: 'https://example.invalid/12.apk' },
        { name: 'heb-calendar-1.0.2.apk', browser_download_url: 'https://example.invalid/2.apk' },
      ],
    });
    expect(out).toMatchObject({ versionCode: 12, apk: 'https://example.invalid/12.apk' });
  });

  it('שחרור בלי APK מחזיר null', () => {
    expect(parseRelease({ assets: [] })).toBeNull();
  });

  it('גוף השחרור הופך להערות הגרסה', () => {
    expect(parseRelease(release('heb-calendar-1.0.7.apk'))?.notes).toBe('גרסה 1.0.7');
  });
});
