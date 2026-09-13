/**
 * אירועי היום הנבחר.
 *
 * בטלפון זו חלונית תחתונה: מקופלת כברירת מחדל ומציגה רק ידית וסיכום קצר,
 * כך שהלוח נשאר נקי. מושכים למעלה כדי לפתוח וגוררים למטה כדי לסגור.
 * במסך רחב אותו תוכן יושב כעמודה קבועה לצד הלוח, בלי גרירה.
 */
import { motion, useMotionValue, type PanInfo } from 'framer-motion';
import { useRef } from 'react';
import { ChevronLeft, ChevronUp, Plus } from 'lucide-react';
import type { DayInfo } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { dayTitleLabel, relativeDayLabel } from '@/lib/dates';
import { EventCard } from './EventChip';
import { useElementSize } from '@/hooks/useElementSize';

/** כמה מהחלונית נשאר גלוי כשהיא מקופלת */
const PEEK_HEIGHT = 78;
const SNAP_OFFSET = 70;
const SNAP_VELOCITY = 420;

type ContentProps = {
  day: DayInfo | undefined;
  occurrences: Occurrence[];
  onOpenDay: () => void;
  onAddEvent: () => void;
  onEditEvent: (occurrence: Occurrence) => void;
};

/* ==========================================================================
   התוכן - משותף לחלונית הנגררת ולעמודה הקבועה
   ========================================================================== */

function DayPanelContent({
  day,
  occurrences,
  onOpenDay,
  onAddEvent,
  onEditEvent,
}: ContentProps) {
  if (!day) return null;

  const candles = day.times.find((t) => t.kind === 'candles');
  const havdalah = day.times.find((t) => t.kind === 'havdalah');

  return (
    <>
      {/* כניסה לתצוגת היום המורחבת */}
      <button
        type="button"
        onClick={onOpenDay}
        className="mb-3.5 flex w-full items-center gap-2.5 rounded-2xl bg-well px-4 py-3.5 text-right"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label font-semibold text-ink">
            {day.hebrewFull}
          </span>
          <span className="mt-1 block truncate text-caption text-muted">
            {[
              day.parsha ? `פרשת ${day.parsha}` : null,
              day.omerDay ? `${day.omerDay} לעומר` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'לתצוגת יום מורחבת'}
          </span>
        </span>
        <ChevronLeft size={19} strokeWidth={2.3} className="shrink-0 text-faint" />
      </button>

      {day.holidays.length > 0 && (
        <div className="mb-3.5 flex flex-wrap gap-2">
          {day.holidays.map((h) => (
            <span
              key={h.id}
              className="rounded-full bg-brand-soft px-3.5 py-1.5 text-caption font-medium text-brand-ink"
            >
              {h.emoji ? `${h.emoji} ` : ''}
              {h.title}
            </span>
          ))}
        </div>
      )}

      {(candles || havdalah) && (
        <div className="mb-3.5 flex gap-2.5">
          {candles && (
            <div className="flex-1 rounded-2xl bg-[rgb(var(--c-shabbat)/0.1)] px-4 py-3">
              <span className="block text-caption text-[rgb(var(--c-shabbat))]">
                🕯 {candles.title}
              </span>
              <span className="tnum mt-0.5 block text-title font-semibold text-ink">
                {candles.time}
              </span>
            </div>
          )}
          {havdalah && (
            <div className="flex-1 rounded-2xl bg-brand-soft px-4 py-3">
              <span className="block text-caption text-brand-ink">✦ {havdalah.title}</span>
              <span className="tnum mt-0.5 block text-title font-semibold text-ink">
                {havdalah.time}
              </span>
            </div>
          )}
        </div>
      )}

      {occurrences.length > 0 ? (
        <div className="space-y-2.5">
          {occurrences.map((occ) => (
            <EventCard
              key={occ.occurrenceId}
              occurrence={occ}
              onClick={() => onEditEvent(occ)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-hairline px-4 py-8 text-center">
          <p className="text-caption text-muted">אין אירועים ביום הזה</p>
          <button
            type="button"
            onClick={onAddEvent}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-soft px-5 py-2.5 text-caption font-semibold text-brand-ink"
          >
            <Plus size={16} strokeWidth={2.5} />
            הוספת אירוע
          </button>
        </div>
      )}
    </>
  );
}

/** סיכום קצר לשורת הידית. */
function summaryOf(day: DayInfo | undefined, count: number): string {
  if (!day) return '';
  const parts: string[] = [];
  if (count) parts.push(count === 1 ? 'אירוע אחד' : `${count} אירועים`);
  if (day.holidays.length) parts.push(day.holidays[0].title);
  else if (day.parsha) parts.push(`פרשת ${day.parsha}`);
  if (!parts.length) parts.push('אין אירועים');
  return parts.join(' · ');
}

/* ==========================================================================
   עמודה קבועה - מסכים רחבים
   ========================================================================== */

export function DockedDayPanel(props: ContentProps) {
  const { day } = props;
  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-3xl bg-surface shadow-soft xl:w-[420px]">
      <header className="shrink-0 border-b border-hairline px-5 py-4">
        <h2 className="text-title font-semibold leading-tight text-ink">
          {day ? relativeDayLabel(day.date) : ''}
        </h2>
        <p className="mt-1 text-caption text-muted">
          {day ? dayTitleLabel(day.date) : ''}
        </p>
      </header>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <DayPanelContent {...props} />
      </div>
    </aside>
  );
}

/* ==========================================================================
   חלונית נגררת - טלפון
   ========================================================================== */

export function EventsPanel({
  day,
  occurrences,
  open,
  onOpenChange,
  onOpenDay,
  onAddEvent,
  onEditEvent,
  bottomInset,
}: ContentProps & {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** מרווח מלמטה, כדי שהחלונית תשב מעל סרגל הלשוניות */
  bottomInset: number;
}) {
  const { ref, height } = useElementSize<HTMLDivElement>();
  const y = useMotionValue(0);
  const collapsedY = Math.max(0, height - PEEK_HEIGHT);
  const dragging = useRef(false);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    dragging.current = false;
    if (open) {
      if (info.offset.y > SNAP_OFFSET || info.velocity.y > SNAP_VELOCITY) onOpenChange(false);
      else onOpenChange(true);
    } else if (info.offset.y < -SNAP_OFFSET || info.velocity.y < -SNAP_VELOCITY) {
      onOpenChange(true);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <motion.div
      ref={ref}
      className="absolute inset-x-0 z-30 mx-auto flex h-[62svh] max-w-[640px] flex-col rounded-t-sheet bg-surface shadow-sheet"
      style={{ y, bottom: bottomInset }}
      animate={{ y: open ? 0 : collapsedY }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: collapsedY }}
      dragElastic={{ top: 0.02, bottom: 0.06 }}
      onDragStart={() => {
        dragging.current = true;
      }}
      onDragEnd={onDragEnd}
    >
      {/* ידית + סיכום - גם כפתור פתיחה וסגירה */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="shrink-0 cursor-grab touch-none px-5 pb-2 pt-3 text-right active:cursor-grabbing"
      >
        <span className="mx-auto mb-2.5 block h-1.5 w-11 rounded-full bg-hairline" />
        <span className="flex items-center gap-2.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-label font-semibold leading-tight text-ink">
              {day ? relativeDayLabel(day.date) : ''}
            </span>
            <span className="mt-1 block truncate text-caption leading-none text-muted">
              {summaryOf(day, occurrences.length)}
            </span>
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="shrink-0 text-faint"
          >
            <ChevronUp size={20} strokeWidth={2.3} />
          </motion.span>
        </span>
      </button>

      {/* התוכן נעלם כשהחלונית מקופלת, כדי שלא ייראה מבעד לסרגל הלשוניות */}
      <motion.div
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5"
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.18 }}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
      >
        <DayPanelContent
          day={day}
          occurrences={occurrences}
          onOpenDay={onOpenDay}
          onAddEvent={onAddEvent}
          onEditEvent={onEditEvent}
        />
      </motion.div>
    </motion.div>
  );
}
