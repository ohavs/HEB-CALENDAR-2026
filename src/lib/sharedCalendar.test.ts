import { describe, expect, it } from 'vitest';
import { mergeOccurrences, sharedOccurrences } from './sharedCalendar';
import { expandEvents, type Occurrence } from './recurrence';
import type { DateKey } from '@/types';
import type { SharedItem, SharedList } from './sharedLists';
import { event } from '@/test/factories';

const list = (id: string, name: string): SharedList => ({
  id,
  name,
  color: 'violet',
  ownerUid: 'uidA',
  memberUids: ['uidA', 'uidB'],
  members: {},
  categories: [],
  createdAt: 1,
  updatedAt: 1,
});

const item = (over: Partial<SharedItem> = {}): SharedItem =>
  ({
    id: 'i1',
    title: 'לחם',
    date: '2026-09-20',
    startTime: null,
    endTime: null,
    allDay: true,
    color: 'mint',
    reminderMinutes: null,
    repeat: 'none',
    createdBy: 'uidA',
    createdAt: 1,
    updatedAt: 1,
    ...over,
  }) as SharedItem;

const FROM = new Date(2026, 8, 1);
const TO = new Date(2026, 8, 30);

describe('sharedOccurrences', () => {
  it('פריט עם תאריך מגיע ליום שלו, ונושא את שם הרשימה', () => {
    const out = sharedOccurrences([list('L1', 'קניות')], { L1: [item()] }, 'uidA', FROM, TO);
    const day = out.get('2026-09-20' as DateKey);
    expect(day).toHaveLength(1);
    expect(day![0].title).toBe('לחם');
    expect(day![0].shared).toEqual({ listId: 'L1', listName: 'קניות' });
  });

  /* לב העניין: אותו פריט, שני משתמשים, החלטות שונות */
  it('מוסתר אצל אחד, מופיע אצל השני', () => {
    const items = { L1: [item({ hiddenBy: { uidA: true } })] };
    expect(sharedOccurrences([list('L1', 'קניות')], items, 'uidA', FROM, TO).size).toBe(0);
    expect(sharedOccurrences([list('L1', 'קניות')], items, 'uidB', FROM, TO).size).toBe(1);
  });

  it('פריט בלי תאריך אינו מגיע ללוח', () => {
    const out = sharedOccurrences(
      [list('L1', 'קניות')],
      { L1: [item({ undated: true })] },
      'uidA',
      FROM,
      TO,
    );
    expect(out.size).toBe(0);
  });

  it('שתי רשימות נאספות לאותה מפה', () => {
    const out = sharedOccurrences(
      [list('L1', 'קניות'), list('L2', 'עבודה')],
      { L1: [item()], L2: [item({ id: 'i2', title: 'דוח' })] },
      'uidA',
      FROM,
      TO,
    );
    expect(out.get('2026-09-20' as DateKey)).toHaveLength(2);
  });

  /* חזרה היא של המנוע, ולא צריך קוד משלה כאן */
  it('פריט חוזר מתפשט כמו אירוע אישי', () => {
    const out = sharedOccurrences(
      [list('L1', 'קניות')],
      { L1: [item({ date: '2026-09-01', repeat: 'weekly' })] },
      'uidA',
      FROM,
      TO,
    );
    expect(out.size).toBeGreaterThan(3);
    for (const day of out.values()) expect(day[0].shared?.listId).toBe('L1');
  });

  it('רשימה בלי פריטים אינה יוצרת רשומות', () => {
    expect(sharedOccurrences([list('L1', 'קניות')], {}, 'uidA', FROM, TO).size).toBe(0);
  });
});

describe('mergeOccurrences', () => {
  const personal = expandEvents([event({ date: '2026-09-20', title: 'פגישה' })], FROM, TO);

  it('בלי משותפים מוחזרת המפה האישית עצמה', () => {
    const empty = new Map<DateKey, Occurrence[]>();
    expect(mergeOccurrences(personal, empty)).toBe(personal);
  });

  it('שני הסוגים יושבים באותו יום', () => {
    const shared = sharedOccurrences([list('L1', 'קניות')], { L1: [item()] }, 'uidA', FROM, TO);
    const merged = mergeOccurrences(personal, shared);
    const day = merged.get('2026-09-20' as DateKey)!;
    expect(day.map((o) => o.title).sort()).toEqual(['לחם', 'פגישה']);
  });

  /*
    המפה האישית מגיעה ממטמון שמשותף לכל התצוגות. דחיפה לתוכה הייתה
    מזהמת גם מסך שלא ביקש פריטים משותפים.
  */
  it('אינו משנה את המפה האישית', () => {
    const before = personal.get('2026-09-20' as DateKey)!.length;
    const shared = sharedOccurrences([list('L1', 'קניות')], { L1: [item()] }, 'uidA', FROM, TO);
    mergeOccurrences(personal, shared);
    expect(personal.get('2026-09-20' as DateKey)!.length).toBe(before);
  });

  it('יום שיש בו רק משותף נוסף למפה', () => {
    const shared = sharedOccurrences(
      [list('L1', 'קניות')],
      { L1: [item({ date: '2026-09-25' })] },
      'uidA',
      FROM,
      TO,
    );
    expect(mergeOccurrences(personal, shared).get('2026-09-25' as DateKey)).toHaveLength(1);
  });
});
