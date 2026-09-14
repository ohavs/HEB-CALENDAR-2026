/**
 * פריסת אירועים חוזרים. המקרה המעניין הוא החזרה השנתית לפי התאריך העברי:
 * אירוע שנקבע באדר של שנה פשוטה צריך לחזור באדר ב׳ של שנה מעוברת, ולהפך.
 *
 * תשפ״ו (2026) שנה פשוטה, תשפ״ז (2027) שנה מעוברת.
 */
import { describe, expect, it } from 'vitest';
import {
  eventsOnDay,
  expandEvents,
  isOccurrenceKey,
  isSpanEnd,
  sortOccurrences,
  spanLengthOf,
  REPEAT_LABELS,
} from './recurrence';
import { dateKey, keyToDate } from './dates';
import { event } from '@/test/factories';

const keysFor = (ev: Parameters<typeof expandEvents>[0][number], from: string, to: string) =>
  [...expandEvents([ev], keyToDate(from), keyToDate(to)).entries()]
    .filter(([, occs]) => occs.length > 0)
    .map(([k]) => k)
    .sort();

describe('אירוע חד־פעמי', () => {
  it('מופיע ביומו בלבד', () => {
    const ev = event({ date: '2026-09-13', repeat: 'none' });
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).toEqual(['2026-09-13']);
  });

  it('לא מופיע מחוץ לטווח', () => {
    const ev = event({ date: '2026-08-13', repeat: 'none' });
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).toEqual([]);
  });

  it('אירוע מסומן כמחוק לא נפרס', () => {
    const ev = event({ date: '2026-09-13', deleted: true });
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).toEqual([]);
  });
});

describe('חזרה שבועית', () => {
  it('חוזר כל שבעה ימים מיום הבסיס', () => {
    const ev = event({ date: '2026-09-07', repeat: 'weekly' }); // שני
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
  });

  it('לא חוזר אחורה מלפני יום הבסיס', () => {
    const ev = event({ date: '2026-09-14', repeat: 'weekly' });
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).toEqual(['2026-09-14', '2026-09-21', '2026-09-28']);
  });

  it('שומר על אותו יום בשבוע במעבר שעון קיץ', () => {
    const ev = event({ date: '2026-03-16', repeat: 'weekly' }); // שני
    for (const key of keysFor(ev, '2026-03-01', '2026-04-30')) {
      expect(keyToDate(key).getDay()).toBe(1);
    }
  });
});

describe('חזרה חודשית', () => {
  it('חוזר באותו יום בחודש', () => {
    const ev = event({ date: '2026-09-15', repeat: 'monthly' });
    expect(keysFor(ev, '2026-09-01', '2026-12-31')).toEqual([
      '2026-09-15',
      '2026-10-15',
      '2026-11-15',
      '2026-12-15',
    ]);
  });

  it('יום 31 מדלג על חודשים קצרים במקום לזלוג לחודש הבא', () => {
    const ev = event({ date: '2026-01-31', repeat: 'monthly' });
    const keys = keysFor(ev, '2026-01-01', '2026-04-30');
    expect(keys).toContain('2026-01-31');
    expect(keys).toContain('2026-03-31');
    expect(keys).not.toContain('2026-03-01'); // לא זולג מפברואר
    expect(keys.some((k) => k.startsWith('2026-02'))).toBe(false);
  });
});

describe('חזרה שנתית לועזית', () => {
  it('חוזר באותו יום ובאותו חודש', () => {
    const ev = event({ date: '2026-09-13', repeat: 'yearly' });
    expect(keysFor(ev, '2026-01-01', '2028-12-31')).toEqual([
      '2026-09-13',
      '2027-09-13',
      '2028-09-13',
    ]);
  });

  it('29 בפברואר מופיע רק בשנים מעוברות', () => {
    const ev = event({ date: '2028-02-29', repeat: 'yearly' });
    const keys = keysFor(ev, '2028-01-01', '2032-12-31');
    expect(keys).toEqual(['2028-02-29', '2032-02-29']);
  });
});

describe('חזרה שנתית עברית', () => {
  it('חוזר באותו תאריך עברי, לא באותו תאריך לועזי', () => {
    // א׳ בתשרי תשפ״ז = 12.9.2026, תשפ״ח = 2.10.2027
    const ev = event({ date: '2026-09-12', repeat: 'hebrew-yearly' });
    const keys = keysFor(ev, '2026-09-01', '2027-12-31');
    expect(keys).toContain('2026-09-12');
    expect(keys).toContain('2027-10-02');
    expect(keys).not.toContain('2027-09-12');
  });

  it('אירוע מאדר בשנה פשוטה חוזר באדר ב׳ בשנה מעוברת', () => {
    // י׳ באדר תשפ״ו = 27.2.2026 (שנה פשוטה)
    // תשפ״ז מעוברת: י׳ באדר ב׳ = 19.3.2027, י׳ באדר א׳ = 17.2.2027
    const ev = event({ date: '2026-02-27', repeat: 'hebrew-yearly' });
    const keys = keysFor(ev, '2027-01-01', '2027-12-31');
    expect(keys).toEqual(['2027-03-19']);
    expect(keys).not.toContain('2027-02-17');
  });

  it('חוזר פעם אחת בלבד בשנה מעוברת', () => {
    const ev = event({ date: '2026-02-27', repeat: 'hebrew-yearly' });
    expect(keysFor(ev, '2027-01-01', '2027-12-31')).toHaveLength(1);
  });

  it('אירוע מאדר א׳ בשנה מעוברת חוזר באדר בשנה פשוטה', () => {
    // י׳ באדר א׳ תשפ״ז = 17.2.2027 (מעוברת) → תשפ״ח פשוטה
    const ev = event({ date: '2027-02-17', repeat: 'hebrew-yearly' });
    const keys = keysFor(ev, '2028-01-01', '2028-12-31');
    expect(keys).toHaveLength(1);
  });

  it('תאריך עברי רגיל חוזר שנה אחר שנה', () => {
    const ev = event({ date: '2026-11-15', repeat: 'hebrew-yearly' });
    const keys = keysFor(ev, '2026-01-01', '2029-12-31');
    expect(keys.length).toBeGreaterThanOrEqual(3);
  });
});

describe('צורת המופע', () => {
  it('המופע המקורי אינו מסומן כחוזר ומזההו הוא מזהה האירוע', () => {
    const ev = event({ date: '2026-09-07', repeat: 'weekly' });
    const first = eventsOnDay([ev], keyToDate('2026-09-07'))[0];
    expect(first.isRecurring).toBe(false);
    expect(first.occurrenceId).toBe(ev.id);
    expect(first.baseId).toBe(ev.id);
  });

  it('מופע חוזר מקבל מזהה ייחודי שכולל את התאריך', () => {
    const ev = event({ date: '2026-09-07', repeat: 'weekly' });
    const later = eventsOnDay([ev], keyToDate('2026-09-14'))[0];
    expect(later.isRecurring).toBe(true);
    expect(later.occurrenceId).toBe(`${ev.id}@2026-09-14`);
    expect(later.baseId).toBe(ev.id);
    expect(later.date).toBe('2026-09-14');
  });

  it('המופע יורש את שאר שדות האירוע', () => {
    const ev = event({ date: '2026-09-07', repeat: 'weekly', title: 'שיעור', startTime: '20:00' });
    const later = eventsOnDay([ev], keyToDate('2026-09-14'))[0];
    expect(later.title).toBe('שיעור');
    expect(later.startTime).toBe('20:00');
  });
});

describe('מיון מופעים', () => {
  it('אירועי כל היום ראשונים', () => {
    const all = event({ allDay: true, startTime: null });
    const timed = event({ startTime: '08:00' });
    expect([timed, all].sort(sortOccurrences as never)[0]).toBe(all);
  });

  it('ממוין לפי שעת התחלה', () => {
    const a = event({ startTime: '14:00' });
    const b = event({ startTime: '09:00' });
    const sorted = eventsOnDay([a, b], keyToDate(a.date));
    expect(sorted[0].startTime).toBe('09:00');
  });

  it('מופעים באותה שעה ממוינים לפי סדר היצירה', () => {
    const first = event({ startTime: '09:00' });
    const second = event({ startTime: '09:00' });
    const sorted = eventsOnDay([second, first], keyToDate(first.date));
    expect(sorted[0].id).toBe(first.id);
  });
});

describe('expandEvents על כמה אירועים', () => {
  it('מקבץ מופעים מאירועים שונים לאותו יום', () => {
    const a = event({ date: '2026-09-13', startTime: '09:00' });
    const b = event({ date: '2026-09-13', startTime: '11:00' });
    const map = expandEvents([a, b], keyToDate('2026-09-13'), keyToDate('2026-09-13'));
    expect(map.get('2026-09-13')).toHaveLength(2);
  });

  it('לא מחזיר מפתחות לימים ריקים', () => {
    const ev = event({ date: '2026-09-13' });
    const map = expandEvents([ev], keyToDate('2026-09-01'), keyToDate('2026-09-30'));
    expect(map.size).toBe(1);
  });

  it('טווח של יום בודד עובד', () => {
    const ev = event({ date: '2026-09-13' });
    expect(eventsOnDay([ev], keyToDate('2026-09-13'))).toHaveLength(1);
    expect(eventsOnDay([ev], keyToDate('2026-09-14'))).toHaveLength(0);
  });

  it('רשימה ריקה מחזירה מפה ריקה', () => {
    expect(expandEvents([], new Date(2026, 8, 1), new Date(2026, 8, 30)).size).toBe(0);
  });
});

describe('REPEAT_LABELS', () => {
  it('יש כיתוב בעברית לכל סוג חזרה', () => {
    for (const label of Object.values(REPEAT_LABELS)) {
      expect(label).toMatch(/[א-ת]/);
    }
  });
});

describe('עקביות מפתחות', () => {
  it('המפתחות תמיד לוקאליים', () => {
    const ev = event({ date: '2026-09-07', repeat: 'weekly' });
    for (const key of keysFor(ev, '2026-09-01', '2026-10-31')) {
      expect(dateKey(keyToDate(key))).toBe(key);
    }
  });
});

/* ==========================================================================
   חריגים למופע יחיד
   ========================================================================== */

describe('ביטול מופע יחיד', () => {
  it('המופע שבוטל נעלם והשאר נשארים', () => {
    const ev = event({
      date: '2026-09-07',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { cancelled: true } },
    });
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-07',
      '2026-09-21',
      '2026-09-28',
    ]);
  });

  it('אפשר לבטל גם את המופע הראשון', () => {
    const ev = event({
      date: '2026-09-07',
      repeat: 'weekly',
      exceptions: { '2026-09-07': { cancelled: true } },
    });
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).not.toContain('2026-09-07');
  });

  it('ביטול של אירוע חד־פעמי מעלים אותו', () => {
    const ev = event({
      date: '2026-09-13',
      repeat: 'none',
      exceptions: { '2026-09-13': { cancelled: true } },
    });
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).toEqual([]);
  });
});

describe('הזזת מופע יחיד', () => {
  it('המופע מופיע ביעד ולא במקור', () => {
    const ev = event({
      date: '2026-09-07',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { movedTo: '2026-09-16' } },
    });
    const keys = keysFor(ev, '2026-09-01', '2026-09-30');
    expect(keys).toContain('2026-09-16');
    expect(keys).not.toContain('2026-09-14');
    expect(keys).toContain('2026-09-21'); // שאר הסדרה לא זזה
  });

  it('מופע שהוזז מחוץ לחלון הנצפה אל תוכו כן מופיע', () => {
    const ev = event({
      date: '2026-09-07',
      repeat: 'weekly',
      exceptions: { '2026-09-28': { movedTo: '2026-10-02' } },
    });
    // החלון מתחיל אחרי המקור ומסתיים אחרי היעד
    expect(keysFor(ev, '2026-10-01', '2026-10-31')).toContain('2026-10-02');
  });

  it('מופע שהוזז אל מחוץ לחלון לא מופיע בו', () => {
    const ev = event({
      date: '2026-09-07',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { movedTo: '2026-10-20' } },
    });
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).not.toContain('2026-09-14');
  });

  it('המזהה של המופע נשאר לפי התאריך המקורי גם אחרי ההזזה', () => {
    const ev = event({
      date: '2026-09-07',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { movedTo: '2026-09-16' } },
    });
    const occ = eventsOnDay([ev], keyToDate('2026-09-16'))[0];
    expect(occ.sourceKey).toBe('2026-09-14');
    expect(occ.occurrenceId).toBe(`${ev.id}@2026-09-14`);
    expect(occ.date).toBe('2026-09-16');
  });

  it('ביטול גובר על הזזה', () => {
    const ev = event({
      date: '2026-09-07',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { movedTo: '2026-09-16', cancelled: true } },
    });
    const keys = keysFor(ev, '2026-09-01', '2026-09-30');
    expect(keys).not.toContain('2026-09-14');
    expect(keys).not.toContain('2026-09-16');
  });

  it('אפשר להזיז את המופע הראשון בלי להזיז את הסדרה', () => {
    const ev = event({
      date: '2026-09-07',
      repeat: 'weekly',
      exceptions: { '2026-09-07': { movedTo: '2026-09-08' } },
    });
    const keys = keysFor(ev, '2026-09-01', '2026-09-30');
    expect(keys).toContain('2026-09-08');
    expect(keys).toContain('2026-09-14');
    expect(keys).not.toContain('2026-09-07');
  });
});

describe('שינוי שדות במופע יחיד', () => {
  it('שינוי שעה חל על המופע בלבד', () => {
    const ev = event({
      date: '2026-09-07',
      startTime: '20:00',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { startTime: '21:30' } },
    });
    expect(eventsOnDay([ev], keyToDate('2026-09-14'))[0].startTime).toBe('21:30');
    expect(eventsOnDay([ev], keyToDate('2026-09-21'))[0].startTime).toBe('20:00');
  });

  it('שינוי כותרת חל על המופע בלבד', () => {
    const ev = event({
      date: '2026-09-07',
      title: 'שיעור',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { title: 'שיעור מיוחד' } },
    });
    expect(eventsOnDay([ev], keyToDate('2026-09-14'))[0].title).toBe('שיעור מיוחד');
    expect(eventsOnDay([ev], keyToDate('2026-09-21'))[0].title).toBe('שיעור');
  });

  it('ערך null בחריג נשמר ולא נחשב כהיעדר', () => {
    const ev = event({
      date: '2026-09-07',
      startTime: '20:00',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { allDay: true, startTime: null } },
    });
    const occ = eventsOnDay([ev], keyToDate('2026-09-14'))[0];
    expect(occ.allDay).toBe(true);
    expect(occ.startTime).toBeNull();
  });

  it('המופע מסומן כבעל חריג', () => {
    const ev = event({
      date: '2026-09-07',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { title: 'אחר' } },
    });
    expect(eventsOnDay([ev], keyToDate('2026-09-14'))[0].hasException).toBe(true);
    expect(eventsOnDay([ev], keyToDate('2026-09-21'))[0].hasException).toBe(false);
  });

  it('החריג לא משנה את האירוע המקורי', () => {
    const ev = event({
      date: '2026-09-07',
      title: 'שיעור',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { title: 'אחר' } },
    });
    eventsOnDay([ev], keyToDate('2026-09-14'));
    expect(ev.title).toBe('שיעור');
  });
});

describe('חריג יתום', () => {
  it('חריג על תאריך שאינו מופע של הסדרה נזרק', () => {
    const ev = event({
      date: '2026-09-07',
      repeat: 'weekly',
      // יום שלישי - הסדרה היא של ימי שני
      exceptions: { '2026-09-15': { movedTo: '2026-09-17' } },
    });
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).not.toContain('2026-09-17');
  });

  it('isOccurrenceKey מזהה מופע אמיתי', () => {
    const ev = event({ date: '2026-09-07', repeat: 'weekly' });
    expect(isOccurrenceKey(ev, '2026-09-14')).toBe(true);
    expect(isOccurrenceKey(ev, '2026-09-15')).toBe(false);
    expect(isOccurrenceKey(ev, '2026-09-07')).toBe(true);
  });

  it('אירוע חד־פעמי הוא מופע של עצמו בלבד', () => {
    const ev = event({ date: '2026-09-13', repeat: 'none' });
    expect(isOccurrenceKey(ev, '2026-09-13')).toBe(true);
    expect(isOccurrenceKey(ev, '2026-09-20')).toBe(false);
  });
});

describe('חריגים בחזרה עברית', () => {
  it('הזזת מופע עברי בודד לא משפיעה על השנים הבאות', () => {
    const ev = event({
      date: '2026-11-15',
      repeat: 'hebrew-yearly',
    });
    const natural = keysFor(ev, '2027-01-01', '2027-12-31');
    expect(natural).toHaveLength(1);
    const moved = event({
      ...ev,
      exceptions: { [natural[0]]: { movedTo: '2027-12-25' } },
    });
    const after = keysFor(moved, '2027-01-01', '2027-12-31');
    expect(after).toEqual(['2027-12-25']);
    // השנה שאחריה חוזרת לתאריך העברי הרגיל
    expect(keysFor(moved, '2028-01-01', '2028-12-31')).toHaveLength(1);
  });
});

/* ==========================================================================
   אירועים רב־יומיים
   ========================================================================== */

describe('spanLengthOf', () => {
  it('אירוע בלי יום סיום נמשך יום אחד', () => {
    expect(spanLengthOf({ date: '2026-09-13' })).toBe(1);
  });

  it('יום סיום זהה ליום ההתחלה נמשך יום אחד', () => {
    expect(spanLengthOf({ date: '2026-09-13', endDate: '2026-09-13' })).toBe(1);
  });

  it('סופר את שני הקצוות', () => {
    expect(spanLengthOf({ date: '2026-09-13', endDate: '2026-09-15' })).toBe(3);
  });

  it('יום סיום לפני ההתחלה מתעלמים ממנו', () => {
    expect(spanLengthOf({ date: '2026-09-13', endDate: '2026-09-10' })).toBe(1);
  });

  it('חוצה גבול חודש', () => {
    expect(spanLengthOf({ date: '2026-09-29', endDate: '2026-10-02' })).toBe(4);
  });

  it('חוצה מעבר שעון קיץ בלי לאבד יום', () => {
    // שעון הקיץ בישראל מתחיל ב-27.3.2026
    expect(spanLengthOf({ date: '2026-03-26', endDate: '2026-03-29' })).toBe(4);
  });
});

describe('פריסת אירוע רב־יומי', () => {
  it('מופיע בכל ימי הפרישה', () => {
    const ev = event({ date: '2026-09-13', endDate: '2026-09-16', allDay: true });
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
    ]);
  });

  it('כל יום יודע את מקומו בפרישה', () => {
    const ev = event({ date: '2026-09-13', endDate: '2026-09-15', allDay: true });
    const at = (k: string) => eventsOnDay([ev], keyToDate(k))[0];
    expect(at('2026-09-13').spanIndex).toBe(0);
    expect(at('2026-09-14').spanIndex).toBe(1);
    expect(at('2026-09-15').spanIndex).toBe(2);
    expect(at('2026-09-15').spanLength).toBe(3);
    expect(isSpanEnd(at('2026-09-15'))).toBe(true);
    expect(isSpanEnd(at('2026-09-14'))).toBe(false);
  });

  it('כל ימי הפרישה חולקים את אותו יום ראשון ואת אותו מזהה', () => {
    const ev = event({ date: '2026-09-13', endDate: '2026-09-15', allDay: true });
    const a = eventsOnDay([ev], keyToDate('2026-09-13'))[0];
    const b = eventsOnDay([ev], keyToDate('2026-09-15'))[0];
    expect(b.spanStart).toBe('2026-09-13');
    expect(b.occurrenceId).toBe(a.occurrenceId);
  });

  it('פרישה שהתחילה לפני החלון ממשיכה לתוכו', () => {
    const ev = event({ date: '2026-09-28', endDate: '2026-10-04', allDay: true });
    const keys = keysFor(ev, '2026-10-01', '2026-10-31');
    expect(keys).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(eventsOnDay([ev], keyToDate('2026-10-01'))[0].spanIndex).toBe(3);
  });

  it('פרישה נחתכת בקצה החלון ולא זולגת מעבר לו', () => {
    const ev = event({ date: '2026-09-28', endDate: '2026-10-04', allDay: true });
    expect(keysFor(ev, '2026-09-01', '2026-09-30')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30']);
  });

  it('אירוע רב־יומי חוזר פורש מחדש בכל מופע', () => {
    const ev = event({
      date: '2026-09-07',
      endDate: '2026-09-09',
      repeat: 'weekly',
      allDay: true,
    });
    const keys = keysFor(ev, '2026-09-01', '2026-09-30');
    expect(keys).toContain('2026-09-07');
    expect(keys).toContain('2026-09-09');
    expect(keys).toContain('2026-09-14');
    expect(keys).toContain('2026-09-16');
    expect(keys).not.toContain('2026-09-10');
  });

  it('מופע חוזר שהתחיל לפני החלון נמשך לתוכו', () => {
    const ev = event({
      date: '2026-09-07',
      endDate: '2026-09-09',
      repeat: 'weekly',
      allDay: true,
    });
    // החלון מתחיל באמצע המופע של ה-14
    expect(keysFor(ev, '2026-09-15', '2026-09-20')).toContain('2026-09-15');
  });

  it('הזזת מופע רב־יומי מזיזה את כל הפרישה', () => {
    const ev = event({
      date: '2026-09-07',
      endDate: '2026-09-09',
      repeat: 'weekly',
      allDay: true,
      exceptions: { '2026-09-14': { movedTo: '2026-09-21' } },
    });
    const keys = keysFor(ev, '2026-09-01', '2026-09-30');
    expect(keys).not.toContain('2026-09-14');
    expect(keys).toContain('2026-09-21');
    expect(keys).toContain('2026-09-23');
  });

  it('חריג יכול לשנות את אורך הפרישה של מופע יחיד', () => {
    const ev = event({
      date: '2026-09-07',
      endDate: '2026-09-08',
      repeat: 'weekly',
      allDay: true,
      exceptions: { '2026-09-14': { endDate: '2026-09-18' } },
    });
    expect(eventsOnDay([ev], keyToDate('2026-09-18'))).toHaveLength(1);
    // השבוע שאחריו חוזר לאורך המקורי
    expect(eventsOnDay([ev], keyToDate('2026-09-25'))).toHaveLength(0);
  });

  it('אירוע רב־יומי ממוין לפני אירוע ממודד', () => {
    const trip = event({ date: '2026-09-13', endDate: '2026-09-15', allDay: true, title: 'טיול' });
    const meeting = event({ date: '2026-09-14', startTime: '08:00', title: 'פגישה' });
    const list = eventsOnDay([meeting, trip], keyToDate('2026-09-14'));
    expect(list[0].title).toBe('טיול');
  });

  it('אירוע ארוך יותר ממוין לפני אירוע ארוך פחות', () => {
    const long = event({ date: '2026-09-13', endDate: '2026-09-20', allDay: true, title: 'ארוך' });
    const short = event({ date: '2026-09-13', endDate: '2026-09-14', allDay: true, title: 'קצר' });
    const list = eventsOnDay([short, long], keyToDate('2026-09-13'));
    expect(list[0].title).toBe('ארוך');
  });

  it('אירוע רגיל נשאר באורך 1', () => {
    const ev = event({ date: '2026-09-13' });
    const occ = eventsOnDay([ev], keyToDate('2026-09-13'))[0];
    expect(occ.spanLength).toBe(1);
    expect(occ.spanIndex).toBe(0);
    expect(isSpanEnd(occ)).toBe(true);
  });
});

describe('סימון כבוצע', () => {
  it('מופע בלי חריג אינו מסומן', () => {
    const ev = event({ date: '2026-09-14' });
    expect(eventsOnDay([ev], keyToDate('2026-09-14'))[0].done).toBe(false);
  });

  it('החריג מסמן את המופע שלו בלבד', () => {
    const ev = event({
      date: '2026-09-07',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { done: true } },
    });
    expect(eventsOnDay([ev], keyToDate('2026-09-14'))[0].done).toBe(true);
    expect(eventsOnDay([ev], keyToDate('2026-09-21'))[0].done).toBe(false);
  });
});
