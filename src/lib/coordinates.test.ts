/**
 * פענוח נקודת ציון מטקסט שהודבק.
 *
 * כל מקרה כאן הוא פורמט שיוצא ממסלול אמיתי: העתקה ממפות גוגל, שיתוף
 * של מקום, קישור מווייז, או כוונה של אנדרואיד.
 */
import { describe, expect, it } from 'vitest';
import { formatCoordinates, isShortLink, parseCoordinates } from './coordinates';

/** ירושלים, לצורך ההשוואות */
const JLM = { latitude: 31.7683, longitude: 35.2137 };

const near = (actual: ReturnType<typeof parseCoordinates>, expected: typeof JLM, eps = 0.01) => {
  expect(actual).not.toBeNull();
  expect(Math.abs(actual!.latitude - expected.latitude)).toBeLessThan(eps);
  expect(Math.abs(actual!.longitude - expected.longitude)).toBeLessThan(eps);
};

describe('זוג עשרוני', () => {
  it('עם פסיק ורווח', () => {
    expect(parseCoordinates('31.7683, 35.2137')).toEqual(JLM);
  });

  it('עם פסיק בלי רווח', () => {
    expect(parseCoordinates('31.7683,35.2137')).toEqual(JLM);
  });

  it('עם רווח בלבד', () => {
    expect(parseCoordinates('31.7683 35.2137')).toEqual(JLM);
  });

  it('עם רווחים מיותרים מסביב', () => {
    expect(parseCoordinates('  31.7683, 35.2137  ')).toEqual(JLM);
  });

  it('מספרים שליליים', () => {
    expect(parseCoordinates('-33.8688, 151.2093')).toEqual({
      latitude: -33.8688,
      longitude: 151.2093,
    });
  });

  it('מספרים שלמים', () => {
    expect(parseCoordinates('32, 35')).toEqual({ latitude: 32, longitude: 35 });
  });

  it('טקסט שיש בו מספרים אבל אינו נקודת ציון נדחה', () => {
    expect(parseCoordinates('רחוב הרצל 5, תל אביב')).toBeNull();
    expect(parseCoordinates('פגישה ב-3 ל-4')).toBeNull();
  });
});

describe('מעלות־דקות־שניות', () => {
  it('הפורמט שמוצג בלוח המידע של מפות גוגל', () => {
    near(parseCoordinates(`31°46'05.9"N 35°12'49.3"E`), JLM);
  });

  it('עם פסיק בין הצירים', () => {
    near(parseCoordinates(`31°46'05.9"N, 35°12'49.3"E`), JLM);
  });

  it('חצי כדור דרומי ומערבי', () => {
    const out = parseCoordinates(`33°51'24.0"S 151°12'33.0"W`);
    expect(out!.latitude).toBeLessThan(0);
    expect(out!.longitude).toBeLessThan(0);
  });
});

describe('קישורים של מפות גוגל', () => {
  it('שיתוף של מקום - הנקודה המדויקת מ-data גוברת על מרכז המפה', () => {
    const url =
      'https://www.google.com/maps/place/Western+Wall/@31.7000,35.2000,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d31.7683!4d35.2137';
    expect(parseCoordinates(url)).toEqual(JLM);
  });

  it('מרכז המפה, כשאין נקודה מדויקת', () => {
    near(parseCoordinates('https://www.google.com/maps/@31.7683,35.2137,17z'), JLM);
  });

  it('קישור חיפוש עם q', () => {
    expect(parseCoordinates('https://www.google.com/maps?q=31.7683,35.2137')).toEqual(JLM);
  });

  it('קישור חיפוש עם query', () => {
    expect(
      parseCoordinates('https://www.google.com/maps/search/?api=1&query=31.7683,35.2137'),
    ).toEqual(JLM);
  });

  it('קישור עם ll', () => {
    expect(parseCoordinates('https://maps.google.com/maps?ll=31.7683,35.2137&z=17')).toEqual(JLM);
  });

  it('קישור חיפוש לפי שם, בלי נקודת ציון, נדחה', () => {
    expect(
      parseCoordinates('https://www.google.com/maps/search/?api=1&query=הכותל+המערבי'),
    ).toBeNull();
  });
});

describe('שירותי מפות אחרים', () => {
  it('מפות של אפל', () => {
    expect(parseCoordinates('https://maps.apple.com/?ll=31.7683,35.2137')).toEqual(JLM);
  });

  it('ווייז', () => {
    expect(parseCoordinates('https://waze.com/ul?ll=31.7683,35.2137&navigate=yes')).toEqual(JLM);
  });

  it('כוונת geo של אנדרואיד', () => {
    expect(parseCoordinates('geo:31.7683,35.2137')).toEqual(JLM);
  });

  it('geo עם פרמטרים נוספים', () => {
    expect(parseCoordinates('geo:31.7683,35.2137?z=17')).toEqual(JLM);
  });
});

describe('ערכים מחוץ לתחום', () => {
  it('קו רוחב מעל 90 נדחה', () => {
    expect(parseCoordinates('91, 35')).toBeNull();
  });

  it('קו אורך מעל 180 נדחה', () => {
    expect(parseCoordinates('31, 181')).toBeNull();
  });

  it('קצוות התחום מתקבלים', () => {
    expect(parseCoordinates('90, 180')).toEqual({ latitude: 90, longitude: 180 });
    expect(parseCoordinates('-90, -180')).toEqual({ latitude: -90, longitude: -180 });
  });
});

describe('קלט ריק ופגום', () => {
  it('מחרוזת ריקה', () => {
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('   ')).toBeNull();
  });

  it('כתובת פגומה לא מפילה כלום', () => {
    expect(parseCoordinates('https://')).toBeNull();
    expect(parseCoordinates('http://[')).toBeNull();
  });

  it('טקסט אקראי', () => {
    expect(parseCoordinates('שלום')).toBeNull();
  });
});

describe('isShortLink', () => {
  it('מזהה קישור מקוצר של גוגל', () => {
    expect(isShortLink('https://maps.app.goo.gl/abc123')).toBe(true);
    expect(isShortLink('https://goo.gl/maps/abc123')).toBe(true);
  });

  it('מזהה קישור מקוצר של אפל', () => {
    expect(isShortLink('https://maps.apple.com/p/abc123')).toBe(true);
  });

  it('קישור מלא אינו מקוצר', () => {
    expect(isShortLink('https://www.google.com/maps?q=31.7683,35.2137')).toBe(false);
  });

  it('נקודת ציון אינה קישור', () => {
    expect(isShortLink('31.7683, 35.2137')).toBe(false);
  });
});

describe('formatCoordinates', () => {
  it('מציג חמש ספרות אחרי הנקודה', () => {
    expect(formatCoordinates(JLM)).toBe('31.76830, 35.21370');
  });
});
