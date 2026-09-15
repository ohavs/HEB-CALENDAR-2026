/**
 * סדר יום - רשימה רציפה של מה שבאמת קורה.
 *
 * בניגוד ללוח, כאן אין ימים ריקים: יום בלי אירוע ובלי מועד פשוט לא
 * מופיע. זו התצוגה שעונה על "מה יש לי השבוע" בלי לספור משבצות.
 *
 * הרשימה נטענת בחלונות של שלושה חודשים ומתארכת כשמגיעים לסופה, במקום
 * לחשב שנה שלמה מראש.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarPlus, ChevronDown, RotateCcw, Search } from 'lucide-react';
import type { DayInfo } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { useRangeData } from '@/hooks/useMonthData';
import {
  addDays,
  dateKey,
  dayTitleLabel,
  relativeDayLabel,
  startOfDay,
  GREG_MONTHS_HE,
} from '@/lib/dates';
import { hebrewMonthSpanLabel } from '@/lib/hebrew';
import { useSettings, useSettingsStore } from '@/store/settings';
import { AGENDA_CATEGORIES, filterAgendaDay, toggleCategory } from '@/lib/agendaFilters';
import { AgendaFilterButton, AgendaFilterSheet } from './AgendaFilters';
import { EventCard } from './EventChip';
import { useEventsStore } from '@/store/events';
import { ICON, STROKE, TAP, TAP_SCALE } from '@/lib/motion';

/** כמה ימים נטענים בכל פעם */
const WINDOW_DAYS = 92;
/** תקרה, כדי שגלילה ארוכה לא תנסה לחשב עשור */
const MAX_DAYS = 730;

type AgendaEntry = { day: DayInfo; occurrences: Occurrence[] };

/**
 * שובר חודש.
 *
 * הרשימה רציפה ואין בה ימים ריקים, ולכן ה-30 בספטמבר וה-1 באוקטובר
 * נראים כמו שני ימים רגילים זה אחרי זה - מספר היום קופץ אחורה ושום
 * דבר לא אומר למה. הכותרת היא הדבר היחיד שאומר באיזה חודש אנחנו,
 * והיא גם נקודת עגינה לעין בגלילה ארוכה.
 */
function MonthDivider({ date, hebrew }: { date: Date; hebrew: string | null }) {
  return (
    <div className="flex items-baseline gap-2.5 pb-3 pt-4 first:pt-0">
      <h2 className="shrink-0 text-label font-bold text-ink">
        {GREG_MONTHS_HE[date.getMonth()]} {date.getFullYear()}
      </h2>
      {hebrew && <span className="shrink-0 text-caption text-muted">{hebrew}</span>}
      <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-hairline" />
    </div>
  );
}

/** האם השובר צריך להופיע לפני היום הזה */
function startsMonth(entry: AgendaEntry, previous: AgendaEntry | undefined): boolean {
  if (!previous) return true;
  const a = previous.day.date;
  const b = entry.day.date;
  return a.getMonth() !== b.getMonth() || a.getFullYear() !== b.getFullYear();
}

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
  const setDone = useEventsStore((s) => s.setOccurrenceDone);
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
            onToggleDone={(done) => setDone(occ.baseId, occ.sourceKey, done)}
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
  onSearch,
  bottomInset,
}: {
  /** מאיפה הרשימה מתחילה - בדרך כלל היום */
  from: Date;
  onOpenDay: (date: Date) => void;
  onAddEvent: () => void;
  onEditEvent: (occurrence: Occurrence) => void;
  onMoveEvent: (occurrence: Occurrence, days: number) => void;
  /** החיפוש חי כאן מאז שירד מכותרת הלוח */
  onSearch: () => void;
  bottomInset: number;
}) {
  const settings = useSettings();
  const [days, setDays] = useState(WINDOW_DAYS);
  const sentinel = useRef<HTMLDivElement>(null);

  const start = useMemo(() => startOfDay(from), [from]);
  const end = useMemo(() => addDays(start, days), [start, days]);
  const data = useRangeData(start, end);

  const hidden = settings.agendaHidden;
  const setValue = useSettingsStore((s) => s.set);
  const [filtersOpen, setFiltersOpen] = useState(false);

  /**
   * שינוי הסינון ממסגר את הרשימה מחדש מהחלון הקרוב.
   *
   * בלי זה החלון רק גדל: סינון מקצר את הרשימה, הזקיף נחשף, וההארכה רצה -
   * וכשמחזירים את הסינון נשארים עם שנתיים של ימים על המסך בבת אחת.
   */
  const hiddenKey = [...hidden].sort().join(',');
  useEffect(() => {
    setDays(WINDOW_DAYS);
  }, [hiddenKey]);

  // הארכה אוטומטית כשמגיעים לסוף הרשימה.
  //
  // כשהכול מסונן הרשימה ריקה, הזקיף גלוי מיד, וההארכה הייתה רצה שוב
  // ושוב עד התקרה - שמונה חישובים של טווח שהולך וגדל, שאף אחד מהם לא
  // יכול להחזיר כלום. במצב הזה אין טעם להאריך.
  const everythingHidden = hidden.length === AGENDA_CATEGORIES.length;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || days >= MAX_DAYS || everythingHidden) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setDays((d) => Math.min(MAX_DAYS, d + WINDOW_DAYS));
      },
      { rootMargin: '400px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [days, everythingHidden]);

  /** רק ימים שנשאר בהם משהו אחרי הסינון. יום ריק בסדר יום הוא רעש. */
  const entries = useMemo(() => {
    const out: AgendaEntry[] = [];
    for (const date of data.dates) {
      const key = dateKey(date);
      const day = data.days.get(key);
      if (!day) continue;
      // כיבוי המועדים בהגדרות גובר על הפילטר המקומי
      const base = settings.showJewishHolidays ? day : { ...day, holidays: [] };
      const entry = filterAgendaDay(base, data.occurrences.get(key) ?? [], hidden);
      if (entry) out.push(entry);
    }
    return out;
  }, [data, hidden, settings.showJewishHolidays]);

  return (
    <div
      className="no-scrollbar min-h-0 flex-1 overflow-y-auto gutter-x pt-2"
      style={{ paddingBottom: bottomInset + 24 }}
    >
      <div className="app-shell-narrow">
        {/*
          החיפוש ירד מכותרת הלוח כדי שהשורה שם תישאר שורה אחת, והוא נחת
          כאן: סדר היום הוא רשימה, וחיפוש ברשימה הוא המקום שמצפים לו.
        */}
        <AgendaFilterButton
          hidden={hidden}
          onOpen={() => setFiltersOpen(true)}
          action={
            <motion.button
              type="button"
              onClick={onSearch}
              whileTap={{ scale: 0.92 }}
              transition={TAP}
              aria-label="חיפוש"
              className="focus-ring flex w-11 shrink-0 items-center justify-center self-stretch rounded-2xl bg-surface text-muted shadow-raised"
            >
              <Search size={ICON.md} strokeWidth={STROKE} />
            </motion.button>
          }
        />

        {entries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-hairline px-5 py-14 text-center">
            {hidden.length > 0 ? (
              <>
                <p className="text-body text-muted">הכול מסונן</p>
                <motion.button
                  type="button"
                  whileTap={TAP_SCALE}
                  onClick={() => setValue('agendaHidden', [])}
                  className="focus-ring mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand-soft px-5 py-3 text-label font-semibold text-brand-ink"
                >
                  <RotateCcw size={ICON.md} strokeWidth={STROKE} />
                  הצגת הכול
                </motion.button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        ) : (
          entries.map((entry, i) => (
            <Fragment key={entry.day.key}>
              {startsMonth(entry, entries[i - 1]) && (
                <MonthDivider
                  date={entry.day.date}
                  hebrew={
                    settings.showHebrewMonths
                      ? hebrewMonthSpanLabel(
                          new Date(entry.day.date.getFullYear(), entry.day.date.getMonth(), 1),
                        )
                      : null
                  }
                />
              )}
              <DayGroup
                entry={entry}
                onOpenDay={onOpenDay}
                onEditEvent={onEditEvent}
                onMoveEvent={onMoveEvent}
              />
            </Fragment>
          ))
        )}

        <AgendaFilterSheet
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          hidden={hidden}
          onToggle={(category) => setValue('agendaHidden', toggleCategory(hidden, category))}
          onReset={() => setValue('agendaHidden', [])}
        />

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
