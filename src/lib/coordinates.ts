/**
 * פענוח נקודת ציון מטקסט שהמשתמש הדביק.
 *
 * הבעיה שזה פותר: כדי להגדיר מקום שמור צריך היה לעמוד בו פיזית, כי
 * הדרך היחידה לקבוע נקודת ציון הייתה "המיקום הנוכחי שלי". המסלול
 * המעשי להגדיר את הבית מהספה הוא לפתוח מפות, ללחוץ לחיצה ארוכה על
 * הנקודה, ולהעתיק - או את הקואורדינטות או את הקישור.
 *
 * לכן נתמכים כאן כל הפורמטים שיוצאים מהמסלול הזה, ובלי שום קריאת רשת:
 *
 *   31.7683, 35.2137                       העתקה ישירה ממפות גוגל
 *   31°46'05.9"N 35°12'49.3"E              מה שמוצג בלוח המידע בדסקטופ
 *   google.com/maps/place/…/@31.76,35.21   שיתוף של מקום
 *   google.com/maps?q=31.7683,35.2137      קישור חיפוש
 *   maps.apple.com/?ll=31.7683,35.2137     מפות של אפל
 *   waze.com/ul?ll=31.7683,35.2137         ווייז
 *   geo:31.7683,35.2137                    כוונה של אנדרואיד
 *
 * מה שלא נתמך, ולמה: קישור מקוצר (maps.app.goo.gl) מצריך לפתוח אותו
 * כדי לדעת לאן הוא מצביע, וזו קריאת רשת שהדפדפן חוסם ממילא ב-CORS.
 * `isShortLink()` מזהה את המקרה כדי שאפשר יהיה לומר למשתמש מה לעשות,
 * במקום להיכשל בשקט.
 */

export type Coordinates = { latitude: number; longitude: number };

const LAT_LIMIT = 90;
const LNG_LIMIT = 180;

function valid(latitude: number, longitude: number): Coordinates | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > LAT_LIMIT || Math.abs(longitude) > LNG_LIMIT) return null;
  return { latitude, longitude };
}

/** מעלות־דקות־שניות למעלות עשרוניות. */
function fromDms(deg: string, min: string, sec: string, hemisphere: string): number {
  const value = Number(deg) + Number(min || 0) / 60 + Number(sec || 0) / 3600;
  return /[SW]/i.test(hemisphere) ? -value : value;
}

const DMS_PAIR =
  /(\d{1,3})[°\s]\s*(\d{1,2})['′\s]\s*([\d.]+)?["″\s]*\s*([NSns])[,\s]+(\d{1,3})[°\s]\s*(\d{1,2})['′\s]\s*([\d.]+)?["″\s]*\s*([EWew])/;

/** זוג מספרים עשרוניים, עם פסיק או רווח ביניהם. */
const DECIMAL_PAIR = /(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)/;

/**
 * הנקודה המדויקת שמפות גוגל שומרת ב-data של הקישור.
 * מדויקת יותר מ-@, שהוא מרכז המפה ולא בהכרח המקום עצמו.
 */
const GOOGLE_PLACE = /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/;

/** מרכז המפה בקישור של גוגל. */
const GOOGLE_CENTER = /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/;

/** פרמטרים שנושאים נקודת ציון בשירותי המפות השונים. */
const PARAM_KEYS = ['q', 'll', 'query', 'daddr', 'saddr', 'center', 'destination'];

/** האם זה קישור מקוצר, שאי אפשר לפענח בלי לפתוח אותו. */
export function isShortLink(text: string): boolean {
  return /\b(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|maps\.apple\.com\/p\/)/i.test(text);
}

/**
 * מחלץ נקודת ציון מטקסט חופשי. מחזיר null כשאין שם נקודה תקינה.
 */
export function parseCoordinates(text: string): Coordinates | null {
  const input = text.trim();
  if (!input) return null;

  // geo:31.7683,35.2137 - כוונת מפות של אנדרואיד
  const geo = /^geo:(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i.exec(input);
  if (geo) return valid(Number(geo[1]), Number(geo[2]));

  // הנקודה המדויקת בקישור של גוגל גוברת על מרכז המפה
  const exact = GOOGLE_PLACE.exec(input);
  if (exact) return valid(Number(exact[1]), Number(exact[2]));

  // פרמטרים מפורשים בכתובת
  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      for (const key of PARAM_KEYS) {
        const raw = url.searchParams.get(key);
        if (!raw) continue;
        const pair = DECIMAL_PAIR.exec(raw);
        if (pair) {
          const found = valid(Number(pair[1]), Number(pair[2]));
          if (found) return found;
        }
      }
    } catch {
      /* כתובת פגומה - ממשיכים לנסות את שאר הדפוסים */
    }

    const center = GOOGLE_CENTER.exec(input);
    if (center) return valid(Number(center[1]), Number(center[2]));
  }

  // מעלות־דקות־שניות, כפי שמוצג בלוח המידע של מפות גוגל
  const dms = DMS_PAIR.exec(input);
  if (dms) {
    return valid(
      fromDms(dms[1], dms[2], dms[3], dms[4]),
      fromDms(dms[5], dms[6], dms[7], dms[8]),
    );
  }

  // זוג עשרוני פשוט. רק כשזה כל מה שיש בטקסט, אחרת כל מחרוזת עם שני
  // מספרים הייתה מתפרשת כנקודת ציון.
  const plain = /^(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(input);
  if (plain) return valid(Number(plain[1]), Number(plain[2]));

  return null;
}

/** כיתוב קריא לנקודת ציון. */
export function formatCoordinates(coords: Coordinates): string {
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
}
