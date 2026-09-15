/**
 * המודל של הרשימות המשותפות. הכול טהור, ולכן הכול נבדק בלי Firestore.
 *
 * הבדיקה החשובה כאן היא `inviteId`: הכלל ב-firestore.rules מרכיב את אותו
 * מזהה בעצמו מ-`listId` ומהאימייל שבטוקן, ומשווה. אם הנרמול בצד הזה
 * ישתנה, ההצטרפות תיכשל בלי הודעה מובנת - ולכן יש לו בדיקות משלו.
 */
import { describe, expect, it } from 'vitest';
import {
  countByCategory,
  findCategory,
  inviteId,
  isMember,
  isOwner,
  matchesCategory,
  memberLabel,
  newId,
  normalizeEmail,
  type ListCategory,
  type SharedItem,
  type SharedList,
} from './sharedLists';
import { event } from '@/test/factories';

const CATEGORIES: ListCategory[] = [
  { id: 'c1', name: 'קניות', color: 'violet' },
  { id: 'c2', name: 'בית', color: 'rose' },
];

function list(patch: Partial<SharedList> = {}): SharedList {
  return {
    id: 'l1',
    name: 'רשימה',
    color: 'violet',
    ownerUid: 'u1',
    memberUids: ['u1', 'u2'],
    members: {
      u1: { uid: 'u1', name: 'אוהב', email: 'a@example.com', role: 'owner', joinedAt: 0 },
      u2: { uid: 'u2', name: '', email: 'b@example.com', role: 'member', joinedAt: 0 },
    },
    categories: CATEGORIES,
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

function item(patch: Partial<SharedItem> = {}): SharedItem {
  return { ...event(), createdBy: 'u1', ...patch };
}

describe('normalizeEmail', () => {
  it('מוריד רווחים ומאותיות גדולות', () => {
    expect(normalizeEmail('  Foo@Example.COM ')).toBe('foo@example.com');
  });
});

describe('inviteId', () => {
  it('מורכב מהרשימה ומהאימייל, מופרדים בשני קווים תחתונים', () => {
    expect(inviteId('l1', 'a@example.com')).toBe('l1__a@example.com');
  });

  it('אותו נמען באותיות שונות מקבל אותו מזהה', () => {
    // הזמנה חוזרת דורסת את הקודמת במקום לייצר שנייה
    expect(inviteId('l1', 'A@Example.com')).toBe(inviteId('l1', 'a@example.com'));
  });

  it('רשימות שונות לאותו נמען הן הזמנות שונות', () => {
    expect(inviteId('l1', 'a@b.co')).not.toBe(inviteId('l2', 'a@b.co'));
  });
});

describe('חברות ובעלות', () => {
  it('חבר הוא מי שנמצא ב-memberUids', () => {
    expect(isMember(list(), 'u2')).toBe(true);
    expect(isMember(list(), 'u9')).toBe(false);
  });

  it('בלי משתמש - לא חבר ולא בעלים', () => {
    expect(isMember(list(), null)).toBe(false);
    expect(isOwner(list(), null)).toBe(false);
  });

  it('בעלים הוא אחד בלבד', () => {
    expect(isOwner(list(), 'u1')).toBe(true);
    expect(isOwner(list(), 'u2')).toBe(false);
  });
});

describe('memberLabel', () => {
  it('שם כשיש', () => {
    expect(memberLabel(list(), 'u1')).toBe('אוהב');
  });

  it('אימייל כשאין שם', () => {
    expect(memberLabel(list(), 'u2')).toBe('b@example.com');
  });

  it('"חבר" כשמי שיצר כבר אינו ברשימה', () => {
    // פריט שנשאר אחרי שמי שכתב אותו יצא
    expect(memberLabel(list(), 'u9')).toBe('חבר');
  });
});

describe('findCategory', () => {
  it('מוצא לפי מזהה', () => {
    expect(findCategory(list(), 'c2')?.name).toBe('בית');
  });

  it('בלי מזהה, או למזהה שנמחק - undefined', () => {
    expect(findCategory(list(), undefined)).toBeUndefined();
    expect(findCategory(list(), 'נמחקה')).toBeUndefined();
  });
});

describe('matchesCategory', () => {
  it('null הוא הכול', () => {
    expect(matchesCategory(item({ categoryId: 'c1' }), null)).toBe(true);
    expect(matchesCategory(item(), null)).toBe(true);
  });

  it('"none" הוא מה שאין לו קטגוריה', () => {
    expect(matchesCategory(item(), 'none')).toBe(true);
    expect(matchesCategory(item({ categoryId: 'c1' }), 'none')).toBe(false);
  });

  it('מזהה מסנן לקטגוריה אחת', () => {
    expect(matchesCategory(item({ categoryId: 'c1' }), 'c1')).toBe(true);
    expect(matchesCategory(item({ categoryId: 'c2' }), 'c1')).toBe(false);
  });
});

describe('countByCategory', () => {
  const TODAY = '2026-09-15';

  it('סופר לכל קטגוריה ולסך הכול', () => {
    const counts = countByCategory(
      [
        item({ date: TODAY, categoryId: 'c1' }),
        item({ date: TODAY, categoryId: 'c1' }),
        item({ date: TODAY, categoryId: 'c2' }),
        item({ date: TODAY }),
      ],
      TODAY,
    );
    expect(counts.get(null)).toBe(4);
    expect(counts.get('c1')).toBe(2);
    expect(counts.get('c2')).toBe(1);
    expect(counts.get('none')).toBe(1);
  });

  it('מחוק לא נספר', () => {
    const counts = countByCategory([item({ date: TODAY, deleted: true })], TODAY);
    expect(counts.get(null)).toBeUndefined();
  });

  it('מה שסומן כבוצע לא נספר', () => {
    const done = item({ date: TODAY, exceptions: { [TODAY]: { done: true } } });
    expect(countByCategory([done], TODAY).get(null)).toBeUndefined();
  });

  it('פריט עתידי אינו "פתוח"', () => {
    expect(countByCategory([item({ date: '2026-12-01' })], TODAY).get(null)).toBeUndefined();
  });

  it('אבל פריט שעבר כן', () => {
    expect(countByCategory([item({ date: '2026-01-01' })], TODAY).get(null)).toBe(1);
  });

  it('פריט בלי תאריך נספר תמיד, גם כשהתאריך שנשמר לו עתידי', () => {
    // התאריך נשמר כדי שיהיה לו לאן לחזור, והוא לא אמור להשפיע
    const undated = item({ date: '2026-12-01', undated: true });
    expect(countByCategory([undated], TODAY).get(null)).toBe(1);
  });
});

describe('newId', () => {
  it('לא מתנגש בין קריאות סמוכות', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    expect(ids.size).toBe(500);
  });
});
