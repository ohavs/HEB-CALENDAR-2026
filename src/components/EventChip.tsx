/**
 * ייצוגי האירוע: צ׳יפ זעיר לתא בלוח, וכרטיס מלא לרשימות.
 *
 * הצבע נישא על ידי רקע הכרטיס ותג השעה המלא, ולא על ידי פס דק בצד -
 * כך האירוע נקרא כיחידה אחת ולא כמלבן עם קישוט.
 */
import { motion } from 'framer-motion';
import { MapPin, Repeat } from 'lucide-react';
import { isSpanEnd, type Occurrence } from '@/lib/recurrence';
import { durationLabel } from '@/lib/dates';
import { beginLongPress, useIsDraggingOccurrence } from '@/lib/dragEngine';
import { ICON, STROKE, TAP } from '@/lib/motion';

/**
 * צ׳יפ זעיר לתוך תא בלוח - שורה אחת, רקע בגוון האירוע.
 *
 * באירוע רב־יומי הצ׳יפ נמשך על פני התאים: רק היום הראשון נושא את
 * הכותרת, והפינות מתעגלות רק בקצוות הפרישה. כך הפס נקרא כרצף אחד
 * ולא כשורה של מלבנים חוזרים.
 */
export function MiniEventChip({
  occurrence,
  draggable = true,
  labelled = true,
}: {
  occurrence: Occurrence;
  draggable?: boolean;
  /** האם היום הזה נושא את הכותרת (רלוונטי רק לפס רב־יומי) */
  labelled?: boolean;
}) {
  const isDragging = useIsDraggingOccurrence(occurrence.occurrenceId);
  const multiDay = occurrence.spanLength > 1;
  const isStart = occurrence.spanIndex === 0;
  const isEnd = isSpanEnd(occurrence);

  // הפינות בקצוות בלבד, ובאמצע הפס נמשך אל מחוץ לתא כדי לכסות את המרווח
  const shape = !multiDay
    ? 'rounded-lg'
    : [
        isStart ? 'rounded-s-lg' : '-ms-[3px] ps-[3px]',
        isEnd ? 'rounded-e-lg' : '-me-[3px] pe-[3px]',
      ].join(' ');

  return (
    <div
      className={`ev ev-${occurrence.color} overflow-hidden px-1.5 py-1 text-micro font-semibold leading-tight transition-opacity ${shape} ${
        isDragging ? 'opacity-25' : ''
      }`}
      style={{ touchAction: draggable ? 'none' : undefined }}
      onPointerDown={draggable ? (e) => beginLongPress(e, occurrence) : undefined}
    >
      {/* בתא צר יש מקום רק לכותרת; השעה מופיעה בפאנל ובתצוגת היום */}
      <span className="block truncate">
        {multiDay && !labelled ? '\u00A0' : occurrence.title}
      </span>
    </div>
  );
}

/**
 * כרטיס אירוע מלא לרשימות ולתצוגת היום.
 * השעה יושבת בתג מלא בצבע האירוע, והכותרת לצידו.
 */
export function EventCard({
  occurrence,
  onClick,
  draggable = false,
}: {
  occurrence: Occurrence;
  onClick?: () => void;
  draggable?: boolean;
}) {
  const duration =
    !occurrence.allDay && occurrence.startTime && occurrence.endTime
      ? durationLabel(occurrence.startTime, occurrence.endTime)
      : '';

  const meta = [duration, occurrence.endTime && !occurrence.allDay ? `עד ${occurrence.endTime}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      transition={TAP}
      onPointerDown={draggable ? (e) => beginLongPress(e, occurrence) : undefined}
      className={`ev ev-${occurrence.color} flex w-full items-center gap-3.5 rounded-2xl p-3 text-right`}
    >
      {/* תג השעה - מלא בצבע האירוע */}
      <span
        className="ev-solid flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-xl text-white"
        aria-hidden="true"
      >
        {occurrence.spanLength > 1 ? (
          <>
            <span className="tnum text-label font-bold leading-none">
              {occurrence.spanIndex + 1}/{occurrence.spanLength}
            </span>
            <span className="mt-1 text-micro font-medium leading-none opacity-85">ימים</span>
          </>
        ) : occurrence.allDay ? (
          <span className="text-caption font-semibold leading-tight">כל היום</span>
        ) : (
          <>
            <span className="tnum text-label font-bold leading-none">
              {occurrence.startTime}
            </span>
            {duration && (
              <span className="mt-1 text-micro font-medium leading-none opacity-85">
                {duration}
              </span>
            )}
          </>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-title font-semibold leading-snug">
            {occurrence.title}
          </span>
          {occurrence.repeat !== 'none' && (
            <Repeat size={ICON.sm} className="shrink-0 opacity-60" strokeWidth={STROKE} />
          )}
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption opacity-85">
          {meta && <span className="tnum font-medium">{meta}</span>}
          {occurrence.location && (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin size={ICON.xs} strokeWidth={STROKE} className="shrink-0" />
              <span className="truncate">{occurrence.location}</span>
            </span>
          )}
        </span>
      </span>
    </motion.button>
  );
}
