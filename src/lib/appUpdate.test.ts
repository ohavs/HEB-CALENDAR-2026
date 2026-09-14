/**
 * החלטת העדכון.
 *
 * שני דברים שקל לשבור כאן: שההשוואה מספרית ולא לקסיקוגרפית, ושעדכון חי
 * לא יוצע כשהמעטפת הנייטיבית השתנתה - חבילת web חדשה מול מעטפת ישנה היא
 * אפליקציה שבורה.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { decideUpdate, dismissUpdate, isDismissed, parseRelease } from './appUpdate';

const asset = (name: string) => ({ name, browser_download_url: `https://example.invalid/${name}` });

const release = (names: string[], body = 'מה חדש') =>
  parseRelease({ body, assets: names.map(asset) });

beforeEach(() => localStorage.clear());

describe('parseRelease', () => {
  it('מזהה APK וחבילת web', () => {
    const info = release(['heb-calendar-1.0.7.apk', 'bundle-7-a1b2c3d.zip']);
    expect(info.apk).toMatchObject({ versionName: '1.0.7', versionCode: 7 });
    expect(info.bundle).toMatchObject({ build: 7, nativeRev: 'a1b2c3d' });
  });

  it('בוחר את המספר הגבוה, גם כשהוא אחרון ברשימה', () => {
    // בשחרור נשארים קבצים של בניות קודמות, והסדר אינו מובטח
    const info = release([
      'heb-calendar-1.0.2.apk',
      'heb-calendar-1.0.12.apk',
      'bundle-2-aaa1111.zip',
      'bundle-12-bbb2222.zip',
    ]);
    expect(info.apk?.versionCode).toBe(12);
    expect(info.bundle?.build).toBe(12);
  });

  it('מדלג על נכסים שאינם שלנו', () => {
    const info = release(['notes.txt', 'heb-calendar-1.0.3.apk']);
    expect(info.apk?.versionCode).toBe(3);
    expect(info.bundle).toBeUndefined();
  });

  it('גוף השחרור הופך להערות הגרסה', () => {
    expect(release(['heb-calendar-1.0.1.apk']).notes).toBe('מה חדש');
  });
});

describe('decideUpdate', () => {
  const full = (build: number, rev: string) =>
    release([`heb-calendar-1.0.${build}.apk`, `bundle-${build}-${rev}.zip`]);

  it('אותה מעטפת וקוד חדש - עדכון חי', () => {
    const out = decideUpdate(full(9, 'aaa1111'), 8, 8, 'aaa1111');
    expect(out).toMatchObject({ kind: 'web', versionCode: 9 });
  });

  it('מעטפת שהשתנתה - התקנת APK', () => {
    const out = decideUpdate(full(9, 'bbb2222'), 8, 8, 'aaa1111');
    expect(out).toMatchObject({ kind: 'native', versionCode: 9 });
  });

  it('אותה מעטפת ואותו קוד - אין מה לעדכן', () => {
    expect(decideUpdate(full(8, 'aaa1111'), 8, 8, 'aaa1111')).toBeNull();
  });

  it('מעטפת שהשתנתה אבל ה-APK אינו חדש - אין מה לעדכן', () => {
    expect(decideUpdate(full(8, 'bbb2222'), 8, 8, 'aaa1111')).toBeNull();
  });

  it('10 גדול מ-9, ולא להפך', () => {
    // השוואת מחרוזות הייתה נכשלת כאן בדיוק
    expect(decideUpdate(full(10, 'aaa1111'), 9, 9, 'aaa1111')).toMatchObject({ versionCode: 10 });
    expect(decideUpdate(full(9, 'aaa1111'), 10, 10, 'aaa1111')).toBeNull();
  });

  it('אחרי עדכון חי, הקוד שרץ קובע ולא ה-APK', () => {
    // ה-APK נשאר 8, אבל כבר הוחלה חבילה 9: 9 אינו עדכון
    expect(decideUpdate(full(9, 'aaa1111'), 8, 9, 'aaa1111')).toBeNull();
    expect(decideUpdate(full(10, 'aaa1111'), 8, 9, 'aaa1111')).toMatchObject({ kind: 'web' });
  });

  it('בלי טביעה נייטיבית נופלים למסלול ה-APK', () => {
    // גרסה ישנה שנבנתה לפני שהטביעה הוטמעה
    expect(decideUpdate(full(9, 'aaa1111'), 8, 8, '')).toMatchObject({ kind: 'native' });
  });

  it('שחרור בלי נכסים אינו עדכון', () => {
    expect(decideUpdate(parseRelease({ assets: [] }), 8, 8, 'aaa1111')).toBeNull();
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
