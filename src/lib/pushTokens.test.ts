/**
 * מזהה המסמך של טוקן push.
 *
 * הוא נגזר מהטוקן ולא אקראי, כדי שאותו מכשיר שנרשם שוב ידרוס את עצמו.
 * מזהה אקראי היה מוסיף שורה בכל פתיחה, וכל הזמנה הייתה נשלחת לאותו
 * מכשיר עשרות פעמים.
 */
import { describe, expect, it } from 'vitest';
import { __tokenId as tokenId } from './pushTokens';

describe('tokenId', () => {
  it('יציב: אותו טוקן נותן אותו מזהה', () => {
    expect(tokenId('abc123')).toBe(tokenId('abc123'));
  });

  it('טוקנים שונים נותנים מזהים שונים', () => {
    expect(tokenId('abc123')).not.toBe(tokenId('abc124'));
  });

  it('מחזיר מזהה מסמך חוקי - בלי / ובלי רווחים', () => {
    const id = tokenId('fMEP:APA91bH-x_y/z 123');
    expect(id).toMatch(/^[a-z0-9]+$/);
    expect(id.length).toBeGreaterThanOrEqual(7);
  });

  it('עמיד לטוקן ארוך כמו שה-FCM מנפיק', () => {
    expect(tokenId('x'.repeat(200))).toMatch(/^[a-z0-9]+$/);
  });

  it('אין התנגשות על טוקנים ריאליסטיים', () => {
    const ids = new Set(
      Array.from({ length: 2000 }, (_, i) => tokenId(`fMEP:APA91bH${i}_${'z'.repeat(140)}`)),
    );
    expect(ids.size).toBe(2000);
  });
});
