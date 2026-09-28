import { describe, expect, it } from 'vitest';
import type { ReminderGroup, ReminderItem } from './reminders';
import { sectionByCategory } from './reminderSections';

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
