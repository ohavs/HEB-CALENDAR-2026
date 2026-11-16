import { describe, expect, it } from 'vitest';
import {
  COLLAPSE_AFTER_PX,
  EXPAND_AFTER_PX,
  MIN_ROOM_PX,
  TOP_ZONE_PX,
  foldStep,
  type FoldTrack,
} from './scrollCollapse';

const ROOM = 2000;

/** מריץ רצף של מיקומי גלילה על אזור אחד, ומחזיר את המצב אחרי כל אחד */
function run(tops: number[], room = ROOM, start = false): boolean[] {
  let track: FoldTrack | undefined;
  let collapsed = start;
  return tops.map((top) => {
    const r = foldStep(track, top, room, collapsed);
    track = r.track;
    collapsed = r.collapsed;
    return collapsed;
  });
}

describe('foldStep', () => {
  it('collapses only after a steady scroll down', () => {
    const steps = run([100, 110, 120, 100 + COLLAPSE_AFTER_PX]);
    expect(steps).toEqual([false, false, false, true]);
  });

  it('ignores a finger that jitters in place', () => {
    // הלוך ושוב בכמה פיקסלים: הכיוון מתחלף, והמרחק מתאפס בכל פעם
    const tops = Array.from({ length: 40 }, (_, i) => 300 + (i % 2 ? 6 : 0));
    expect(run(tops).some(Boolean)).toBe(false);
  });

  it('expands on a shorter scroll up', () => {
    const down = [100, 200];
    const up = [200 - EXPAND_AFTER_PX + 1, 200 - EXPAND_AFTER_PX];
    expect(run([...down, ...up])).toEqual([false, true, true, false]);
  });

  it('is always open at the top', () => {
    expect(run([400, 600, TOP_ZONE_PX], ROOM)).toEqual([false, true, false]);
  });

  it('does not collapse a list that barely scrolls', () => {
    expect(run([0, 50, 100], MIN_ROOM_PX - 1)).toEqual([false, false, false]);
  });

  it('keeps the state when a new scroller first reports', () => {
    // אזור שני (רשימה אחרת) אינו פותח את הסרגל רק מפני שלא נמדד קודם
    expect(foldStep(undefined, 500, ROOM, true).collapsed).toBe(true);
    expect(foldStep(undefined, 0, ROOM, true).collapsed).toBe(false);
  });
});
