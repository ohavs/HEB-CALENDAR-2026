/**
 * חיפוש מקום לפי שם - "בית שאן", "רחוב הרצל 5, חולון", "שופרסל רמות".
 *
 * **ההחלטה.** עד כה לא היה חיפוש כלל, כי כל שירות גיאוקודינג פירושו שמה
 * שהמשתמש מקליד יוצא מהמכשיר (ראו הטבלה ב-README). המחיר של היעדרו התברר
 * גדול יותר: בלי נקודת ציון אין התראת הגעה ויציאה, ומקום שנכתב כטקסט
 * חופשי נראה כאילו נשמר ולא עשה דבר. נבחר Photon של Komoot:
 *
 * - בלי מפתח ובלי חיוב, ולכן בלי סוד באפליקציה.
 * - נבנה להשלמה בזמן הקלדה. Nominatim אוסר את זה במפורש במדיניות שלו.
 * - הנתונים של OpenStreetMap, שמחייבים ייחוס - והוא מוצג מתחת לתוצאות.
 *
 * מה שנשלח מצומצם בכוונה: רק השאילתה, ורק מתווים ומעלה ואחרי השהייה
 * בהקלדה. המיקום של המשתמש **אינו** נשלח - ההטיה היא לפי העיר שבהגדרות,
 * שהיא נתון שהמשתמש כבר בחר ולא נקודה שנמדדה.
 *
 * הקובץ טהור למעט `searchPlaces`, נקודת הרשת היחידה.
 */
import type { SavedPlace } from '@/types';
import { distanceMeters } from './geofence';

export const PHOTON_URL = 'https://photon.komoot.io/api/';
/** פחות מזה השאילתה רחבה מדי ומחזירה רעש */
export const MIN_QUERY = 2;
/** השהייה בהקלדה לפני שנשלח משהו */
export const SEARCH_DEBOUNCE_MS = 350;
const LIMIT = 6;

export type PlaceResult = {
  key: string;
  /** מה שיישמר על האירוע ובשם המקום */
  label: string;
  /** פירוט מתחת: רחוב, עיר */
  hint?: string;
  latitude: number;
  longitude: number;
  /** רדיוס מוצע לגדר, לפי סוג המקום */
  radius: number;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string;
    osm_value?: string;
  };
};

/**
 * הרדיוס שמתאים לסוג המקום.
 *
 * עיר אינה נקודה: "כשאגיע לבית שאן" ברדיוס של 150 מטר סביב המרכז היה
 * מצלצל רק למי שעובר בכיכר העירייה. בית או עסק הם כן נקודה.
 */
export function radiusFor(type: string | undefined): number {
  switch (type) {
    case 'city':
    case 'town':
      return 1500;
    case 'village':
    case 'suburb':
    case 'district':
      return 600;
    case 'neighbourhood':
    case 'locality':
    case 'street':
      return 300;
    default:
      return 150;
  }
}

export function searchUrl(query: string, bias?: { latitude: number; longitude: number }): string {
  const params = new URLSearchParams({ q: query.trim(), limit: String(LIMIT) });
  if (bias) {
    params.set('lat', bias.latitude.toFixed(3));
    params.set('lon', bias.longitude.toFixed(3));
  }
  return `${PHOTON_URL}?${params.toString()}`;
}

/** תשובת Photon (GeoJSON) לתוצאות שאפשר להציג ולשמור */
export function parsePhoton(body: unknown): PlaceResult[] {
  const features = (body as { features?: PhotonFeature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const out: PlaceResult[] = [];
  const seen = new Set<string>();

  for (const f of features) {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    const p = f.properties ?? {};
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;

    const address = [p.street, p.housenumber].filter(Boolean).join(' ');
    const label = p.name || address;
    if (!label) continue;

    const place = p.city && p.city !== label ? p.city : p.district || p.state;
    const hint = [p.name && address ? address : '', place, p.countrycode !== 'IL' ? p.country : '']
      .filter(Boolean)
      .join(', ');

    // אותו שם באותה עיר מגיע לפעמים פעמיים - כצומת וכדרך, למשל
    const dedupe = `${label}|${place ?? ''}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    out.push({
      key: `${p.osm_type ?? ''}${p.osm_id ?? `${lat},${lon}`}`,
      label,
      hint: hint || undefined,
      latitude: lat,
      longitude: lon,
      radius: radiusFor(p.type ?? p.osm_value),
    });
  }
  return out;
}

/**
 * מקום שמור שכבר נמצא בנקודה הזו, אם יש.
 *
 * בחירה בתוצאה יוצרת מקום שמור - בלעדיו אין על מה לגדר - ובלי הבדיקה
 * הזו כל אירוע בסופר היה מוסיף עוד "שופרסל" לרשימת המקומות.
 */
export function existingPlaceFor(result: PlaceResult, places: SavedPlace[]): SavedPlace | null {
  for (const place of places) {
    const d = distanceMeters(place.latitude, place.longitude, result.latitude, result.longitude);
    if (d <= Math.max(75, Math.min(place.radius, result.radius) / 2)) return place;
  }
  return null;
}

/** החיפוש עצמו. זורק כשאין רשת או שהשירות נכשל - המסך אומר את זה. */
export async function searchPlaces(
  query: string,
  bias: { latitude: number; longitude: number } | undefined,
  signal: AbortSignal,
): Promise<PlaceResult[]> {
  const res = await fetch(searchUrl(query, bias), { signal });
  if (!res.ok) throw new Error(`photon-${res.status}`);
  return parsePhoton(await res.json());
}
