/**
 * מנוע הלוח. הבדיקות נשענות על תאריכים שידועים מראש ולא על פלט הקוד עצמו,
 * כדי שהן תתפוסנה שינוי בהתנהגות ולא רק שינוי בקוד.
 *
 * עוגנים לשנת תשפ״ז (2026/27):
 *   ראש השנה   1 בתשרי   → 12 בספטמבר 2026
 *   יום כיפור  10 בתשרי  → 21 בספטמבר 2026
 *   סוכות      15 בתשרי  → 26 בספטמבר 2026
 *   שמיני עצרת 22 בתשרי  → 3 באוקטובר 2026
 *   פסח תשפ״ו  15 בניסן  → 2 באפריל 2026
 */
import { describe, expect, it } from 'vitest';
import { HDate } from '@hebcal/core';
import {
  buildDay,
  clearCalendarCache,
  buildDays,
  dayZmanim,
  hebrewDateAfterSunset,
  hebrewDateParts,
  hebrewMonthSpanLabel,
  upcomingShabbatot,
  yearHolidays,
} from './hebrew';
import { timeToMinutes } from './dates';
import { JERUSALEM, TEL_AVIV, buildOptions } from '@/test/factories';

const opts = buildOptions();

function dayOn(y: number, m: number, d: number) {
  return buildDay(new Date(y, m, d), opts);
}

/* ==========================================================================
   מועדים בתאריכים ידועים
   ========================================================================== */

describe('מועדי תשפ״ז', () => {
  it('ראש השנה ב-12 וב-13 בספטמבר 2026', () => {
    expect(dayOn(2026, 8, 12).holidays.map((h) => h.id)).toContain('Rosh Hashana 5787');
    expect(dayOn(2026, 8, 13).holidays.some((h) => h.id.startsWith('Rosh Hashana'))).toBe(true);
  });

  it('יום כיפור ב-21 בספטמבר 2026, ואסור במלאכה', () => {
    const yk = dayOn(2026, 8, 21).holidays.find((h) => h.id === 'Yom Kippur');
    expect(yk).toBeDefined();
    expect(yk!.kind).toBe('yomtov');
    expect(yk!.restWork).toBe(true);
    expect(dayOn(2026, 8, 21).isRestDay).toBe(true);
  });

  it('סוכות מתחיל ב-26 בספטמבר 2026', () => {
    expect(dayOn(2026, 8, 26).holidays.some((h) => h.id.startsWith('Sukkot'))).toBe(true);
  });

  it('חול המועד סוכות מסווג כחול המועד ומותר במלאכה', () => {
    const chol = dayOn(2026, 8, 29).holidays.find((h) => h.kind === 'cholhamoed');
    expect(chol).toBeDefined();
    expect(chol!.restWork).toBe(false);
  });

  it('שמיני עצרת ב-3 באוקטובר 2026', () => {
    expect(dayOn(2026, 9, 3).holidays.some((h) => h.id.startsWith('Shmini Atzeret'))).toBe(true);
  });

  it('פסח תשפ״ו ב-2 באפריל 2026', () => {
    expect(dayOn(2026, 3, 2).holidays.some((h) => h.id.startsWith('Pesach'))).toBe(true);
  });

  it('יום רגיל לא מקבל מועדים', () => {
    // 17 בנובמבר 2026: שלישי רגיל, לא ראש חודש ולא מועד
    expect(dayOn(2026, 10, 17).holidays).toHaveLength(0);
  });
});

describe('הכיתוב בעברית', () => {
  it('כותרות המועדים בעברית, לא באנגלית', () => {
    const rh = dayOn(2026, 8, 12).holidays[0];
    expect(rh.title).toMatch(/[א-ת]/);
    expect(rh.title).not.toMatch(/[A-Za-z]/);
  });

  it('הכיתוב המקוצר קצר מהמלא או שווה לו', () => {
    for (const h of dayOn(2026, 8, 12).holidays) {
      expect(h.shortTitle.length).toBeLessThanOrEqual(h.title.length);
      expect(h.shortTitle.length).toBeGreaterThan(0);
    }
  });

  it('השנה בכותרת מוצגת בגימטריה ולא בספרות', () => {
    const rh = dayOn(2026, 8, 12).holidays.find((h) => h.id.startsWith('Rosh Hashana'))!;
    expect(rh.title).not.toMatch(/\d{4}/);
  });
});

/* ==========================================================================
   סינון לפי הגדרות
   ========================================================================== */

describe('סינון מועדים', () => {
  it('כיבוי חגים יהודיים מסיר את יום כיפור', () => {
    const day = buildDay(new Date(2026, 8, 21), buildOptions({ showJewishHolidays: false }));
    expect(day.holidays.filter((h) => h.kind === 'yomtov')).toHaveLength(0);
  });

  it('כיבוי צומות לא מעלים את יום כיפור', () => {
    // יום כיפור נושא גם את דגל הצום; הוא חייב להישאר כיום טוב
    const day = buildDay(new Date(2026, 8, 21), buildOptions({ showFasts: false }));
    expect(day.holidays.some((h) => h.id === 'Yom Kippur')).toBe(true);
    expect(day.isRestDay).toBe(true);
  });

  it('כיבוי צומות מסיר את תשעה באב', () => {
    const on = buildDay(new Date(2026, 6, 23), buildOptions());
    const off = buildDay(new Date(2026, 6, 23), buildOptions({ showFasts: false }));
    expect(on.holidays.some((h) => h.kind === 'majorfast')).toBe(true);
    expect(off.holidays.some((h) => h.kind === 'majorfast')).toBe(false);
  });

  it('כיבוי מועדי ישראל מסיר את יום העצמאות', () => {
    const on = buildDay(new Date(2026, 3, 22), buildOptions());
    const off = buildDay(new Date(2026, 3, 22), buildOptions({ showIsraeliHolidays: false }));
    expect(on.holidays.some((h) => h.kind === 'modern')).toBe(true);
    expect(off.holidays.some((h) => h.kind === 'modern')).toBe(false);
  });

  it('כיבוי ראש חודש מסיר אותו', () => {
    const range = (o: ReturnType<typeof buildOptions>) =>
      [...buildDays(new Date(2026, 10, 1), new Date(2026, 10, 30), o).values()].flatMap(
        (d) => d.holidays,
      );
    expect(range(buildOptions()).some((h) => h.kind === 'roshchodesh')).toBe(true);
    expect(range(buildOptions({ showRoshChodesh: false })).some((h) => h.kind === 'roshchodesh')).toBe(
      false,
    );
  });

  it('כיבוי פרשת השבוע מסיר אותה', () => {
    expect(buildDay(new Date(2026, 10, 7), buildOptions()).parsha).toBeDefined();
    expect(
      buildDay(new Date(2026, 10, 7), buildOptions({ showParsha: false })).parsha,
    ).toBeUndefined();
  });

  it('כיבוי זמני שבת מסיר את הדלקת הנרות', () => {
    expect(buildDay(new Date(2026, 10, 6), buildOptions()).times.length).toBeGreaterThan(0);
    expect(
      buildDay(new Date(2026, 10, 6), buildOptions({ showCandleTimes: false })).times,
    ).toHaveLength(0);
  });
});

/* ==========================================================================
   זמנים ושעון קיץ
   ========================================================================== */

describe('הדלקת נרות ושעון קיץ', () => {
  const candlesOn = (y: number, m: number, d: number, o = opts) =>
    buildDay(new Date(y, m, d), o).times.find((t) => t.kind === 'candles');

  it('יש הדלקת נרות בערב שבת', () => {
    // 6 בנובמבר 2026 הוא יום שישי
    expect(new Date(2026, 10, 6).getDay()).toBe(5);
    expect(candlesOn(2026, 10, 6)).toBeDefined();
  });

  it('אין הדלקת נרות ביום שלישי רגיל', () => {
    expect(candlesOn(2026, 10, 10)).toBeUndefined();
  });

  it('הדלקת הנרות בחורף מוקדמת בהרבה מזו שבקיץ', () => {
    const jan = candlesOn(2026, 0, 2)!; // שישי בינואר, שעון חורף
    const jul = candlesOn(2026, 6, 3)!; // שישי ביולי, שעון קיץ
    expect(timeToMinutes(jan.time)).toBeLessThan(timeToMinutes(jul.time));
    // הפרש של שלוש שעות לפחות מוכיח שהמעבר בין השעונים נלקח בחשבון
    expect(timeToMinutes(jul.time) - timeToMinutes(jan.time)).toBeGreaterThan(150);
  });

  it('הזמנים בפורמט 24 שעות בלי AM/PM', () => {
    expect(candlesOn(2026, 10, 6)!.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('הבדלה מאוחרת מהדלקת הנרות של אותה שבת', () => {
    const candles = candlesOn(2026, 10, 6)!;
    const havdalah = buildDay(new Date(2026, 10, 7), opts).times.find(
      (t) => t.kind === 'havdalah',
    )!;
    expect(havdalah.at).toBeGreaterThan(candles.at);
  });

  it('דקות ההדלקה מהגדרות משפיעות על הזמן', () => {
    const a = candlesOn(2026, 10, 6, buildOptions({ candleLightingMins: 18 }))!;
    const b = candlesOn(2026, 10, 6, buildOptions({ candleLightingMins: 40 }))!;
    expect(timeToMinutes(a.time) - timeToMinutes(b.time)).toBe(22);
  });

  it('ערים שונות מקבלות זמנים משלהן', () => {
    // בהפרש של 55 ק״מ ההדלקה עשויה להתעגל לאותה דקה; השקיעה היא שנבדלת
    const jlm = dayZmanim(new Date(2026, 10, 6), JERUSALEM).sunset;
    const tlv = dayZmanim(new Date(2026, 10, 6), TEL_AVIV).sunset;
    expect(jlm).not.toBe(tlv);
  });
});

describe('dayZmanim', () => {
  it('הזמנים עולים לאורך היום', () => {
    const z = dayZmanim(new Date(2026, 8, 13), JERUSALEM);
    const order = [
      z.alotHaShachar,
      z.sunrise,
      z.sofZmanShma,
      z.chatzot,
      z.minchaGedola,
      z.plagHaMincha,
      z.sunset,
      z.tzeit,
    ].map(timeToMinutes);
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
  });

  it('השקיעה בקיץ מאוחרת מזו שבחורף', () => {
    const winter = timeToMinutes(dayZmanim(new Date(2026, 0, 15), JERUSALEM).sunset);
    const summer = timeToMinutes(dayZmanim(new Date(2026, 6, 15), JERUSALEM).sunset);
    expect(summer - winter).toBeGreaterThan(150);
  });
});

/* ==========================================================================
   תאריך עברי
   ========================================================================== */

describe('hebrewDateParts', () => {
  it('ראש השנה תשפ״ז הוא א׳ בתשרי', () => {
    const p = hebrewDateParts(new Date(2026, 8, 12));
    expect(p.dayNumber).toBe(1);
    expect(p.month).toBe('תשרי');
    expect(p.yearNumber).toBe(5787);
    expect(p.year).toContain('תשפ');
  });

  it('היום מוצג בגימטריה ולא בספרות', () => {
    expect(hebrewDateParts(new Date(2026, 8, 26)).day).not.toMatch(/\d/);
  });

  it('מקבל גם HDate', () => {
    expect(hebrewDateParts(new HDate(new Date(2026, 8, 12))).dayNumber).toBe(1);
  });
});

describe('hebrewDateAfterSunset', () => {
  it('מקדם את התאריך העברי ביום אחד', () => {
    const today = hebrewDateParts(new Date(2026, 8, 12));
    const evening = hebrewDateAfterSunset(new Date(2026, 8, 12));
    expect(evening.dayNumber).toBe(today.dayNumber + 1);
  });
});

describe('hebrewMonthSpanLabel', () => {
  it('חודש לועזי שפרוש על שני חודשים עבריים מציג את שניהם', () => {
    expect(hebrewMonthSpanLabel(new Date(2026, 8, 1))).toContain('–');
  });

  it('הכיתוב בעברית בלבד', () => {
    expect(hebrewMonthSpanLabel(new Date(2026, 8, 1))).not.toMatch(/[A-Za-z]/);
  });
});

/* ==========================================================================
   שבתות וחגים לטאב הזמנים
   ========================================================================== */

describe('upcomingShabbatot', () => {
  const entries = upcomingShabbatot(new Date(2026, 10, 1), 4, opts);

  it('מחזיר רשומות בסדר כרונולוגי', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (let i = 1; i < entries.length; i += 1) {
      expect(entries[i].startKey > entries[i - 1].startKey).toBe(true);
    }
  });

  it('בכל רשומה ההבדלה אחרי הדלקת הנרות', () => {
    for (const e of entries) {
      if (e.candles && e.havdalah) expect(e.havdalah.at).toBeGreaterThan(e.candles.at);
    }
  });

  it('לשבת רגילה יש פרשה', () => {
    expect(entries.some((e) => e.parsha)).toBe(true);
  });

  it('תופס גם ימים טובים, לא רק שבתות', () => {
    const high = upcomingShabbatot(new Date(2026, 8, 10), 4, opts);
    expect(high.some((e) => e.isHoliday)).toBe(true);
  });
});

describe('yearHolidays', () => {
  const list = yearHolidays(2026, opts);

  it('מחזיר מועדים לאורך כל השנה', () => {
    expect(list.length).toBeGreaterThan(10);
  });

  it('ממוין לפי תאריך', () => {
    for (let i = 1; i < list.length; i += 1) {
      expect(list[i].key >= list[i - 1].key).toBe(true);
    }
  });

  it('כולל את יום כיפור', () => {
    expect(list.some((h) => h.key === '2026-09-21')).toBe(true);
  });
});

/* ==========================================================================
   מבנה התוצאה
   ========================================================================== */

describe('buildDays', () => {
  it('מחזיר רשומה לכל יום בטווח', () => {
    const days = buildDays(new Date(2026, 8, 1), new Date(2026, 8, 30), opts);
    expect(days.size).toBe(30);
    expect(days.has('2026-09-01')).toBe(true);
    expect(days.has('2026-09-30')).toBe(true);
  });

  it('מסמן שייכות לחודש המוצג', () => {
    const days = buildDays(
      new Date(2026, 7, 30),
      new Date(2026, 9, 3),
      opts,
      new Date(2026, 8, 1),
    );
    expect(days.get('2026-08-30')!.inCurrentMonth).toBe(false);
    expect(days.get('2026-09-15')!.inCurrentMonth).toBe(true);
  });

  it('שבת מסומנת כיום מנוחה', () => {
    const shabbat = buildDay(new Date(2026, 10, 7), opts);
    expect(shabbat.date.getDay()).toBe(6);
    expect(shabbat.isShabbat).toBe(true);
    expect(shabbat.isRestDay).toBe(true);
  });

  it('המועדים ממוינים לפי חשיבות - יום טוב לפני ראש חודש', () => {
    const day = buildDay(new Date(2026, 8, 12), opts);
    if (day.holidays.length > 1) {
      expect(day.holidays[0].kind).toBe('yomtov');
    }
  });

  it('הזמנים ממוינים כרונולוגית', () => {
    for (const day of buildDays(new Date(2026, 8, 1), new Date(2026, 8, 30), opts).values()) {
      for (let i = 1; i < day.times.length; i += 1) {
        expect(day.times[i].at).toBeGreaterThanOrEqual(day.times[i - 1].at);
      }
    }
  });
});

/* ==========================================================================
   מטמון
   ========================================================================== */

describe('מטמון החישוב', () => {
  it('אותה בקשה מחזירה את אותה מפה', () => {
    clearCalendarCache();
    const a = buildDays(new Date(2026, 8, 1), new Date(2026, 8, 30), opts);
    const b = buildDays(new Date(2026, 8, 1), new Date(2026, 8, 30), opts);
    expect(b).toBe(a);
  });

  it('שינוי סינון מחזיר תוצאה חדשה', () => {
    clearCalendarCache();
    const a = buildDays(new Date(2026, 8, 1), new Date(2026, 8, 30), opts);
    const b = buildDays(
      new Date(2026, 8, 1),
      new Date(2026, 8, 30),
      buildOptions({ showParsha: false }),
    );
    expect(b).not.toBe(a);
    expect([...b.values()].every((d) => d.parsha === undefined)).toBe(true);
  });

  it('שינוי עיר מחזיר תוצאה חדשה', () => {
    clearCalendarCache();
    const a = buildDays(new Date(2026, 8, 1), new Date(2026, 8, 30), opts);
    const b = buildDays(
      new Date(2026, 8, 1),
      new Date(2026, 8, 30),
      buildOptions({ city: TEL_AVIV }),
    );
    expect(b).not.toBe(a);
  });

  it('עיר מותאמת אישית עם אותו מזהה אך קואורדינטות אחרות לא מחזירה מטמון', () => {
    clearCalendarCache();
    const here = { ...JERUSALEM, id: 'custom' };
    const there = { ...JERUSALEM, id: 'custom', latitude: 32.79, longitude: 34.99 };
    const a = buildDays(new Date(2026, 8, 1), new Date(2026, 8, 30), buildOptions({ city: here }));
    const b = buildDays(new Date(2026, 8, 1), new Date(2026, 8, 30), buildOptions({ city: there }));
    expect(b).not.toBe(a);
  });

  it('טווח אחר מחזיר תוצאה חדשה', () => {
    clearCalendarCache();
    const a = buildDays(new Date(2026, 8, 1), new Date(2026, 8, 30), opts);
    const b = buildDays(new Date(2026, 9, 1), new Date(2026, 9, 31), opts);
    expect(b).not.toBe(a);
    expect(b.size).toBe(31);
  });

  it('המטמון לא מחזיק יותר מהתקרה', () => {
    clearCalendarCache();
    const first = buildDays(new Date(2020, 0, 1), new Date(2020, 0, 31), opts);
    for (let m = 0; m < 30; m += 1) {
      buildDays(new Date(2021, m, 1), new Date(2021, m, 28), opts);
    }
    // הישן ביותר נזרק, ולכן אותה בקשה תיבנה מחדש
    expect(buildDays(new Date(2020, 0, 1), new Date(2020, 0, 31), opts)).not.toBe(first);
  });
});
