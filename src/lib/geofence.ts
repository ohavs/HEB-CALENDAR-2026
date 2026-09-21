/**
 * התראות מבוססות מיקום לאירועים.
 *
 * ההתראה שייכת לאירוע ולא למקום: המקום אומר *איפה*, והאירוע אומר *על
 * מה* ו*מתי*. קודם הדגלים ישבו על המקום עצמו, וכך אי אפשר היה להבחין
 * בין שתי תזכורות שונות באותו בית.
 *
 * המימוש עוקב אחרי מיקום המכשיר ומשווה אותו למקומות השמורים. לכל מקום
 * נשמר מצב אחרון (בפנים/בחוץ), ורק מעבר בין המצבים מפעיל התראה - כך
 * שריחוף על גבול הרדיוס לא מציף את המשתמש.
 *
 * מגבלה: דפדפן מאפשר מעקב מיקום רק כשהאפליקציה פתוחה או פעילה ברקע.
 * גאו-פנסינג אמיתי ברקע יגיע עם אפליקציית האנדרואיד; כל הלוגיקה כאן
 * (הסף, ההיסטרזיס, ניסוח ההתראה) תישאר כמות שהיא.
 */
import type { PlaceTrigger, SavedPlace } from '@/types';
import { isNative, readNativePosition, watchNativePosition } from './native';
import type { Occurrence } from './recurrence';
import { dateKey } from './dates';

/** שוליים סביב הרדיוס, כדי שלא יהיו התראות כפולות על הגבול */
const HYSTERESIS_M = 40;
/** דיוק גרוע מזה נחשב לא אמין ומתעלמים ממנו */
const MAX_ACCURACY_M = 120;
/** מרווח מינימלי בין שתי התראות של אותו מקום */
const COOLDOWN_MS = 5 * 60 * 1000;
/** כמה התראות שכבר נורו לזכור, כדי שהמצב לא יתפח בלי גבול */
const FIRED_MEMORY = 60;

const STATE_KEY = 'heb-cal:place-state';

type PlaceState = { inside: boolean; lastNotifiedAt: number };
/**
 * מצב לכל מקום, ובנוסף `fired` - רשימת ההתראות שכבר נשלחו. בלעדיה
 * יציאה וכניסה חוזרת באותו יום היו יורות את אותה תזכורת שוב.
 */
type StateMap = Record<string, PlaceState> & { fired?: string[] };

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
  kind: PlaceTrigger;
  /** האירוע שביקש את ההתראה */
  occurrence: Occurrence;
  title: string;
  body: string;
};

/**
 * האם התראת המיקום של המופע דרוכה עכשיו.
 *
 * בלי חלון זמן, "תזכיר לי כשאגיע הביתה" היה יורה בכל פעם שנכנסים הביתה,
 * לנצח. החלון הוא יום האירוע: מתחילתו ועד סופו. באירוע רב־יומי דרוך רק
 * היום הראשון, בדיוק כמו בתזכורת רגילה.
 */
export function isTriggerArmed(occurrence: Occurrence, now: Date): boolean {
  if (!occurrence.placeId || !occurrence.placeTrigger) return false;
  if (occurrence.spanIndex > 0) return false;
  return occurrence.date === dateKey(now);
}

/** מזהה ייחודי להתראה שכבר נורתה, כדי לא לחזור עליה באותו יום. */
function firedKey(occurrence: Occurrence, kind: PlaceTrigger): string {
  return `${occurrence.occurrenceId}|${occurrence.date}|${kind}`;
}

/**
 * משווה מיקום למקומות השמורים ומחזיר את ההתראות שיש לשלוח.
 *
 * ההתראה שייכת לאירוע ולא למקום: המקום רק אומר *איפה*, והאירוע אומר
 * *על מה* ו*מתי*. כך שתי תזכורות שונות באותו מקום הן שני דברים שונים,
 * ולא דגל אחד משותף.
 *
 * פונקציה טהורה למעט קריאה וכתיבה של המצב האחרון, כדי שיהיה קל לבדוק.
 */
export function evaluatePosition(
  places: SavedPlace[],
  occurrences: Occurrence[],
  coords: { latitude: number; longitude: number; accuracy?: number },
  now = Date.now(),
): GeofenceEvent[] {
  if (coords.accuracy !== undefined && coords.accuracy > MAX_ACCURACY_M) return [];

  const state = loadState();
  const armed = occurrences.filter((o) => isTriggerArmed(o, new Date(now)));
  const events: GeofenceEvent[] = [];

  for (const place of places) {
    // מקום שאף אירוע דרוך לא מצביע עליו אינו מעניין, וגם לא צריך לעקוב
    // אחרי המצב שלו
    const waiting = armed.filter((o) => o.placeId === place.id);
    if (!waiting.length) continue;

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
      const kind: PlaceTrigger = inside ? 'arrive' : 'leave';
      const cooled = now - (previous.lastNotifiedAt ?? 0) > COOLDOWN_MS;
      const matching = waiting.filter(
        (o) => o.placeTrigger === kind && !state.fired?.includes(firedKey(o, kind)),
      );

      if (matching.length && cooled) {
        for (const occurrence of matching) {
          events.push({
            place,
            kind,
            occurrence,
            title: occurrence.title,
            body: inside ? `הגעת ל${place.name}` : `יצאת מ${place.name}`,
          });
        }
        state.fired = [
          ...(state.fired ?? []),
          ...matching.map((o) => firedKey(o, kind)),
        ].slice(-FIRED_MEMORY);
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
   גדרות שמערכת ההפעלה שומרת
   ========================================================================== */

/**
 * גדר אחת כפי שהיא נמסרת לאנדרואיד.
 *
 * **הטקסט מגיע ערוך, בדיוק כמו בוידג׳ט.** מקבל הגדר הוא BroadcastReceiver
 * שרץ כשהאפליקציה מתה לגמרי - אין שם React, אין hebcal, ואין דרך לגזור
 * כותרת ממזהה. מה שלא נשלח כאן, לא יוצג.
 *
 * `date` נוסע איתה כדי שהמקלט יוכל להשוות מחרוזות ולוודא שהיום הנכון.
 * בלי זה היינו צריכים לרשום מחדש כל בוקר, ומי שלא פתח את האפליקציה לא
 * היה מקבל כלום.
 */
export type NativeFence = {
  /** `<occurrenceId>|<kind>` - ייחודי, ומאפשר להסיר גדר בודדת */
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  kind: PlaceTrigger;
  /** יום המופע, להשוואת מחרוזות במקלט */
  date: string;
  title: string;
  body: string;
  /** תג ההתראה, לקביעת הערוץ בצד הנייטיבי */
  tag: string;
};

/** כמה ימים קדימה נרשמים מראש */
export const FENCE_HORIZON_DAYS = 7;
/** תקרה: אנדרואיד מגביל ל-100 גדרות לאפליקציה */
const MAX_FENCES = 90;

/**
 * הגדרות שיש לרשום במערכת ההפעלה.
 *
 * רושמים קדימה ולא רק להיום, כי גדר נרשמת פעם אחת וחיה גם כשהאפליקציה
 * סגורה - וזה כל העניין. המקלט מסנן לפי `date`.
 */
export function buildFences(
  places: SavedPlace[],
  occurrences: Occurrence[],
  now = new Date(),
): NativeFence[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  const todayKey = dateKey(now);
  const fences: NativeFence[] = [];

  for (const occurrence of occurrences) {
    if (!occurrence.placeId || !occurrence.placeTrigger) continue;
    // באירוע רב־יומי דרוך רק היום הראשון, בדיוק כמו בתזכורת רגילה
    if (occurrence.spanIndex > 0) continue;
    if (occurrence.date < todayKey) continue;

    const place = byId.get(occurrence.placeId);
    // מקום שנמחק - האירוע נשאר, אבל אין לו על מה להצביע
    if (!place) continue;

    const kind = occurrence.placeTrigger;
    fences.push({
      id: `${occurrence.occurrenceId}|${kind}`,
      latitude: place.latitude,
      longitude: place.longitude,
      radius: place.radius,
      kind,
      date: occurrence.date,
      title: occurrence.title,
      body: kind === 'arrive' ? `הגעת ל${place.name}` : `יצאת מ${place.name}`,
      tag: `place-${occurrence.occurrenceId}-${kind}`,
    });
    if (fences.length >= MAX_FENCES) break;
  }

  return fences;
}

/* ==========================================================================
   מעקב חי
   ========================================================================== */

let watchId: number | null = null;
/** עצירת המעקב הנייטיבי, שנקבע אסינכרונית */
let stopNative: (() => void) | null = null;

export type GeofenceWatchOptions = {
  getPlaces: () => SavedPlace[];
  /** המופעים של היום, שמהם נגזרות ההתראות הדרוכות */
  getOccurrences: () => Occurrence[];
  onEvents: (events: GeofenceEvent[]) => void;
};

/** מתחיל מעקב מיקום. מחזיר פונקציית עצירה. */
export function startGeofenceWatch({
  getPlaces,
  getOccurrences,
  onEvents,
}: GeofenceWatchOptions): () => void {
  stopGeofenceWatch();

  const handle = (coords: { latitude: number; longitude: number; accuracy?: number }) => {
    const places = getPlaces();
    if (!places.length) return;
    const events = evaluatePosition(places, getOccurrences(), coords);
    if (events.length) onEvents(events);
  };

  // באנדרואיד המעקב עובר דרך הפלאגין, שמבקש את ההרשאה בעצמו
  if (isNative()) {
    let cancelled = false;
    void watchNativePosition(handle).then((stop) => {
      if (cancelled) stop();
      else stopNative = stop;
    });
    return () => {
      cancelled = true;
      stopGeofenceWatch();
    };
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return () => undefined;
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => handle(pos.coords),
    () => {
      /* אין הרשאה או אין קליטה - המעקב פשוט לא יפעל */
    },
    { enableHighAccuracy: false, maximumAge: 30_000, timeout: 60_000 },
  );

  return stopGeofenceWatch;
}

export function stopGeofenceWatch(): void {
  if (stopNative) {
    stopNative();
    stopNative = null;
  }
  if (watchId !== null && typeof navigator !== 'undefined') {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

/** מה שבאמת צריך מנקודת מיקום - גם בדפדפן וגם באנדרואיד. */
export type Coords = { latitude: number; longitude: number; accuracy?: number };

/** קריאת מיקום חד-פעמית, לשמירת מקום חדש. */
export function readCurrentPosition(): Promise<Coords> {
  if (isNative()) return readNativePosition();
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
