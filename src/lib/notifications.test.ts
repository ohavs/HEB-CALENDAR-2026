/**
 * חישוב התזכורות. buildReminders היא הנקודה שבה כל הלוגיקה מתרכזת לפני
 * שכבת ההצגה, ולכן הבדיקות כאן עובדות עליה בלבד - בלי IndexedDB ובלי
 * Notification API.
 */
import { describe, expect, it } from 'vitest';
import { buildReminders, permissionLabel } from './notifications';
import { combineDateTime } from './dates';
import { event, settings } from '@/test/factories';

/** אמצע נובמבר 2026, יום שלישי בבוקר - רחוק מכל מועד. */
const NOW = new Date(2026, 10, 17, 8, 0, 0);

const idsOf = (rs: { id: string }[]) => rs.map((r) => r.id);

describe('צורת התוצאה', () => {
  it('ממוין לפי זמן', () => {
    const rs = buildReminders(settings(), [], NOW);
    for (let i = 1; i < rs.length; i += 1) {
      expect(rs[i].at).toBeGreaterThanOrEqual(rs[i - 1].at);
    }
  });

  it('לכל תזכורת מזהה ייחודי', () => {
    const ids = idsOf(buildReminders(settings(), [], NOW));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('הכותרות בעברית', () => {
    for (const r of buildReminders(settings(), [], NOW)) {
      expect(r.title).toMatch(/[א-ת]/);
    }
  });

  it('לא מחזיר תזכורות שעברו מזמן', () => {
    const cutoff = NOW.getTime() - 3 * 60 * 60 * 1000;
    for (const r of buildReminders(settings(), [], NOW)) {
      expect(r.at).toBeGreaterThan(cutoff);
    }
  });

  it('לא חורג מהאופק המוצהר של 30 יום', () => {
    const limit = NOW.getTime() + 31 * 24 * 60 * 60 * 1000;
    for (const r of buildReminders(settings(), [], NOW)) {
      expect(r.at).toBeLessThan(limit);
    }
  });
});

describe('כניסת ויציאת שבת', () => {
  it('מייצר תזכורות כניסת שבת כשהן דלוקות', () => {
    const rs = buildReminders(settings({ notifyCandleLighting: true }), [], NOW);
    expect(rs.some((r) => r.id.startsWith('candles-'))).toBe(true);
  });

  it('לא מייצר אותן כשהן כבויות', () => {
    const rs = buildReminders(
      settings({ notifyCandleLighting: false, notifyHavdalah: false }),
      [],
      NOW,
    );
    expect(rs.some((r) => r.id.startsWith('candles-'))).toBe(false);
  });

  it('התזכורת מקדימה את ההדלקה במספר הדקות שהוגדר', () => {
    const a = buildReminders(settings({ notifyCandleLightingMins: 0 }), [], NOW).filter((r) =>
      r.id.startsWith('candles-'),
    );
    const b = buildReminders(settings({ notifyCandleLightingMins: 30 }), [], NOW).filter((r) =>
      r.id.startsWith('candles-'),
    );
    const byId = new Map(a.map((r) => [r.id, r.at]));
    for (const r of b) {
      const exact = byId.get(r.id);
      if (exact !== undefined) expect(exact - r.at).toBe(30 * 60_000);
    }
  });

  it('גוף ההודעה כולל את שעת ההדלקה ואת שם העיר', () => {
    const r = buildReminders(settings(), [], NOW).find((x) => x.id.startsWith('candles-'))!;
    expect(r.body).toMatch(/\d{1,2}:\d{2}/);
    expect(r.body).toContain('ירושלים');
  });

  it('תזכורת הבדלה נוצרת רק כשהיא דלוקה', () => {
    expect(
      buildReminders(settings({ notifyHavdalah: false }), [], NOW).some((r) =>
        r.id.startsWith('havdalah-'),
      ),
    ).toBe(false);
    expect(
      buildReminders(settings({ notifyHavdalah: true }), [], NOW).some((r) =>
        r.id.startsWith('havdalah-'),
      ),
    ).toBe(true);
  });
});

describe('ערב מועד', () => {
  it('כבוי כברירת מחדל', () => {
    expect(
      buildReminders(settings(), [], NOW).some((r) => r.id.startsWith('holiday-')),
    ).toBe(false);
  });

  it('מייצר תזכורת בערב שלפני חנוכה', () => {
    // כ״ה בכסלו תשפ״ז = 5.12.2026, ולכן התזכורת ב-4.12 בערב
    const rs = buildReminders(
      settings({ notifyHolidayEve: true, showMinorHolidays: true }),
      [],
      new Date(2026, 11, 1, 8, 0),
    );
    const chanukah = rs.find((r) => r.id === 'holiday-2026-12-05');
    expect(chanukah).toBeDefined();
    expect(chanukah!.title).toContain('מחר');
    expect(new Date(chanukah!.at).getDate()).toBe(4);
  });

  it('נשלחת בשעה שהוגדרה', () => {
    const rs = buildReminders(
      settings({ notifyHolidayEve: true, notifyHolidayEveTime: '17:45' }),
      [],
      new Date(2026, 11, 1, 8, 0),
    );
    const r = rs.find((x) => x.id.startsWith('holiday-'))!;
    const at = new Date(r.at);
    expect(at.getHours()).toBe(17);
    expect(at.getMinutes()).toBe(45);
  });
});

describe('אירועים אישיים', () => {
  const soon = '2026-11-20';

  it('אירוע בלי תזכורת לא מייצר כלום', () => {
    const ev = event({ date: soon, reminderMinutes: null });
    expect(
      buildReminders(settings(), [ev], NOW).some((r) => r.id.startsWith('event-')),
    ).toBe(false);
  });

  it('אירוע עם תזכורת מייצר תזכורת בזמן הנכון', () => {
    const ev = event({ date: soon, startTime: '14:00', reminderMinutes: 30 });
    const r = buildReminders(settings(), [ev], NOW).find((x) => x.id === `event-${ev.id}`)!;
    expect(r).toBeDefined();
    expect(r.at).toBe(combineDateTime(soon, '14:00').getTime() - 30 * 60_000);
    expect(r.title).toBe(ev.title);
  });

  it('תזכורת בזמן האירוע עצמו', () => {
    const ev = event({ date: soon, startTime: '14:00', reminderMinutes: 0 });
    const r = buildReminders(settings(), [ev], NOW).find((x) => x.id === `event-${ev.id}`)!;
    expect(r.at).toBe(combineDateTime(soon, '14:00').getTime());
  });

  it('אירוע של כל היום מזכיר בבוקר', () => {
    const ev = event({ date: soon, allDay: true, startTime: null, reminderMinutes: 0 });
    const r = buildReminders(settings(), [ev], NOW).find((x) => x.id === `event-${ev.id}`)!;
    expect(new Date(r.at).getHours()).toBe(9);
    expect(r.body).toContain('כל היום');
  });

  it('אירוע חוזר מייצר תזכורת לכל מופע באופק', () => {
    const ev = event({ date: '2026-11-18', repeat: 'weekly', reminderMinutes: 10 });
    const rs = buildReminders(settings(), [ev], NOW).filter((r) => r.id.startsWith('event-'));
    expect(rs.length).toBeGreaterThanOrEqual(4);
    expect(new Set(idsOf(rs)).size).toBe(rs.length);
  });

  it('כיבוי תזכורות אירועים מבטל את כולן', () => {
    const ev = event({ date: soon, reminderMinutes: 30 });
    expect(
      buildReminders(settings({ notifyEvents: false }), [ev], NOW).some((r) =>
        r.id.startsWith('event-'),
      ),
    ).toBe(false);
  });

  it('אירוע מחוק לא מייצר תזכורת', () => {
    const ev = event({ date: soon, reminderMinutes: 30, deleted: true });
    expect(
      buildReminders(settings(), [ev], NOW).some((r) => r.id.startsWith('event-')),
    ).toBe(false);
  });

  it('המיקום נכנס לגוף ההודעה', () => {
    const ev = event({ date: soon, startTime: '14:00', reminderMinutes: 10, location: 'בית הכנסת' });
    const r = buildReminders(settings(), [ev], NOW).find((x) => x.id === `event-${ev.id}`)!;
    expect(r.body).toContain('בית הכנסת');
  });

  it('אירוע שכבר עבר לא מייצר תזכורת', () => {
    const ev = event({ date: '2026-10-01', startTime: '09:00', reminderMinutes: 10 });
    expect(
      buildReminders(settings(), [ev], NOW).some((r) => r.id === `event-${ev.id}`),
    ).toBe(false);
  });
});

describe('permissionLabel', () => {
  it('מחזיר כיתוב בעברית לכל מצב', () => {
    for (const state of ['unsupported', 'default', 'granted', 'denied'] as const) {
      expect(permissionLabel(state)).toMatch(/[א-ת]/);
    }
  });
});
