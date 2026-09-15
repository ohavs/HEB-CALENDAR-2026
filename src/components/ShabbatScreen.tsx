/** טאב זמני כניסת ויציאת שבת וחג. */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Moon, Sunset } from 'lucide-react';
import { upcomingShabbatot, type ShabbatEntry } from '@/lib/hebrew';
import { GREG_MONTHS_HE, startOfDay, weekdayDateLabel } from '@/lib/dates';
import { findCity } from '@/lib/locations';
import { toFilters, useSettings } from '@/store/settings';
import { ICON, STROKE } from '@/lib/motion';

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

/**
 * "18-19 בספטמבר", או "30 בספטמבר - 1 באוקטובר" כשהחודש מתחלף.
 *
 * ברשימה של שמונה שורות התאריך הוא מה שמפריד ביניהן, ולכן הוא קצר
 * ומודגש: "יום שישי, 18 בספטמבר - שבת, 19 בספטמבר" נקרא כמשפט ולא
 * כתאריך, וכל השורות נראו אותו דבר.
 */
function rangeLabel(start: Date, end: Date): string {
  const day = (d: Date) => d.getDate();
  const month = (d: Date) => GREG_MONTHS_HE[d.getMonth()];
  if (start.getTime() === end.getTime()) return `${day(start)} ב${month(start)}`;
  if (start.getMonth() === end.getMonth()) {
    return `${day(start)}–${day(end)} ב${month(start)}`;
  }
  return `${day(start)} ב${month(start)} – ${day(end)} ב${month(end)}`;
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
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-surface px-4 py-2.5 text-label font-medium text-ink shadow-raised"
        >
          <MapPin size={ICON.sm} strokeWidth={STROKE} className="text-brand" />
          {city.name}
        </motion.button>
      </header>

      {next && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mb-5 overflow-hidden rounded-3xl bg-surface shadow-raised"
        >
          {/*
            שם הפרשה ירד לשורה אחת בראש הכרטיס. מה שמחפשים כאן הוא שתי
            שעות, והן מקבלות את הגובה: המסך הזה נפתח ביום שישי אחר הצהריים
            כדי לענות על שאלה אחת.
          */}
          <div className="flex items-baseline gap-2 bg-brand px-6 pb-3.5 pt-4 text-white">
            <h2 className="min-w-0 flex-1 truncate text-label font-semibold leading-tight">
              {next.title}
            </h2>
            <span className="shrink-0 text-caption opacity-85">
              {next.candles ? countdownLabel(next) : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline">
            <div className="px-5 py-6 text-center">
              <p className="flex items-center justify-center gap-1.5 text-caption font-medium text-muted">
                <Sunset size={ICON.sm} strokeWidth={STROKE} className="text-[rgb(var(--c-shabbat))]" />
                הדלקת נרות
              </p>
              <p className="tnum mt-2.5 text-display font-bold leading-none text-ink">
                {next.candles?.time ?? '—'}
              </p>
              <p className="mt-2 text-caption text-faint">{weekdayDateLabel(next.startDate)}</p>
            </div>
            <div className="px-5 py-6 text-center">
              <p className="flex items-center justify-center gap-1.5 text-caption font-medium text-muted">
                <Moon size={ICON.sm} strokeWidth={STROKE} className="text-brand" />
                צאת השבת
              </p>
              <p className="tnum mt-2.5 text-display font-bold leading-none text-ink">
                {next.havdalah?.time ?? '—'}
              </p>
              <p className="mt-2 text-caption text-faint">{weekdayDateLabel(next.endDate)}</p>
            </div>
          </div>

          {/*
            צ׳יפ הפרשה ירד: הכותרת כבר אומרת "שבת פרשת האזינו", והצ׳יפ
            חזר על אותן מילים בשורה נפרדת. מה שנשאר הוא מה שהכותרת לא
            אומרת - שבת שובה, חול המועד וכדומה.
          */}
          {next.holidays.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-hairline px-5 py-3">
              {next.holidays.map((h) => (
                <span
                  key={h}
                  className="rounded-lg bg-well px-3 py-1.5 text-caption font-medium text-muted"
                >
                  {h}
                </span>
              ))}
            </div>
          )}
        </motion.section>
      )}

      <h3 className="mb-2.5 px-2 text-caption font-semibold uppercase tracking-wide text-faint">
        המועדים הבאים
      </h3>

      <div className="mb-4 divide-y divide-hairline overflow-hidden rounded-3xl bg-surface shadow-raised">
        {rest.map((entry, i) => (
          <motion.div
            key={entry.startKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.25), duration: 0.26 }}
            className="flex items-center gap-4 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              {/* התאריך קודם ומודגש: ברשימה של שמונה שורות הוא מה שמפריד ביניהן */}
              <p className="truncate text-caption font-semibold text-ink">
                {rangeLabel(entry.startDate, entry.endDate)}
              </p>
              <p className="mt-0.5 truncate text-caption text-muted">{entry.title}</p>
            </div>
            {/*
              אותם שני אייקונים של הכרטיס העליון. בלעדיהם שני הזמנים
              מוצגים זה מעל זה בלי תווית, והקורא צריך לנחש מי מהם כניסה.
            */}
            <div className="shrink-0 text-left">
              <p className="flex items-center justify-end gap-1.5">
                <span className="tnum text-title font-bold leading-tight text-ink">
                  {entry.candles?.time ?? '—'}
                </span>
                <Sunset
                  size={ICON.sm}
                  strokeWidth={STROKE}
                  className="text-[rgb(var(--c-shabbat))]"
                  aria-label="הדלקת נרות"
                />
              </p>
              <p className="mt-1 flex items-center justify-end gap-1.5">
                <span className="tnum text-label font-semibold leading-tight text-muted">
                  {entry.havdalah?.time ?? '—'}
                </span>
                <Moon
                  size={ICON.sm}
                  strokeWidth={STROKE}
                  className="text-brand"
                  aria-label="יציאה והבדלה"
                />
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
