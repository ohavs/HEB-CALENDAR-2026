/**
 * מאיפה מגיעות ההצעות למקום של אירוע.
 *
 * שתי שכבות, ושתיהן של המשתמש עצמו:
 *   1. המקומות השמורים שלו (בית, עבודה) - הוא כבר טרח להגדיר אותם
 *   2. מקומות שכתב באירועים קודמים - "בית הכנסת", "אצל סבתא"
 *
 * רשימת הערים המובנית **אינה** מקור להצעות. היא נבנתה לזמני שבת, ולכן
 * הצעה ממנה היא רעש: המשתמש שמחפש "בית" מקבל ערים שמעולם לא הזכיר, והן
 * דוחקות את מה שהוא באמת כתב. הערים נשארות בשימוש בבורר העיר של זמני
 * שבת וב-nearestCity() שמתרגם את המיקום הנוכחי לשם - שם הן נכונות.
 *
 * הכול מקומי: אין קריאת רשת, אין מפתח API, והשאילתה של המשתמש לא יוצאת
 * מהמכשיר. חיפוש כתובות חופשי דורש שירות גיאוקודינג חיצוני, ואיתו גם
 * עלות וגם שליחה של כל תו שהמשתמש מקליד לצד שלישי - ראו את הטבלה
 * ב-README. אם וכשזה יידרש, נקודת החיבור היחידה היא suggestLocations()
 * כאן.
 */
import type { SavedPlace, UserEvent } from '@/types';
import { bestScore, normalize } from './search';

export type LocationSuggestion = {
  /** מזהה ייחודי לרשימה */
  key: string;
  /** הכיתוב שיישמר על האירוע */
  label: string;
  /** הסבר קצר מתחת לכיתוב */
  hint?: string;
  kind: 'place' | 'recent';
  /** מזהה מקום שמור, אם זה מקום שמור */
  placeId?: string;
  latitude?: number;
  longitude?: number;
};

/** כמה מקומות אחרונים לזכור */
const MAX_RECENT = 8;

function fromPlace(place: SavedPlace): LocationSuggestion {
  return {
    key: `place:${place.id}`,
    label: place.name,
    hint: 'מקום שמור',
    kind: 'place',
    placeId: place.id,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

/**
 * מקומות שהמשתמש כתב באירועים קודמים, מהחדש לישן.
 * מדלג על מה שכבר מופיע כמקום שמור, כדי לא להציע את אותו דבר פעמיים.
 */
export function recentLocations(events: UserEvent[], places: SavedPlace[]): LocationSuggestion[] {
  const taken = new Set(places.map((p) => normalize(p.name)));
  const seen = new Set<string>();
  const out: LocationSuggestion[] = [];

  for (const ev of [...events].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const label = ev.location?.trim();
    if (!label || ev.deleted) continue;
    const key = normalize(label);
    if (!key || seen.has(key) || taken.has(key)) continue;
    seen.add(key);
    out.push({ key: `recent:${key}`, label, hint: 'מאירוע קודם', kind: 'recent' });
    if (out.length >= MAX_RECENT) break;
  }
  return out;
}

/**
 * ההצעות לתיבת החיפוש. בלי שאילתה מוצגים המקומות השמורים והאחרונים
 * כפי שהם; עם שאילתה הם מסוננים ומדורגים לפי עוצמת ההתאמה.
 *
 * אין מקור שלישי: מה שהמשתמש לא הגדיר ולא כתב - לא יוצע לו. טקסט חופשי
 * תמיד אפשרי, ו-LocationPicker מציע אותו בעצמו.
 */
export function suggestLocations(
  query: string,
  events: UserEvent[],
  places: SavedPlace[],
): LocationSuggestion[] {
  const term = query.trim();
  const all = [...places.map(fromPlace), ...recentLocations(events, places)];

  if (!term) return all;

  // מקום שמור מקבל דחיפה: הוא נבחר במפורש על ידי המשתמש, ולכן סביר
  // יותר ממקום שנכתב פעם אחת באירוע
  const boost: Record<LocationSuggestion['kind'], number> = { place: 6, recent: 0 };

  return all
    .map((s) => ({ s, score: bestScore([s.label, s.hint], term) + boost[s.kind] }))
    .filter((x) => x.score > boost[x.s.kind])
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((x) => x.s);
}

/** קישור שפותח את הנקודה באפליקציית המפות של המכשיר. */
export function mapsUrl(latitude: number, longitude: number, label?: string): string {
  const query = encodeURIComponent(label ? `${latitude},${longitude}(${label})` : `${latitude},${longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
