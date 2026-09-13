/**
 * התראות הגעה ויציאה ממקום שמור.
 *
 * המימוש עוקב אחרי מיקום המכשיר ומשווה אותו למקומות השמורים. לכל מקום
 * נשמר מצב אחרון (בפנים/בחוץ), ורק מעבר בין המצבים מפעיל התראה - כך
 * שריחוף על גבול הרדיוס לא מציף את המשתמש.
 *
 * מגבלה: דפדפן מאפשר מעקב מיקום רק כשהאפליקציה פתוחה או פעילה ברקע.
 * גאו-פנסינג אמיתי ברקע יגיע עם אפליקציית האנדרואיד; כל הלוגיקה כאן
 * (הסף, ההיסטרזיס, ניסוח ההתראה) תישאר כמות שהיא.
 */
import type { SavedPlace } from '@/types';

/** שוליים סביב הרדיוס, כדי שלא יהיו התראות כפולות על הגבול */
const HYSTERESIS_M = 40;
/** דיוק גרוע מזה נחשב לא אמין ומתעלמים ממנו */
const MAX_ACCURACY_M = 120;
/** מרווח מינימלי בין שתי התראות של אותו מקום */
const COOLDOWN_MS = 5 * 60 * 1000;

const STATE_KEY = 'heb-cal:place-state';

type PlaceState = { inside: boolean; lastNotifiedAt: number };
type StateMap = Record<string, PlaceState>;

function loadState(): StateMap {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}') as StateMap;
  } catch {
    return {};
  }
}

function saveState(state: StateMap): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* מצב פרטי */
  }
}

/** מרחק במטרים בין שתי נקודות על פני כדור הארץ. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type GeofenceEvent = {
  place: SavedPlace;
  kind: 'arrive' | 'leave';
  title: string;
  body: string;
};

/**
 * משווה מיקום למקומות השמורים ומחזיר את המעברים שיש להתריע עליהם.
 * פונקציה טהורה למעט קריאה וכתיבה של המצב האחרון, כדי שיהיה קל לבדוק אותה.
 */
export function evaluatePosition(
  places: SavedPlace[],
  coords: { latitude: number; longitude: number; accuracy?: number },
  now = Date.now(),
): GeofenceEvent[] {
  if (coords.accuracy !== undefined && coords.accuracy > MAX_ACCURACY_M) return [];

  const state = loadState();
  const events: GeofenceEvent[] = [];

  for (const place of places) {
    if (!place.notifyOnArrive && !place.notifyOnLeave) continue;

    const distance = distanceMeters(
      coords.latitude,
      coords.longitude,
      place.latitude,
      place.longitude,
    );
    const previous = state[place.id];
    // ההיסטרזיס: נכנסים רק בתוך הרדיוס, ויוצאים רק מעבר לרדיוס והשוליים
    const inside = previous?.inside
      ? distance <= place.radius + HYSTERESIS_M
      : distance <= place.radius;

    if (previous && previous.inside !== inside) {
      const kind = inside ? 'arrive' : 'leave';
      const wanted = inside ? place.notifyOnArrive : place.notifyOnLeave;
      const cooled = now - (previous.lastNotifiedAt ?? 0) > COOLDOWN_MS;
      if (wanted && cooled) {
        events.push({
          place,
          kind,
          title: inside ? `הגעת ל${place.name}` : `יצאת מ${place.name}`,
          body: place.message?.trim() || (inside ? 'ברוך הבא' : 'נסיעה טובה'),
        });
        state[place.id] = { inside, lastNotifiedAt: now };
        continue;
      }
    }

    state[place.id] = { inside, lastNotifiedAt: previous?.lastNotifiedAt ?? 0 };
  }

  saveState(state);
  return events;
}

/* ==========================================================================
   מעקב חי
   ========================================================================== */

let watchId: number | null = null;

export type GeofenceWatchOptions = {
  getPlaces: () => SavedPlace[];
  onEvents: (events: GeofenceEvent[]) => void;
};

/** מתחיל מעקב מיקום. מחזיר פונקציית עצירה. */
export function startGeofenceWatch({
  getPlaces,
  onEvents,
}: GeofenceWatchOptions): () => void {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return () => undefined;
  }
  stopGeofenceWatch();

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const places = getPlaces();
      if (!places.length) return;
      const events = evaluatePosition(places, pos.coords);
      if (events.length) onEvents(events);
    },
    () => {
      /* אין הרשאה או אין קליטה - המעקב פשוט לא יפעל */
    },
    { enableHighAccuracy: false, maximumAge: 30_000, timeout: 60_000 },
  );

  return stopGeofenceWatch;
}

export function stopGeofenceWatch(): void {
  if (watchId !== null && typeof navigator !== 'undefined') {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

/** קריאת מיקום חד-פעמית, לשמירת מקום חדש. */
export function readCurrentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('geolocation-unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

/** "120 מ׳" / "1.2 ק״מ" */
export function radiusLabel(meters: number): string {
  return meters >= 1000 ? `${Math.round(meters / 100) / 10} ק״מ` : `${meters} מ׳`;
}
