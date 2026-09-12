/**
 * תא יום בלוח השנה.
 * נקי ושקט: מספר גדול, תאריך עברי קטן מתחתיו, ואז המועדים והאירועים
 * ככיתובים דקים. התא הוא גם יעד השחרור בגרירת אירועים.
 */
import { memo } from 'react';
import { motion } from 'framer-motion';
import type { DayInfo, HolidayKind, Settings } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { MiniEventChip } from './EventChip';
import { useIsDropTarget } from '@/lib/dragEngine';

/** צבע הכיתוב של מועד לפי סוגו. */
function holidayTone(kind: HolidayKind): string {
  switch (kind) {
    case 'yomtov':
    case 'majorfast':
      return 'font-semibold text-brand-ink';
    case 'cholhamoed':
    case 'minor':
      return 'text-brand-ink/85';
    case 'modern':
      return 'text-[rgb(var(--c-shabbat))]';
    default:
      return 'text-muted';
  }
}

type Props = {
  day: DayInfo;
  occurrences: Occurrence[];
  selected: boolean;
  settings: Settings;
  /** כמה שורות כיתוב נכנסות בתא לפי הגובה בפועל */
  capacity: number;
  onSelect: (day: DayInfo) => void;
  layoutGroupId: string;
};

function DayCellInner({
  day,
  occurrences,
  selected,
  settings,
  capacity,
  onSelect,
  layoutGroupId,
}: Props) {
  const isDropTarget = useIsDropTarget(day.key);
  const dim = !day.inCurrentMonth;

  const holidays = settings.showJewishHolidays ? day.holidays : [];
  // מועד ראשון תמיד מוצג; השאר מתחלקים עם האירועים לפי המקום שנשאר
  const holidaySlots = Math.max(
    Math.min(holidays.length, 1),
    Math.min(holidays.length, capacity - Math.min(occurrences.length, 1)),
  );
  const shownHolidays = holidays.slice(0, holidaySlots);
  const shownEvents = occurrences.slice(0, Math.max(0, capacity - shownHolidays.length));
  const hidden =
    holidays.length - shownHolidays.length + (occurrences.length - shownEvents.length);

  const candles = settings.showCandleTimes
    ? day.times.find((t) => t.kind === 'candles')
    : undefined;
  const havdalah = settings.showCandleTimes
    ? day.times.find((t) => t.kind === 'havdalah')
    : undefined;
  const time = candles ?? havdalah;

  return (
    <button
      type="button"
      data-day-key={day.key}
      onClick={() => onSelect(day)}
      className={`relative flex min-h-0 select-none flex-col items-stretch overflow-hidden rounded-2xl px-[2px] pb-[2px] pt-1 text-center outline-none transition-colors ${
        dim ? 'opacity-45' : ''
      } ${day.isShabbat && !dim ? 'bg-brand/[0.04]' : ''}`}
      aria-label={`${day.date.getDate()} ${day.hebrewFull}`}
      aria-pressed={selected}
    >
      {isDropTarget && (
        <motion.span
          layoutId="drop-target"
          className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-brand bg-brand/10"
          transition={{ type: 'spring', stiffness: 600, damping: 40 }}
        />
      )}

      {/* מספר היום */}
      <span className="relative flex h-[24px] shrink-0 items-center justify-center">
        {selected && (
          <motion.span
            layoutId={`day-selection-${layoutGroupId}`}
            className="absolute h-[27px] w-[27px] rounded-full bg-brand"
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          />
        )}
        {day.isToday && !selected && (
          <span className="absolute h-[27px] w-[27px] rounded-full bg-brand-soft" />
        )}
        <span
          className={`tnum relative text-[15px] leading-none ${
            selected
              ? 'font-semibold text-white'
              : day.isToday
                ? 'font-semibold text-brand-ink'
                : day.isRestDay
                  ? 'font-medium text-brand-ink'
                  : 'font-medium text-ink'
          }`}
        >
          {day.date.getDate()}
        </span>
      </span>

      {/* תאריך עברי */}
      {settings.showHebrewDates && (
        <span
          className={`mt-[1px] shrink-0 text-[9px] leading-none ${
            day.hebrewDay === 'א׳' ? 'font-medium text-brand-ink/70' : 'text-faint'
          }`}
        >
          {day.hebrewDay}
        </span>
      )}

      {/* מועדים, אירועים וזמנים */}
      <span className="mt-[3px] flex min-h-0 flex-col gap-[2px]">
        {shownHolidays.map((h, i) => (
          <span
            key={h.id}
            className={`text-[9px] leading-[1.2] ${holidayTone(h.kind)} ${
              i === 0 ? 'line-clamp-2' : 'truncate'
            }`}
          >
            {h.shortTitle}
          </span>
        ))}

        {shownEvents.map((occ) => (
          <MiniEventChip key={occ.occurrenceId} occurrence={occ} />
        ))}

        {hidden > 0 && (
          <span className="text-[8.5px] font-medium leading-none text-faint">+{hidden}</span>
        )}

        {time && (
          <span className="tnum flex items-center justify-center gap-[1px] text-[8.5px] leading-none text-[rgb(var(--c-shabbat))]">
            <span aria-hidden="true">{candles ? '🕯' : '✦'}</span>
            {time.time}
          </span>
        )}
      </span>
    </button>
  );
}

export const DayCell = memo(DayCellInner);
