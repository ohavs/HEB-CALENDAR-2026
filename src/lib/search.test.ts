/**
 * התאמת טקסט בעברית. הבדיקות כאן הן רשימת המקרים שהחיפוש הקודם נכשל
 * בהם: ניקוד, גרשיים, אותיות סופיות וסדר מילים.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bestScore,
  clearRecentSearches,
  matchScore,
  matches,
  normalize,
  recentSearches,
  rememberSearch,
} from './search';

describe('normalize', () => {
  it('מסיר ניקוד', () => {
    expect(normalize('שָׁלוֹם')).toBe(normalize('שלום'));
  });

  it('מסיר גרש וגרשיים עבריים', () => {
    expect(normalize('תשפ״ז')).toBe(normalize('תשפז'));
    expect(normalize('כ׳ בתשרי')).toBe(normalize('כ בתשרי'));
  });

  it('מסיר גם מרכאות לועזיות ומסולסלות', () => {
    expect(normalize('ט"ו בשבט')).toBe(normalize('טו בשבט'));
    expect(normalize('ט’ באב')).toBe(normalize('ט באב'));
  });

  it('מקפל אותיות סופיות', () => {
    expect(normalize('ירושלים')).toBe('ירושלימ');
    expect(normalize('ך ם ן ף ץ')).toBe('כ מ נ פ צ');
    // אותה מילה שנכתבה בסוף ובאמצע נראית זהה אחרי הנרמול
    expect(normalize('חנוכה שמח')).toBe(normalize('חנוכה שמח'));
  });

  it('מאחד מקף ורווחים', () => {
    expect(normalize('ראש־חודש')).toBe(normalize('ראש חודש'));
    expect(normalize('  ראש    השנה  ')).toBe('ראש השנה');
  });

  it('אנגלית הופכת לאותיות קטנות', () => {
    expect(normalize('Rosh HaShana')).toBe('rosh hashana');
  });
});

describe('matchScore', () => {
  it('התאמה מלאה מקבלת את הניקוד הגבוה ביותר', () => {
    expect(matchScore('פורים', 'פורים')).toBe(100);
  });

  it('תחילת מחרוזת גוברת על תחילת מילה', () => {
    expect(matchScore('ראש השנה', 'ראש')).toBeGreaterThan(matchScore('ערב ראש השנה', 'ראש'));
  });

  it('תחילת מילה גוברת על אמצע מילה', () => {
    expect(matchScore('ערב פסח', 'פסח')).toBeGreaterThan(matchScore('אפסחה', 'פסח'));
  });

  it('סדר מילים הפוך עדיין מתאים', () => {
    expect(matchScore('ראש השנה', 'השנה ראש')).toBeGreaterThan(0);
  });

  it('שאילתה ריקה לא מתאימה לכלום', () => {
    expect(matchScore('פורים', '')).toBe(0);
    expect(matchScore('פורים', '   ')).toBe(0);
  });

  it('מה שאין - אין', () => {
    expect(matchScore('פורים', 'חנוכה')).toBe(0);
  });

  it('מוצא חג עם שנה בגימטריה', () => {
    expect(matches('ראש השנה תשפ״ז', 'ראש השנה')).toBe(true);
    expect(matches('ראש השנה תשפ״ז', 'תשפז')).toBe(true);
  });

  it('מוצא למרות ניקוד בטקסט', () => {
    expect(matches('יוֹם כִּיפּוּר', 'יום כיפור')).toBe(true);
  });

  it('כתיב חסר מול כתיב מלא אינו מטופל, וזו החלטה', () => {
    // מרחק עריכה היה מביא תוצאות שגויות בשמות חגים קצרים ודומים
    expect(matches('יום כפור', 'יום כיפור')).toBe(false);
  });

  it('מוצא למרות אות סופית', () => {
    expect(matches('ירושלים', 'ירושלימ')).toBe(true);
  });
});

describe('bestScore', () => {
  it('לוקח את השדה המתאים ביותר', () => {
    expect(bestScore(['הערה על פורים', 'פורים'], 'פורים')).toBe(100);
  });

  it('מדלג על שדות ריקים', () => {
    expect(bestScore([undefined, null, 'פורים'], 'פורים')).toBe(100);
  });

  it('בלי התאמה מחזיר אפס', () => {
    expect(bestScore(['חנוכה', 'סוכות'], 'פסח')).toBe(0);
  });
});

describe('חיפושים אחרונים', () => {
  beforeEach(clearRecentSearches);

  it('נשמר ונקרא', () => {
    rememberSearch('פורים');
    expect(recentSearches()).toEqual(['פורים']);
  });

  it('החדש ביותר ראשון', () => {
    rememberSearch('פורים');
    rememberSearch('חנוכה');
    expect(recentSearches()[0]).toBe('חנוכה');
  });

  it('אותו חיפוש לא נשמר פעמיים', () => {
    rememberSearch('פורים');
    rememberSearch('פורים');
    expect(recentSearches()).toHaveLength(1);
  });

  it('התאמה מנורמלת נחשבת לאותו חיפוש', () => {
    rememberSearch('תשפ״ז');
    rememberSearch('תשפז');
    expect(recentSearches()).toHaveLength(1);
  });

  it('שאילתה קצרה מדי לא נשמרת', () => {
    rememberSearch('א');
    expect(recentSearches()).toHaveLength(0);
  });

  it('נשמרים עד שישה', () => {
    for (const t of ['אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה']) {
      rememberSearch(t);
    }
    expect(recentSearches()).toHaveLength(6);
    expect(recentSearches()[0]).toBe('שבעה');
  });
});
