/**
 * רשימת התזכורות.
 *
 * מה שנבדק כאן הוא ההבחנה שכל המסך עומד עליה: פריט בלי תאריך אינו קיים
 * בלוח בכלל, ופריט עם תאריך הוא מופע רגיל לכל דבר. שבירה של ההבחנה הזו
 * מחזירה תזכורות "בלי תאריך" לתוך רשת החודש.
 */
import { describe, expect, it } from 'vitest';
import { buildReminderGroups, pendingCount, undatedReminders } from './reminders';
import { expandEvents } from './recurrence';
import { buildDays } from './hebrew';
import { addDays, dateKey } from './dates';
import { buildOptions, event } from '@/test/factories';

const NOW = new Date(2026, 8, 14, 10, 0);
const TODAY = dateKey(NOW);

const days = buildDays(NOW, addDays(NOW, 40), buildOptions() as never);

function groups(...events: ReturnType<typeof event>[]) {
  const occurrences = expandEvents(events, NOW, addDays(NOW, 130));
  return buildReminderGroups(events, occurrences, days, NOW, 40);
}

describe('תזכורת בלי תאריך', () => {
  it('אינה מופיעה בלוח', () => {
    const ev = event({ date: TODAY, undated: true });
    expect(expandEvents([ev], NOW, addDays(NOW, 10)).size).toBe(0);
  });

  it('נאספת לקבוצה משלה בראש הרשימה', () => {
    const out = groups(event({ date: TODAY, undated: true, title: 'לבדוק משהו' }));
    expect(out[0].key).toBe('undated');
    expect(out[0].items[0].title).toBe('לבדוק משהו');
  });

  it('החדשות למעלה', () => {
    const a = event({ date: TODAY, undated: true, title: 'ראשונה', createdAt: 1 });
    const b = event({ date: TODAY, undated: true, title: 'שנייה', createdAt: 2 });
    expect(undatedReminders([a, b]).map((i) => i.title)).toEqual(['שנייה', 'ראשונה']);
  });

  it('אירוע מחוק אינו נספר', () => {
    expect(undatedReminders([event({ undated: true, deleted: true })])).toHaveLength(0);
  });
});

describe('קבוצות לפי יום', () => {
  it('היום מוצג גם כשהוא ריק, כדי שיהיה לאן לגרור', () => {
    const out = groups();
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe(TODAY);
    expect(out[0].items).toHaveLength(0);
  });

  it('ימים ריקים אחרים אינם מוצגים', () => {
    const out = groups(event({ date: dateKey(addDays(NOW, 3)) }));
    expect(out.map((g) => g.key)).toEqual([TODAY, dateKey(addDays(NOW, 3))]);
  });

  it('לכל קבוצה כיתוב מוכן ותאריך עברי', () => {
    const out = groups(event({ date: TODAY }));
    expect(out[0].label).toBe('היום');
    expect(out[0].hebrew).toMatch(/[א-ת]/);
  });

  it('אירוע חוזר מופיע בכל מופע', () => {
    const out = groups(event({ date: TODAY, repeat: 'weekly' }));
    expect(out.map((g) => g.key)).toContain(dateKey(addDays(NOW, 7)));
  });

  it('הקבוצה בלי תאריך תמיד ראשונה', () => {
    const out = groups(
      event({ date: TODAY, title: 'היום' }),
      event({ date: TODAY, undated: true, title: 'בלי' }),
    );
    expect(out[0].key).toBe('undated');
    expect(out[1].key).toBe(TODAY);
  });
});

describe('סימני הפריט', () => {
  it('מסמן התראת מיקום', () => {
    const out = groups(event({ date: TODAY, placeId: 'home', placeTrigger: 'arrive' }));
    expect(out[0].items[0].hasPlace).toBe(true);
  });

  it('מסמן תזכורת בזמן', () => {
    const out = groups(event({ date: TODAY, reminderMinutes: 15 }));
    expect(out[0].items[0].hasAlarm).toBe(true);
  });

  it('שעה ריקה לפריט של כל היום', () => {
    const out = groups(event({ date: TODAY, allDay: true, startTime: null }));
    expect(out[0].items[0].time).toBe('');
  });

  it('סימון בוצע נקרא מהחריג', () => {
    const out = groups(event({ date: TODAY, exceptions: { [TODAY]: { done: true } } }));
    expect(out[0].items[0].done).toBe(true);
  });
});

describe('pendingCount', () => {
  it('מפריד בין מה שאין לו תאריך למה שפתוח היום', () => {
    const out = groups(
      event({ date: TODAY }),
      event({ date: TODAY, exceptions: { [TODAY]: { done: true } } }),
      event({ date: TODAY, undated: true }),
    );
    expect(pendingCount(out, TODAY)).toEqual({ undated: 1, today: 1 });
  });

  /*
    זה הממצא שבגללו הפונקציה הוחלפה: שיעור שבועי אחד תרם למונה הישן
    כ-17 "פתוחים" לאורך האופק, ויום הולדת שנתי נספר כמשימה.
  */
  it('אירוע חוזר נספר פעם אחת ולא לאורך כל האופק', () => {
    const out = groups(event({ date: TODAY, repeat: 'weekly' }));
    expect(pendingCount(out, TODAY)).toEqual({ undated: 0, today: 1 });
    // ובכל זאת הוא מופיע בכל שבוע ברשימה עצמה
    expect(out.filter((g) => g.items.length).length).toBeGreaterThan(3);
  });

  it('יום עתידי אינו נספר', () => {
    const tomorrow = dateKey(addDays(NOW, 1));
    const out = groups(event({ date: tomorrow }));
    expect(pendingCount(out, TODAY)).toEqual({ undated: 0, today: 0 });
  });
});
