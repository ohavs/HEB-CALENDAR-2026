import { describe, expect, it } from 'vitest';
import { isDraftDirty } from './draftDirty';

describe('isDraftDirty', () => {
  const base = { title: '', date: '2026-09-14', startTime: null, allDay: true };

  it('טופס שלא נגעו בו אינו מלוכלך', () => {
    expect(isDraftDirty({ ...base }, base)).toBe(false);
  });

  it('כותרת שהוקלדה היא שינוי', () => {
    expect(isDraftDirty({ ...base, title: 'לחם' }, base)).toBe(true);
  });

  /*
    שדה רשות נמחק ל-undefined לפני כתיבה לענן, ושעות נשמרות null
    באירוע של כל היום. שלושתם מתארים "לא מולא", ואם הם ייחשבו שונים
    כל טופס ישאל בסגירה - והשאלה תהפוך לרעש.
  */
  it('undefined, null ומחרוזת ריקה שקולים', () => {
    expect(isDraftDirty({ a: undefined }, { a: null })).toBe(false);
    expect(isDraftDirty({ a: '' }, { a: undefined })).toBe(false);
    expect(isDraftDirty({ a: null }, { a: '' })).toBe(false);
  });

  it('false ו-0 הם ערכים, לא ריק', () => {
    expect(isDraftDirty({ allDay: false }, { allDay: undefined })).toBe(true);
    expect(isDraftDirty({ n: 0 }, { n: null })).toBe(true);
  });

  it('תופס שדה שנוסף או שנעלם', () => {
    expect(isDraftDirty({ a: 1, b: 2 }, { a: 1 })).toBe(true);
    expect(isDraftDirty({ a: 1 }, { a: 1, b: 2 })).toBe(true);
  });

  /* שדה רשות שנוסף כריק אינו שינוי - זו אותה טיוטה */
  it('שדה שנוסף ריק אינו שינוי', () => {
    expect(isDraftDirty({ a: 1, notes: '' }, { a: 1 })).toBe(false);
  });

  it('משווה מפה מקוננת לפי תוכן ולא לפי זהות', () => {
    expect(isDraftDirty({ ex: { '2026-09-14': 'x' } }, { ex: { '2026-09-14': 'x' } })).toBe(false);
    expect(isDraftDirty({ ex: { '2026-09-14': 'x' } }, { ex: { '2026-09-14': 'y' } })).toBe(true);
  });

  it('כיבוי "כל היום" הוא שינוי', () => {
    expect(isDraftDirty({ ...base, allDay: false }, base)).toBe(true);
  });
});
