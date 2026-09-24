import { describe, expect, it } from 'vitest';
import { MARQUEE, marqueeTimeline } from './motion';

describe('marqueeTimeline', () => {
  it('holds before moving, so the eye can start reading', () => {
    const { duration, keyframes } = marqueeTimeline(170);
    expect(keyframes[1].shift).toBe(0);
    expect(keyframes[1].offset * duration).toBeCloseTo(MARQUEE.holdStart);
  });

  it('travels at reading speed and reaches the very end', () => {
    const { duration, keyframes } = marqueeTimeline(170);
    const travel = (keyframes[2].offset - keyframes[1].offset) * duration;
    expect(travel).toBeCloseTo((170 / MARQUEE.speed) * 1000);
    expect(keyframes[2].shift).toBe(170);
    expect(keyframes[3].shift).toBe(170);
  });

  it('comes back to the start, faster than it went', () => {
    const { duration, keyframes } = marqueeTimeline(170);
    const there = (keyframes[2].offset - keyframes[1].offset) * duration;
    const back = (keyframes[4].offset - keyframes[3].offset) * duration;
    expect(keyframes[4]).toEqual({ offset: 1, shift: 0 });
    expect(back).toBeLessThan(there);
  });
});
