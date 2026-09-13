/**
 * ההצעות למקום של אירוע. הכול מקומי, ולכן הכול נבדק בלי רשת.
 */
import { describe, expect, it } from 'vitest';
import { mapsUrl, recentLocations, suggestLocations } from './eventLocations';
import type { SavedPlace } from '@/types';
import { event } from '@/test/factories';

const place = (id: string, name: string): SavedPlace => ({
  id,
  name,
  latitude: 32.08,
  longitude: 34.78,
  radius: 150,
  notifyOnArrive: true,
  notifyOnLeave: false,
  createdAt: 0,
});

const HOME = place('home', 'בית');
const WORK = place('work', 'עבודה');

describe('recentLocations', () => {
  it('אוסף מקומות מאירועים קודמים', () => {
    const events = [event({ location: 'בית הכנסת' }), event({ location: 'אצל סבתא' })];
    expect(recentLocations(events, []).map((s) => s.label)).toContain('בית הכנסת');
    expect(recentLocations(events, []).map((s) => s.label)).toContain('אצל סבתא');
  });

  it('החדש ביותר ראשון', () => {
    const older = event({ location: 'ישן', updatedAt: 100 });
    const newer = event({ location: 'חדש', updatedAt: 200 });
    expect(recentLocations([older, newer], [])[0].label).toBe('חדש');
  });

  it('אותו מקום לא מופיע פעמיים', () => {
    const events = [event({ location: 'בית הכנסת' }), event({ location: 'בית הכנסת' })];
    expect(recentLocations(events, [])).toHaveLength(1);
  });

  it('התאמה מנורמלת נחשבת לאותו מקום', () => {
    const events = [event({ location: 'בית־הכנסת' }), event({ location: 'בית הכנסת' })];
    expect(recentLocations(events, [])).toHaveLength(1);
  });

  it('מדלג על מה שכבר מוגדר כמקום שמור', () => {
    const events = [event({ location: 'בית' }), event({ location: 'אצל סבתא' })];
    const out = recentLocations(events, [HOME]).map((s) => s.label);
    expect(out).not.toContain('בית');
    expect(out).toContain('אצל סבתא');
  });

  it('אירוע בלי מקום או מחוק מדולג', () => {
    const events = [
      event({ location: undefined }),
      event({ location: '   ' }),
      event({ location: 'מחוק', deleted: true }),
    ];
    expect(recentLocations(events, [])).toHaveLength(0);
  });

  it('לא יותר משמונה', () => {
    const events = Array.from({ length: 20 }, (_, i) => event({ location: `מקום ${i}` }));
    expect(recentLocations(events, []).length).toBeLessThanOrEqual(8);
  });
});

describe('suggestLocations בלי שאילתה', () => {
  it('המקומות השמורים ראשונים', () => {
    const out = suggestLocations('', [event({ location: 'אצל סבתא' })], [HOME, WORK]);
    expect(out[0].label).toBe('בית');
    expect(out[1].label).toBe('עבודה');
  });

  it('אחריהם המקומות מאירועים קודמים', () => {
    const out = suggestLocations('', [event({ location: 'אצל סבתא' })], [HOME]);
    expect(out[1].label).toBe('אצל סבתא');
  });

  it('ואז ערים', () => {
    const out = suggestLocations('', [], []);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((s) => s.kind === 'city')).toBe(true);
  });

  it('למקום שמור יש מזהה וקואורדינטות', () => {
    const out = suggestLocations('', [], [HOME]);
    expect(out[0].placeId).toBe('home');
    expect(out[0].latitude).toBe(HOME.latitude);
  });
});

describe('suggestLocations עם שאילתה', () => {
  it('מסנן לפי מה שהוקלד', () => {
    const out = suggestLocations('ירושל', [], [HOME]);
    expect(out.some((s) => s.label === 'ירושלים')).toBe(true);
    expect(out.some((s) => s.label === 'בית')).toBe(false);
  });

  it('מקום שמור גובר על עיר באותה התאמה', () => {
    const tlv = place('p', 'תל אביב–יפו');
    const out = suggestLocations('תל אביב', [], [tlv]);
    expect(out[0].kind).toBe('place');
  });

  it('מקום מאירוע קודם גובר על עיר', () => {
    const out = suggestLocations('חיפה', [event({ location: 'חיפה' })], []);
    expect(out[0].kind).toBe('recent');
  });

  it('חיפוש עברי מנורמל עובד', () => {
    // גרשיים וניקוד לא אמורים להכשיל
    expect(suggestLocations('תל אביב יפו', [], []).some((s) => s.label.includes('תל אביב'))).toBe(
      true,
    );
  });

  it('שאילתה בלי התאמות מחזירה רשימה ריקה', () => {
    expect(suggestLocations('זזזזזז', [], [])).toHaveLength(0);
  });

  it('מוצא גם לפי האזור של העיר', () => {
    expect(suggestLocations('ישראל', [], []).length).toBeGreaterThan(0);
  });
});

describe('mapsUrl', () => {
  it('בונה קישור עם הקואורדינטות', () => {
    const url = mapsUrl(31.7683, 35.2137);
    expect(url).toContain('31.7683');
    expect(url).toContain('35.2137');
  });

  it('מקודד את הכיתוב', () => {
    expect(mapsUrl(32, 34, 'בית הכנסת')).not.toContain(' ');
  });
});
