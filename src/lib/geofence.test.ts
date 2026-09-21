/**
 * התראות מבוססות מיקום.
 *
 * ההתראה שייכת לאירוע ולא למקום, ולכן כל בדיקה כאן מרכיבה גם מקום שמור
 * וגם אירוע שמצביע עליו. זו הלוגיקה שתעבור כמות שהיא לאנדרואיד, ולכן
 * היא נבדקת בלי דפדפן - רק עם אחסון מקומי מדומה.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildFences,
  distanceMeters,
  evaluatePosition,
  isTriggerArmed,
  radiusLabel,
} from './geofence';
import { eventsOnDay } from './recurrence';
import { dateKey, keyToDate } from './dates';
import type { PlaceTrigger, SavedPlace } from '@/types';
import { event } from '@/test/factories';

const HOME: SavedPlace = {
  id: 'home',
  name: 'בית',
  latitude: 32.0853,
  longitude: 34.7818,
  radius: 150,
  createdAt: 0,
};

/** נקודה במרחק מטרים נתון צפונה מהבית. */
function north(meters: number) {
  return { latitude: HOME.latitude + meters / 111_320, longitude: HOME.longitude };
}

const INSIDE = north(0);
const FAR = north(5_000);

/** "היום" מנקודת המבט של הבדיקה */
const NOW = new Date(2026, 8, 20, 12, 0);
const TODAY = dateKey(NOW);

/** מופע של אירוע שמבקש התראה במקום נתון, נפרש ביום שלו עצמו. */
function occurrenceAt(trigger: PlaceTrigger | undefined, patch: Record<string, unknown> = {}) {
  const ev = event({
    date: TODAY,
    title: 'לקנות חלב',
    placeId: 'home',
    placeTrigger: trigger,
    ...patch,
  });
  return eventsOnDay([ev], keyToDate(ev.date))[0];
}

const arriving = [occurrenceAt('arrive')];

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

describe('isTriggerArmed', () => {
  it('דרוך ביום האירוע', () => {
    expect(isTriggerArmed(occurrenceAt('arrive'), NOW)).toBe(true);
  });

  it('לא דרוך ביום אחר', () => {
    expect(isTriggerArmed(occurrenceAt('arrive'), new Date(2026, 8, 25))).toBe(false);
  });

  it('בלי טריגר אינו דרוך', () => {
    expect(isTriggerArmed(occurrenceAt(undefined), NOW)).toBe(false);
  });

  it('בלי מקום שמור אינו דרוך', () => {
    expect(isTriggerArmed(occurrenceAt('arrive', { placeId: undefined }), NOW)).toBe(false);
  });

  it('באירוע רב־יומי רק היום הראשון דרוך', () => {
    const ev = event({
      date: TODAY,
      endDate: dateKey(new Date(2026, 8, 23)),
      allDay: true,
      placeId: 'home',
      placeTrigger: 'arrive',
    });
    const first = eventsOnDay([ev], new Date(NOW))[0];
    const second = eventsOnDay([ev], new Date(2026, 8, 21))[0];
    expect(isTriggerArmed(first, NOW)).toBe(true);
    expect(isTriggerArmed(second, new Date(2026, 8, 21))).toBe(false);
  });
});

describe('התראה על הגעה', () => {
  it('הקריאה הראשונה רק קובעת מצב ולא מתריעה', () => {
    expect(evaluatePosition([HOME], arriving, INSIDE, NOW.getTime())).toHaveLength(0);
  });

  it('מתריעה על הגעה אחרי שהיה בחוץ', () => {
    evaluatePosition([HOME], arriving, FAR, NOW.getTime());
    const out = evaluatePosition([HOME], arriving, INSIDE, NOW.getTime() + 10 * 60_000);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('arrive');
  });

  it('הכותרת היא שם האירוע, והגוף אומר מה קרה', () => {
    evaluatePosition([HOME], arriving, FAR, NOW.getTime());
    const [alert] = evaluatePosition([HOME], arriving, INSIDE, NOW.getTime() + 10 * 60_000);
    expect(alert.title).toBe('לקנות חלב');
    expect(alert.body).toContain('בית');
    expect(alert.occurrence.placeId).toBe('home');
  });

  it('אירוע שמבקש יציאה לא מתריע על הגעה', () => {
    const leaving = [occurrenceAt('leave')];
    evaluatePosition([HOME], leaving, FAR, NOW.getTime());
    expect(evaluatePosition([HOME], leaving, INSIDE, NOW.getTime() + 10 * 60_000)).toHaveLength(0);
  });

  it('אותה התראה לא נורית פעמיים באותו יום', () => {
    const t = NOW.getTime();
    evaluatePosition([HOME], arriving, FAR, t);
    expect(evaluatePosition([HOME], arriving, INSIDE, t + 10 * 60_000)).toHaveLength(1);
    // יוצאים וחוזרים - התזכורת כבר נמסרה
    evaluatePosition([HOME], arriving, FAR, t + 30 * 60_000);
    expect(evaluatePosition([HOME], arriving, INSIDE, t + 60 * 60_000)).toHaveLength(0);
  });
});

describe('התראה על יציאה', () => {
  const leaving = [occurrenceAt('leave')];

  it('מתריעה על יציאה אחרי שהיה בפנים', () => {
    evaluatePosition([HOME], leaving, INSIDE, NOW.getTime());
    const out = evaluatePosition([HOME], leaving, FAR, NOW.getTime() + 10 * 60_000);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('leave');
  });
});

describe('היסטרזיס וזמן צינון', () => {
  it('יציאה קצרה מעבר לרדיוס לא מפעילה התראה', () => {
    const leaving = [occurrenceAt('leave')];
    evaluatePosition([HOME], leaving, INSIDE, NOW.getTime());
    // 30 מטר מעבר לרדיוס - בתוך שולי ההיסטרזיס של 40 מטר
    expect(
      evaluatePosition([HOME], leaving, north(HOME.radius + 30), NOW.getTime() + 10 * 60_000),
    ).toHaveLength(0);
  });

  it('יציאה אמיתית מעבר לשולי ההיסטרזיס כן מתריעה', () => {
    const leaving = [occurrenceAt('leave')];
    evaluatePosition([HOME], leaving, INSIDE, NOW.getTime());
    expect(
      evaluatePosition([HOME], leaving, north(HOME.radius + 100), NOW.getTime() + 10 * 60_000),
    ).toHaveLength(1);
  });

  it('זמן צינון חוסם התראה צמודה', () => {
    const both = [occurrenceAt('arrive'), occurrenceAt('leave')];
    const t = NOW.getTime();
    evaluatePosition([HOME], both, FAR, t);
    expect(evaluatePosition([HOME], both, INSIDE, t + 10 * 60_000)).toHaveLength(1);
    // יציאה דקה אחר כך - בתוך זמן הצינון
    expect(evaluatePosition([HOME], both, FAR, t + 11 * 60_000)).toHaveLength(0);
  });
});

describe('מה לא מפעיל התראה', () => {
  it('מיקום לא מדויק נזרק', () => {
    evaluatePosition([HOME], arriving, FAR, NOW.getTime());
    expect(
      evaluatePosition([HOME], arriving, { ...INSIDE, accuracy: 500 }, NOW.getTime() + 10 * 60_000),
    ).toHaveLength(0);
  });

  it('מיקום מדויק מספיק מתקבל', () => {
    evaluatePosition([HOME], arriving, FAR, NOW.getTime());
    expect(
      evaluatePosition([HOME], arriving, { ...INSIDE, accuracy: 20 }, NOW.getTime() + 10 * 60_000),
    ).toHaveLength(1);
  });

  it('בלי אירועים דרוכים לא קורה כלום', () => {
    evaluatePosition([HOME], [], FAR, NOW.getTime());
    expect(evaluatePosition([HOME], [], INSIDE, NOW.getTime() + 10 * 60_000)).toHaveLength(0);
  });

  it('אירוע של יום אחר אינו דרוך', () => {
    const tomorrow = [occurrenceAt('arrive', { date: dateKey(new Date(2026, 8, 21)) })];
    evaluatePosition([HOME], tomorrow, FAR, NOW.getTime());
    expect(evaluatePosition([HOME], tomorrow, INSIDE, NOW.getTime() + 10 * 60_000)).toHaveLength(0);
  });

  it('אירוע שמצביע על מקום אחר אינו רלוונטי', () => {
    const elsewhere = [occurrenceAt('arrive', { placeId: 'work' })];
    evaluatePosition([HOME], elsewhere, FAR, NOW.getTime());
    expect(evaluatePosition([HOME], elsewhere, INSIDE, NOW.getTime() + 10 * 60_000)).toHaveLength(0);
  });

  it('רשימת מקומות ריקה לא מפילה כלום', () => {
    expect(evaluatePosition([], arriving, INSIDE, NOW.getTime())).toEqual([]);
  });
});

describe('כמה אירועים באותו מקום', () => {
  it('שתי תזכורות באותה הגעה נשלחות שתיהן', () => {
    const two = [
      occurrenceAt('arrive'),
      occurrenceAt('arrive', { title: 'להוציא את הכביסה' }),
    ];
    evaluatePosition([HOME], two, FAR, NOW.getTime());
    const out = evaluatePosition([HOME], two, INSIDE, NOW.getTime() + 10 * 60_000);
    expect(out).toHaveLength(2);
    expect(out.map((a) => a.title)).toContain('להוציא את הכביסה');
  });

  it('הגעה ויציאה על אותו מקום הן שתי תזכורות נפרדות', () => {
    const both = [occurrenceAt('arrive'), occurrenceAt('leave')];
    const t = NOW.getTime();
    evaluatePosition([HOME], both, FAR, t);
    const arrived = evaluatePosition([HOME], both, INSIDE, t + 10 * 60_000);
    expect(arrived).toHaveLength(1);
    expect(arrived[0].kind).toBe('arrive');
    // אחרי שזמן הצינון עבר
    const left = evaluatePosition([HOME], both, FAR, t + 40 * 60_000);
    expect(left).toHaveLength(1);
    expect(left[0].kind).toBe('leave');
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

describe('buildFences', () => {
  const TOMORROW = dateKey(new Date(2026, 8, 21, 12, 0));

  it('גדר לכל מופע שמבקש התראת מקום', () => {
    const fences = buildFences([HOME], [occurrenceAt('arrive')], NOW);
    expect(fences).toHaveLength(1);
    expect(fences[0]).toMatchObject({
      latitude: HOME.latitude,
      longitude: HOME.longitude,
      radius: HOME.radius,
      kind: 'arrive',
      date: TODAY,
      title: 'לקנות חלב',
    });
  });

  /*
    הטקסט נוסע ערוך כי המקלט רץ כשהאפליקציה מתה - אין שם דרך לגזור
    שם מקום ממזהה, בדיוק כמו בוידג׳ט.
  */
  it('הגוף ערוך מראש, ושונה בין הגעה ליציאה', () => {
    expect(buildFences([HOME], [occurrenceAt('arrive')], NOW)[0].body).toBe('הגעת לבית');
    expect(buildFences([HOME], [occurrenceAt('leave')], NOW)[0].body).toBe('יצאת מבית');
  });

  it('מופע בלי התראת מקום אינו גדר', () => {
    expect(buildFences([HOME], [occurrenceAt(undefined)], NOW)).toEqual([]);
  });

  /* רושמים קדימה: גדר חיה גם כשהאפליקציה סגורה, ולא נרשמת כל בוקר */
  it('גם מחר נרשם מראש', () => {
    const fences = buildFences([HOME], [occurrenceAt('arrive', { date: TOMORROW })], NOW);
    expect(fences).toHaveLength(1);
    expect(fences[0].date).toBe(TOMORROW);
  });

  it('יום שעבר אינו נרשם', () => {
    const yesterday = dateKey(new Date(2026, 8, 19, 12, 0));
    expect(buildFences([HOME], [occurrenceAt('arrive', { date: yesterday })], NOW)).toEqual([]);
  });

  /* המקום נמחק וההצבעה נשארה תלויה - אין על מה לגדר */
  it('מקום שאינו קיים מדלג', () => {
    expect(buildFences([], [occurrenceAt('arrive')], NOW)).toEqual([]);
  });

  it('המזהה ייחודי לכל מופע וסוג', () => {
    const fences = buildFences(
      [HOME],
      [occurrenceAt('arrive'), occurrenceAt('leave', { id: 'other', title: 'אחר' })],
      NOW,
    );
    expect(new Set(fences.map((f) => f.id)).size).toBe(fences.length);
    expect(fences.every((f) => f.tag.startsWith('place-'))).toBe(true);
  });
});
