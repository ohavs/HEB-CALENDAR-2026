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
            className="flex h-9 w-9 items-center justify-center rounded-full bg-well text-muted active:bg-hairline"
          >
            <ChevronRight size={18} strokeWidth={2.3} />
          </button>
          <button
            type="button"
            aria-label="היום הבא"
            onClick={() => onNavigate(addDays(day.date, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-well text-muted active:bg-hairline"
          >
            <ChevronLeft size={18} strokeWidth={2.3} />
          </button>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={onAddEvent}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-body font-semibold text-white"
        >
          <Plus size={18} strokeWidth={2.5} />
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
              className="flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3"
            >
              {h.emoji && <span className="text-heading leading-none">{h.emoji}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold text-brand-ink">{h.title}</p>
                {h.restWork && <p className="text-tiny text-brand-ink/70">אסור בעשיית מלאכה</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* פרשה ועומר */}
      {(day.parsha || day.omerDay) && (
        <div className="mb-4 flex gap-2">
          {day.parsha && (
            <div className="flex-1 rounded-2xl bg-well px-4 py-3">
              <p className="text-tiny text-muted">פרשת השבוע</p>
              <p className="text-label font-semibold text-ink">{day.parsha}</p>
            </div>
          )}
          {day.omerDay && (
            <div className="flex-1 rounded-2xl bg-well px-4 py-3">
              <p className="text-tiny text-muted">ספירת העומר</p>
              <p className="text-label font-semibold text-ink">יום {day.omerDay}</p>
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
                className={`rounded-2xl px-4 py-3 ${
                  t.kind === 'candles'
                    ? 'bg-[rgb(var(--c-shabbat)/0.1)]'
                    : t.kind === 'havdalah'
                      ? 'bg-brand-soft'
                      : 'bg-well'
                }`}
              >
                <p className="truncate text-tiny text-muted">{t.title}</p>
                <p className="tnum text-title font-semibold text-ink">{t.time}</p>
              </div>
            ))}
        </div>
      )}

      {/* אירועים */}
      <div className="mb-4">
        <h3 className="mb-2 text-caption font-semibold uppercase tracking-wide text-faint">
          אירועים
        </h3>
        {occurrences.length ? (
          <div className="space-y-2">
            {occurrences.map((occ) => (
              <EventCard
                key={occ.occurrenceId}
                occurrence={occ}
                onClick={() => onEditEvent(occ)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-hairline px-4 py-5 text-center text-caption text-muted">
            אין אירועים ביום הזה
          </p>
        )}
      </div>

      {/* זמני היום */}
      <div className="mb-4 overflow-hidden rounded-2xl bg-well">
        <button
          type="button"
          onClick={() => setShowZmanim((v) => !v)}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-right"
        >
          <Sun size={17} strokeWidth={2.2} className="shrink-0 text-muted" />
          <span className="flex-1 text-label font-medium text-ink">זמני היום ב{city.name}</span>
          <motion.span
            animate={{ rotate: showZmanim ? 90 : 0 }}
            className="shrink-0 text-faint"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <ChevronLeft size={17} strokeWidth={2.3} />
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
              <div key={k} className="flex items-center justify-between py-[5px]">
                <dt className="text-caption text-muted">{ZMANIM_LABELS[k]}</dt>
                <dd className="tnum text-label font-medium text-ink">{zmanim[k]}</dd>
              </div>
            ))}
          </motion.dl>
        )}
      </div>

      {/* תאריך עברי אחרי השקיעה */}
      {eveningDate && (
        <p className="mb-2 px-1 text-tiny leading-relaxed text-faint">
          מהשקיעה מתחיל {eveningDate.full}
        </p>
      )}
    </Sheet>
  );
}
