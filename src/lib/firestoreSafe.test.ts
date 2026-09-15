import { describe, expect, it } from 'vitest';
import { stripUndefined } from './firestoreSafe';

describe('stripUndefined', () => {
  it('מוריד מפתח שערכו undefined', () => {
    const out = stripUndefined({ a: 1, b: undefined });
    expect(Object.prototype.hasOwnProperty.call(out, 'b')).toBe(false);
    expect(out).toEqual({ a: 1 });
  });

  /* null הוא ערך תקין ב-Firestore, ויש לו משמעות: "אין שעה" */
  it('משאיר null, אפס, מחרוזת ריקה ו-false', () => {
    const out = stripUndefined({ a: null, b: 0, c: '', d: false });
    expect(out).toEqual({ a: null, b: 0, c: '', d: false });
    expect(Object.prototype.hasOwnProperty.call(out, 'a')).toBe(true);
  });

  it('יורד לעומק', () => {
    const out = stripUndefined({ outer: { inner: { keep: 1, drop: undefined } } });
    expect(out).toEqual({ outer: { inner: { keep: 1 } } });
  });

  /* כאן יושבות התבניות והמקומות השמורים בתוך ההגדרות */
  it('מנקה גם בתוך מערכים', () => {
    const out = stripUndefined({
      templates: [
        { id: 'a', title: 'חופש', location: undefined },
        { id: 'b', title: 'ספורט', location: 'חדר כושר' },
      ],
    });
    expect(out).toEqual({
      templates: [
        { id: 'a', title: 'חופש' },
        { id: 'b', title: 'ספורט', location: 'חדר כושר' },
      ],
    });
  });

  it('לא נוגע ב-Date - Firestore ממיר אותו בעצמו', () => {
    const date = new Date(0);
    const out = stripUndefined({ when: date });
    expect(out.when).toBe(date);
  });

  it('אינו משנה את המקור', () => {
    const source = { a: 1, b: undefined };
    stripUndefined(source);
    expect(Object.prototype.hasOwnProperty.call(source, 'b')).toBe(true);
  });

  /*
    הבאג עצמו: `JSON.stringify` מוריד את השדה בשקט, ולכן האחסון
    המקומי נראה תקין בעוד הכתיבה לענן נדחית.
  */
  it('תופס את מה ש-JSON מסתיר', () => {
    const template = { id: 'a', title: 'חופש', location: undefined, notes: undefined };
    expect(JSON.stringify(template)).toBe('{"id":"a","title":"חופש"}');
    expect(Object.keys(template)).toContain('location');
    expect(Object.keys(stripUndefined(template))).not.toContain('location');
  });
});
