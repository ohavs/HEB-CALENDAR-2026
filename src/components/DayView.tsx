/** תצוגת יום מורחבת - נפתחת בלחיצה על יום בלוח. */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Sun } from 'lucide-react';
import type { DayInfo } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { ZMANIM_LABELS, dayZmanim, hebrewDateAfterSunset } from '@/lib/hebrew';
import { addDays, dayTitleLabel, relativeDayLabel } from '@/lib/dates';
import { findCity } from '@/lib/locations';
import { useSettings } from '@/store/settings';
import { Sheet } from './ui/Sheet';
import { EventCard } from './EventChip';
import { useEventsStore } from '@/store/events';
import { ICON, SNAP, STROKE } from '@/lib/motion';

export function DayView({
  open,
  onClose,
  day,
  occurrences,
  onNavigate,
  onAddEvent,
  onEditEvent,
}: {
  open: boolean;
  onClose: () => void;
  day: DayInfo | null;
  occurrences: Occurrence[];
  onNavigate: (date: Date) => void;
  onAddEvent: () => void;
  onEditEvent: (occurrence: Occurrence) => void;
}) {
  const settings = useSettings();
  const setDone = useEventsStore((s) => s.setOccurrenceDone);
  const [showZmanim, setShowZmanim] = useState(false);
  const city = findCity(settings.cityId);

  const zmanim = useMemo(
    () => (day && showZmanim ? dayZmanim(day.date, city) : null),
    [day, showZmanim, city],
  );

  const eveningDate = useMemo(
    () => (day ? hebrewDateAfterSunset(day.date) : null),
    [day],
  );

  if (!day) return null;

  const candles = day.times.find((t) => t.kind === 'candles');
  const havdalah = day.times.find((t) => t.kind === 'havdalah');
  const fastBegins = day.times.find((t) => t.kind === 'fast-begins');
  const fastEnds = day.times.find((t) => t.kind === 'fast-ends');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={dayTitleLabel(day.date)}
      subtitle={`${day.hebrewFull}${day.isToday ? ' · היום' : ''}`}
      headerAction={
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="היום הקודם"
            onClick={() => onNavigate(addDays(day.date, -1))}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-well text-muted active:bg-hairline"
          >
            <ChevronRight size={ICON.lg} strokeWidth={STROKE} />
          </button>
          <button
            type="button"
            aria-label="היום הבא"
            onClick={() => onNavigate(addDays(day.date, 1))}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-well text-muted active:bg-hairline"
          >
            <ChevronLeft size={ICON.lg} strokeWidth={STROKE} />
          </button>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={onAddEvent}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand py-4 text-label font-semibold text-white"
        >
          <Plus size={ICON.md} strokeWidth={STROKE} />
          אירוע חדש ב{relativeDayLabel(day.date)}
        </button>
      }
    >
      {/* מועדים */}
      {day.holidays.length > 0 && (
        <div className="mb-4 space-y-2">
          {day.holidays.map((h) => (
            <div
              key={h.id}
              className="flex items-center gap-3.5 rounded-2xl bg-brand-soft px-4 py-4"
            >
              {h.emoji && <span className="text-heading leading-none">{h.emoji}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold text-brand-ink">{h.title}</p>
                {h.restWork && <p className="mt-0.5 text-caption text-brand-ink/70">אסור בעשיית מלאכה</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* פרשה ועומר */}
      {(day.parsha || day.omerDay) && (
        <div className="mb-4 flex gap-2">
          {day.parsha && (
            <div className="flex-1 rounded-2xl bg-well px-4 py-3.5">
              <p className="text-caption text-muted">פרשת השבוע</p>
              <p className="mt-1 text-body font-semibold text-ink">{day.parsha}</p>
            </div>
          )}
          {day.omerDay && (
            <div className="flex-1 rounded-2xl bg-well px-4 py-3.5">
              <p className="text-caption text-muted">ספירת העומר</p>
              <p className="mt-1 text-body font-semibold text-ink">יום {day.omerDay}</p>
            </div>
          )}
        </div>
      )}

      {/* זמני שבת/צום */}
      {(candles || havdalah || fastBegins || fastEnds) && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {[candles, havdalah, fastBegins, fastEnds]
            .filter((t): t is NonNullable<typeof t> => Boolean(t))
            .map((t) => (
              <div
                key={t.id}
                className={`rounded-2xl px-4 py-3.5 ${
                  t.kind === 'candles'
                    ? 'bg-[rgb(var(--c-shabbat)/0.1)]'
                    : t.kind === 'havdalah'
                      ? 'bg-brand-soft'
                      : 'bg-well'
                }`}
              >
                <p className="truncate text-caption text-muted">{t.title}</p>
                <p className="tnum mt-1 text-heading font-semibold text-ink">{t.time}</p>
              </div>
            ))}
        </div>
      )}

      {/* אירועים */}
      <div className="mb-4">
        <h3 className="mb-2.5 text-caption font-semibold uppercase tracking-wide text-faint">
          אירועים
        </h3>
        {occurrences.length ? (
          <div className="space-y-2">
            {occurrences.map((occ) => (
              <EventCard
                key={occ.occurrenceId}
                occurrence={occ}
                onClick={() => onEditEvent(occ)}
                onToggleDone={(done) => setDone(occ.baseId, occ.sourceKey, done)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-hairline px-4 py-7 text-center text-body text-muted">
            אין אירועים ביום הזה
          </p>
        )}
      </div>

      {/* זמני היום */}
      <div className="mb-4 overflow-hidden rounded-2xl bg-well">
        <button
          type="button"
          onClick={() => setShowZmanim((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-4 text-right"
        >
          <Sun size={ICON.lg} strokeWidth={STROKE} className="shrink-0 text-muted" />
          <span className="flex-1 text-body font-medium text-ink">זמני היום ב{city.name}</span>
          <motion.span
            animate={{ rotate: showZmanim ? 90 : 0 }}
            className="shrink-0 text-faint"
            transition={SNAP}
          >
            <ChevronLeft size={ICON.md} strokeWidth={STROKE} />
          </motion.span>
        </button>
        {zmanim && (
          <motion.dl
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-hairline px-4 pb-2 pt-1"
          >
            {(Object.keys(ZMANIM_LABELS) as (keyof typeof ZMANIM_LABELS)[]).map((k) => (
              <div key={k} className="flex items-center justify-between py-2">
                <dt className="text-label text-muted">{ZMANIM_LABELS[k]}</dt>
                <dd className="tnum text-label font-semibold text-ink">{zmanim[k]}</dd>
              </div>
            ))}
          </motion.dl>
        )}
      </div>

      {/* תאריך עברי אחרי השקיעה */}
      {eveningDate && (
        <p className="mb-2 px-1 text-caption leading-relaxed text-faint">
          מהשקיעה מתחיל {eveningDate.full}
        </p>
      )}
    </Sheet>
  );
}
