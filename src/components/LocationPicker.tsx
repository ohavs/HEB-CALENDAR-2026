/**
 * בחירת מקום לאירוע.
 *
 * עד כה זו הייתה תיבת טקסט חופשי, בזמן שהאפליקציה כבר יודעת על המקומות
 * השמורים של המשתמש, על 83 ערים, ועל המיקום הנוכחי של המכשיר. הבחירה
 * החופשית נשארה - "אצל סבתא" הוא מקום לגיטימי שאין לו כתובת - אבל היא
 * כבר לא הדרך היחידה.
 *
 * הכול מקומי: אין קריאת רשת ואין מפתח API, ומה שהמשתמש מקליד לא יוצא
 * מהמכשיר.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Crosshair, History, MapPin, Search, Trash2, X } from 'lucide-react';
import type { SavedPlace, UserEvent } from '@/types';
import { suggestLocations, type LocationSuggestion } from '@/lib/eventLocations';
import { nearestCity } from '@/lib/locations';
import { readCurrentPosition } from '@/lib/geofence';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE, TAP_SCALE } from '@/lib/motion';

const ICON_FOR = {
  place: MapPin,
  recent: History,
  city: Building2,
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
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-well px-4 py-3.5">
        <Search size={ICON.lg} strokeWidth={STROKE} className="shrink-0 text-faint" />
        <input
          id="location-query"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="מקום שמור, עיר, או כל טקסט"
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
        {/* שימוש בטקסט שהוקלד, כשאין לו התאמה ברשימה */}
        {showFreeText && (
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => choose({ location: trimmed })}
            className="focus-ring flex w-full items-center gap-3.5 rounded-2xl bg-brand-soft px-4 py-4 text-right"
          >
            <MapPin size={ICON.md} strokeWidth={STROKE} className="shrink-0 text-brand-ink" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-semibold text-brand-ink">
                {trimmed}
              </span>
              <span className="mt-0.5 block text-caption text-brand-ink/70">
                שימוש בטקסט שהקלדתם
              </span>
            </span>
          </motion.button>
        )}

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
              אין מקומות שמורים עדיין. אפשר להוסיף אותם בהגדרות, או פשוט לכתוב
              כאן טקסט.
            </p>
          )
        )}
      </div>
    </Sheet>
  );
}
