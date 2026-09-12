/**
 * רשימת ערים לחישוב זמני הלכה.
 * ה-tzid הוא מזהה IANA, ולכן חישוב שעון קיץ/חורף מתבצע אוטומטית ונכון
 * לכל תאריך בעבר ובעתיד.
 */
import type { GeoCity } from '@/types';

export const CITIES: GeoCity[] = [
  // ===== ישראל =====
  { id: 'jerusalem', name: 'ירושלים', region: 'ישראל', latitude: 31.7683, longitude: 35.2137, tzid: 'Asia/Jerusalem', il: true, elevation: 754 },
  { id: 'telaviv', name: 'תל אביב–יפו', region: 'ישראל', latitude: 32.0853, longitude: 34.7818, tzid: 'Asia/Jerusalem', il: true },
  { id: 'haifa', name: 'חיפה', region: 'ישראל', latitude: 32.794, longitude: 34.9896, tzid: 'Asia/Jerusalem', il: true, elevation: 300 },
  { id: 'beersheva', name: 'באר שבע', region: 'ישראל', latitude: 31.253, longitude: 34.7915, tzid: 'Asia/Jerusalem', il: true },
  { id: 'rishon', name: 'ראשון לציון', region: 'ישראל', latitude: 31.973, longitude: 34.7925, tzid: 'Asia/Jerusalem', il: true },
  { id: 'petahtikva', name: 'פתח תקווה', region: 'ישראל', latitude: 32.0878, longitude: 34.8878, tzid: 'Asia/Jerusalem', il: true },
  { id: 'ashdod', name: 'אשדוד', region: 'ישראל', latitude: 31.8014, longitude: 34.6435, tzid: 'Asia/Jerusalem', il: true },
  { id: 'netanya', name: 'נתניה', region: 'ישראל', latitude: 32.3215, longitude: 34.8532, tzid: 'Asia/Jerusalem', il: true },
  { id: 'bneibrak', name: 'בני ברק', region: 'ישראל', latitude: 32.0809, longitude: 34.8338, tzid: 'Asia/Jerusalem', il: true },
  { id: 'holon', name: 'חולון', region: 'ישראל', latitude: 32.0114, longitude: 34.7736, tzid: 'Asia/Jerusalem', il: true },
  { id: 'ramatgan', name: 'רמת גן', region: 'ישראל', latitude: 32.0684, longitude: 34.8248, tzid: 'Asia/Jerusalem', il: true },
  { id: 'ashkelon', name: 'אשקלון', region: 'ישראל', latitude: 31.6688, longitude: 34.5743, tzid: 'Asia/Jerusalem', il: true },
  { id: 'rehovot', name: 'רחובות', region: 'ישראל', latitude: 31.8928, longitude: 34.8113, tzid: 'Asia/Jerusalem', il: true },
  { id: 'batyam', name: 'בת ים', region: 'ישראל', latitude: 32.0171, longitude: 34.7454, tzid: 'Asia/Jerusalem', il: true },
  { id: 'beitshemesh', name: 'בית שמש', region: 'ישראל', latitude: 31.7497, longitude: 34.9886, tzid: 'Asia/Jerusalem', il: true },
  { id: 'kfarsaba', name: 'כפר סבא', region: 'ישראל', latitude: 32.175, longitude: 34.907, tzid: 'Asia/Jerusalem', il: true },
  { id: 'herzliya', name: 'הרצליה', region: 'ישראל', latitude: 32.1624, longitude: 34.8447, tzid: 'Asia/Jerusalem', il: true },
  { id: 'hadera', name: 'חדרה', region: 'ישראל', latitude: 32.434, longitude: 34.9196, tzid: 'Asia/Jerusalem', il: true },
  { id: 'modiin', name: 'מודיעין', region: 'ישראל', latitude: 31.8928, longitude: 35.0104, tzid: 'Asia/Jerusalem', il: true },
  { id: 'raanana', name: 'רעננה', region: 'ישראל', latitude: 32.1848, longitude: 34.8713, tzid: 'Asia/Jerusalem', il: true },
  { id: 'ramla', name: 'רמלה', region: 'ישראל', latitude: 31.9288, longitude: 34.8667, tzid: 'Asia/Jerusalem', il: true },
  { id: 'lod', name: 'לוד', region: 'ישראל', latitude: 31.9514, longitude: 34.8953, tzid: 'Asia/Jerusalem', il: true },
  { id: 'givatayim', name: 'גבעתיים', region: 'ישראל', latitude: 32.0723, longitude: 34.8104, tzid: 'Asia/Jerusalem', il: true },
  { id: 'kiryatgat', name: 'קריית גת', region: 'ישראל', latitude: 31.61, longitude: 34.7642, tzid: 'Asia/Jerusalem', il: true },
  { id: 'nahariya', name: 'נהרייה', region: 'ישראל', latitude: 33.0058, longitude: 35.0946, tzid: 'Asia/Jerusalem', il: true },
  { id: 'afula', name: 'עפולה', region: 'ישראל', latitude: 32.6078, longitude: 35.2897, tzid: 'Asia/Jerusalem', il: true },
  { id: 'eilat', name: 'אילת', region: 'ישראל', latitude: 29.5577, longitude: 34.9519, tzid: 'Asia/Jerusalem', il: true },
  { id: 'tzfat', name: 'צפת', region: 'ישראל', latitude: 32.9646, longitude: 35.496, tzid: 'Asia/Jerusalem', il: true, elevation: 900 },
  { id: 'tiberias', name: 'טבריה', region: 'ישראל', latitude: 32.7922, longitude: 35.5312, tzid: 'Asia/Jerusalem', il: true },
  { id: 'akko', name: 'עכו', region: 'ישראל', latitude: 32.9281, longitude: 35.0818, tzid: 'Asia/Jerusalem', il: true },
  { id: 'nazareth', name: 'נצרת', region: 'ישראל', latitude: 32.7021, longitude: 35.2978, tzid: 'Asia/Jerusalem', il: true },
  { id: 'kiryatshmona', name: 'קריית שמונה', region: 'ישראל', latitude: 33.2075, longitude: 35.5697, tzid: 'Asia/Jerusalem', il: true },
  { id: 'karmiel', name: 'כרמיאל', region: 'ישראל', latitude: 32.9192, longitude: 35.2953, tzid: 'Asia/Jerusalem', il: true },
  { id: 'dimona', name: 'דימונה', region: 'ישראל', latitude: 31.0686, longitude: 35.0331, tzid: 'Asia/Jerusalem', il: true },
  { id: 'arad', name: 'ערד', region: 'ישראל', latitude: 31.2589, longitude: 35.2137, tzid: 'Asia/Jerusalem', il: true },
  { id: 'ariel', name: 'אריאל', region: 'ישראל', latitude: 32.1056, longitude: 35.17, tzid: 'Asia/Jerusalem', il: true },
  { id: 'beitar', name: 'ביתר עילית', region: 'ישראל', latitude: 31.6969, longitude: 35.1197, tzid: 'Asia/Jerusalem', il: true },
  { id: 'elad', name: 'אלעד', region: 'ישראל', latitude: 32.0516, longitude: 34.9508, tzid: 'Asia/Jerusalem', il: true },
  { id: 'maaleadumim', name: 'מעלה אדומים', region: 'ישראל', latitude: 31.7768, longitude: 35.2983, tzid: 'Asia/Jerusalem', il: true },
  { id: 'kiryatarba', name: 'קריית ארבע', region: 'ישראל', latitude: 31.5262, longitude: 35.1136, tzid: 'Asia/Jerusalem', il: true },
  { id: 'zichron', name: 'זכרון יעקב', region: 'ישראל', latitude: 32.5722, longitude: 34.9528, tzid: 'Asia/Jerusalem', il: true },
  { id: 'roshhaayin', name: 'ראש העין', region: 'ישראל', latitude: 32.0956, longitude: 34.9567, tzid: 'Asia/Jerusalem', il: true },
  { id: 'yavne', name: 'יבנה', region: 'ישראל', latitude: 31.8781, longitude: 34.7386, tzid: 'Asia/Jerusalem', il: true },
  { id: 'nesziona', name: 'נס ציונה', region: 'ישראל', latitude: 31.9293, longitude: 34.7986, tzid: 'Asia/Jerusalem', il: true },
  { id: 'sderot', name: 'שדרות', region: 'ישראל', latitude: 31.525, longitude: 34.5964, tzid: 'Asia/Jerusalem', il: true },
  { id: 'netivot', name: 'נתיבות', region: 'ישראל', latitude: 31.4222, longitude: 34.5889, tzid: 'Asia/Jerusalem', il: true },
  { id: 'beitshean', name: 'בית שאן', region: 'ישראל', latitude: 32.4967, longitude: 35.4997, tzid: 'Asia/Jerusalem', il: true },
  { id: 'mitzperamon', name: 'מצפה רמון', region: 'ישראל', latitude: 30.6097, longitude: 34.8011, tzid: 'Asia/Jerusalem', il: true },

  // ===== ארצות הברית וקנדה =====
  { id: 'newyork', name: 'ניו יורק', region: 'ארצות הברית', latitude: 40.7128, longitude: -74.006, tzid: 'America/New_York', il: false },
  { id: 'brooklyn', name: 'ברוקלין', region: 'ארצות הברית', latitude: 40.6782, longitude: -73.9442, tzid: 'America/New_York', il: false },
  { id: 'lakewood', name: 'לייקווד', region: 'ארצות הברית', latitude: 40.0959, longitude: -74.2179, tzid: 'America/New_York', il: false },
  { id: 'monsey', name: 'מונסי', region: 'ארצות הברית', latitude: 41.1112, longitude: -74.0687, tzid: 'America/New_York', il: false },
  { id: 'miami', name: 'מיאמי', region: 'ארצות הברית', latitude: 25.7617, longitude: -80.1918, tzid: 'America/New_York', il: false },
  { id: 'chicago', name: 'שיקגו', region: 'ארצות הברית', latitude: 41.8781, longitude: -87.6298, tzid: 'America/Chicago', il: false },
  { id: 'losangeles', name: 'לוס אנג׳לס', region: 'ארצות הברית', latitude: 34.0522, longitude: -118.2437, tzid: 'America/Los_Angeles', il: false },
  { id: 'toronto', name: 'טורונטו', region: 'קנדה', latitude: 43.6532, longitude: -79.3832, tzid: 'America/Toronto', il: false },
  { id: 'montreal', name: 'מונטריאול', region: 'קנדה', latitude: 45.5019, longitude: -73.5674, tzid: 'America/Toronto', il: false },

  // ===== אירופה =====
  { id: 'london', name: 'לונדון', region: 'אירופה', latitude: 51.5074, longitude: -0.1278, tzid: 'Europe/London', il: false },
  { id: 'manchester', name: 'מנצ׳סטר', region: 'אירופה', latitude: 53.4808, longitude: -2.2426, tzid: 'Europe/London', il: false },
  { id: 'paris', name: 'פריז', region: 'אירופה', latitude: 48.8566, longitude: 2.3522, tzid: 'Europe/Paris', il: false },
  { id: 'amsterdam', name: 'אמסטרדם', region: 'אירופה', latitude: 52.3676, longitude: 4.9041, tzid: 'Europe/Amsterdam', il: false },
  { id: 'antwerp', name: 'אנטוורפן', region: 'אירופה', latitude: 51.2194, longitude: 4.4025, tzid: 'Europe/Brussels', il: false },
  { id: 'berlin', name: 'ברלין', region: 'אירופה', latitude: 52.52, longitude: 13.405, tzid: 'Europe/Berlin', il: false },
  { id: 'zurich', name: 'ציריך', region: 'אירופה', latitude: 47.3769, longitude: 8.5417, tzid: 'Europe/Zurich', il: false },
  { id: 'vienna', name: 'וינה', region: 'אירופה', latitude: 48.2082, longitude: 16.3738, tzid: 'Europe/Vienna', il: false },
  { id: 'rome', name: 'רומא', region: 'אירופה', latitude: 41.9028, longitude: 12.4964, tzid: 'Europe/Rome', il: false },
  { id: 'madrid', name: 'מדריד', region: 'אירופה', latitude: 40.4168, longitude: -3.7038, tzid: 'Europe/Madrid', il: false },
  { id: 'moscow', name: 'מוסקבה', region: 'אירופה', latitude: 55.7558, longitude: 37.6173, tzid: 'Europe/Moscow', il: false },
  { id: 'kyiv', name: 'קייב', region: 'אירופה', latitude: 50.4501, longitude: 30.5234, tzid: 'Europe/Kyiv', il: false },
  { id: 'istanbul', name: 'איסטנבול', region: 'אירופה', latitude: 41.0082, longitude: 28.9784, tzid: 'Europe/Istanbul', il: false },

  // ===== שאר העולם =====
  { id: 'buenosaires', name: 'בואנוס איירס', region: 'דרום אמריקה', latitude: -34.6037, longitude: -58.3816, tzid: 'America/Argentina/Buenos_Aires', il: false },
  { id: 'saopaulo', name: 'סאו פאולו', region: 'דרום אמריקה', latitude: -23.5505, longitude: -46.6333, tzid: 'America/Sao_Paulo', il: false },
  { id: 'mexicocity', name: 'מקסיקו סיטי', region: 'דרום אמריקה', latitude: 19.4326, longitude: -99.1332, tzid: 'America/Mexico_City', il: false },
  { id: 'melbourne', name: 'מלבורן', region: 'אוסטרליה', latitude: -37.8136, longitude: 144.9631, tzid: 'Australia/Melbourne', il: false },
  { id: 'sydney', name: 'סידני', region: 'אוסטרליה', latitude: -33.8688, longitude: 151.2093, tzid: 'Australia/Sydney', il: false },
  { id: 'johannesburg', name: 'יוהנסבורג', region: 'אפריקה', latitude: -26.2041, longitude: 28.0473, tzid: 'Africa/Johannesburg', il: false },
  { id: 'bangkok', name: 'בנגקוק', region: 'אסיה', latitude: 13.7563, longitude: 100.5018, tzid: 'Asia/Bangkok', il: false },
  { id: 'mumbai', name: 'מומבאי', region: 'אסיה', latitude: 19.076, longitude: 72.8777, tzid: 'Asia/Kolkata', il: false },
  { id: 'hongkong', name: 'הונג קונג', region: 'אסיה', latitude: 22.3193, longitude: 114.1694, tzid: 'Asia/Hong_Kong', il: false },
  { id: 'tokyo', name: 'טוקיו', region: 'אסיה', latitude: 35.6762, longitude: 139.6503, tzid: 'Asia/Tokyo', il: false },
];

export const DEFAULT_CITY_ID = 'jerusalem';

const byId = new Map(CITIES.map((c) => [c.id, c]));

/** מזהה של עיר מותאמת אישית שנקבעה לפי מיקום המכשיר. */
export const CUSTOM_CITY_ID = 'custom';

let customCity: GeoCity | null = null;

export function setCustomCity(city: GeoCity | null): void {
  customCity = city;
  if (city) byId.set(CUSTOM_CITY_ID, city);
  else byId.delete(CUSTOM_CITY_ID);
}

export function getCustomCity(): GeoCity | null {
  return customCity;
}

export function findCity(id: string): GeoCity {
  return byId.get(id) ?? byId.get(DEFAULT_CITY_ID)!;
}

/** מקבץ ערים לפי אזור, לשימוש בבוחר העיר. */
export function citiesByRegion(): { region: string; cities: GeoCity[] }[] {
  const order = ['ישראל', 'ארצות הברית', 'קנדה', 'אירופה', 'דרום אמריקה', 'אוסטרליה', 'אסיה', 'אפריקה'];
  const groups = new Map<string, GeoCity[]>();
  for (const c of CITIES) {
    const arr = groups.get(c.region) ?? [];
    arr.push(c);
    groups.set(c.region, arr);
  }
  return order
    .filter((r) => groups.has(r))
    .map((region) => ({ region, cities: groups.get(region)! }));
}

/** חיפוש חופשי ברשימת הערים. */
export function searchCities(query: string): GeoCity[] {
  const q = query.trim();
  if (!q) return [];
  return CITIES.filter((c) => c.name.includes(q) || c.id.includes(q.toLowerCase())).slice(0, 24);
}

/**
 * מאתר את העיר הקרובה ביותר לקו אורך/רוחב נתונים (לשימוש עם מיקום המכשיר).
 * מחזיר null אם אין עיר במרחק סביר.
 */
export function nearestCity(latitude: number, longitude: number, maxKm = 60): GeoCity | null {
  let best: GeoCity | null = null;
  let bestDist = Infinity;
  for (const c of CITIES) {
    const d = haversineKm(latitude, longitude, c.latitude, c.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return bestDist <= maxKm ? best : null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** אזור הזמן של המכשיר, לשימוש כברירת מחדל חכמה. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem';
  } catch {
    return 'Asia/Jerusalem';
  }
}

/** ניחוש עיר התחלתי לפי אזור הזמן של המכשיר. */
export function guessCityId(): string {
  const tz = deviceTimeZone();
  const match = CITIES.find((c) => c.tzid === tz);
  if (tz === 'Asia/Jerusalem') return DEFAULT_CITY_ID;
  return match?.id ?? DEFAULT_CITY_ID;
}
