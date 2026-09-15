/**
 * תבניות אירוע. הכול טהור, ולכן הכול נבדק בלי דפדפן.
 *
 * הבדיקה החשובה כאן היא `templateToEvent`: היא הגשר בין תבנית לאירוע
 * אמיתי, וטעות בה מייצרת אירועים שגויים על הלוח.
 */
import { describe, expect, it } from 'vitest';
import type { EventTemplate } from '@/types';
import {
  MAX_TEMPLATES,
  addTemplate,
  emptyTemplate,
  isValidTemplate,
  newTemplateId,
  normalizeTemplate,
  removeTemplate,
  templateHint,
  templateToEvent,
  updateTemplate,
} from './templates';

function tpl(patch: Partial<EventTemplate> = {}): EventTemplate {
  return { ...emptyTemplate('violet'), title: 'חופש מהעבודה', ...patch };
}

describe('תקינות', () => {
  it('שם ריק נפסל', () => {
    expect(isValidTemplate(tpl({ title: '' }))).toBe(false);
    expect(isValidTemplate(tpl({ title: '   ' }))).toBe(false);
  });

  it('שם וצבע בלבד מספיקים', () => {
    expect(isValidTemplate(tpl())).toBe(true);
  });
});

describe('normalizeTemplate', () => {
  it('חותך רווחים', () => {
    expect(normalizeTemplate(tpl({ title: '  חופש  ' })).title).toBe('חופש');
  });

  it('אוכף אורך מרבי', () => {
    expect(normalizeTemplate(tpl({ title: 'x'.repeat(500) })).title).toHaveLength(300);
  });

  it('תבנית של כל היום אינה שומרת שעות', () => {
    // אחרת הן חוזרות להפתיע ברגע שמכבים את "כל היום"
    const out = normalizeTemplate(tpl({ allDay: true, startTime: '09:00', endTime: '10:00' }));
    expect(out.startTime).toBeNull();
    expect(out.endTime).toBeNull();
  });

  it('תבנית עם שעות מקבלת ברירת מחדל כשאין', () => {
    const out = normalizeTemplate(tpl({ allDay: false, startTime: null, endTime: null }));
    expect(out.startTime).toBe('09:00');
    expect(out.endTime).toBe('10:00');
  });

  it('מקום והערות ריקים הופכים ל-undefined ולא למחרוזת ריקה', () => {
    const out = normalizeTemplate(tpl({ location: '   ', notes: '' }));
    expect(out.location).toBeUndefined();
    expect(out.notes).toBeUndefined();
  });
});

describe('templateToEvent', () => {
  it('נותן אירוע ביום המבוקש', () => {
    const ev = templateToEvent(tpl(), '2026-09-20');
    expect(ev.date).toBe('2026-09-20');
    expect(ev.title).toBe('חופש מהעבודה');
    expect(ev.color).toBe('violet');
  });

  it('אירוע שנוצר מתבנית לעולם אינו חוזר', () => {
    // התבנית היא מקור לשיבוץ, לא סדרה. חזרה הייתה מפתיעה.
    expect(templateToEvent(tpl(), '2026-09-20').repeat).toBe('none');
  });

  it('כל היום - בלי שעות', () => {
    const ev = templateToEvent(tpl({ allDay: true }), '2026-09-20');
    expect(ev.allDay).toBe(true);
    expect(ev.startTime).toBeNull();
    expect(ev.endTime).toBeNull();
  });

  it('עם שעות - השעות עוברות', () => {
    const ev = templateToEvent(
      tpl({ allDay: false, startTime: '08:30', endTime: '16:00' }),
      '2026-09-20',
    );
    expect(ev.startTime).toBe('08:30');
    expect(ev.endTime).toBe('16:00');
  });

  it('מקום, הערות ותזכורת עוברים', () => {
    const ev = templateToEvent(
      tpl({ location: 'המשרד', placeId: 'p1', notes: 'לזכור', reminderMinutes: 30 }),
      '2026-09-20',
    );
    expect(ev.location).toBe('המשרד');
    expect(ev.placeId).toBe('p1');
    expect(ev.notes).toBe('לזכור');
    expect(ev.reminderMinutes).toBe(30);
  });

  it('אותה תבנית על שני ימים נותנת שני אירועים נפרדים', () => {
    const t = tpl();
    const a = templateToEvent(t, '2026-09-20');
    const b = templateToEvent(t, '2026-09-21');
    expect(a.date).not.toBe(b.date);
    expect(a.title).toBe(b.title);
  });
});

describe('רשימת התבניות', () => {
  it('מוסיפה ומנרמלת', () => {
    const out = addTemplate([], tpl({ title: '  חופש  ' }));
    expect(out).toHaveLength(1);
    expect(out![0].title).toBe('חופש');
  });

  it('לא עוברת את התקרה', () => {
    const full = Array.from({ length: MAX_TEMPLATES }, (_, i) => tpl({ title: `t${i}` }));
    expect(addTemplate(full, tpl())).toBeNull();
  });

  it('מעדכנת לפי מזהה', () => {
    const t = tpl();
    const out = updateTemplate([t], { ...t, title: 'מילואים' });
    expect(out[0].title).toBe('מילואים');
    expect(out).toHaveLength(1);
  });

  it('עדכון של תבנית שאינה ברשימה אינו מוסיף אותה', () => {
    const out = updateTemplate([tpl({ id: 'a' })], tpl({ id: 'b', title: 'זרה' }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });

  it('מוחקת לפי מזהה', () => {
    expect(removeTemplate([tpl({ id: 'a' }), tpl({ id: 'b' })], 'a').map((t) => t.id)).toEqual(['b']);
  });
});

describe('templateHint', () => {
  it('"כל היום" לתבנית בלי שעות', () => {
    expect(templateHint(tpl({ allDay: true }))).toBe('כל היום');
  });

  it('שעת ההתחלה כשיש', () => {
    expect(templateHint(tpl({ allDay: false, startTime: '08:30' }))).toBe('08:30');
  });
});

describe('newTemplateId', () => {
  it('לא מתנגש', () => {
    expect(new Set(Array.from({ length: 500 }, newTemplateId)).size).toBe(500);
  });
});
