import { describe, expect, it } from 'vitest';
import type { SavedPlace } from '@/types';
import { existingPlaceFor, parsePhoton, radiusFor, searchUrl } from './placeSearch';

/** תשובה בצורה של Photon: GeoJSON, והקואורדינטות הפוכות - אורך ואז רוחב */
function feature(props: Record<string, unknown>, lon = 35.4975, lat = 32.4973) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props };
}

describe('parsePhoton', () => {
  it('עיר: השם, הקואורדינטות בסדר הנכון, ורדיוס של עיר', () => {
    const [r] = parsePhoton({
      features: [feature({ osm_id: 1, osm_type: 'R', name: 'בית שאן', type: 'city', state: 'מחוז הצפון', countrycode: 'IL', country: 'ישראל' })],
    });
    expect(r).toMatchObject({ label: 'בית שאן', latitude: 32.4973, longitude: 35.4975, radius: 1500 });
    // מדינה אינה נכתבת כשהיא ישראל - זה רעש בכל שורה
    expect(r.hint).toBe('מחוז הצפון');
  });

  it('עסק: שם, ומתחתיו הכתובת והעיר', () => {
    const [r] = parsePhoton({
      features: [feature({ name: 'שופרסל', street: 'הרצל', housenumber: '5', city: 'חולון', type: 'house', countrycode: 'IL' })],
    });
    expect(r.label).toBe('שופרסל');
    expect(r.hint).toBe('הרצל 5, חולון');
    expect(r.radius).toBe(150);
  });

  it('כתובת בלי שם נקראת לפי הרחוב והמספר', () => {
    const [r] = parsePhoton({ features: [feature({ street: 'הרצל', housenumber: '5', city: 'חולון' })] });
    expect(r.label).toBe('הרצל 5');
    expect(r.hint).toBe('חולון');
  });

  it('בחו״ל המדינה נכתבת', () => {
    const [r] = parsePhoton({ features: [feature({ name: 'Louvre', city: 'Paris', country: 'France', countrycode: 'FR' })] });
    expect(r.hint).toBe('Paris, France');
  });

  it('כפילות באותה עיר נזרקת, ותוצאה בלי נקודה או בלי שם מדולגת', () => {
    const out = parsePhoton({
      features: [
        feature({ osm_id: 1, name: 'הרצל', city: 'חולון', type: 'street' }),
        feature({ osm_id: 2, name: 'הרצל', city: 'חולון', type: 'street' }),
        { properties: { name: 'בלי נקודה' } },
        feature({ city: 'חולון' }),
      ],
    });
    expect(out.map((r) => r.label)).toEqual(['הרצל']);
  });

  it('תשובה שבורה אינה מפילה', () => {
    expect(parsePhoton(null)).toEqual([]);
    expect(parsePhoton({ features: 'x' })).toEqual([]);
  });
});

describe('radiusFor', () => {
  it('עיר רחבה מכפר, וכפר רחב מבית', () => {
    expect(radiusFor('city')).toBeGreaterThan(radiusFor('village'));
    expect(radiusFor('village')).toBeGreaterThan(radiusFor('house'));
    expect(radiusFor(undefined)).toBe(150);
  });
});

describe('searchUrl', () => {
  it('נשלחת השאילתה וההטיה לפי העיר שבהגדרות - ולא יותר', () => {
    const url = new URL(searchUrl('  בית שאן ', { latitude: 31.7683, longitude: 35.2137 }));
    expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api/');
    expect(url.searchParams.get('q')).toBe('בית שאן');
    expect(url.searchParams.get('lat')).toBe('31.768');
    expect(url.searchParams.get('lon')).toBe('35.214');
    expect([...url.searchParams.keys()].sort()).toEqual(['lat', 'limit', 'lon', 'q']);
  });
});

describe('existingPlaceFor', () => {
  const home: SavedPlace = { id: 'h', name: 'בית', latitude: 32.0853, longitude: 34.7818, radius: 150, createdAt: 0 };
  const result = (lat: number, lon: number) => ({ key: 'k', label: 'x', latitude: lat, longitude: lon, radius: 150 });

  it('תוצאה באותה נקודה של מקום שמור מחזירה אותו, ולא יוצרת כפילות', () => {
    expect(existingPlaceFor(result(32.0854, 34.7818), [home])?.id).toBe('h');
  });

  it('תוצאה רחוקה אינה נחשבת אותו מקום', () => {
    expect(existingPlaceFor(result(32.1, 34.8), [home])).toBeNull();
  });
});
