import { describe, expect, it } from 'vitest';
import { externalToDraft, parseExternalEvent } from './externalEvent';
import { parseExternalUrl } from './launchParams';

// הבדיקות נעולות ל-Asia/Jerusalem. ספטמבר 2026 הוא שעון קיץ, UTC+3.
const now = new Date(2026, 8, 24, 10, 10);
const params = (q: string) => new URLSearchParams(q);

describe('parseExternalEvent', () => {
  it('ignores ordinary links', () => {
    expect(parseExternalEvent(params('date=2026-09-24'))).toBeNull();
  });

  it('reads the fields MainActivity sends', () => {
    const ext = parseExternalEvent(
      params('ext=insert&title=%D7%A4%D7%92%D7%99%D7%A9%D7%94&begin=100&end=200&allDay=1&loc=x&notes=y'),
    );
    expect(ext).toEqual({ title: 'פגישה', begin: 100, end: 200, allDay: true, location: 'x', notes: 'y' });
  });

  it('drops times that are not numbers', () => {
    expect(parseExternalEvent(params('ext=insert&begin=abc&end=-5'))).toEqual({
      title: undefined,
      begin: undefined,
      end: undefined,
      allDay: false,
      location: undefined,
      notes: undefined,
    });
  });

  it('comes through a deep link', () => {
    expect(parseExternalUrl('hebcal://open?ext=insert&title=a').external?.title).toBe('a');
    expect(parseExternalUrl('hebcal://open?ext=ics').ics).toBe(true);
  });
});

describe('externalToDraft', () => {
  it('keeps local time for a timed event', () => {
    // 21 בספטמבר 2026 (יום כיפור) 14:30 שעון ישראל = 11:30 UTC
    const begin = Date.UTC(2026, 8, 21, 11, 30);
    const draft = externalToDraft({ title: 'x', begin, end: begin + 90 * 60_000 }, 'sky', now);
    expect(draft).toMatchObject({
      date: '2026-09-21',
      startTime: '14:30',
      endTime: '16:00',
      allDay: false,
    });
    expect(draft.endDate).toBeUndefined();
  });

  it('gives an hour when the end is missing or before the start', () => {
    const begin = Date.UTC(2026, 8, 21, 11, 30);
    expect(externalToDraft({ begin }, 'sky', now).endTime).toBe('15:30');
    expect(externalToDraft({ begin, end: begin - 1 }, 'sky', now).endTime).toBe('15:30');
  });

  it('never runs past midnight when inventing an end', () => {
    const begin = Date.UTC(2026, 8, 21, 20, 30); // 23:30 בישראל
    expect(externalToDraft({ begin }, 'sky', now).endTime).toBe('23:59');
  });

  it('spans days when the event does', () => {
    const begin = Date.UTC(2026, 8, 21, 17, 0); // 20:00
    const end = Date.UTC(2026, 8, 22, 6, 0); // 09:00 למחרת
    expect(externalToDraft({ begin, end }, 'sky', now)).toMatchObject({
      date: '2026-09-21',
      endDate: '2026-09-22',
      endTime: '09:00',
    });
  });

  it('reads an all-day event stored at UTC midnight on its own day', () => {
    // סוכות תשפ״ז: 26 בספטמבר 2026. הסיום בלעדי - חצות שאחריו
    const begin = Date.UTC(2026, 8, 26);
    const draft = externalToDraft({ begin, end: Date.UTC(2026, 8, 27), allDay: true }, 'sky', now);
    expect(draft).toMatchObject({ date: '2026-09-26', allDay: true, startTime: null, endTime: null });
    expect(draft.endDate).toBeUndefined();
  });

  it('reads a multi-day all-day event', () => {
    const draft = externalToDraft(
      { begin: Date.UTC(2026, 8, 26), end: Date.UTC(2026, 9, 3), allDay: true },
      'sky',
      now,
    );
    expect(draft).toMatchObject({ date: '2026-09-26', endDate: '2026-10-02' });
  });

  it('reads an all-day event sent at local midnight as that day', () => {
    const begin = new Date(2026, 8, 26).getTime(); // 25.9 21:00 UTC
    expect(externalToDraft({ begin, allDay: true }, 'sky', now).date).toBe('2026-09-26');
  });

  it('falls back to the next round half hour today', () => {
    expect(externalToDraft({ title: 'x' }, 'mint', now)).toMatchObject({
      date: '2026-09-24',
      startTime: '10:30',
      endTime: '11:30',
      color: 'mint',
    });
  });

  it('trims text to what the cloud accepts', () => {
    const draft = externalToDraft({ title: 'a'.repeat(400), notes: 'b'.repeat(5000) }, 'sky', now);
    expect(draft.title).toHaveLength(300);
    expect(draft.notes).toHaveLength(4000);
  });
});
