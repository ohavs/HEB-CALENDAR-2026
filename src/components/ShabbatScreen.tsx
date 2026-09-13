/** טאב זמני כניסת ויציאת שבת וחג. */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Moon, Sunset } from 'lucide-react';
import { upcomingShabbatot, type ShabbatEntry } from '@/lib/hebrew';
import { dayTitleLabel, startOfDay } from '@/lib/dates';
import { findCity } from '@/lib/locations';
import { toFilters, useSettings } from '@/store/settings';

/** "מתקיים כעת", "בעוד 4 שעות", "מחר", "בעוד יומיים" */
function countdownLabel(entry: ShabbatEntry, now = Date.now()): string {
  const start = entry.candles?.at;
  const end = entry.havdalah?.at;
  if (start === undefined) return '';
  if (start <= now) return end && end > now ? 'מתקיים כעת' : 'הסתיים';
  const diff = start - now;
  const hours = diff / 3_600_000;
  if (hours < 1) return `בעוד ${Math.max(1, Math.round(diff / 60_000))} דקות`;
  if (hours < 24) return `בעוד ${Math.round(hours)} שעות`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'מחר';
  if (days === 2) return 'בעוד יומיים';
  return `בעוד ${days} ימים`;
}

export function ShabbatScreen({
  onPickCity,
  bottomInset,
}: {
  onPickCity: () => void;
  bottomInset: number;
}) {
  const settings = useSettings();
  const city = findCity(settings.cityId);

  const entries = useMemo(
    () =>
      upcomingShabbatot(startOfDay(new Date()), 10, {
        ...toFilters(settings),
        city,
        showCandleTimes: true,
      }),
    [settings, city],
  );

  const [next, ...rest] = entries;

  return (
    <div
      className="no-scrollbar app-shell-narrow flex-1 overflow-y-auto overscroll-contain gutter-x"
      style={{ paddingBottom: bottomInset + 24 }}
    >
      <header className="safe-t flex items-center gap-3 pb-5 pt-5 lg:pt-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-heading font-semibold leading-tight text-ink">שבת וחגים</h1>
          <p className="mt-1.5 text-caption text-muted">
            זמנים מדויקים כולל שעון קיץ וחורף
          </p>
        </div>
        <motion.button
          type="button"
          onClick={onPickCity}
          whileTap={{ scale: 0.96 }}
          className="flex shrink-0 items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-label font-medium text-ink shadow-soft"
        >
          <MapPin size={16} strokeWidth={2.3} className="text-brand" />
          {city.name}
        </motion.button>
      </header>

      {next && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mb-5 overflow-hidden rounded-3xl bg-surface shadow-soft"
        >
          <div className="bg-brand px-6 pb-5 pt-5 text-white">
            <p className="text-caption opacity-85">
              {next.isHoliday ? 'החג הקרוב' : 'השבת הקרובה'}
            </p>
            <h2 className="mt-1 text-heading font-semibold leading-tight">{next.title}</h2>
            <p className="mt-2 text-caption opacity-85">
              {dayTitleLabel(next.startDate)}
              {next.candles ? ` · ${countdownLabel(next)}` : ''}
            </p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline">
            <div className="px-6 py-5">
              <p className="flex items-center gap-2 text-caption text-muted">
                <Sunset size={16} strokeWidth={2.3} className="text-[rgb(var(--c-shabbat))]" />
                הדלקת נרות
              </p>
              <p className="tnum mt-2 text-display font-semibold leading-none text-ink">
                {next.candles?.time ?? '—'}
              </p>
            </div>
            <div className="px-6 py-5">
              <p className="flex items-center gap-2 text-caption text-muted">
                <Moon size={16} strokeWidth={2.3} className="text-brand" />
                יציאה / הבדלה
              </p>
              <p className="tnum mt-2 text-display font-semibold leading-none text-ink">
                {next.havdalah?.time ?? '—'}
              </p>
            </div>
          </div>

          {(next.parsha || next.holidays.length > 0) && (
            <div className="flex flex-wrap gap-2 border-t border-hairline px-6 py-4">
              {next.parsha && (
                <span className="rounded-full bg-brand-soft px-3.5 py-1.5 text-caption font-medium text-brand-ink">
                  פרשת {next.parsha}
                </span>
              )}
              {next.holidays.map((h) => (
                <span
                  key={h}
                  className="rounded-full bg-well px-3.5 py-1.5 text-caption font-medium text-muted"
                >
                  {h}
                </span>
              ))}
            </div>
          )}
        </motion.section>
      )}

      <h3 className="mb-2.5 px-2 text-caption font-semibold uppercase tracking-wide text-faint">
        השבועות הבאים
      </h3>

      <div className="mb-4 divide-y divide-hairline overflow-hidden rounded-3xl bg-surface shadow-soft">
        {rest.map((entry, i) => (
          <motion.div
            key={entry.startKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.25), duration: 0.26 }}
            className="flex items-center gap-4 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium text-ink">{entry.title}</p>
              <p className="mt-1 truncate text-caption text-muted">
                {dayTitleLabel(entry.startDate)}
                {entry.endKey !== entry.startKey
                  ? ` – ${dayTitleLabel(entry.endDate).replace('יום ', '')}`
                  : ''}
              </p>
            </div>
            <div className="shrink-0 text-left">
              <p className="tnum text-title font-semibold leading-tight text-ink">
                {entry.candles?.time ?? '—'}
              </p>
              <p className="tnum mt-0.5 text-caption leading-tight text-muted">
                {entry.havdalah?.time ?? '—'}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="px-2 pb-3 text-caption leading-relaxed text-faint">
        הדלקת נרות {settings.candleLightingMins} דקות לפני השקיעה.{' '}
        {settings.havdalahMode === 'degrees'
          ? `הבדלה בצאת הכוכבים (${settings.havdalahDegrees}°).`
          : `הבדלה ${settings.havdalahMins} דקות לאחר השקיעה.`}{' '}
        אפשר לשנות בהגדרות. הזמנים מחושבים לפי אזור הזמן של {city.name}.
      </p>
    </div>
  );
}
