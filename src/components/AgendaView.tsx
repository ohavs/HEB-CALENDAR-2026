/**
 * סדר יום - רשימה רציפה של מה שבאמת קורה.
 *
 * בניגוד ללוח, כאן אין ימים ריקים: יום בלי אירוע ובלי מועד פשוט לא
 * מופיע. זו התצוגה שעונה על "מה יש לי השבוע" בלי לספור משבצות.
 *
 * הרשימה נטענת בחלונות של שלושה חודשים ומתארכת כשמגיעים לסופה, במקום
 * לחשב שנה שלמה מראש.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarPlus, ChevronDown } from 'lucide-react';
import type { DayInfo } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { useRangeData } from '@/hooks/useMonthData';
import { addDays, dateKey, dayTitleLabel, relativeDayLabel, startOfDay } from '@/lib/dates';
import { useSettings } from '@/store/settings';
import { EventCard } from './EventChip';
import { ICON, STROKE, TAP_SCALE } from '@/lib/motion';

/** כמה ימים נטענים בכל פעם */
const WINDOW_DAYS = 92;
/** תקרה, כדי שגלילה ארוכה לא תנסה לחשב עשור */
const MAX_DAYS = 730;

type AgendaEntry = { day: DayInfo; occurrences: Occurrence[] };

function DayGroup({
  entry,
  onOpenDay,
  onEditEvent,
  onMoveEvent,
}: {
  entry: AgendaEntry;
  onOpenDay: (date: Date) => void;
  onEditEvent: (occurrence: Occurrence) => void;
  onMoveEvent: (occurrence: Occurrence, days: number) => void;
}) {
  const { day, occurrences } = entry;
  const candles = day.times.find((t) => t.kind === 'candles');
  const havdalah = day.times.find((t) => t.kind === 'havdalah');

  return (
    <section className="flex gap-3.5">
      {/* עמודת התאריך */}
      <button
        type="button"
        onClick={() => onOpenDay(day.date)}
        aria-label={`${dayTitleLabel(day.date)} ${day.hebrewFull}`}
        className="focus-ring w-14 shrink-0 rounded-2xl pt-1 text-center"
      >
        <span
          className={`tnum mx-auto flex h-11 w-11 items-center justify-center rounded-2xl text-title font-bold leading-none ${
            day.isToday ? 'bg-brand text-white' : day.isRestDay ? 'bg-brand-soft text-brand-ink' : 'text-ink'
          }`}
        >
          {day.date.getDate()}
        </span>
        <span className="mt-1.5 block text-micro leading-none text-faint">{day.hebrewDay}</span>
      </button>

      {/* תוכן היום */}
      <div className="min-w-0 flex-1 space-y-2 pb-7">
        <h3 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="text-label font-semibold text-ink">
            {relativeDayLabel(day.date)}
          </span>
          <span className="text-caption text-muted">
            {day.hebrewDay} ב{day.hebrewMonth}
          </span>
        </h3>

        {day.holidays.map((h) => (
          <div
            key={h.id}
            className="flex items-center gap-2.5 rounded-2xl bg-brand-soft px-3.5 py-2.5"
          >
            <span aria-hidden="true" className="text-label leading-none">
              {h.emoji ?? '✦'}
            </span>
            <span className="min-w-0 flex-1 truncate text-caption font-semibold text-brand-ink">
              {h.title}
            </span>
            {h.restWork && (
              <span className="shrink-0 text-micro text-brand-ink/70">אסור במלאכה</span>
            )}
          </div>
        ))}

        {(candles || havdalah) && (
          <div className="flex flex-wrap gap-2">
            {candles && (
              <span className="tnum rounded-xl bg-[rgb(var(--c-shabbat)/0.12)] px-3 py-1.5 text-caption font-medium text-[rgb(var(--c-shabbat))]">
                🕯 {candles.time}
              </span>
            )}
            {havdalah && (
              <span className="tnum rounded-xl bg-brand-soft px-3 py-1.5 text-caption font-medium text-brand-ink">
                ✦ {havdalah.time}
              </span>
            )}
          </div>
        )}

        {occurrences.map((occ) => (
          <EventCard
            key={occ.occurrenceId}
            occurrence={occ}
            onClick={() => onEditEvent(occ)}
            onMove={(days) => onMoveEvent(occ, days)}
          />
        ))}
      </div>
    </section>
  );
}

export function AgendaView({
  from,
  onOpenDay,
  onAddEvent,
  onEditEvent,
  onMoveEvent,
  bottomInset,
}: {
  /** מאיפה הרשימה מתחילה - בדרך כלל היום */
  from: Date;
  onOpenDay: (date: Date) => void;
  onAddEvent: () => void;
  onEditEvent: (occurrence: Occurrence) => void;
  onMoveEvent: (occurrence: Occurrence, days: number) => void;
  bottomInset: number;
}) {
  const settings = useSettings();
  const [days, setDays] = useState(WINDOW_DAYS);
  const sentinel = useRef<HTMLDivElement>(null);

  const start = useMemo(() => startOfDay(from), [from]);
  const end = useMemo(() => addDays(start, days), [start, days]);
  const data = useRangeData(start, end);

  // הארכה אוטומטית כשמגיעים לסוף הרשימה
  useEffect(() => {
    const node = sentinel.current;
    if (!node || days >= MAX_DAYS) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setDays((d) => Math.min(MAX_DAYS, d + WINDOW_DAYS));
      },
      { rootMargin: '400px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [days]);

  /** רק ימים שיש בהם משהו. יום ריק בסדר יום הוא רעש. */
  const entries = useMemo(() => {
    const out: AgendaEntry[] = [];
    for (const date of data.dates) {
      const key = dateKey(date);
      const day = data.days.get(key);
      if (!day) continue;
      const occurrences = data.occurrences.get(key) ?? [];
      const holidays = settings.showJewishHolidays ? day.holidays : [];
      if (!occurrences.length && !holidays.length) continue;
      out.push({ day: { ...day, holidays }, occurrences });
    }
    return out;
  }, [data, settings.showJewishHolidays]);

  return (
    <div
      className="no-scrollbar min-h-0 flex-1 overflow-y-auto gutter-x pt-2"
      style={{ paddingBottom: bottomInset + 24 }}
    >
      <div className="app-shell-narrow">
        {entries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-hairline px-5 py-14 text-center">
            <p className="text-body text-muted">אין כלום בטווח הקרוב</p>
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={onAddEvent}
              className="focus-ring mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand-soft px-5 py-3 text-label font-semibold text-brand-ink"
            >
              <CalendarPlus size={ICON.md} strokeWidth={STROKE} />
              הוספת אירוע
            </motion.button>
          </div>
        ) : (
          entries.map((entry) => (
            <DayGroup
              key={entry.day.key}
              entry={entry}
              onOpenDay={onOpenDay}
              onEditEvent={onEditEvent}
              onMoveEvent={onMoveEvent}
            />
          ))
        )}

        <div ref={sentinel} className="flex justify-center py-6 text-caption text-faint">
          {days >= MAX_DAYS ? (
            'עד כאן'
          ) : (
            <span className="flex items-center gap-2">
              <ChevronDown size={ICON.sm} strokeWidth={STROKE} />
              טוען עוד
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
