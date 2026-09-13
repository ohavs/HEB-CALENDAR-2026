/**
 * עזרי התאריכים. הסכנה המרכזית כאן היא החלקה ל-UTC: מפתח תאריך שנבנה
 * מ-toISOString יזוז ביום שלם בערב, ולכן הבדיקות נוגעות בשעות קצה.
 */
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  combineDateTime,
  dateKey,
  durationLabel,
  formatTimeInZone,
  keyToDate,
  minutesToTime,
  monthGridDays,
  orderedWeekdays,
  relativeDayLabel,
  timeToMinutes,
} from './dates';

describe('dateKey', () => {
  it('משתמש בשעון המקומי ולא ב-UTC', () => {
    // 23:30 מקומי — ב-UTC זה כבר היום הבא בישראל
    expect(dateKey(new Date(2026, 8, 13, 23, 30))).toBe('2026-09-13');
    expect(dateKey(new Date(2026, 8, 13, 0, 15))).toBe('2026-09-13');
  });

  it('מרפד חודש ויום לשתי ספרות', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('הלוך ושוב עם keyToDate', () => {
    const key = '2026-02-28';
    expect(dateKey(keyToDate(key))).toBe(key);
  });
});

describe('addDays', () => {
  it('חוצה גבול חודש', () => {
    expect(dateKey(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
  });

  it('חוצה גבול שנה אחורה', () => {
    expect(dateKey(addDays(new Date(2026, 0, 1), -1))).toBe('2025-12-31');
  });

  it('נשאר על אותו יום קלנדרי במעבר שעון קיץ', () => {
    // שעון הקיץ בישראל מתחיל ב-27.3.2026; הוספת יום סביבו לא אמורה לדלג
    expect(dateKey(addDays(new Date(2026, 2, 26), 1))).toBe('2026-03-27');
    expect(dateKey(addDays(new Date(2026, 2, 27), 1))).toBe('2026-03-28');
  });
});

describe('addMonths', () => {
  it('מחזיר את תחילת החודש', () => {
    expect(dateKey(addMonths(new Date(2026, 8, 30), 1))).toBe('2026-10-01');
  });

  it('חוצה גבול שנה', () => {
    expect(dateKey(addMonths(new Date(2026, 11, 15), 1))).toBe('2027-01-01');
  });
});

describe('monthGridDays', () => {
  it('מחזיר 42 ימים', () => {
    expect(monthGridDays(new Date(2026, 8, 1), 0)).toHaveLength(42);
  });

  it('מתחיל ביום ראשון כשתחילת השבוע היא ראשון', () => {
    const days = monthGridDays(new Date(2026, 8, 1), 0);
    expect(days[0].getDay()).toBe(0);
  });

  it('מתחיל ביום שני כשתחילת השבוע היא שני', () => {
    const days = monthGridDays(new Date(2026, 8, 1), 1);
    expect(days[0].getDay()).toBe(1);
  });

  it('מכיל את כל ימי החודש', () => {
    const days = monthGridDays(new Date(2026, 8, 1), 0).map(dateKey);
    expect(days).toContain('2026-09-01');
    expect(days).toContain('2026-09-30');
  });
});

describe('orderedWeekdays', () => {
  it('מסתובב לפי תחילת השבוע', () => {
    expect(orderedWeekdays(0)[0]).toBe('א');
    expect(orderedWeekdays(1)[0]).toBe('ב');
    expect(orderedWeekdays(1)).toHaveLength(7);
  });
});

describe('timeToMinutes / minutesToTime', () => {
  it('ממיר בשני הכיוונים', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(0)).toBe('00:00');
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

describe('combineDateTime', () => {
  it('מרכיב תאריך ושעה בשעון מקומי', () => {
    const d = combineDateTime('2026-09-13', '18:45');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(45);
  });

  it('בלי שעה מחזיר את תחילת היום', () => {
    const d = combineDateTime('2026-09-13', null);
    expect(d.getHours()).toBe(0);
  });
});

describe('durationLabel', () => {
  it('שעות ודקות', () => {
    expect(durationLabel('09:00', '10:30')).toContain('1');
    expect(durationLabel('09:00', '09:45')).toContain('45');
  });
});

describe('formatTimeInZone', () => {
  it('מציג שעון 24 שעות בלי AM/PM', () => {
    const at = new Date(2026, 8, 13, 18, 5);
    const out = formatTimeInZone(at, 'Asia/Jerusalem');
    expect(out).toBe('18:05');
    expect(out).not.toMatch(/[AP]M/i);
  });

  it('מכבד את אזור הזמן שנשלח', () => {
    const at = new Date(Date.UTC(2026, 8, 13, 12, 0));
    expect(formatTimeInZone(at, 'Asia/Jerusalem')).toBe('15:00'); // UTC+3 בקיץ
    expect(formatTimeInZone(at, 'UTC')).toBe('12:00');
  });
});

describe('relativeDayLabel', () => {
  const now = new Date(2026, 8, 13);
  it('היום, מחר ואתמול', () => {
    expect(relativeDayLabel(new Date(2026, 8, 13), now)).toContain('היום');
    expect(relativeDayLabel(new Date(2026, 8, 14), now)).toContain('מחר');
    expect(relativeDayLabel(new Date(2026, 8, 12), now)).toContain('אתמול');
  });
});
