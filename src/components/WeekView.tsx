/**
 * תצוגת שבוע עם ציר שעות.
 *
 * מה שתצוגת החודש לא יכולה לתת: איפה בדיוק יושב האירוע ביום, וכמה זמן
 * הוא לוקח. שבעה טורים, ציר שעות בצד, ושורה נפרדת למה שאין לו שעה -
 * מועדים ואירועי כל היום - כדי שלא ייפול לתוך הציר בשעה אקראית.
 *
 * ב-RTL הימים מתקדמים מימין לשמאל. `direction: rtl` על הרשת מספיק:
 * הטור הראשון בקוד הוא הימני ביותר, בדיוק כמו ברשת החודש.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { DayInfo, Settings } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import type { RangeData } from '@/hooks/useMonthData';
import { dateKey, timeToMinutes, WEEKDAYS_SHORT_HE } from '@/lib/dates';
import { beginLongPress, useIsDropTarget, useIsDraggingOccurrence } from '@/lib/dragEngine';
import { TAP_SCALE_LG } from '@/lib/motion';

/** גובה שעה בפיקסלים. גדול דיו שאירוע של חצי שעה עדיין קריא. */
const HOUR_HEIGHT = 52;
/** משך מינימלי לתצוגה, כדי שאירוע נקודתי לא ייעלם */
const MIN_BLOCK_MINUTES = 30;
/** השעה שאליה גוללים בפתיחה, אם אין אירוע מוקדם יותר */
const DEFAULT_SCROLL_HOUR = 7;

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** כמה דקות עברו מתחילת היום, לקו ה"עכשיו". */
function minutesIntoDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** מיקום וגובה של אירוע על הציר, באחוזים מהיממה. */
function blockGeometry(occ: Occurrence): { top: number; height: number } {
  const start = timeToMinutes(occ.startTime ?? '00:00');
  const end = occ.endTime ? timeToMinutes(occ.endTime) : start + MIN_BLOCK_MINUTES;
  const minutes = Math.max(MIN_BLOCK_MINUTES, end - start);
  return { top: (start / 1440) * 100, height: (Math.min(minutes, 1440 - start) / 1440) * 100 };
}

/**
 * חלוקת אירועים חופפים לעמודות משנה, כדי ששניים באותה שעה לא יסתירו זה
 * את זה. אלגוריתם סריקה פשוט: אירוע מקבל את העמודה הפנויה הראשונה.
 */
function layoutColumns(occurrences: Occurrence[]): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...occurrences].sort(
    (a, b) => timeToMinutes(a.startTime ?? '00:00') - timeToMinutes(b.startTime ?? '00:00'),
  );

  let cluster: Occurrence[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const laneEnds: number[] = [];
    const assigned: { occ: Occurrence; lane: number }[] = [];
    for (const occ of cluster) {
      const start = timeToMinutes(occ.startTime ?? '00:00');
      const end = Math.max(
        start + MIN_BLOCK_MINUTES,
        occ.endTime ? timeToMinutes(occ.endTime) : start + MIN_BLOCK_MINUTES,
      );
      let lane = laneEnds.findIndex((e) => e <= start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = end;
      assigned.push({ occ, lane });
    }
    for (const { occ, lane } of assigned) {
      out.set(occ.occurrenceId, { lane, lanes: laneEnds.length });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const occ of sorted) {
    const start = timeToMinutes(occ.startTime ?? '00:00');
    const end = Math.max(
      start + MIN_BLOCK_MINUTES,
      occ.endTime ? timeToMinutes(occ.endTime) : start + MIN_BLOCK_MINUTES,
    );
    if (cluster.length && start >= clusterEnd) flush();
    cluster.push(occ);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return out;
}

function DayColumn({
  day,
  occurrences,
  nowMinutes,
  onEditEvent,
}: {
  day: DayInfo;
  occurrences: Occurrence[];
  /** דקות מתחילת היום, או null אם זה לא היום */
  nowMinutes: number | null;
  onEditEvent: (occurrence: Occurrence) => void;
}) {
  const isDropTarget = useIsDropTarget(day.key);
  const timed = occurrences.filter((o) => !o.allDay && o.startTime);
  const lanes = useMemo(() => layoutColumns(timed), [timed]);

  return (
    <div
      data-drop-key={day.key}
      className={`relative border-s border-hairline transition-colors ${
        day.isRestDay ? 'bg-brand-soft/25' : ''
      } ${isDropTarget ? 'bg-brand-soft' : ''}`}
      style={{ height: HOUR_HEIGHT * 24 }}
    >
      {/* קווי השעות */}
      {HOURS.map((h) => (
        <span
          key={h}
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-hairline/60"
          style={{ top: h * HOUR_HEIGHT }}
        />
      ))}

      {/* קו השעה הנוכחית - רק על היום עצמו */}
      {nowMinutes !== null && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 z-10 border-t-2 border-brand"
          style={{ top: `${(nowMinutes / 1440) * 100}%` }}
        >
          <span className="absolute -top-[5px] -start-[3px] block h-2 w-2 rounded-full bg-brand" />
        </span>
      )}

      {timed.map((occ) => {
        const { top, height } = blockGeometry(occ);
        const lane = lanes.get(occ.occurrenceId) ?? { lane: 0, lanes: 1 };
        const width = 100 / lane.lanes;
        return (
          <WeekBlock
            key={occ.occurrenceId}
            occurrence={occ}
            style={{
              top: `${top}%`,
              height: `${height}%`,
              insetInlineStart: `${lane.lane * width}%`,
              width: `calc(${width}% - 2px)`,
            }}
            onClick={() => onEditEvent(occ)}
          />
        );
      })}
    </div>
  );
}

function WeekBlock({
  occurrence,
  style,
  onClick,
}: {
  occurrence: Occurrence;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  const isDragging = useIsDraggingOccurrence(occurrence.occurrenceId);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={TAP_SCALE_LG}
      onPointerDown={(e) => beginLongPress(e, occurrence)}
      style={{ ...style, touchAction: 'none' }}
      className={`ev ev-${occurrence.color} focus-ring-inset absolute overflow-hidden rounded-lg px-1.5 py-1 text-start transition-opacity ${
        isDragging ? 'opacity-25' : ''
      }`}
    >
      <span className="block truncate text-micro font-semibold leading-tight">
        {occurrence.title}
      </span>
      <span className="tnum block truncate text-micro leading-tight opacity-80">
        {occurrence.startTime}
      </span>
    </motion.button>
  );
}

export function WeekView({
  data,
  settings,
  selectedKey,
  onSelectDay,
  onEditEvent,
}: {
  data: RangeData;
  settings: Settings;
  selectedKey: string;
  onSelectDay: (day: DayInfo) => void;
  onEditEvent: (occurrence: Occurrence) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // גוללים לשעה של האירוע המוקדם ביותר בשבוע, או לבוקר אם אין
  const firstHour = useMemo(() => {
    let earliest = 24 * 60;
    for (const list of data.occurrences.values()) {
      for (const occ of list) {
        if (occ.allDay || !occ.startTime) continue;
        earliest = Math.min(earliest, timeToMinutes(occ.startTime));
      }
    }
    return earliest === 24 * 60 ? DEFAULT_SCROLL_HOUR : Math.max(0, Math.floor(earliest / 60) - 1);
  }, [data.occurrences]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: firstHour * HOUR_HEIGHT, behavior: 'auto' });
  }, [firstHour]);

  const today = dateKey(new Date());
  // הקו מתעדכן פעם בדקה; שעון שלא זז הוא גרוע משעון שאין
  const [nowMinutes, setNowMinutes] = useState(() => minutesIntoDay(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNowMinutes(minutesIntoDay(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* כותרות הימים + כל מה שאין לו שעה */}
      <div className="shrink-0 border-b border-hairline bg-surface/95 backdrop-blur">
        <div className="grid grid-cols-[3.4rem_repeat(7,1fr)]">
          <span aria-hidden="true" />
          {data.dates.map((date) => {
            const key = dateKey(date);
            const day = data.days.get(key);
            if (!day) return <span key={key} />;
            const selected = key === selectedKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDay(day)}
                aria-label={`${date.getDate()} ${day.hebrewFull}`}
                aria-current={key === today ? 'date' : undefined}
                className="focus-ring-inset flex flex-col items-center gap-0.5 py-2.5"
              >
                <span
                  className={`text-micro font-medium ${
                    day.isShabbat ? 'text-brand-ink/70' : 'text-faint'
                  }`}
                >
                  {WEEKDAYS_SHORT_HE[date.getDay()]}
                </span>
                <span
                  className={`tnum flex h-8 w-8 items-center justify-center rounded-full text-label font-semibold ${
                    key === today
                      ? 'bg-brand text-white'
                      : selected
                        ? 'bg-brand-soft text-brand-ink'
                        : 'text-ink'
                  }`}
                >
                  {date.getDate()}
                </span>
                {settings.showHebrewDates && (
                  <span className="text-micro leading-none text-faint">{day.hebrewDay}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* שורת מה שאין לו שעה: מועדים ואירועי כל היום */}
        <div className="grid grid-cols-[3.4rem_repeat(7,1fr)] border-t border-hairline">
          <span className="flex items-center justify-center py-1 text-micro text-faint">
            כל היום
          </span>
          {data.dates.map((date) => {
            const key = dateKey(date);
            const day = data.days.get(key);
            const allDay = (data.occurrences.get(key) ?? []).filter((o) => o.allDay);
            const holidays = settings.showJewishHolidays ? (day?.holidays ?? []) : [];
            return (
              <div key={key} className="min-w-0 space-y-[2px] border-s border-hairline p-[3px]">
                {holidays.slice(0, 2).map((h) => (
                  <span
                    key={h.id}
                    title={h.title}
                    className="block truncate rounded bg-brand-soft px-1 py-0.5 text-micro font-medium leading-tight text-brand-ink"
                  >
                    {h.shortTitle}
                  </span>
                ))}
                {allDay.slice(0, 2).map((occ) => (
                  <button
                    key={occ.occurrenceId}
                    type="button"
                    onClick={() => onEditEvent(occ)}
                    className={`ev ev-${occ.color} focus-ring-inset block w-full truncate rounded px-1 py-0.5 text-start text-micro font-semibold leading-tight`}
                  >
                    {occ.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* הציר עצמו */}
      <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[3.4rem_repeat(7,1fr)]">
          <div className="relative" style={{ height: HOUR_HEIGHT * 24 }}>
            {HOURS.map((h) => (
              // הכיתוב יושב מתחת לקו ולא ממורכז עליו, אחרת השעה הראשונה
              // נחתכת בקצה העליון של אזור הגלילה
              <span
                key={h}
                className="tnum absolute inset-x-0 pt-0.5 text-center text-micro text-faint"
                style={{ top: h * HOUR_HEIGHT }}
              >
                {`${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          {data.dates.map((date) => {
            const key = dateKey(date);
            const day = data.days.get(key);
            if (!day) return <span key={key} />;
            return (
              <DayColumn
                key={key}
                day={day}
                occurrences={data.occurrences.get(key) ?? []}
                nowMinutes={key === today ? nowMinutes : null}
                onEditEvent={onEditEvent}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
