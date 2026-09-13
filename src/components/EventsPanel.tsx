/**
 * אירועי היום הנבחר.
 *
 * בטלפון זו חלונית תחתונה: מקופלת כברירת מחדל ומציגה רק ידית וסיכום קצר,
 * כך שהלוח נשאר נקי. מושכים למעלה כדי לפתוח וגוררים למטה כדי לסגור.
 * במסך רחב אותו תוכן יושב כעמודה קבועה לצד הלוח, בלי גרירה.
 *
 * ביצועים: החלונית מקודמת לשכבה משלה (will-change), הצל שלה קטן מספיק
 * כדי לא לדרוש רסטור מחדש בכל פריים, ושקיפות התוכן נגזרת ישירות ממיקום
 * הגרירה כ-motion value - בלי רינדור מחדש של React תוך כדי התנועה.
 */
import {
  motion,
  useDragControls,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import { useRef } from 'react';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { ChevronLeft, ChevronUp, Plus } from 'lucide-react';
import type { DayInfo } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { dayTitleLabel, relativeDayLabel } from '@/lib/dates';
import { EventCard } from './EventChip';
import { useElementSize } from '@/hooks/useElementSize';
import { GLIDE, ICON, SNAP, STROKE } from '@/lib/motion';

/** כמה מהחלונית נשאר גלוי כשהיא מקופלת */
const PEEK_HEIGHT = 84;
const SNAP_OFFSET = 70;
const SNAP_VELOCITY = 420;
/** מרחק המשיכה שבו התוכן מגיע לשקיפות מלאה */
const FADE_DISTANCE = 90;

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
    <div className="space-y-3">
      {/* כניסה לתצוגת היום המורחבת */}
      <button
        type="button"
        onClick={onOpenDay}
        className="flex w-full items-center gap-3 rounded-2xl bg-well px-4 py-4 text-right transition-colors active:bg-hairline"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ink">
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
        <ChevronLeft size={ICON.lg} strokeWidth={STROKE} className="shrink-0 text-faint" />
      </button>

      {/* מועדים - שורות עם נקודת צבע, לא גלולות */}
      {day.holidays.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-brand-soft">
          {day.holidays.map((h, i) => (
            <div
              key={h.id}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                i > 0 ? 'border-t border-brand/10' : ''
              }`}
            >
              <span className="text-title leading-none">{h.emoji ?? '✦'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-brand-ink">
                  {h.title}
                </span>
                {h.restWork && (
                  <span className="mt-0.5 block text-caption text-brand-ink/70">
                    אסור בעשיית מלאכה
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* זמני שבת */}
      {(candles || havdalah) && (
        <div className="flex gap-3">
          {candles && (
            <div className="flex-1 rounded-2xl bg-[rgb(var(--c-shabbat)/0.1)] px-4 py-3.5">
              <span className="block text-caption font-medium text-[rgb(var(--c-shabbat))]">
                🕯 {candles.title}
              </span>
              <span className="tnum mt-1 block text-heading font-semibold text-ink">
                {candles.time}
              </span>
            </div>
          )}
          {havdalah && (
            <div className="flex-1 rounded-2xl bg-brand-soft px-4 py-3.5">
              <span className="block text-caption font-medium text-brand-ink">
                ✦ {havdalah.title}
              </span>
              <span className="tnum mt-1 block text-heading font-semibold text-ink">
                {havdalah.time}
              </span>
            </div>
          )}
        </div>
      )}

      {/* אירועים */}
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
        <div className="rounded-2xl border border-dashed border-hairline px-4 py-9 text-center">
          <p className="text-body text-muted">אין אירועים ביום הזה</p>
          <button
            type="button"
            onClick={onAddEvent}
            className="mt-3.5 inline-flex items-center gap-2 rounded-2xl bg-brand-soft px-5 py-3 text-label font-semibold text-brand-ink"
          >
            <Plus size={ICON.md} strokeWidth={STROKE} />
            הוספת אירוע
          </button>
        </div>
      )}
    </div>
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
    <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-3xl bg-surface shadow-raised xl:w-[420px]">
      <header className="shrink-0 border-b border-hairline px-5 py-5">
        <h2 className="text-title font-semibold leading-tight text-ink">
          {day ? relativeDayLabel(day.date) : ''}
        </h2>
        <p className="mt-1 text-caption text-muted">{day ? dayTitleLabel(day.date) : ''}</p>
      </header>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5">
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
  const controls = useDragControls();
  const { scrollRef, handleProps, contentProps } = useSheetDrag(controls);
  const y = useMotionValue(0);
  const collapsedY = Math.max(0, height - PEEK_HEIGHT);

  // שומרים את נקודת הקיפול ב-ref כדי שהטרנספורם יקרא ערך עדכני
  // בלי ליצור את עצמו מחדש בכל מדידה.
  const collapsedRef = useRef(collapsedY);
  collapsedRef.current = collapsedY;

  // שקיפות התוכן נגזרת ממיקום הגרירה בפועל: התוכן מתגלה תוך כדי המשיכה
  // ולא קופץ בסופה. זהו motion value, ולכן אין רינדור מחדש תוך כדי תנועה.
  const contentOpacity = useTransform(y, (v) => {
    const collapsed = collapsedRef.current;
    if (collapsed <= 0) return 1;
    const progress = (collapsed - v) / FADE_DISTANCE;
    return Math.min(1, Math.max(0, progress));
  });

  const onDragEnd = (_: unknown, info: PanInfo) => {
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
      className="absolute inset-x-0 z-30 mx-auto flex h-[64svh] max-w-[640px] flex-col rounded-t-sheet border-t border-hairline bg-surface shadow-overlay"
      style={{ y, bottom: bottomInset, willChange: 'transform' }}
      animate={{ y: open ? 0 : collapsedY }}
      transition={GLIDE}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: collapsedY }}
      dragElastic={{ top: 0.02, bottom: 0.06 }}
      onDragEnd={onDragEnd}
    >
      {/* ידית + סיכום - גם כפתור פתיחה וסגירה */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={open ? 'סגירת אירועי היום' : 'פתיחת אירועי היום'}
        aria-expanded={open}
        className="focus-ring-inset shrink-0 cursor-grab touch-none px-5 pb-2.5 pt-3.5 text-right active:cursor-grabbing"
        {...handleProps}
      >
        <span className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-hairline" />
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-semibold leading-tight text-ink">
              {day ? relativeDayLabel(day.date) : ''}
            </span>
            <span className="mt-1 block truncate text-caption leading-none text-muted">
              {summaryOf(day, occurrences.length)}
            </span>
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={SNAP}
            className="shrink-0 text-faint"
          >
            <ChevronUp size={ICON.xl} strokeWidth={STROKE} />
          </motion.span>
        </span>
      </button>

      <motion.div
        ref={scrollRef}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5"
        style={{ opacity: contentOpacity, pointerEvents: open ? 'auto' : 'none' }}
        {...contentProps}
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
