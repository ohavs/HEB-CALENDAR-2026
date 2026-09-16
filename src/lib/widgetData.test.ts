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
  buildShabbatWidget,
  buildSharedWidget,
  occurrenceRef,
  parseInbox,
  parseOccurrenceRef,
  parseSharedRef,
  sharedRef,
} from './widgetData';
import { expandEvents } from './recurrence';
import { buildDays, upcomingShabbatot } from './hebrew';
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
    return buildRemindersWidget(events, days, occ, NOW);
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
    const out = buildRemindersWidget([], days, new Map(), NOW);
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

describe('buildShabbatWidget', () => {
  const options = buildOptions() as never;

  function entries(from: Date) {
    return upcomingShabbatot(from, 8, options);
  }

  it('הרשומה הראשונה היא הקרובה שעוד לא הסתיימה', () => {
    const out = buildShabbatWidget(entries(NOW), 'ירושלים', NOW);
    expect(out.entries.length).toBeGreaterThan(0);
    expect(out.entries[0].k >= '2026-09-14').toBe(true);
  });

  it('לכל רשומה שעת הדלקה ושעת הבדלה', () => {
    const out = buildShabbatWidget(entries(NOW), 'ירושלים', NOW);
    for (const entry of out.entries.slice(0, 3)) {
      expect(entry.candles).toMatch(/^\d{1,2}:\d{2}$/);
      expect(entry.havdalah).toMatch(/^\d{1,2}:\d{2}$/);
    }
  });

  it('יום כיפור מופיע ומסומן כיום טוב', () => {
    // יום כיפור תשפ״ז חל ב-21 בספטמבר 2026, וההדלקה בערבו
    const out = buildShabbatWidget(entries(new Date(2026, 8, 18)), 'ירושלים', new Date(2026, 8, 18));
    const kippur = out.entries.find((e) => e.title.includes('כפור'));
    expect(kippur).toBeDefined();
    expect(kippur?.k).toBe('2026-09-20');
    expect(kippur?.yomtov).toBe(true);
  });

  it('שבת שכבר נכנסה נשארת ראשונה עד ההבדלה', () => {
    // מוצאי שישי, אחרי הדלקת נרות ולפני צאת השבת
    const friday = new Date(2026, 8, 18, 20, 0);
    const out = buildShabbatWidget(entries(friday), 'ירושלים', friday);
    expect(out.entries[0].k).toBe('2026-09-18');
  });

  it('שומר את שם העיר, כי הזמנים תלויים בה', () => {
    expect(buildShabbatWidget(entries(NOW), 'חיפה', NOW).city).toBe('חיפה');
  });

  it('רשימה ריקה אינה מפילה כלום', () => {
    expect(buildShabbatWidget([], 'ירושלים', NOW).entries).toEqual([]);
  });

  /* ------------------------- התאריך הלועזי ------------------------- */

  /*
    הוידג׳ט אינו מריץ שום קוד שלנו, ולכן כל מחרוזת מגיעה ערוכה מכאן.
    הלועזי קודם לעברי כי הוא זה שאפשר להצליב מולו פגישה או טיסה.
  */
  it('לכל רשומה שורת משנה שמתחילה בתאריך לועזי', () => {
    const out = buildShabbatWidget(entries(NOW), 'ירושלים', NOW);
    for (const entry of out.entries.slice(0, 3)) {
      expect(entry.sub).toMatch(/^\d{1,2} ב[\u0590-\u05FF]+ · /);
    }
  });

  it('שורת המשנה נושאת גם את התאריך העברי, אחרי הלועזי', () => {
    // ערב יום כיפור תשפ״ז: 20 בספטמבר 2026, ט׳ בתשרי
    const out = buildShabbatWidget(entries(new Date(2026, 8, 18)), 'ירושלים', new Date(2026, 8, 18));
    const kippur = out.entries.find((e) => e.k === '2026-09-20');
    expect(kippur?.sub).toBe('20 בספטמבר · ט׳ בתשרי');
  });

  /* מעטפת מותקנת ישנה קוראת רק אותו, ולכן הוא נשאר */
  it('התאריך העברי נשאר גם בשדה שלו', () => {
    const out = buildShabbatWidget(entries(new Date(2026, 8, 18)), 'ירושלים', new Date(2026, 8, 18));
    expect(out.entries.find((e) => e.k === '2026-09-20')?.hebrew).toBe('ט׳ בתשרי');
  });

  /*
    "יום שישי, 25 בספטמבר · 25 בספטמבר" היה כופל את התאריך בשורה אחת,
    כי `dayLine` בצד הנייטיבי מחבר את השניים.
  */
  it('שם היום אינו נושא תאריך, כדי שלא יוכפל בשורה', () => {
    const out = buildShabbatWidget(entries(NOW), 'ירושלים', NOW);
    for (const entry of out.entries.slice(0, 4)) {
      expect(entry.day).not.toMatch(/\d/);
    }
  });
});

describe('הוידג׳ט והמסך מציגים אותו דבר', () => {
  it('תזכורת בלי תאריך מופיעה גם בוידג׳ט', () => {
    const undated = event({ date: '2026-09-14', undated: true, title: 'בלי תאריך' });
    const out = buildRemindersWidget(
      [undated],
      buildDays(NOW, addDays(NOW, 30), buildOptions() as never),
      new Map(),
      NOW,
    );
    expect(out.groups[0].label).toBe('בלי תאריך');
    expect(out.groups[0].items[0].title).toBe('בלי תאריך');
    expect(out.open).toBe(1);
  });
});


/* ==========================================================================
   הוידג׳ט המשותף
   ========================================================================== */

describe('מזהי פריטים משותפים', () => {
  it('הלוך ושוב', () => {
    const ref = sharedRef('l1', 'i1', '2026-09-14');
    expect(parseSharedRef(ref)).toEqual({
      listId: 'l1',
      baseId: 'i1',
      sourceKey: '2026-09-14',
    });
  });

  it('מזהה פריט שמכיל קו אנכי אינו נשבר', () => {
    // baseId מגיע ממי שיצר אותו ואינו מובטח נקי
    const ref = sharedRef('l1', 'a|b', '2026-09-14');
    expect(parseSharedRef(ref)).toEqual({
      listId: 'l1',
      baseId: 'a|b',
      sourceKey: '2026-09-14',
    });
  });

  it('מזהה פגום מחזיר null', () => {
    expect(parseSharedRef('')).toBeNull();
    expect(parseSharedRef('l1')).toBeNull();
    expect(parseSharedRef('l1|i1')).toBeNull();
    expect(parseSharedRef('|i1|2026-09-14')).toBeNull();
    expect(parseSharedRef('l1|i1|')).toBeNull();
  });
});

describe('buildSharedWidget', () => {
  const days = realDays(NOW, addDays(NOW, 30));
  const expand = (items: ReturnType<typeof event>[]) =>
    expandEvents(items, NOW, addDays(NOW, 30));

  const shared = (patch: Partial<ReturnType<typeof event>> & { categoryId?: string; createdBy?: string }) => ({
    ...event(patch),
    categoryId: patch.categoryId,
    createdBy: patch.createdBy ?? 'me',
  });

  function build(items: ReturnType<typeof shared>[], categories: { id: string; name: string }[] = []) {
    return buildSharedWidget(
      [
        {
          id: 'l1',
          name: 'קניות',
          categories,
          items,
          who: (uid: string) => (uid === 'me' ? '' : 'דנה'),
        },
      ],
      days,
      expand,
      true,
      NOW,
    );
  }

  it('מקבץ לפי יום, כמו המסך', () => {
    const out = build([
      shared({ date: '2026-09-16', title: 'מאוחר' }),
      shared({ date: '2026-09-14', title: 'היום' }),
    ]);
    expect(out.lists[0].groups.map((g) => g.k)).toEqual(['2026-09-14', '2026-09-16']);
  });

  it('שם הקטגוריה מגיע מוכן, והמזהה נשמר להשוואה', () => {
    const out = build(
      [shared({ date: '2026-09-14', categoryId: 'c1' })],
      [{ id: 'c1', name: 'סופר' }],
    );
    expect(out.lists[0].categories).toEqual([{ id: 'c1', name: 'סופר' }]);
    expect(out.lists[0].groups[0].items[0].cat).toBe('c1');
  });

  it('פריט בלי קטגוריה מקבל מחרוזת ריקה ולא undefined', () => {
    // הצד הנייטיבי משווה מחרוזות; undefined היה מגיע כ-null ב-JSON
    const out = build([shared({ date: '2026-09-14' })]);
    expect(out.lists[0].groups[0].items[0].cat).toBe('');
  });

  it('מי שהוסיף מופיע רק כשזה לא אני', () => {
    const out = build([
      shared({ date: '2026-09-14', title: 'שלי' }),
      shared({ date: '2026-09-14', title: 'שלה', createdBy: 'u2' }),
    ]);
    const items = out.lists[0].groups[0].items;
    expect(items.find((i) => i.title === 'שלי')!.who).toBe('');
    expect(items.find((i) => i.title === 'שלה')!.who).toBe('דנה');
  });

  it('המזהה של פריט נושא גם את הרשימה', () => {
    const out = build([shared({ id: 'i1', date: '2026-09-14' })]);
    expect(parseSharedRef(out.lists[0].groups[0].items[0].id)?.listId).toBe('l1');
  });

  it('פריט בלי תאריך נאסף לקבוצה משלו', () => {
    const out = build([shared({ date: '2026-09-14', undated: true, title: 'מתישהו' })]);
    expect(out.lists[0].groups[0].k).toBe('undated');
    expect(out.lists[0].groups[0].items[0].title).toBe('מתישהו');
  });

  it('רשימה ריקה נשמרת, כדי שאפשר יהיה לבחור בה בהגדרת הוידג׳ט', () => {
    const out = build([]);
    expect(out.lists).toHaveLength(1);
    expect(out.lists[0].groups).toHaveLength(0);
  });

  it('בלי חשבון - signedIn כבוי', () => {
    const out = buildSharedWidget([], days, expand, false, NOW);
    expect(out.signedIn).toBe(false);
    expect(out.lists).toEqual([]);
  });

  it('רשימות שונות אינן נדרסות זו בזו', () => {
    // כל רשימה מורחבת בנפרד; מפה אחת לפי תאריך הייתה מאבדת אחת מהן
    const out = buildSharedWidget(
      [
        { id: 'l1', name: 'א', categories: [], items: [shared({ date: '2026-09-14', title: 'של א' })], who: () => '' },
        { id: 'l2', name: 'ב', categories: [], items: [shared({ date: '2026-09-14', title: 'של ב' })], who: () => '' },
      ],
      days,
      expand,
      true,
      NOW,
    );
    expect(out.lists[0].groups[0].items[0].title).toBe('של א');
    expect(out.lists[1].groups[0].items[0].title).toBe('של ב');
  });

  it('אותן כותרות קבוצה של המסך', () => {
    // שני חישובים נפרדים היו נפרדים גם בתוצאה
    const out = build([shared({ date: dateKey(NOW) })]);
    expect(out.lists[0].groups[0].label).toBe('היום');
  });
});

describe('parseInbox - סימון משותף', () => {
  it('מקבל shared-done', () => {
    const raw = JSON.stringify([{ type: 'shared-done', ref: 'l1|i1|2026-09-14', done: true, at: 1 }]);
    expect(parseInbox(raw)).toHaveLength(1);
  });

  it('דוחה shared-done בלי ref', () => {
    expect(parseInbox(JSON.stringify([{ type: 'shared-done', done: true, at: 1 }]))).toHaveLength(0);
  });
});
