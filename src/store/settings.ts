/** הגדרות המשתמש - נשמרות מקומית ומסונכרנות לענן כשמתחברים. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CalendarFilters, SavedPlace, Settings, ThemeMode } from '@/types';
import { DEFAULT_CITY_ID, findCity, guessCityId } from '@/lib/locations';

const STORAGE_KEY = 'heb-cal:settings';

export function defaultSettings(): Settings {
  const cityId = guessCityId();
  const city = findCity(cityId);
  return {
    theme: 'system',
    view: 'month',
    density: 'comfortable',
    agendaHidden: [],
    showHebrewDates: true,
    showHebrewMonths: true,
    showJewishHolidays: true,
    showIsraeliHolidays: true,
    showMinorHolidays: false,
    showFasts: true,
    showRoshChodesh: true,
    showParsha: true,
    showOmer: false,
    showCandleTimes: true,
    cityId: cityId || DEFAULT_CITY_ID,
    candleLightingMins: city.il ? 40 : 18,
    havdalahMode: 'degrees',
    havdalahDegrees: 8.5,
    havdalahMins: 42,
    notifyCandleLighting: true,
    notifyCandleLightingMins: 30,
    notifyHavdalah: false,
    notifyHavdalahMins: 0,
    notifyEvents: true,
    notifyHolidayEve: false,
    notifyHolidayEveTime: '20:00',
    defaultEventColor: 'violet',
    customLocation: null,
    places: [],
    placeAlertsEnabled: false,
  };
}

type SettingsStore = {
  settings: Settings;
  /** חתימה שמשתנה בכל עדכון - שימושי כדי לרענן חישובים ותזכורות */
  revision: number;
  /** חתימת זמן לשינוי האחרון, לצורך סנכרון last-write-wins */
  updatedAt: number;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  patch: (values: Partial<Settings>) => void;
  replaceAll: (values: Settings) => void;
  reset: () => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (setState) => ({
      settings: defaultSettings(),
      revision: 0,
      updatedAt: 0,
      set: (key, value) =>
        setState((s) => ({
          settings: { ...s.settings, [key]: value },
          revision: s.revision + 1,
          updatedAt: Date.now(),
        })),
      patch: (values) =>
        setState((s) => ({
          settings: { ...s.settings, ...values },
          revision: s.revision + 1,
          updatedAt: Date.now(),
        })),
      replaceAll: (values) =>
        setState((s) => ({ settings: values, revision: s.revision + 1, updatedAt: Date.now() })),
      reset: () =>
        setState((s) => ({ settings: defaultSettings(), revision: s.revision + 1, updatedAt: Date.now() })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      // ממזגים עם ברירות המחדל כדי שהוספת הגדרה חדשה לא תשבור משתמשים קיימים
      merge: (persisted, current) => {
        const stored = persisted as
          | { settings?: Partial<Settings> & { notifyHolidayEveHour?: number }; updatedAt?: number }
          | undefined;
        const saved = { ...(stored?.settings ?? {}) };
        // הגירה: פעם שמרנו שעה שלמה, עכשיו שעה מלאה
        if (saved.notifyHolidayEveTime === undefined && typeof saved.notifyHolidayEveHour === 'number') {
          saved.notifyHolidayEveTime = `${String(saved.notifyHolidayEveHour).padStart(2, '0')}:00`;
        }
        delete saved.notifyHolidayEveHour;
        // הגירה: תחילת השבוע ירדה. אצלנו יום ראשון הוא הראשון, תמיד.
        delete (saved as { weekStart?: number }).weekStart;
        // הגירה: דגלי ההגעה והיציאה עברו מהמקום לאירוע, וההודעה המותאמת
        // התייתרה איתם. מנקים כדי שלא יישארו שדות מתים באחסון ובסנכרון.
        if (Array.isArray(saved.places)) {
          saved.places = saved.places.map((place) => {
            const legacy = place as SavedPlace & {
              notifyOnArrive?: boolean;
              notifyOnLeave?: boolean;
              message?: string;
            };
            return {
              id: legacy.id,
              name: legacy.name,
              latitude: legacy.latitude,
              longitude: legacy.longitude,
              radius: legacy.radius,
              createdAt: legacy.createdAt,
            };
          });
        }
        return {
          ...current,
          settings: { ...current.settings, ...saved },
          updatedAt: stored?.updatedAt ?? 0,
        };
      },
    },
  ),
);

/** גישה נוחה להגדרות. */
export const useSettings = (): Settings => useSettingsStore((s) => s.settings);

/** רק החלק שמנוע הלוח צריך, כדי לא לחשב מחדש על כל שינוי ערכת נושא. */
export function toFilters(s: Settings): CalendarFilters {
  return {
    showJewishHolidays: s.showJewishHolidays,
    showIsraeliHolidays: s.showIsraeliHolidays,
    showMinorHolidays: s.showMinorHolidays,
    showFasts: s.showFasts,
    showRoshChodesh: s.showRoshChodesh,
    showParsha: s.showParsha,
    showOmer: s.showOmer,
    showCandleTimes: s.showCandleTimes,
    candleLightingMins: s.candleLightingMins,
    havdalahMode: s.havdalahMode,
    havdalahDegrees: s.havdalahDegrees,
    havdalahMins: s.havdalahMins,
  };
}

/* ==========================================================================
   ערכת נושא
   ========================================================================== */

let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

function paint(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (meta) meta.content = dark ? '#09090F' : '#F6F6FA';
}

/** מחיל ערכת נושא ומאזין לשינוי העדפת המערכת. */
export function applyTheme(mode: ThemeMode): void {
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener('change', mediaListener);
    mediaListener = null;
  }
  if (mode === 'system') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaListener = (e) => paint(e.matches);
    mediaQuery.addEventListener('change', mediaListener);
    paint(mediaQuery.matches);
  } else {
    paint(mode === 'dark');
  }
  // index.html קורא את המפתח הזה לפני הצביעה הראשונה, כדי למנוע הבהוב
  try {
    localStorage.setItem('heb-cal:theme', JSON.stringify(mode));
  } catch {
    /* מצב פרטי - אין מה לעשות */
  }
}
