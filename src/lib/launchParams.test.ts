/**
 * פענוח פרמטרי פתיחה. אותו קוד ישרת קיצורי דרך במסך הבית, קישורים
 * עמוקים, וכוונות חיצוניות באנדרואיד - ולכן הוא חייב להיות סלחני:
 * קישור ישן או מקוצץ צריך לפתוח את האפליקציה, לא להכשיל אותה.
 */
import { describe, expect, it } from 'vitest';
import { parseExternalUrl, parseLaunch } from './launchParams';
import { dateKey, keyToDate } from './dates';

describe('לשונית', () => {
  it('קורא לשונית מוכרת', () => {
    expect(parseLaunch('?tab=shabbat').tab).toBe('shabbat');
    expect(parseLaunch('?tab=settings').tab).toBe('settings');
    expect(parseLaunch('?tab=calendar').tab).toBe('calendar');
  });

  it('מתעלם מלשונית שאינה קיימת', () => {
    expect(parseLaunch('?tab=nope').tab).toBeUndefined();
    expect(parseLaunch('?tab=').tab).toBeUndefined();
  });
});

describe('תאריך', () => {
  it('go=today מחזיר את היום', () => {
    const d = parseLaunch('?go=today').date!;
    expect(dateKey(d)).toBe(dateKey(new Date()));
  });

  it('date קורא תאריך מפורש', () => {
    expect(dateKey(parseLaunch('?date=2026-09-13').date!)).toBe('2026-09-13');
  });

  it('date גובר על go=today', () => {
    expect(dateKey(parseLaunch('?go=today&date=2026-09-13').date!)).toBe('2026-09-13');
  });

  it('תאריך שאינו קיים נדחה', () => {
    expect(parseLaunch('?date=2026-02-31').date).toBeUndefined();
    expect(parseLaunch('?date=2026-13-01').date).toBeUndefined();
  });

  it('צורה שגויה נדחית', () => {
    expect(parseLaunch('?date=13/09/2026').date).toBeUndefined();
    expect(parseLaunch('?date=abc').date).toBeUndefined();
    expect(parseLaunch('?date=2026-9-3').date).toBeUndefined();
  });
});

describe('פתיחת עורך', () => {
  it('compose=1 פותח על היום', () => {
    expect(parseLaunch('?compose=1').compose).toBe(dateKey(new Date()));
  });

  it('compose=today זהה', () => {
    expect(parseLaunch('?compose=today').compose).toBe(dateKey(new Date()));
  });

  it('compose עם תאריך מפורש', () => {
    expect(parseLaunch('?compose=2026-09-13').compose).toBe('2026-09-13');
  });

  it('compose=1 יחד עם date פותח על אותו תאריך', () => {
    expect(parseLaunch('?date=2026-09-13&compose=1').compose).toBe('2026-09-13');
  });

  it('תאריך לא תקין ב-compose נדחה', () => {
    expect(parseLaunch('?compose=2026-02-31').compose).toBeUndefined();
  });
});

describe('סלחנות', () => {
  it('שאילתה ריקה מחזירה כלום', () => {
    expect(parseLaunch('')).toEqual({});
    expect(parseLaunch('?')).toEqual({});
  });

  it('פרמטרים לא מוכרים מדולגים', () => {
    expect(parseLaunch('?utm_source=x&ref=y')).toEqual({});
  });

  it('פרמטר מוכר שורד לצד לא מוכרים', () => {
    expect(parseLaunch('?utm_source=x&tab=shabbat&ref=y').tab).toBe('shabbat');
  });

  it('קיצורי הדרך שב-manifest עובדים', () => {
    expect(parseLaunch('?tab=shabbat').tab).toBe('shabbat');
    const today = parseLaunch('?tab=calendar&go=today');
    expect(today.tab).toBe('calendar');
    expect(dateKey(today.date!)).toBe(dateKey(new Date()));
    const compose = parseLaunch('?tab=calendar&compose=today');
    expect(compose.tab).toBe('calendar');
    expect(compose.compose).toBe(dateKey(new Date()));
  });
});

describe('parseExternalUrl', () => {
  it('קורא קישור של סכמה פנימית', () => {
    expect(parseExternalUrl('hebcal://open?tab=calendar&date=2026-09-14').date).toEqual(
      keyToDate('2026-09-14'),
    );
  });

  it('קישור בלי שאילתה אינו עושה כלום', () => {
    expect(parseExternalUrl('hebcal://open')).toEqual({});
  });

  it('תאריך לא תקין נזרק, והלשונית נשארת', () => {
    const out = parseExternalUrl('hebcal://open?tab=shabbat&date=2026-02-31');
    expect(out.tab).toBe('shabbat');
    expect(out.date).toBeUndefined();
  });
});

describe('view - הלשונית הפנימית של התזכורות', () => {
  it('view=shared נקרא', () => {
    expect(parseLaunch('?tab=reminders&view=shared').view).toBe('shared');
  });

  it('view=mine נקרא', () => {
    expect(parseLaunch('?tab=reminders&view=mine').view).toBe('mine');
  });

  it('ערך לא מוכר מדולג בשקט', () => {
    expect(parseLaunch('?tab=reminders&view=zzz').view).toBeUndefined();
  });

  it('בלי view אין שדה', () => {
    expect(parseLaunch('?tab=reminders').view).toBeUndefined();
  });

  it('עובר גם דרך קישור חיצוני של וידג׳ט', () => {
    const intent = parseExternalUrl('hebcal://open?tab=reminders&view=shared');
    expect(intent.tab).toBe('reminders');
    expect(intent.view).toBe('shared');
  });
});
