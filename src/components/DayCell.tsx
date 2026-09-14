/**
 * תא יום בלוח השנה.
 * נקי ושקט: מספר גדול, תאריך עברי קטן מתחתיו, ואז המועדים והאירועים
 * ככיתובים דקים. התא הוא גם יעד השחרור בגרירת אירועים.
 *
 * כל המידות כאן נגזרות מגודל הגופן (יחידות em) כדי שהתא יגדל יחד עם
 * הסקאלה הנוזלית כשעוברים מטלפון למסך גדול.
 */
import { memo } from 'react';
import { motion } from 'framer-motion';
import type { DayInfo, HolidayItem, HolidayKind, Settings } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { MiniEventChip } from './EventChip';
import { useIsDropTarget } from '@/lib/dragEngine';
import { SNAP, TAP } from '@/lib/motion';

/**
 * מה שקורא מסך מקריא על התא. הכיתוב הקודם היה המספר והתאריך העברי
 * בלבד, כך שמשתמש עיוור לא ידע שיש ביום הזה חג או אירועים.
 */
function cellLabel(day: DayInfo, holidays: HolidayItem[], eventCount: number): string {
  const parts = [`${day.date.getDate()} ${day.hebrewFull}`];
  if (day.isToday) parts.push('היום');
  for (const h of holidays) parts.push(h.title);
  if (eventCount === 1) parts.push('אירוע אחד');
  else if (eventCount > 1) parts.push(`${eventCount} אירועים`);
  return parts.join(', ');
}

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
  /**
   * רק תא אחד ברשת נושא tabIndex=0 בכל רגע (roving tabindex), כדי
   * שהמקלדת לא תצטרך לעבור דרך 42 תאים כדי לצאת מהלוח.
   */
  focusable: boolean;
};

function DayCellInner({
  day,
  occurrences,
  selected,
  settings,
  capacity,
  onSelect,
  layoutGroupId,
  focusable,
}: Props) {
  const isDropTarget = useIsDropTarget(day.key);
  const dim = !day.inCurrentMonth;
  const compact = settings.density === 'compact';

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
      role="gridcell"
      data-day-key={day.key}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onSelect(day)}
      className={`focus-ring-inset relative flex min-h-0 select-none flex-col items-stretch overflow-hidden rounded-2xl px-1 pb-1 pt-1.5 text-center transition-colors ${
        dim ? 'opacity-45' : ''
      } ${day.isShabbat && !dim ? 'bg-brand/[0.045]' : ''}`}
      aria-label={cellLabel(day, shownHolidays, occurrences.length)}
      aria-selected={selected}
      aria-current={day.isToday ? 'date' : undefined}
    >
      {isDropTarget && (
        <motion.span
          layoutId="drop-target"
          className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-brand bg-brand/10"
          transition={TAP}
        />
      )}

      {/* מספר היום - עיגול הבחירה נמדד ביחס לגודל הגופן ולכן גדל איתו */}
      <span className="relative flex shrink-0 items-center justify-center text-daynum">
        {selected && (
          <motion.span
            layoutId={`day-selection-${layoutGroupId}`}
            className="absolute h-[1.75em] w-[1.75em] rounded-full bg-brand"
            transition={SNAP}
          />
        )}
        {day.isToday && !selected && (
          <span className="absolute h-[1.75em] w-[1.75em] rounded-full bg-brand-soft" />
        )}
        <span
          className={`tnum relative leading-[1.6] ${
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
          className={`mt-px shrink-0 text-micro leading-none ${
            day.hebrewDay === 'א׳' ? 'font-medium text-brand-ink/70' : 'text-faint'
          }`}
        >
          {day.hebrewDay}
        </span>
      )}

      {/* מועדים, אירועים וזמנים */}
      <span className="mt-1 flex min-h-0 flex-col gap-[3px]">
        {/*
          במצב קומפקטי התא מוותר על הכיתובים: מועד אחד בשורה קצרה,
          והאירועים כנקודות צבע. במסך צר זה ההבדל בין תא שאפשר לקרוא
          לבין ארבעה כיתובים חתוכים.
        */}
        {compact ? (
          <>
            {shownHolidays.slice(0, 1).map((h) => (
              <span
                key={h.id}
                className={`truncate text-tiny leading-[1.2] ${holidayTone(h.kind)}`}
              >
                {h.shortTitle}
              </span>
            ))}
            {occurrences.length > 0 && (
              <span className="mt-0.5 flex flex-wrap justify-center gap-[3px]">
                {occurrences.slice(0, 4).map((occ) => (
                  <span
                    key={occ.occurrenceId}
                    className={`ev ev-${occ.color} ev-dot h-1.5 w-1.5 rounded-full`}
                  />
                ))}
              </span>
            )}
          </>
        ) : (
          <>
            {shownHolidays.map((h, i) => (
              <span
                key={h.id}
                className={`text-tiny leading-[1.2] ${holidayTone(h.kind)} ${
                  i === 0 ? 'line-clamp-2' : 'truncate'
                }`}
              >
                {h.shortTitle}
              </span>
            ))}

            {shownEvents.map((occ) => (
              <MiniEventChip
                key={occ.occurrenceId}
                occurrence={occ}
                // פס רב־יומי נושא כותרת בתחילתו, ושוב בתחילת כל שורת שבוע -
                // אחרת השורה השנייה של החופשה היא פס צבע בלי שם
                labelled={occ.spanIndex === 0 || day.date.getDay() === 0}
              />
            ))}
          </>
        )}

        {!compact && hidden > 0 && (
          <span className="text-micro font-medium leading-none text-faint">+{hidden}</span>
        )}

        {time && (
          <span className="tnum flex items-center justify-center gap-0.5 text-micro leading-none text-[rgb(var(--c-shabbat))]">
            <span aria-hidden="true">{candles ? '🕯' : '✦'}</span>
            {time.time}
          </span>
        )}
      </span>
    </button>
  );
}

export const DayCell = memo(DayCellInner);
