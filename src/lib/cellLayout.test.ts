import { describe, expect, it } from 'vitest';
import { linesNeeded, planCell, type CellItem, type CellMetrics } from './cellLayout';

// מידות של תא בטלפון: כ-36px רוחב טקסט, כ-6 תווים בשורה
const PHONE: CellMetrics = {
  space: 66,
  textWidth: 36,
  firstLine: 18,
  extraLine: 13,
  row: 18,
  charWidth: 5.5,
};

const ev = (title: string, multiDay = false): CellItem => ({ title, multiDay });

describe('linesNeeded', () => {
  it('כותרת קצרה - שורה אחת', () => {
    expect(linesNeeded(ev('ים'), PHONE)).toBe(1);
  });

  it('כותרת ארוכה נפרשת על כמה שורות', () => {
    expect(linesNeeded(ev('פגישת צוות שבועית'), PHONE)).toBeGreaterThanOrEqual(3);
  });

  it('שבירה במילים: כל מילה שאינה נכנסת עם הקודמת יורדת שורה', () => {
    // 6 תווים בשורה: "יום" / "הולדת" / "לסבתא" / "רחל"
    expect(linesNeeded(ev('יום הולדת לסבתא רחל'), PHONE)).toBe(4);
    expect(linesNeeded(ev('ים ים'), PHONE)).toBe(1);
  });

  it('מילה ארוכה מהשורה נשברת באמצע', () => {
    expect(linesNeeded(ev('אבגדהוזחטיכלמ'), PHONE)).toBe(3);
  });

  it('פס רב־יומי תמיד בשורה אחת', () => {
    expect(linesNeeded(ev('חופשה משפחתית בצפון', true), PHONE)).toBe(1);
  });
});

describe('planCell', () => {
  it('אירוע יחיד מקבל את כל הגובה שהכותרת צריכה', () => {
    const plan = planCell([ev('פגישת צוות שבועית')], 0, false, PHONE);
    expect(plan.eventLines[0]).toBeGreaterThanOrEqual(3);
  });

  it('השורות הנוספות לא באות על חשבון אירוע שממתין', () => {
    const plan = planCell([ev('פגישת צוות שבועית'), ev('רופא')], 0, false, PHONE);
    expect(plan.eventLines).toHaveLength(2);
    expect(plan.eventLines[0]).toBeGreaterThan(1);
    expect(plan.eventLines[1]).toBe(1);
  });

  it('זמן ההדלקה שמור מראש בתקציב', () => {
    const without = planCell([ev('פגישת צוות שבועית ארוכה')], 0, false, PHONE);
    const withTime = planCell([ev('פגישת צוות שבועית ארוכה')], 0, true, PHONE);
    expect(withTime.eventLines[0]).toBeLessThan(without.eventLines[0]);
  });

  it('מועדים מקבלים את מה שנשאר אחרי האירועים', () => {
    const plan = planCell([ev('ים')], 3, false, PHONE);
    expect(plan.eventLines).toEqual([1]);
    expect(plan.holidays).toBe(2);
  });

  it('בתא נמוך מדי מוצג לפחות אירוע אחד', () => {
    const plan = planCell([ev('א'), ev('ב')], 1, true, { ...PHONE, space: 10 });
    expect(plan.eventLines).toEqual([1]);
    expect(plan.holidays).toBe(0);
  });

  it('אין יותר שורות ממה שנכנס', () => {
    const plan = planCell(
      [ev('פגישת צוות שבועית ארוכה מאוד מאוד מאוד')],
      0,
      false,
      { ...PHONE, space: 200 },
    );
    expect(plan.eventLines[0]).toBe(4);
  });
});
