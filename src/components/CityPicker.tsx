/** בוחר עיר לחישוב הזמנים, עם חיפוש ואיתור לפי מיקום המכשיר. */
import { useMemo, useState } from 'react';
import { Check, Crosshair, Search } from 'lucide-react';
import { CITIES, citiesByRegion, nearestCity } from '@/lib/locations';
import { useSettingsStore } from '@/store/settings';
import { Sheet } from './ui/Sheet';

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
    patch({ cityId: id, ...(city ? { candleLightingMins: city.il ? 40 : 18 } : {}) });
    onClose();
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
      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-well px-3.5 py-2.5">
        <Search size={16} strokeWidth={2.3} className="shrink-0 text-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש עיר"
          className="w-full border-none bg-transparent p-0 text-[15px] text-ink outline-none placeholder:text-faint"
        />
      </div>

      <button
        type="button"
        onClick={locate}
        disabled={locating}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-soft py-3 text-[14px] font-semibold text-brand-ink disabled:opacity-60"
      >
        <Crosshair size={16} strokeWidth={2.3} />
        {locating ? 'מאתר…' : 'לפי המיקום שלי'}
      </button>

      {locateError && (
        <p className="mb-3 rounded-2xl bg-well px-4 py-3 text-[13px] text-muted">{locateError}</p>
      )}

      {groups.map((group) => (
        <section key={group.region} className="mb-4">
          <h3 className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-faint">
            {group.region}
          </h3>
          <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">
            {group.cities.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-right"
              >
                <span className="flex-1 text-[15px] text-ink">{c.name}</span>
                {c.id === cityId && (
                  <Check size={17} strokeWidth={2.6} className="shrink-0 text-brand" />
                )}
              </button>
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <p className="py-6 text-center text-[13.5px] text-muted">לא נמצאה עיר בשם הזה</p>
      )}
    </Sheet>
  );
}
