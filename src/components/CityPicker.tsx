/** בוחר עיר לחישוב הזמנים, עם חיפוש ואיתור לפי מיקום המכשיר. */
import { useMemo, useState } from 'react';
import { Check, Crosshair, Search } from 'lucide-react';
import { CITIES, CUSTOM_CITY_ID, citiesByRegion, deviceTimeZone, nearestCity } from '@/lib/locations';
import { useSettingsStore } from '@/store/settings';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE } from '@/lib/motion';

export function CityPicker({
  open,
  onClose,
  cityId,
}: {
  open: boolean;
  onClose: () => void;
  cityId: string;
}) {
  const patch = useSettingsStore((s) => s.patch);
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim();
    if (!q) return citiesByRegion();
    const matches = CITIES.filter((c) => c.name.includes(q));
    return matches.length ? [{ region: 'תוצאות', cities: matches }] : [];
  }, [query]);

  const select = (id: string) => {
    const city = CITIES.find((c) => c.id === id);
    // ברירת מחדל הגיונית לדקות הדלקת נרות לפי הארץ
    patch({
      cityId: id,
      customLocation: null,
      ...(city ? { candleLightingMins: city.il ? 40 : 18 } : {}),
    });
    onClose();
  };

  /** שימוש בקואורדינטות המדויקות של המכשיר במקום עיר מהרשימה */
  const useExactLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocateError('הדפדפן לא תומך באיתור מיקום');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const near = nearestCity(pos.coords.latitude, pos.coords.longitude, 400);
        patch({
          cityId: CUSTOM_CITY_ID,
          customLocation: {
            id: CUSTOM_CITY_ID,
            name: near ? `המיקום שלי (ליד ${near.name})` : 'המיקום שלי',
            region: 'מיקום מדויק',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            tzid: deviceTimeZone(),
            il: near?.il ?? deviceTimeZone() === 'Asia/Jerusalem',
          },
        });
        onClose();
      },
      () => {
        setLocating(false);
        setLocateError('לא הצלחנו לאתר את המיקום');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLocateError('הדפדפן לא תומך באיתור מיקום');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const city = nearestCity(pos.coords.latitude, pos.coords.longitude, 80);
        if (city) select(city.id);
        else setLocateError('לא נמצאה עיר קרובה ברשימה. בחרו ידנית.');
      },
      () => {
        setLocating(false);
        setLocateError('לא הצלחנו לאתר את המיקום');
      },
      { timeout: 8000, maximumAge: 300_000 },
    );
  };

  return (
    <Sheet open={open} onClose={onClose} size="tall" title="עיר לחישוב הזמנים">
      <div className="mb-3.5 flex items-center gap-3 rounded-2xl bg-well px-4 py-3.5">
        <Search size={ICON.lg} strokeWidth={STROKE} className="shrink-0 text-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש עיר"
          className="field-reset bg-transparent p-0 text-body text-ink placeholder:text-faint"
        />
      </div>

      <div className="mb-5 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand-soft py-4 text-label font-semibold text-brand-ink disabled:opacity-60"
        >
          <Crosshair size={ICON.lg} strokeWidth={STROKE} />
          {locating ? 'מאתר…' : 'העיר הקרובה אליי'}
        </button>
        <button
          type="button"
          onClick={useExactLocation}
          disabled={locating}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-well py-4 text-label font-semibold text-ink disabled:opacity-60"
        >
          <Crosshair size={ICON.lg} strokeWidth={STROKE} className="text-muted" />
          המיקום המדויק שלי
        </button>
      </div>

      {locateError && (
        <p className="mb-4 rounded-2xl bg-well px-4 py-3.5 text-caption text-muted">{locateError}</p>
      )}

      {groups.map((group) => (
        <section key={group.region} className="mb-4">
          <h3 className="mb-2 px-2 text-caption font-semibold uppercase tracking-wide text-faint">
            {group.region}
          </h3>
          <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">
            {group.cities.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c.id)}
                className="flex w-full items-center gap-3 px-4 py-4 text-right"
              >
                <span className="flex-1 text-body text-ink">{c.name}</span>
                {c.id === cityId && (
                  <Check size={ICON.lg} strokeWidth={2.6} className="shrink-0 text-brand" />
                )}
              </button>
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <p className="py-6 text-center text-label text-muted">לא נמצאה עיר בשם הזה</p>
      )}
    </Sheet>
  );
}
