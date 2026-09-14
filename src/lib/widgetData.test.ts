/**
 * הנתונים שהוידג׳טים קוראים.
 *
 * מה שנבדק כאן הוא החוזה מול הצד הנייטיבי: הוא לא יודע לחשב כלום, ולכן
 * כל מה שהוא צריך חייב להגיע ערוך - וכל שדה שייעלם כאן ייעלם ממסך הבית
 * בלי שום שגיאה.
 */
import { describe, expect, it } from 'vitest';
import type { DateKey, DayInfo } from '@/types';
import {
  buildCalendarWidget,
  buildRemindersWidget,
  occurrenceRef,
  parseInbox,
  parseOccurrenceRef,
} from './widgetData';
import { expandEvents } from './recurrence';
import { buildDays } from './hebrew';
import { addDays, dateKey, keyToDate, monthGridDays } from './dates';
import { buildOptions, event } from '@/test/factories';

/** ספטמבר 2026 - החודש שבו נופל ראש השנה תשפ״ז */
const MONTH = new Date(2026, 8, 1);
const NOW = new Date(2026, 8, 14, 10, 0);

function realDays(from: Date, to: Date): Map<DateKey, DayInfo> {
  return buildDays(from, to, buildOptions() as never, MONTH);
}

describe('buildCalendarWidget', () => {
  const grid = monthGridDays(MONTH);
  const days = realDays(grid[0], grid[grid.length - 1]);

  it('מחזיר 42 תאים, שבוע שלם בכל שורה', () => {
    const out = buildCalendarWidget(MONTH, grid, days, new Map(), NOW);
    expect(out.cells).toHaveLength(42);
    expect(out.cells.length % 7).toBe(0);
  });

  it('כותרת החודש ערוכה מראש', () => {
    const out = buildCalendarWidget(MONTH, grid, days, new Map(), NOW);
    expect(out.month).toContain('2026');
    expect(out.hebrewMonth).toMatch(/[א-ת]/);
  });

  it('ראש השנה תשפ״ז מסומן כיום טוב ב-12 בספטמבר', () => {
    // תאריך ידוע מראש, ולא פלט של הקוד עצמו
    const out = buildCalendarWidget(MONTH, grid, days, new Map(), NOW);
    const cell = out.cells.find((c) => c.k === '2026-09-12');
    expect(cell?.kind).toBe('yomtov');
  });

  it('היום מסומן, ורק הוא', () => {
    const out = buildCalendarWidget(MONTH, grid, days, new Map(), NOW);
    expect(out.cells.filter((c) => c.today)).toHaveLength(1);
    expect(out.cells.find((c) => c.today)?.k).toBe('2026-09-14');
  });

  it('ימי שבת מסומנים, שישה או יותר בחודש', () => {
    const out = buildCalendarWidget(MONTH, grid, days, new Map(), NOW);
    expect(out.cells.filter((c) => c.shabbat).length).toBeGreaterThanOrEqual(6);
  });

  it('ימים מחוץ לחודש מסומנים', () => {
    const out = buildCalendarWidget(MONTH, grid, days, new Map(), NOW);
    const first = out.cells[0];
    expect(first.out === true || first.k === '2026-09-01').toBe(true);
  });

  it('אירועי המשתמש נספרים בתא', () => {
    const events = [
      event({ date: '2026-09-14', title: 'ראשון' }),
      event({ date: '2026-09-14', title: 'שני' }),
    ];
    const occ = expandEvents(events, grid[0], grid[41]);
    const out = buildCalendarWidget(MONTH, grid, days, occ, NOW);
    expect(out.cells.find((c) => c.k === '2026-09-14')?.ev).toBe(2);
  });

  it('אירוע שבוצע אינו נספר', () => {
    const events = [
      event({ date: '2026-09-14', exceptions: { '2026-09-14': { done: true } } }),
    ];
    const occ = expandEvents(events, grid[0], grid[41]);
    const out = buildCalendarWidget(MONTH, grid, days, occ, NOW);
    expect(out.cells.find((c) => c.k === '2026-09-14')?.ev).toBeUndefined();
  });

  it('הרשימה הקרובה מכילה מועדים ואירועים, מהיום והלאה', () => {
    const events = [event({ date: '2026-09-15', title: 'פגישה' })];
    const occ = expandEvents(events, NOW, addDays(NOW, 45));
    const out = buildCalendarWidget(MONTH, grid, realDays(NOW, addDays(NOW, 45)), occ, NOW);
    expect(out.upcoming.some((u) => u.title === 'פגישה')).toBe(true);
    expect(out.upcoming.some((u) => u.holiday)).toBe(true);
    expect(out.upcoming.every((u) => u.k >= '2026-09-14')).toBe(true);
  });
});

describe('buildRemindersWidget', () => {
  const days = realDays(NOW, addDays(NOW, 30));

  function withEvents(...events: ReturnType<typeof event>[]) {
    const occ = expandEvents(events, NOW, addDays(NOW, 30));
    return buildRemindersWidget(days, occ, NOW);
  }

  it('מקבץ לפי יום, לפי סדר התאריכים', () => {
    const out = withEvents(
      event({ date: '2026-09-16', title: 'מאוחר' }),
      event({ date: '2026-09-14', title: 'היום' }),
    );
    expect(out.groups.map((g) => g.k)).toEqual(['2026-09-14', '2026-09-16']);
  });

  it('לכל קבוצה כיתוב מוכן ותאריך עברי', () => {
    const out = withEvents(event({ date: '2026-09-14' }));
    expect(out.groups[0].label).toBe('היום');
    expect(out.groups[0].hebrew).toMatch(/[א-ת]/);
  });

  it('מזהה הפריט מאפשר לחזור למופע', () => {
    const out = withEvents(event({ id: 'abc', date: '2026-09-14' }));
    const parsed = parseOccurrenceRef(out.groups[0].items[0].id);
    expect(parsed).toEqual({ baseId: 'abc', sourceKey: '2026-09-14' });
  });

  it('שעה ריקה לאירוע של כל היום', () => {
    const out = withEvents(event({ date: '2026-09-14', allDay: true, startTime: null }));
    expect(out.groups[0].items[0].time).toBe('');
  });

  it('מונה רק את מה שלא בוצע', () => {
    const out = withEvents(
      event({ date: '2026-09-14', exceptions: { '2026-09-14': { done: true } } }),
      event({ date: '2026-09-14' }),
    );
    expect(out.open).toBe(1);
    expect(out.groups[0].items).toHaveLength(2);
    expect(out.groups[0].items.filter((i) => i.done)).toHaveLength(1);
  });

  it('אירוע חוזר מופיע בכל מופע בטווח', () => {
    const out = withEvents(event({ date: '2026-09-14', repeat: 'weekly' }));
    expect(out.groups.map((g) => g.k)).toContain('2026-09-21');
  });

  it('לא חורג מהאופק', () => {
    const out = withEvents(event({ date: dateKey(addDays(NOW, 40)) }));
    expect(out.groups).toHaveLength(0);
  });

  it('בלי אירועים מחזיר רשימה ריקה ולא נופל', () => {
    const out = buildRemindersWidget(days, new Map(), NOW);
    expect(out.groups).toEqual([]);
    expect(out.open).toBe(0);
  });
});

describe('מזהי מופעים', () => {
  it('הלוך ושוב', () => {
    const occ = expandEvents([event({ id: 'x1', date: '2026-09-14' })], keyToDate('2026-09-14'), keyToDate('2026-09-14'))
      .get('2026-09-14')![0];
    expect(parseOccurrenceRef(occurrenceRef(occ))).toEqual({
      baseId: 'x1',
      sourceKey: '2026-09-14',
    });
  });

  it('מזהה שמכיל את התו המפריד אינו נשבר', () => {
    // מזהה אירוע יכול להכיל כל תו, ולכן הפיצול הוא על המופע האחרון
    expect(parseOccurrenceRef('a|b|2026-09-14')).toEqual({
      baseId: 'a|b',
      sourceKey: '2026-09-14',
    });
  });

  it('מזהה פגום מחזיר null', () => {
    expect(parseOccurrenceRef('בלי מפריד')).toBeNull();
    expect(parseOccurrenceRef('|2026-09-14')).toBeNull();
    expect(parseOccurrenceRef('abc|')).toBeNull();
  });
});

describe('parseInbox', () => {
  it('קורא פעולות תקינות', () => {
    const raw = JSON.stringify([
      { type: 'done', ref: 'a|2026-09-14', done: true, at: 1 },
      { type: 'add', title: 'לקנות חלב', date: '2026-09-14', at: 2 },
    ]);
    expect(parseInbox(raw)).toHaveLength(2);
  });

  it('זורק פעולות פגומות ושומר את התקינות', () => {
    const raw = JSON.stringify([
      { type: 'done' },
      { type: 'לא קיים' },
      null,
      { type: 'add', title: 'תקין', date: '2026-09-14', at: 3 },
    ]);
    expect(parseInbox(raw)).toHaveLength(1);
  });

  it('קלט לא תקין אינו מפיל כלום', () => {
    expect(parseInbox(null)).toEqual([]);
    expect(parseInbox('{')).toEqual([]);
    expect(parseInbox('"מחרוזת"')).toEqual([]);
  });
});
