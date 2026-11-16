import { describe, expect, it } from 'vitest';
import type { ReminderGroup, ReminderItem } from './reminders';
import { firstRows, firstSectionRows, sectionByCategory } from './reminderSections';

const item = (key: string, categoryId?: string, done = false): ReminderItem => ({
  key,
  baseId: key,
  sourceKey: '2026-09-28',
  title: key,
  time: '',
  done,
  color: 'violet',
  hasPlace: false,
  hasAlarm: false,
  repeating: false,
  categoryId,
});

const group = (key: ReminderGroup['key'], items: ReminderItem[]): ReminderGroup => ({
  key,
  label: key,
  hebrew: '',
  droppable: true,
  items,
});

const categories = [
  { id: 'home', name: 'בית' },
  { id: 'work', name: 'עבודה' },
];

describe('sectionByCategory', () => {
  it('splits by category in their order, with the uncategorised last', () => {
    const out = sectionByCategory(
      [
        group('undated', [item('a', 'work'), item('b')]),
        group('2026-09-28', [item('c', 'home'), item('d', 'work', true)]),
      ],
      categories,
    );
    expect(out.map((s) => s.id)).toEqual(['home', 'work', 'none']);
    expect(out[1].groups.map((g) => [g.key, g.items.map((i) => i.key)])).toEqual([
      ['undated', ['a']],
      ['2026-09-28', ['d']],
    ]);
  });

  it('counts only what is still open', () => {
    const out = sectionByCategory([group('undated', [item('a', 'work'), item('d', 'work', true)])], categories);
    expect(out[0].open).toBe(1);
  });

  it('drops empty categories and empty days inside a category', () => {
    const out = sectionByCategory([group('undated', [item('a', 'home')]), group('2026-09-28', [])], categories);
    expect(out.map((s) => s.id)).toEqual(['home']);
    expect(out[0].groups).toHaveLength(1);
  });

  it('treats a deleted category as no category, so its items do not vanish', () => {
    const out = sectionByCategory([group('undated', [item('a', 'gone')])], categories);
    expect(out.map((s) => s.id)).toEqual(['none']);
  });
});

describe('firstRows', () => {
  const days = [
    group('undated', [item('a'), item('b'), item('c')]),
    group('2026-09-28', []),
    group('2026-09-29', [item('d'), item('e')]),
    group('2026-09-30', [item('f')]),
  ];

  it('keeps whole groups until the budget is spent', () => {
    // 3 + 1 (יום ריק הוא שורה) = 4, ואז הקבוצה הבאה נכנסת שלמה
    expect(firstRows(days, 4).map((g) => g.key)).toEqual(['undated', '2026-09-28']);
    expect(firstRows(days, 5).map((g) => g.key)).toEqual(['undated', '2026-09-28', '2026-09-29']);
    expect(firstRows(days, 2).map((g) => g.items.length)).toEqual([3]);
  });

  it('returns everything when the list is short', () => {
    expect(firstRows(days, 100)).toEqual(days);
  });

  it('carries the budget across sections, and keeps their counts', () => {
    const sections = sectionByCategory(
      [group('undated', [item('a', 'home'), item('b', 'home'), item('c', 'work'), item('d', 'work')])],
      categories,
    );
    const first = firstSectionRows(sections, 2);
    expect(first.map((s) => s.id)).toEqual(['home']);
    // המונה בכותרת הוא של הקטגוריה כולה, לא של מה שצויר
    expect(first[0].open).toBe(sections[0].open);
    expect(firstSectionRows(sections, 3).map((s) => s.id)).toEqual(['home', 'work']);
  });
});
