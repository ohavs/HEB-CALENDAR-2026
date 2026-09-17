/**
 * הבדיקות נשענות על שעות ידועות מראש ולא על פלט הקוד: מה שמשווה
 * לעצמו יעבור גם אחרי שהכלל יישבר.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER_TIME,
  buildReminderDraft,
  reminderEndTime,
  shiftEndWithStart,
  suggestReminderTime,
} from './reminderCompose';

const COLOR = 'violet' as const;

describe('suggestReminderTime', () => {
  it('ליום אחר מציע בוקר', () => {
    expect(suggestReminderTime(new Date(2026, 8, 14, 22, 40), false)).toBe(DEFAULT_REMINDER_TIME);
  });

  it('להיום מעגל לחצי השעה הבאה', () => {
    expect(suggestReminderTime(new Date(2026, 8, 14, 10, 1), true)).toBe('10:30');
    expect(suggestReminderTime(new Date(2026, 8, 14, 10, 29), true)).toBe('10:30');
    expect(suggestReminderTime(new Date(2026, 8, 14, 10, 31), true)).toBe('11:00');
  });

  /* על העיגול עצמו מתקדמים, אחרת התזכורת נקבעת לרגע שכבר עובר */
  it('שעה עגולה בדיוק מתקדמת לבאה', () => {
    expect(suggestReminderTime(new Date(2026, 8, 14, 10, 0), true)).toBe('10:30');
    expect(suggestReminderTime(new Date(2026, 8, 14, 10, 30), true)).toBe('11:00');
  });

  it('מאוחר בלילה נעצר בסוף היום ולא גולש למחר', () => {
    expect(suggestReminderTime(new Date(2026, 8, 14, 23, 40), true)).toBe('23:30');
    expect(suggestReminderTime(new Date(2026, 8, 14, 23, 59), true)).toBe('23:30');
  });
});

describe('reminderEndTime', () => {
  it('חצי שעה אחרי ההתחלה', () => {
    expect(reminderEndTime('09:00')).toBe('09:30');
    expect(reminderEndTime('23:00')).toBe('23:30');
  });

  it('נעצר בסוף היממה', () => {
    expect(reminderEndTime('23:50')).toBe('23:59');
  });
});

describe('buildReminderDraft', () => {
  const now = new Date(2026, 8, 14, 10, 0);

  it('שעה שנבחרה מכבה את "כל היום"', () => {
    const draft = buildReminderDraft({
      title: 'רופא',
      color: COLOR,
      date: '2026-09-15',
      time: '16:00',
      now,
    });
    expect(draft.allDay).toBe(false);
    expect(draft.startTime).toBe('16:00');
    expect(draft.endTime).toBe('16:30');
  });

  it('בלי שעה נשאר של כל היום', () => {
    const draft = buildReminderDraft({
      title: 'לחם',
      color: COLOR,
      date: '2026-09-15',
      time: null,
      now,
    });
    expect(draft.allDay).toBe(true);
    expect(draft.startTime).toBeNull();
    expect(draft.endTime).toBeNull();
  });

  /*
    השעה בלי היום אינה שעה. אם הדגל היה עובר, התזכורת הייתה נעלמת
    מהרשימה שבראש המסך וצצה בלוח ביום שנשמר לה רק כדי שתדע לאן לחזור.
  */
  it('תזכורת בלי תאריך אינה נושאת שעה, גם אם נבחרה', () => {
    const draft = buildReminderDraft({
      title: 'מתישהו',
      color: COLOR,
      date: null,
      time: '16:00',
      now,
    });
    expect(draft.undated).toBe(true);
    expect(draft.allDay).toBe(true);
    expect(draft.startTime).toBeNull();
    expect(draft.date).toBe('2026-09-14');
  });

  it('תזכורת עם שעה מתריעה בשעה עצמה, ובלי שעה לא מתריעה', () => {
    const at = { title: 'א', color: COLOR, date: '2026-09-15' as const, now };
    expect(buildReminderDraft({ ...at, time: '16:00' }).reminderMinutes).toBe(0);
    expect(buildReminderDraft({ ...at, time: null }).reminderMinutes).toBeNull();
  });

  it('גוזם רווחים מהכותרת', () => {
    const draft = buildReminderDraft({
      title: '  לחם  ',
      color: COLOR,
      date: null,
      time: null,
      now,
    });
    expect(draft.title).toBe('לחם');
  });
});

describe('shiftEndWithStart', () => {
  it('שומר על המשך כשההתחלה זזה קדימה', () => {
    expect(shiftEndWithStart('09:00', '10:00', '14:00')).toBe('15:00');
  });

  it('שומר על המשך כשההתחלה זזה אחורה', () => {
    expect(shiftEndWithStart('14:00', '15:30', '09:00')).toBe('10:30');
  });

  /*
    זה היה הבאג שדווח: הסיום נשאר על 10:00 קבוע בזמן שההתחלה זזה, כי
    הטיוטה הייתה ריקה והמספר הוצג מ-JSX. כאן הוא חייב לזוז.
  */
  it('הסיום אינו נשאר במקומו', () => {
    expect(shiftEndWithStart('09:00', '10:00', '16:45')).not.toBe('10:00');
    expect(shiftEndWithStart('09:00', '10:00', '16:45')).toBe('17:45');
  });

  /* מודולו יממה היה מחזיר 01:00 - סיום שקודם להתחלה */
  it('נעצר בסוף היממה ולא מתהפך', () => {
    expect(shiftEndWithStart('09:00', '12:00', '22:00')).toBe('23:59');
  });

  it('משך שלילי אינו מכווץ עוד', () => {
    expect(shiftEndWithStart('12:00', '09:00', '15:00')).toBe('15:00');
  });
});
