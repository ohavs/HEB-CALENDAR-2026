import { describe, expect, it } from 'vitest';
import type { UserEvent } from '@/types';
import { expandEvents } from './recurrence';
import { buildSystemEvents } from './systemCalendar';

const base: UserEvent = {
  id: 'e',
  title: 'אירוע',
  date: '2026-09-21',
  startTime: null,
  endTime: null,
  allDay: true,
  color: 'violet',
  reminderMinutes: null,
  repeat: 'none',
  createdAt: 0,
  updatedAt: 0,
};

const build = (events: UserEvent[], from = '2026-09-01', to = '2026-10-31') => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const map = expandEvents(events, new Date(fy, fm - 1, fd), new Date(ty, tm - 1, td));
  return buildSystemEvents([...map.values()].flat());
};

describe('buildSystemEvents', () => {
  it('writes an all-day event at UTC midnight with an exclusive end', () => {
    // יום כיפור תשפ״ז: 21 בספטמבר 2026
    expect(build([base])).toEqual([
      { title: 'אירוע', begin: Date.UTC(2026, 8, 21), end: Date.UTC(2026, 8, 22), allDay: true },
    ]);
  });

  it('writes a multi-day event once, not once per day', () => {
    // סוכות: 26 בספטמבר עד 2 באוקטובר
    const out = build([{ ...base, date: '2026-09-26', endDate: '2026-10-02' }]);
    expect(out).toHaveLength(1);
    expect(out[0].begin).toBe(Date.UTC(2026, 8, 26));
    expect(out[0].end).toBe(Date.UTC(2026, 9, 3));
  });

  it('keeps local time for a timed event', () => {
    const out = build([{ ...base, allDay: false, startTime: '14:30', endTime: '16:00', location: 'בית' }]);
    // שעון קיץ בישראל: UTC+3
    expect(out).toEqual([
      {
        title: 'אירוע',
        begin: Date.UTC(2026, 8, 21, 11, 30),
        end: Date.UTC(2026, 8, 21, 13, 0),
        allDay: false,
        location: 'בית',
      },
    ]);
  });

  it('gives an hour when the end is missing', () => {
    const [ev] = build([{ ...base, allDay: false, startTime: '14:30' }]);
    expect(ev.end - ev.begin).toBe(60 * 60 * 1000);
  });

  it('expands a weekly series into separate events', () => {
    const out = build([{ ...base, repeat: 'weekly' }], '2026-09-01', '2026-10-12');
    expect(out.map((e) => e.begin)).toEqual([
      Date.UTC(2026, 8, 21),
      Date.UTC(2026, 8, 28),
      Date.UTC(2026, 9, 5),
      Date.UTC(2026, 9, 12),
    ]);
  });

  it('leaves undated reminders out', () => {
    expect(build([{ ...base, undated: true }])).toEqual([]);
  });

  it('names the shared list, since the other calendar has no badge for it', () => {
    const map = expandEvents([base], new Date(2026, 8, 1), new Date(2026, 9, 1));
    const occ = [...map.values()].flat().map((o) => ({ ...o, shared: { listId: 'l', listName: 'בית' } }));
    expect(buildSystemEvents(occ)[0].title).toBe('אירוע · בית');
  });
});
