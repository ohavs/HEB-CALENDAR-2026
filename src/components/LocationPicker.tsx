/**
 * בחירת מקום לאירוע.
 *
 * עד כה זו הייתה תיבת טקסט חופשי, בזמן שהאפליקציה כבר יודעת על המקומות
 * השמורים של המשתמש ועל מה שכתב באירועים קודמים. הבחירה החופשית נשארה -
 * "אצל סבתא" הוא מקום לגיטימי שאין לו כתובת - אבל היא כבר לא הדרך היחידה.
 *
 * מה שמוצע הוא רק מה ששייך למשתמש. ערים מהרשימה המובנית אינן מוצעות כאן
 * בכוונה; הן משרתות את זמני השבת, ובבורר מקום הן היו רעש.
 *
 * ומתחת להן - חיפוש לפי שם (`placeSearch.ts`), כי בלי נקודת ציון אין
 * התראת הגעה ויציאה, ושם שהוקלד כטקסט חופשי נשמר בלי לעשות דבר. בחירה
 * בתוצאה שומרת אותה כמקום שמור, או משתמשת במקום השמור שכבר יושב שם.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Globe, History, MapPin, Search, Trash2, X } from 'lucide-react';
import type { SavedPlace, UserEvent } from '@/types';
import { suggestLocations, type LocationSuggestion } from '@/lib/eventLocations';
import { findCity, nearestCity } from '@/lib/locations';
import {
  MIN_QUERY,
  SEARCH_DEBOUNCE_MS,
  existingPlaceFor,
  searchPlaces,
  type PlaceResult,
} from '@/lib/placeSearch';
import { newId } from '@/lib/sharedLists';
import { useSettingsStore } from '@/store/settings';
import { announce } from '@/lib/announce';
import { readCurrentPosition } from '@/lib/geofence';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE, TAP_SCALE } from '@/lib/motion';

const ICON_FOR = {
  place: MapPin,
  recent: History,
} as const;

export type LocationChoice = { location?: string; placeId?: string };

export function LocationPicker({
  open,
  onClose,
  value,
  onChange,
  events,
  places,
}: {
  open: boolean;
  onClose: () => void;
  value: LocationChoice;
  onChange: (next: LocationChoice) => void;
  events: UserEvent[];
  places: SavedPlace[];
}) {
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setError(null);
  }, [open]);

  const suggestions = useMemo(
    () => suggestLocations(query, events, places),
    [query, events, places],
  );

  /* ------------------------------ חיפוש בשם ------------------------------ */
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState<'idle' | 'loading' | 'error' | 'offline'>('idle');
  const cityId = useSettingsStore((s) => s.settings.cityId);
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < MIN_QUERY) {
      setResults([]);
      setSearching('idle');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSearching('offline');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching('loading');
      const city = findCity(cityId);
      searchPlaces(q, { latitude: city.latitude, longitude: city.longitude }, controller.signal)
        .then((next) => {
          setResults(next);
          setSearching('idle');
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearching('error');
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, cityId]);

  /**
   * תוצאת חיפוש הופכת למקום שמור, כי רק למקום שמור יש על מה לגדר - ואז
   * "תזכורת כשאגיע" מופיעה בטופס מיד. מקום שכבר שמור באותה נקודה נבחר
   * במקומה, כדי שהרשימה לא תתמלא בכפילויות.
   */
  const pickResult = (r: PlaceResult) => {
    const existing = existingPlaceFor(r, places);
    if (existing) {
      choose({ location: r.label, placeId: existing.id });
      return;
    }
    const place: SavedPlace = {
      id: newId(),
      name: r.label,
      latitude: r.latitude,
      longitude: r.longitude,
      radius: r.radius,
      createdAt: Date.now(),
    };
    const { settings, set } = useSettingsStore.getState();
    set('places', [...settings.places, place]);
    announce(`${r.label} נשמר כמקום`);
    choose({ location: r.label, placeId: place.id });
  };

  const choose = (next: LocationChoice) => {
    onChange(next);
    onClose();
  };

  const pick = (s: LocationSuggestion) => choose({ location: s.label, placeId: s.placeId });

  /** המיקום הנוכחי מתורגם לעיר הקרובה, כי "31.77, 35.21" אינו מקום. */
  const pickCurrentLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const coords = await readCurrentPosition();
      const city = nearestCity(coords.latitude, coords.longitude);
      if (city) choose({ location: city.name });
      else setError('לא זיהינו עיר מוכרת במיקום הנוכחי. אפשר לכתוב אותו ידנית.');
    } catch {
      setError('לא הצלחנו לקרוא את המיקום. ודאו שאישרתם גישה למיקום.');
    } finally {
      setLocating(false);
    }
  };

  const trimmed = query.trim();
  // הטקסט שהוקלד מוצע כמו שהוא, אלא אם הוא כבר מופיע ברשימה
  const showFreeText =
    trimmed.length > 0 && !suggestions.some((s) => s.label === trimmed);

  return (
    <Sheet open={open} onClose={onClose} size="tall" title="מקום">
      <div className="field-shell mb-4 flex items-center gap-3 rounded-2xl bg-well px-4 py-3.5">
        <Search size={ICON.lg} strokeWidth={STROKE} className="shrink-0 text-faint" />
        <input
          id="location-query"
          /* לא type="search": הוא מוסיף X משלו ליד שלנו */
          type="text"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש מקום, כתובת או עסק"
          autoFocus
          className="field-reset bg-transparent p-0 text-body text-ink placeholder:text-faint"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="ניקוי"
            className="focus-ring -me-1 shrink-0 rounded-full p-1 text-faint"
          >
            <X size={ICON.sm} strokeWidth={STROKE} />
          </button>
        )}
      </div>

      <div className="space-y-2.5 pb-2">
        {/* מיקום נוכחי */}
        {!trimmed && (
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => void pickCurrentLocation()}
            disabled={locating}
            className="focus-ring flex w-full items-center gap-3.5 rounded-2xl bg-well px-4 py-4 text-right disabled:opacity-60"
          >
            <Crosshair size={ICON.md} strokeWidth={STROKE} className="shrink-0 text-muted" />
            <span className="text-body font-medium text-ink">
              {locating ? 'מאתר…' : 'המיקום הנוכחי שלי'}
            </span>
          </motion.button>
        )}

        {error && (
          <p className="rounded-2xl bg-well px-4 py-3 text-caption text-[rgb(194_60_90)]">
            {error}
          </p>
        )}

        {/* הסרת המקום שנבחר */}
        {value.location && !trimmed && (
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => choose({})}
            className="focus-ring flex w-full items-center gap-3.5 rounded-2xl bg-well px-4 py-4 text-right"
          >
            <Trash2 size={ICON.md} strokeWidth={STROKE} className="shrink-0 text-muted" />
            <span className="text-body font-medium text-ink">בלי מקום</span>
          </motion.button>
        )}

        {suggestions.length > 0 ? (
          <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">
            {suggestions.map((s) => {
              const Icon = ICON_FOR[s.kind];
              const selected =
                s.placeId != null ? value.placeId === s.placeId : value.location === s.label;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => pick(s)}
                  aria-pressed={selected}
                  className="focus-ring-inset flex w-full items-center gap-3.5 px-4 py-4 text-right"
                >
                  <Icon
                    size={ICON.md}
                    strokeWidth={STROKE}
                    className={`shrink-0 ${s.kind === 'place' ? 'text-brand-ink' : 'text-faint'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-body ${
                        selected ? 'font-semibold text-brand-ink' : 'font-medium text-ink'
                      }`}
                    >
                      {s.label}
                    </span>
                    {s.hint && (
                      <span className="mt-0.5 block truncate text-caption text-muted">
                        {s.hint}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          !showFreeText && (
            <p className="py-8 text-center text-label text-muted">
              אין עדיין מקומות שלכם. אפשר לחפש מקום לפי שם, או פשוט לכתוב
              כאן טקסט.
            </p>
          )
        )}

        {/* חיפוש לפי שם - מה שנמצא בעולם, מתחת למה ששייך למשתמש */}
        {trimmed.length >= MIN_QUERY && (
          <section aria-label="תוצאות חיפוש" className="space-y-2 pt-1">
            {results.length > 0 && (
              <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">
                {results.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => pickResult(r)}
                    className="focus-ring-inset flex w-full items-center gap-3.5 px-4 py-4 text-right"
                  >
                    <Globe size={ICON.md} strokeWidth={STROKE} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {r.label}
                      </span>
                      {r.hint && (
                        <span className="mt-0.5 block truncate text-caption text-muted">
                          {r.hint}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="px-1 text-caption text-faint" role="status">
              {searching === 'loading'
                ? 'מחפש…'
                : searching === 'offline'
                  ? 'אין חיבור לרשת, ולכן אין חיפוש מקומות. אפשר להשתמש בטקסט שהקלדתם.'
                  : searching === 'error'
                    ? 'החיפוש לא הצליח כרגע. אפשר להשתמש בטקסט שהקלדתם.'
                    : results.length === 0
                      ? 'לא נמצא מקום בשם הזה.'
                      : 'בחירה בתוצאה שומרת אותה כמקום, ואז אפשר לקבל התראה בהגעה וביציאה. © OpenStreetMap'}
            </p>
          </section>
        )}

        {/*
          הטקסט שהוקלד, כמו שהוא - אחרון ובלי הדגשה. "אצל סבתא" הוא מקום
          לגיטימי, אבל אין לו נקודה ולכן גם לא התראה, וכשהוא ישב ראשון
          ומודגש הוא נבחר במקום תוצאת החיפוש שמעליה הייתה נותנת את שתיהן.
        */}
        {showFreeText && (
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => choose({ location: trimmed })}
            className="focus-ring flex w-full items-center gap-3.5 rounded-2xl bg-well px-4 py-4 text-right"
          >
            <MapPin size={ICON.md} strokeWidth={STROKE} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-medium text-ink">
                {trimmed}
              </span>
              <span className="mt-0.5 block text-caption text-muted">
                שימוש בטקסט שהקלדתם - בלי התראת מקום
              </span>
            </span>
          </motion.button>
        )}
      </div>
    </Sheet>
  );
}
