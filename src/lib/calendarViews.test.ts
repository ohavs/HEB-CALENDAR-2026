import { describe, expect, it } from 'vitest';
import {
  ALL_VIEWS,
  availableViews,
  canSwitchViews,
  nextView,
  resolveView,
} from './calendarViews';

const both = { showWeekView: true, showAgendaView: true };
const noWeek = { showWeekView: false, showAgendaView: true };
const noAgenda = { showWeekView: true, showAgendaView: false };
const monthOnly = { showWeekView: false, showAgendaView: false };

describe('availableViews', () => {
  it('מחזיר את שלושתן כשהכול דלוק, בסדר הקבוע', () => {
    expect(availableViews(both)).toEqual(['month', 'week', 'agenda']);
    expect(availableViews(both)).toEqual(ALL_VIEWS);
  });

  it('משמיט את מה שכובה', () => {
    expect(availableViews(noWeek)).toEqual(['month', 'agenda']);
    expect(availableViews(noAgenda)).toEqual(['month', 'week']);
  });

  it('חודש נשאר גם כששתיהן כבויות', () => {
    expect(availableViews(monthOnly)).toEqual(['month']);
  });
});

describe('resolveView', () => {
  it('משאיר תצוגה זמינה כמות שהיא', () => {
    expect(resolveView('week', availableViews(both))).toBe('week');
    expect(resolveView('agenda', availableViews(both))).toBe('agenda');
  });

  it('נופל לחודש כשהתצוגה השמורה כובתה', () => {
    expect(resolveView('week', availableViews(noWeek))).toBe('month');
    expect(resolveView('agenda', availableViews(noAgenda))).toBe('month');
    expect(resolveView('agenda', availableViews(monthOnly))).toBe('month');
  });
});

describe('nextView', () => {
  it('מחזר על שלושתן וחוזר להתחלה', () => {
    const a = availableViews(both);
    expect(nextView('month', a)).toBe('week');
    expect(nextView('week', a)).toBe('agenda');
    expect(nextView('agenda', a)).toBe('month');
  });

  it('מדלג על מה שכובה', () => {
    expect(nextView('month', availableViews(noWeek))).toBe('agenda');
    expect(nextView('agenda', availableViews(noWeek))).toBe('month');
    expect(nextView('month', availableViews(noAgenda))).toBe('week');
    expect(nextView('week', availableViews(noAgenda))).toBe('month');
  });

  it('חודש בלבד נשאר על עצמו', () => {
    expect(nextView('month', availableViews(monthOnly))).toBe('month');
  });

  /*
    המצב שקורה בפועל: המשתמש נמצא בשבוע, נכנס להגדרות ומכבה אותו.
    ה-view השמור עדיין 'week', והכפתור חייב להוציא אותו משם.
  */
  it('מוציא ממצב שכובה תחת הרגליים', () => {
    expect(nextView('week', availableViews(noWeek))).toBe('month');
    expect(nextView('agenda', availableViews(monthOnly))).toBe('month');
  });
});

describe('canSwitchViews', () => {
  it('אמת כשיש יותר מאחת', () => {
    expect(canSwitchViews(availableViews(both))).toBe(true);
    expect(canSwitchViews(availableViews(noWeek))).toBe(true);
  });

  it('שקר כשנשאר רק חודש', () => {
    expect(canSwitchViews(availableViews(monthOnly))).toBe(false);
  });
});
