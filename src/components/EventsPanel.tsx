/**
 * הפאנל התחתון עם אירועי היום הנבחר.
 * כברירת מחדל הוא מקופל ומציג רק ידית וסיכום קצר, כך שהלוח נשאר נקי.
 * מושכים למעלה כדי לפתוח, וגוררים למטה כדי לסגור.
 */
import { motion, useMotionValue, type PanInfo } from 'framer-motion';
import { useRef } from 'react';
import { ChevronLeft, ChevronUp, Plus } from 'lucide-react';
import type { DayInfo } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { relativeDayLabel } from '@/lib/dates';
import { EventCard } from './EventChip';
import { useElementSize } from '@/hooks/useElementSize';

/** כמה מהפאנל נשאר גלוי כשהוא מקופל */
const PEEK_HEIGHT = 66;
const SNAP_OFFSET = 70;
const SNAP_VELOCITY = 420;

export function EventsPanel({
  day,
  occurrences,
  open,
  onOpenChange,
  onOpenDay,
  onAddEvent,
  onEditEvent,
  bottomInset,
}: {
  day: DayInfo | undefined;
  occurrences: Occurrence[];
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onOpenDay: () => void;
  onAddEvent: () => void;
  onEditEvent: (occurrence: Occurrence) => void;
  /** מרווח מלמטה, כדי שהפאנל יישב מעל סרגל הלשוניות */
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

  const summary = (() => {
    if (!day) return '';
    const parts: string[] = [];
    if (occurrences.length)
      parts.push(occurrences.length === 1 ? 'אירוע אחד' : `${occurrences.length} אירועים`);
    if (day.holidays.length) parts.push(day.holidays[0].title);
    else if (day.parsha) parts.push(`פרשת ${day.parsha}`);
    if (!parts.length) parts.push('אין אירועים');
    return parts.join(' · ');
  })();

  const candles = day?.times.find((t) => t.kind === 'candles');
  const havdalah = day?.times.find((t) => t.kind === 'havdalah');

  return (
    <motion.div
      ref={ref}
      className="absolute inset-x-0 z-30 flex h-[58svh] flex-col rounded-t-sheet bg-surface shadow-sheet"
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
      {/* ידית + סיכום - גם כפתור פתיחה/סגירה */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="shrink-0 cursor-grab touch-none px-5 pb-1.5 pt-2.5 text-right active:cursor-grabbing"
      >
        <span className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-hairline" />
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold leading-tight text-ink">
              {day ? relativeDayLabel(day.date) : ''}
            </span>
            <span className="mt-0.5 block truncate text-[11.5px] leading-none text-muted">
              {summary}
            </span>
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="shrink-0 text-faint"
          >
            <ChevronUp size={18} strokeWidth={2.3} />
          </motion.span>
        </span>
      </button>

      {/* התוכן נעלם כשהפאנל מקופל, כדי שלא ייראה מבעד לסרגל הלשוניות */}
      <motion.div
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4"
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.18 }}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
      >
        {day && (
          <>
            {/* כניסה לתצוגת היום המורחבת */}
            <button
              type="button"
              onClick={onOpenDay}
              className="mb-3 flex w-full items-center gap-2 rounded-2xl bg-well px-3.5 py-3 text-right"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">
                  {day.hebrewFull}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-muted">
                  {[
                    day.parsha ? `פרשת ${day.parsha}` : null,
                    day.omerDay ? `${day.omerDay} לעומר` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'לתצוגת יום מורחבת'}
                </span>
              </span>
              <ChevronLeft size={17} strokeWidth={2.3} className="shrink-0 text-faint" />
            </button>

            {day.holidays.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {day.holidays.map((h) => (
                  <span
                    key={h.id}
                    className="rounded-full bg-brand-soft px-3 py-1 text-[12px] font-medium text-brand-ink"
                  >
                    {h.emoji ? `${h.emoji} ` : ''}
                    {h.title}
                  </span>
                ))}
              </div>
            )}

            {(candles || havdalah) && (
              <div className="mb-3 flex gap-2">
                {candles && (
                  <div className="flex-1 rounded-2xl bg-[rgb(var(--c-shabbat)/0.1)] px-3 py-2">
                    <span className="block text-[11px] text-[rgb(var(--c-shabbat))]">
                      🕯 {candles.title}
                    </span>
                    <span className="tnum block text-[15px] font-semibold text-ink">
                      {candles.time}
                    </span>
                  </div>
                )}
                {havdalah && (
                  <div className="flex-1 rounded-2xl bg-brand-soft px-3 py-2">
                    <span className="block text-[11px] text-brand-ink">✦ {havdalah.title}</span>
                    <span className="tnum block text-[15px] font-semibold text-ink">
                      {havdalah.time}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {occurrences.length > 0 ? (
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
          <div className="rounded-2xl border border-dashed border-hairline px-4 py-7 text-center">
            <p className="text-[13px] text-muted">אין אירועים ביום הזה</p>
            <button
              type="button"
              onClick={onAddEvent}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-4 py-2 text-[13px] font-semibold text-brand-ink"
            >
              <Plus size={15} strokeWidth={2.5} />
              הוספת אירוע
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
