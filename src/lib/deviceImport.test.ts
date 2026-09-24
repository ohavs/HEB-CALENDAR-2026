import { describe, expect, it } from 'vitest';
import { deviceToDrafts, durationMs, simpleRepeat, type DeviceRow } from './deviceImport';

// שעון ישראל, ספטמבר 2026 הוא שעון קיץ (UTC+3)
const now = new Date(2026, 8, 24, 10, 0);
const opts = { color: 'sky' as const, now, from: Date.UTC(2026, 7, 25) };
const at = (d: number, h = 11, m = 0) => Date.UTC(2026, 8, d, h - 3, m);

describe('simpleRepeat', () => {
  it('maps what we can represent faithfully', () => {
    expect(simpleRepeat('FREQ=WEEKLY;WKST=SU;BYDAY=MO')).toBe('weekly');
    expect(simpleRepeat('FREQ=MONTHLY;BYMONTHDAY=21')).toBe('monthly');
    expect(simpleRepeat('FREQ=YEARLY')).toBe('yearly');
  });

  it('refuses what would change the meaning', () => {
    expect(simpleRepeat('FREQ=WEEKLY;INTERVAL=2')).toBeNull();
    expect(simpleRepeat('FREQ=WEEKLY;BYDAY=MO,WE')).toBeNull();
    expect(simpleRepeat('FREQ=WEEKLY;UNTIL=20261231T000000Z')).toBeNull();
    expect(simpleRepeat('FREQ=MONTHLY;BYDAY=2TU')).toBeNull();
    expect(simpleRepeat('FREQ=DAILY')).toBeNull();
  });
});

describe('durationMs', () => {
  it('reads the forms the calendar provider writes', () => {
    expect(durationMs('P3600S')).toBe(3_600_000);
    expect(durationMs('PT1H30M')).toBe(5_400_000);
    expect(durationMs('P1D')).toBe(86_400_000);
    expect(durationMs(undefined)).toBe(0);
  });
});

describe('deviceToDrafts', () => {
  const single: DeviceRow = {
    id: 1,
    title: 'רופא שיניים',
    begin: at(28, 14, 30),
    end: at(28, 15, 15),
    allDay: false,
    location: 'חיפה',
  };

  it('copies a one-off event in local time, without a second reminder', () => {
    expect(deviceToDrafts([single], [], opts)).toEqual([
      expect.objectContaining({
        title: 'רופא שיניים',
        date: '2026-09-28',
        startTime: '14:30',
        endTime: '15:15',
        allDay: false,
        location: 'חיפה',
        reminderMinutes: null,
        repeat: 'none',
      }),
    ]);
  });

  it('copies an all-day event on its own day', () => {
    // סוכות תשפ״ז, 26 בספטמבר, שמור בחצות UTC עם סיום בלעדי
    const [d] = deviceToDrafts(
      [{ id: 2, title: 'סוכות אצל סבתא', begin: Date.UTC(2026, 8, 26), end: Date.UTC(2026, 8, 27), allDay: true }],
      [],
      opts,
    );
    expect(d).toMatchObject({ date: '2026-09-26', allDay: true, startTime: null });
    expect(d.endDate).toBeUndefined();
  });

  it('skips what already ended before the window, and what was cancelled or untitled', () => {
    const old = { ...single, id: 3, begin: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 0, 1, 1) };
    const cancelled = { ...single, id: 4, cancelled: true };
    const untitled = { ...single, id: 5, title: '  ' };
    expect(deviceToDrafts([old, cancelled, untitled], [], opts)).toEqual([]);
  });

  it('turns a simple weekly series into ours, with its exceptions', () => {
    const master: DeviceRow = {
      id: 10,
      title: 'חוג',
      begin: at(7, 17),
      duration: 'P3600S',
      allDay: false,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    };
    const cancelled: DeviceRow = {
      id: 11,
      originalId: 10,
      originalInstanceTime: at(14, 17),
      cancelled: true,
      title: 'חוג',
      begin: at(14, 17),
      allDay: false,
    };
    const moved: DeviceRow = {
      id: 12,
      originalId: 10,
      originalInstanceTime: at(21, 17),
      title: 'חוג',
      begin: at(22, 18),
      end: at(22, 19),
      allDay: false,
    };
    const drafts = deviceToDrafts([master, cancelled, moved], [], opts);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      date: '2026-09-07',
      startTime: '17:00',
      endTime: '18:00',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { cancelled: true }, '2026-09-21': { cancelled: true } },
    });
    expect(drafts[1]).toMatchObject({ date: '2026-09-22', startTime: '18:00', repeat: 'none' });
  });

  it('spreads any other series into the instances the provider computed', () => {
    const master: DeviceRow = {
      id: 20,
      title: 'אימון',
      begin: at(1, 7),
      duration: 'P3600S',
      allDay: false,
      rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU',
    };
    const moved: DeviceRow = { id: 21, originalId: 20, title: 'אימון', begin: at(16, 8), end: at(16, 9), allDay: false };
    const drafts = deviceToDrafts(
      [master, moved],
      [
        { eventId: 20, title: 'אימון', begin: at(1, 7), end: at(1, 8), allDay: false },
        { eventId: 21, originalId: 20, title: 'אימון', begin: at(16, 8), end: at(16, 9), allDay: false },
        { eventId: 99, title: 'לא שלנו', begin: at(2, 7), end: at(2, 8), allDay: false },
      ],
      opts,
    );
    expect(drafts.map((d) => [d.date, d.startTime, d.repeat])).toEqual([
      ['2026-09-01', '07:00', 'none'],
      ['2026-09-16', '08:00', 'none'],
    ]);
  });
});
