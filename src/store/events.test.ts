/**
 * מיזוג מהענן וזיהוי התנגשויות.
 *
 * הכלל הוא last-write-wins, ואין כוונה לשנות אותו - אבל המקרה שבו הוא
 * דורס עבודה מקומית שטרם נדחפה חייב להיות גלוי למשתמש ולא להיבלע.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useEventsStore } from './events';
import { event } from '@/test/factories';

const store = () => useEventsStore.getState();

/** מאפס את החנות בין בדיקות, כולל ההתנגשויות. */
beforeEach(() => {
  useEventsStore.setState({ byId: {}, conflicts: [], revision: 0 });
});

function seed(...events: ReturnType<typeof event>[]) {
  useEventsStore.setState({
    byId: Object.fromEntries(events.map((e) => [e.id, e])),
  });
}

describe('mergeRemote', () => {
  it('מקבל אירוע חדש מהענן', () => {
    const remote = event({ id: 'a' });
    store().mergeRemote([remote]);
    expect(store().byId.a).toEqual(remote);
  });

  it('גרסה חדשה יותר מהענן מנצחת', () => {
    seed(event({ id: 'a', title: 'ישן', updatedAt: 100 }));
    store().mergeRemote([event({ id: 'a', title: 'חדש', updatedAt: 200 })]);
    expect(store().byId.a.title).toBe('חדש');
  });

  it('גרסה ישנה יותר מהענן נדחית', () => {
    seed(event({ id: 'a', title: 'מקומי', updatedAt: 300 }));
    store().mergeRemote([event({ id: 'a', title: 'ענן ישן', updatedAt: 200 })]);
    expect(store().byId.a.title).toBe('מקומי');
  });

  it('אותה חותמת זמן משאירה את המקומי', () => {
    seed(event({ id: 'a', title: 'מקומי', updatedAt: 200 }));
    store().mergeRemote([event({ id: 'a', title: 'ענן', updatedAt: 200 })]);
    expect(store().byId.a.title).toBe('מקומי');
  });

  it('סימון מחיקה מהענן מתקבל', () => {
    seed(event({ id: 'a', updatedAt: 100 }));
    store().mergeRemote([event({ id: 'a', updatedAt: 200, deleted: true })]);
    expect(store().byId.a.deleted).toBe(true);
  });
});

describe('זיהוי התנגשות', () => {
  it('דריסה של אירוע מסונכרן אינה התנגשות', () => {
    seed(event({ id: 'a', title: 'ישן', updatedAt: 100 }));
    // הסט ריק: אין שינוי מקומי שטרם נדחף
    store().mergeRemote([event({ id: 'a', title: 'חדש', updatedAt: 200 })], new Set());
    expect(store().conflicts).toHaveLength(0);
  });

  it('דריסה של שינוי מקומי שטרם נדחף היא התנגשות', () => {
    const local = event({ id: 'a', title: 'מה שכתבתי', updatedAt: 100 });
    seed(local);
    store().mergeRemote(
      [event({ id: 'a', title: 'מה שהמכשיר השני כתב', updatedAt: 200 })],
      new Set(['a']),
    );
    expect(store().conflicts).toHaveLength(1);
    expect(store().conflicts[0].local.title).toBe('מה שכתבתי');
    expect(store().conflicts[0].remote.title).toBe('מה שהמכשיר השני כתב');
    // הענן עדיין מנצח - רק שעכשיו זה גלוי
    expect(store().byId.a.title).toBe('מה שהמכשיר השני כתב');
  });

  it('אירוע חדש לגמרי מהענן אינו התנגשות', () => {
    store().mergeRemote([event({ id: 'new' })], new Set(['new']));
    expect(store().conflicts).toHaveLength(0);
  });

  it('אירוע שנמחק מקומית אינו מייצר התנגשות', () => {
    seed(event({ id: 'a', updatedAt: 100, deleted: true }));
    store().mergeRemote([event({ id: 'a', updatedAt: 200 })], new Set(['a']));
    expect(store().conflicts).toHaveLength(0);
  });

  it('התנגשות שנייה על אותו אירוע מחליפה את הראשונה', () => {
    seed(event({ id: 'a', title: 'ראשון', updatedAt: 100 }));
    store().mergeRemote([event({ id: 'a', title: 'ענן א', updatedAt: 200 })], new Set(['a']));
    store().mergeRemote([event({ id: 'a', title: 'ענן ב', updatedAt: 300 })], new Set(['a']));
    expect(store().conflicts).toHaveLength(1);
    expect(store().conflicts[0].remote.title).toBe('ענן ב');
  });

  it('כמה התנגשויות נשמרות יחד', () => {
    seed(event({ id: 'a', updatedAt: 100 }), event({ id: 'b', updatedAt: 100 }));
    store().mergeRemote(
      [event({ id: 'a', updatedAt: 200 }), event({ id: 'b', updatedAt: 200 })],
      new Set(['a', 'b']),
    );
    expect(store().conflicts).toHaveLength(2);
  });
});

describe('פתרון התנגשות', () => {
  function conflict() {
    seed(event({ id: 'a', title: 'שלי', updatedAt: 100 }));
    store().mergeRemote([event({ id: 'a', title: 'שלהם', updatedAt: 200 })], new Set(['a']));
  }

  it('החזרת הגרסה המקומית מחזירה את התוכן', () => {
    conflict();
    store().keepLocalVersion('a');
    expect(store().byId.a.title).toBe('שלי');
    expect(store().conflicts).toHaveLength(0);
  });

  it('הגרסה שהוחזרה מקבלת חותמת זמן חדשה כדי שתנצח בדחיפה הבאה', () => {
    conflict();
    const remoteAt = store().byId.a.updatedAt;
    store().keepLocalVersion('a');
    expect(store().byId.a.updatedAt).toBeGreaterThan(remoteAt);
  });

  it('ויתור משאיר את הגרסה מהענן', () => {
    conflict();
    store().dismissConflict('a');
    expect(store().byId.a.title).toBe('שלהם');
    expect(store().conflicts).toHaveLength(0);
  });

  it('ניקוי מסיר את כולן', () => {
    seed(event({ id: 'a', updatedAt: 100 }), event({ id: 'b', updatedAt: 100 }));
    store().mergeRemote(
      [event({ id: 'a', updatedAt: 200 }), event({ id: 'b', updatedAt: 200 })],
      new Set(['a', 'b']),
    );
    store().clearConflicts();
    expect(store().conflicts).toHaveLength(0);
  });

  it('יציאה מהחשבון מנקה גם את ההתנגשויות', () => {
    conflict();
    store().clearLocal();
    expect(store().conflicts).toHaveLength(0);
    expect(Object.keys(store().byId)).toHaveLength(0);
  });
});

describe('חריגים בחנות', () => {
  it('עדכון מופע יוצר חריג לפי התאריך המקורי', () => {
    seed(event({ id: 'a', date: '2026-09-07', repeat: 'weekly' }));
    store().updateOccurrence('a', '2026-09-14', { title: 'מיוחד' });
    expect(store().byId.a.exceptions?.['2026-09-14'].title).toBe('מיוחד');
  });

  it('עדכונים חוזרים על אותו מופע מתמזגים', () => {
    seed(event({ id: 'a', date: '2026-09-07', repeat: 'weekly' }));
    store().updateOccurrence('a', '2026-09-14', { title: 'מיוחד' });
    store().updateOccurrence('a', '2026-09-14', { startTime: '21:00' });
    const ex = store().byId.a.exceptions!['2026-09-14'];
    expect(ex.title).toBe('מיוחד');
    expect(ex.startTime).toBe('21:00');
  });

  it('החזרת מופע למקומו מוחקת את החריג', () => {
    seed(event({ id: 'a', date: '2026-09-07', repeat: 'weekly' }));
    store().moveOccurrence('a', '2026-09-14', '2026-09-16');
    expect(store().byId.a.exceptions).toBeDefined();
    store().moveOccurrence('a', '2026-09-14', '2026-09-14');
    expect(store().byId.a.exceptions).toBeUndefined();
  });

  it('שינוי כלל החזרה מנקה חריגים שכבר לא מצביעים על מופע', () => {
    seed(event({ id: 'a', date: '2026-09-07', repeat: 'weekly' }));
    store().updateOccurrence('a', '2026-09-14', { cancelled: true });
    store().update('a', { repeat: 'monthly' });
    expect(store().byId.a.exceptions).toBeUndefined();
  });

  it('שינוי כותרת בסדרה לא נוגע בחריגים', () => {
    seed(event({ id: 'a', date: '2026-09-07', repeat: 'weekly' }));
    store().updateOccurrence('a', '2026-09-14', { cancelled: true });
    store().update('a', { title: 'שם חדש' });
    expect(store().byId.a.exceptions?.['2026-09-14'].cancelled).toBe(true);
  });

  it('ביטול מופע נשמר כחריג', () => {
    seed(event({ id: 'a', date: '2026-09-07', repeat: 'weekly' }));
    store().cancelOccurrence('a', '2026-09-21');
    expect(store().byId.a.exceptions?.['2026-09-21'].cancelled).toBe(true);
  });
});

describe('סימון מופע כבוצע', () => {
  it('הסימון נשמר כחריג על המופע', () => {
    seed(event({ id: 'a', date: '2026-09-07', repeat: 'weekly' }));
    store().setOccurrenceDone('a', '2026-09-14', true);
    expect(store().byId.a.exceptions?.['2026-09-14'].done).toBe(true);
  });

  it('מופע אחד בסדרה לא מסמן את השאר', () => {
    seed(event({ id: 'a', date: '2026-09-07', repeat: 'weekly' }));
    store().setOccurrenceDone('a', '2026-09-14', true);
    expect(store().byId.a.exceptions?.['2026-09-21']).toBeUndefined();
  });

  it('ביטול הסימון מוחק את החריג ולא משאיר false', () => {
    seed(event({ id: 'a', date: '2026-09-07', repeat: 'weekly' }));
    store().setOccurrenceDone('a', '2026-09-14', true);
    store().setOccurrenceDone('a', '2026-09-14', false);
    expect(store().byId.a.exceptions).toBeUndefined();
  });

  it('ביטול הסימון לא מוחק שינויים אחרים שיש למופע', () => {
    seed(event({ id: 'a', date: '2026-09-07', repeat: 'weekly' }));
    store().updateOccurrence('a', '2026-09-14', { title: 'שם למופע הזה' });
    store().setOccurrenceDone('a', '2026-09-14', true);
    store().setOccurrenceDone('a', '2026-09-14', false);
    expect(store().byId.a.exceptions?.['2026-09-14']).toEqual({ title: 'שם למופע הזה' });
  });

  it('אירוע שאינו קיים אינו מפיל כלום', () => {
    expect(() => store().setOccurrenceDone('missing', '2026-09-14', true)).not.toThrow();
  });
});
