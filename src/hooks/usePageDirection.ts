/**
 * כיוון המעבר האחרון בין עמודים - חודשים או שבועות - לאנימציה.
 *
 * נגזר מהמפתח עצמו ולא נמסר מבחוץ. כשכל קורא העביר כיוון משלו, היה די
 * באחד ששכח - חיצים שלא עברו דרך ההחלקה, בחירת יום בחודש הסמוך - כדי
 * שהחודש הבא ייכנס כאילו חזרנו אחורה. המפתחות הם `YYYY-MM` או
 * `YYYY-MM-DD`, ולכן השוואת מחרוזות היא השוואת זמנים.
 */
import { useState } from 'react';

export function usePageDirection(key: string): number {
  const [shown, setShown] = useState({ key, direction: 0 });
  if (shown.key !== key) {
    // עדכון בזמן הציור, לפי התבנית של React ל"מצב שנגזר מ-props":
    // הכיוון חייב להיות נכון כבר בציור שבו המפתח התחלף, לא בזה שאחריו
    const next = { key, direction: key > shown.key ? 1 : -1 };
    setShown(next);
    return next.direction;
  }
  return shown.direction;
}
