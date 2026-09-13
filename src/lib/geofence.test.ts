/**
 * גדרות גאוגרפיות. הלוגיקה כאן היא שתעבור כמות שהיא לאנדרואיד, ולכן היא
 * נבדקת בלי דפדפן - רק עם אחסון מקומי מדומה.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { distanceMeters, evaluatePosition, radiusLabel } from './geofence';
import type { SavedPlace } from '@/types';

const HOME: SavedPlace = {
  id: 'home',
  name: 'בית',
  latitude: 32.0853,
  longitude: 34.7818,
  radius: 150,
  notifyOnArrive: true,
  notifyOnLeave: true,
  createdAt: 0,
};

/** נקודה במרחק מטרים נתון צפונה מהבית. */
function north(meters: number) {
  return { latitude: HOME.latitude + meters / 111_320, longitude: HOME.longitude };
}

const INSIDE = north(0);
const FAR = north(5_000);

// המצב נשמר באחסון המקומי, ולכן מנקים בין בדיקות
beforeEach(() => localStorage.clear());

describe('distanceMeters', () => {
  it('מרחק אפס לאותה נקודה', () => {
    expect(distanceMeters(32, 34, 32, 34)).toBe(0);
  });

  it('מעלת רוחב אחת היא כ-111 ק״מ', () => {
    const d = distanceMeters(32, 34, 33, 34);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('סימטרי', () => {
    const a = distanceMeters(31.77, 35.21, 32.08, 34.78);
    const b = distanceMeters(32.08, 34.78, 31.77, 35.21);
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });

  it('ירושלים–תל אביב בערך 54 ק״מ', () => {
    const d = distanceMeters(31.7683, 35.2137, 32.0853, 34.7818) / 1000;
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(58);
  });
});

describe('evaluatePosition', () => {
  it('הקריאה הראשונה רק קובעת מצב ולא מתריעה', () => {
    expect(evaluatePosition([HOME], INSIDE)).toHaveLength(0);
  });

  it('מתריע על הגעה אחרי שהיה בחוץ', () => {
    evaluatePosition([HOME], FAR, 0);
    const events = evaluatePosition([HOME], INSIDE, 10 * 60_000);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('arrive');
    expect(events[0].title).toContain('בית');
  });

  it('מתריע על יציאה אחרי שהיה בפנים', () => {
    evaluatePosition([HOME], INSIDE, 0);
    const events = evaluatePosition([HOME], FAR, 10 * 60_000);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('leave');
  });

  it('לא מתריע פעמיים על אותה כניסה', () => {
    evaluatePosition([HOME], FAR, 0);
    evaluatePosition([HOME], INSIDE, 10 * 60_000);
    expect(evaluatePosition([HOME], INSIDE, 20 * 60_000)).toHaveLength(0);
  });

  it('היסטרזיס: יציאה קצרה מעבר לרדיוס לא מפעילה התראה', () => {
    evaluatePosition([HOME], INSIDE, 0);
    // 30 מטר מעבר לרדיוס - בתוך שולי ההיסטרזיס של 40 מטר
    expect(evaluatePosition([HOME], north(HOME.radius + 30), 10 * 60_000)).toHaveLength(0);
  });

  it('יציאה אמיתית מעבר לשולי ההיסטרזיס כן מתריעה', () => {
    evaluatePosition([HOME], INSIDE, 0);
    expect(evaluatePosition([HOME], north(HOME.radius + 100), 10 * 60_000)).toHaveLength(1);
  });

  it('זמן צינון חוסם התראה צמודה', () => {
    evaluatePosition([HOME], FAR, 0);
    evaluatePosition([HOME], INSIDE, 10 * 60_000); // התראת הגעה
    // יציאה דקה אחר כך - בתוך זמן הצינון
    expect(evaluatePosition([HOME], FAR, 10 * 60_000 + 60_000)).toHaveLength(0);
  });

  it('מיקום לא מדויק נזרק', () => {
    evaluatePosition([HOME], FAR, 0);
    const events = evaluatePosition(
      [HOME],
      { ...INSIDE, accuracy: 500 },
      10 * 60_000,
    );
    expect(events).toHaveLength(0);
  });

  it('מיקום מדויק מספיק מתקבל', () => {
    evaluatePosition([HOME], FAR, 0);
    expect(
      evaluatePosition([HOME], { ...INSIDE, accuracy: 20 }, 10 * 60_000),
    ).toHaveLength(1);
  });

  it('מקום בלי התראות כלל נדלג', () => {
    const quiet = { ...HOME, notifyOnArrive: false, notifyOnLeave: false };
    evaluatePosition([quiet], FAR, 0);
    expect(evaluatePosition([quiet], INSIDE, 10 * 60_000)).toHaveLength(0);
  });

  it('מכבד התראת הגעה בלבד', () => {
    const arriveOnly = { ...HOME, notifyOnLeave: false };
    evaluatePosition([arriveOnly], FAR, 0);
    expect(evaluatePosition([arriveOnly], INSIDE, 10 * 60_000)).toHaveLength(1);
    expect(evaluatePosition([arriveOnly], FAR, 30 * 60_000)).toHaveLength(0);
  });

  it('הודעה מותאמת מוצגת במקום ברירת המחדל', () => {
    const custom = { ...HOME, message: 'להדליק נרות' };
    evaluatePosition([custom], FAR, 0);
    expect(evaluatePosition([custom], INSIDE, 10 * 60_000)[0].body).toBe('להדליק נרות');
  });

  it('כמה מקומות נבדקים במקביל', () => {
    const work: SavedPlace = { ...HOME, id: 'work', name: 'עבודה', latitude: 32.2, longitude: 34.9 };
    evaluatePosition([HOME, work], FAR, 0);
    const events = evaluatePosition([HOME, work], INSIDE, 10 * 60_000);
    expect(events).toHaveLength(1);
    expect(events[0].place.id).toBe('home');
  });

  it('רשימה ריקה לא מפילה כלום', () => {
    expect(evaluatePosition([], INSIDE)).toEqual([]);
  });
});

describe('radiusLabel', () => {
  it('מטרים מתחת לקילומטר', () => {
    expect(radiusLabel(150)).toContain('150');
  });

  it('כיתוב בעברית', () => {
    expect(radiusLabel(500)).toMatch(/[א-ת]/);
  });
});
