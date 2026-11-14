import { describe, expect, it } from 'vitest';
import {
  daysFromToday,
  relativeDaysLabel,
  shortDateLabel,
  shortWhenLabel,
  whenSummary,
} from './whenSummary';

/*
  התאריכים ידועים מראש (CLAUDE.md, "בדיקות"): ראש השנה תשפ״ז חל בשבת,
  12 בספטמבר 2026, ויום כיפור ב-21 בספטמבר.
*/
const evening = (key: string) => new Date(`${key}T23:30:00`);

describe('daysFromToday', () => {
  it('counts local days, also late in the evening', () => {
    // ב-23:30 שעון ישראל כבר מחר ב-UTC; הספירה חייבת להישאר מקומית
    expect(daysFromToday('2026-09-12', evening('2026-09-09'))).toBe(3);
    expect(daysFromToday('2026-09-09', evening('2026-09-09'))).toBe(0);
  });

  it('survives the switch to winter time', () => {
    // שעון החורף בישראל ב-2026 מתחיל ב-25 באוקטובר
    expect(daysFromToday('2026-10-26', new Date('2026-10-24T12:00:00'))).toBe(2);
  });
});

describe('relativeDaysLabel', () => {
  const now = new Date('2026-09-09T10:00:00');
  it.each([
    ['2026-09-09', 'היום'],
    ['2026-09-10', 'מחר'],
    ['2026-09-11', 'מחרתיים'],
    ['2026-09-12', 'בעוד 3 ימים'],
    ['2026-09-16', 'בעוד שבוע'],
    ['2026-09-23', 'בעוד שבועיים'],
    ['2026-09-08', 'אתמול'],
    ['2026-09-07', 'שלשום'],
    ['2026-09-04', 'לפני 5 ימים'],
  ])('%s → %s', (key, label) => {
    expect(relativeDaysLabel(key, now)).toBe(label);
  });
});

describe('whenSummary', () => {
  it('says relative, Gregorian and Hebrew', () => {
    expect(whenSummary({ date: '2026-09-12' }, new Date('2026-09-09T10:00:00'))).toBe(
      'בעוד 3 ימים · שבת, 12 בספטמבר · א׳ בתשרי',
    );
  });

  it('adds the span of a multi-day event', () => {
    expect(
      whenSummary(
        { date: '2026-09-12', endDate: '2026-09-13' },
        new Date('2026-09-12T08:00:00'),
      ),
    ).toBe('היום · שבת, 12 בספטמבר · א׳ בתשרי · 2 ימים, עד א׳ 13/9');
  });

  it('ignores an end date that is not after the start', () => {
    expect(
      whenSummary({ date: '2026-09-21', endDate: '2026-09-21' }, new Date('2026-09-21T08:00:00')),
    ).toBe('היום · שני, 21 בספטמבר · י׳ בתשרי');
  });
});

describe('shortWhenLabel', () => {
  it('abbreviates the weekday and the date', () => {
    expect(shortDateLabel('2026-09-12')).toBe('ש׳ 12/9');
    expect(shortWhenLabel('2026-04-02', '09:00')).toBe('ה׳ 2/4 · 09:00');
  });

  it('drops the time of an all-day event', () => {
    expect(shortWhenLabel('2026-09-21', null)).toBe('ב׳ 21/9');
  });
});
