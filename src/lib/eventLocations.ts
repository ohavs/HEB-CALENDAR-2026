/**
 * מאיפה מגיעות ההצעות למקום של אירוע.
 *
 * שלוש שכבות, לפי מה שסביר שהמשתמש יבחר:
 *   1. המקומות השמורים שלו (בית, עבודה) - הוא כבר טרח להגדיר אותם
 *   2. מקומות שכתב באירועים קודמים - "בית הכנסת", "אצל סבתא"
 *   3. ערים מהרשימה המובנית
 *
 * כל השלוש מקומיות לגמרי: אין קריאת רשת, אין מפתח API, והשאילתה של
 * המשתמש לא יוצאת מהמכשיר. חיפוש כתובות חופשי דורש שירות גיאוקודינג
 * חיצוני, ואיתו גם עלות וגם שליחה של כל תו שהמשתמש מקליד לצד שלישי -
 * ראו את הטבלה ב-README. אם וכשזה יידרש, נקודת החיבור היחידה היא
 * suggestLocations() כאן.
 */
import type { GeoCity, SavedPlace, UserEvent } from '@/types';
import { CITIES } from './locations';
import { bestScore, normalize } from './search';

export type LocationSuggestion = {
  /** מזהה ייחודי לרשימה */
  key: string;
  /** הכיתוב שיישמר על האירוע */
  label: string;
  /** הסבר קצר מתחת לכיתוב */
  hint?: string;
  kind: 'place' | 'recent' | 'city';
  /** מזהה מקום שמור, אם זה מקום שמור */
  placeId?: string;
  latitude?: number;
  longitude?: number;
};

/** כמה מקומות אחרונים לזכור */
const MAX_RECENT = 8;
/** כמה ערים להציע בלי שאילתה */
const MAX_CITIES = 8;

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

function fromCity(city: GeoCity): LocationSuggestion {
  return {
    key: `city:${city.id}`,
    label: city.name,
    hint: city.region,
    kind: 'city',
    latitude: city.latitude,
    longitude: city.longitude,
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
 * ההצעות לתיבת החיפוש. בלי שאילתה מוצגים המקומות השמורים, האחרונים,
 * וכמה ערים; עם שאילתה הכול מסונן ומדורג לפי עוצמת ההתאמה.
 */
export function suggestLocations(
  query: string,
  events: UserEvent[],
  places: SavedPlace[],
): LocationSuggestion[] {
  const term = query.trim();
  const saved = places.map(fromPlace);
  const recent = recentLocations(events, places);

  if (!term) {
    return [...saved, ...recent, ...CITIES.slice(0, MAX_CITIES).map(fromCity)];
  }

  const all = [...saved, ...recent, ...CITIES.map(fromCity)];
  // מקום שמור מקבל דחיפה: הוא נבחר במפורש על ידי המשתמש, ולכן סביר
  // יותר מעיר שסתם נמצאת ברשימה
  const boost: Record<LocationSuggestion['kind'], number> = { place: 12, recent: 6, city: 0 };

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
