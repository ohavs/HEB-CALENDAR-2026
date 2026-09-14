/**
 * הפילטרים של סדר היום. זו עדשה על התצוגה בלבד - היא לא נוגעת בלוח
 * עצמו, ולכן הבדיקות מוודאות גם מה נשאר וגם מה לא השתנה.
 */
import { describe, expect, it } from 'vitest';
import {
  AGENDA_CATEGORIES,
  activeCount,
  categoryOfHoliday,
  filterAgendaDay,
  isHidden,
  toggleCategory,
} from './agendaFilters';
import { buildDay } from './hebrew';
import { eventsOnDay } from './recurrence';
import { buildOptions, event } from '@/test/factories';

/** יום כיפור תשפ״ז - יום טוב, וגם צום, וגם יש בו זמנים */
const YOM_KIPPUR = new Date(2026, 8, 21);
/** ערב סוכות - ערב חג עם הדלקת נרות */
const EREV_SUKKOT = new Date(2026, 8, 25);

const dayOf = (d: Date) => buildDay(d, buildOptions());

describe('categoryOfHoliday', () => {
  it('חגים, חול המועד וערבי חג נכנסים לחגים ומועדים', () => {
    for (const kind of ['yomtov', 'cholhamoed', 'erev', 'minor', 'specialshabbat'] as const) {
      expect(categoryOfHoliday(kind)).toBe('holidays');
    }
  });

  it('צומות נכנסים לצומות', () => {
    expect(categoryOfHoliday('majorfast')).toBe('fasts');
    expect(categoryOfHoliday('minorfast')).toBe('fasts');
  });

  it('מועדי ישראל וראש חודש נפרדים', () => {
    expect(categoryOfHoliday('modern')).toBe('modern');
    expect(categoryOfHoliday('roshchodesh')).toBe('roshchodesh');
  });

  it('מה שלא מוצג ברשימה מוחזר כ-null', () => {
    expect(categoryOfHoliday('parsha')).toBeNull();
    expect(categoryOfHoliday('omer')).toBeNull();
  });

  it('לכל קטגוריה יש כיתוב בעברית', () => {
    for (const c of AGENDA_CATEGORIES) {
      expect(c.label).toMatch(/[א-ת]/);
    }
  });
});

describe('toggleCategory', () => {
  it('מוסיף קטגוריה שאינה מוסתרת', () => {
    expect(toggleCategory([], 'fasts')).toEqual(['fasts']);
  });

  it('מסיר קטגוריה שכבר מוסתרת', () => {
    expect(toggleCategory(['fasts', 'times'], 'fasts')).toEqual(['times']);
  });

  it('לא משנה את המערך המקורי', () => {
    const before: ReturnType<typeof toggleCategory> = ['fasts'];
    toggleCategory(before, 'times');
    expect(before).toEqual(['fasts']);
  });

  it('isHidden עקבי עם toggleCategory', () => {
    const after = toggleCategory([], 'events');
    expect(isHidden(after, 'events')).toBe(true);
    expect(isHidden(after, 'times')).toBe(false);
  });
});

describe('activeCount', () => {
  it('בלי סינון כל הקטגוריות פעילות', () => {
    expect(activeCount([])).toBe(AGENDA_CATEGORIES.length);
  });

  it('יורד עם כל קטגוריה שמוסתרת', () => {
    expect(activeCount(['fasts', 'times'])).toBe(AGENDA_CATEGORIES.length - 2);
  });
});

describe('filterAgendaDay', () => {
  it('בלי סינון הכול נשאר', () => {
    const day = dayOf(YOM_KIPPUR);
    const out = filterAgendaDay(day, [], [])!;
    expect(out.day.holidays.length).toBe(day.holidays.length);
  });

  it('הסתרת חגים מסירה את יום כיפור', () => {
    const day = dayOf(YOM_KIPPUR);
    const out = filterAgendaDay(day, [], ['holidays']);
    expect(out?.day.holidays.some((h) => h.id === 'Yom Kippur')).not.toBe(true);
  });

  it('הסתרת זמני שבת מסירה את ההדלקה', () => {
    const day = dayOf(EREV_SUKKOT);
    expect(filterAgendaDay(day, [], [])!.day.times.length).toBeGreaterThan(0);
    expect(filterAgendaDay(day, [], ['times'])?.day.times ?? []).toHaveLength(0);
  });

  it('הסתרת אירועים מסירה אותם ומשאירה את המועדים', () => {
    const day = dayOf(YOM_KIPPUR);
    const occ = eventsOnDay([event({ date: '2026-09-21' })], YOM_KIPPUR);
    const out = filterAgendaDay(day, occ, ['events'])!;
    expect(out.occurrences).toHaveLength(0);
    expect(out.day.holidays.length).toBeGreaterThan(0);
  });

  it('יום שלא נשאר בו כלום מוחזר כ-null', () => {
    const day = dayOf(YOM_KIPPUR);
    const all = AGENDA_CATEGORIES.map((c) => c.id);
    expect(filterAgendaDay(day, [], all)).toBeNull();
  });

  it('יום שיש בו רק אירוע נשאר כשהאירועים מוצגים', () => {
    const plain = dayOf(new Date(2026, 10, 17));
    const occ = eventsOnDay([event({ date: '2026-11-17' })], new Date(2026, 10, 17));
    expect(filterAgendaDay(plain, occ, [])).not.toBeNull();
    expect(filterAgendaDay(plain, occ, ['events'])).toBeNull();
  });

  it('הסינון אינו משנה את היום המקורי', () => {
    const day = dayOf(YOM_KIPPUR);
    const before = day.holidays.length;
    filterAgendaDay(day, [], ['holidays', 'fasts']);
    expect(day.holidays.length).toBe(before);
  });

  it('פרשה וספירת עומר לא שורדות ממילא, כי אינן מוצגות ברשימה', () => {
    const shabbat = dayOf(new Date(2026, 10, 7));
    const out = filterAgendaDay(shabbat, [], []);
    expect(out?.day.holidays.some((h) => h.kind === 'parsha')).not.toBe(true);
  });

  it('רק הדלקת נרות והבדלה נשמרות מהזמנים', () => {
    const out = filterAgendaDay(dayOf(EREV_SUKKOT), [], [])!;
    for (const t of out.day.times) {
      expect(['candles', 'havdalah']).toContain(t.kind);
    }
  });
});
