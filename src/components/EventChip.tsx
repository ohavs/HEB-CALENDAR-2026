/**
 * ייצוגי האירוע: צ׳יפ זעיר לתא בלוח, וכרטיס מלא לרשימות.
 *
 * הצבע נישא על ידי רקע הכרטיס ותג השעה המלא, ולא על ידי פס דק בצד -
 * כך האירוע נקרא כיחידה אחת ולא כמלבן עם קישוט.
 */
import { motion } from 'framer-motion';
import { MapPin, Repeat } from 'lucide-react';
import type { Occurrence } from '@/lib/recurrence';
import { durationLabel } from '@/lib/dates';
import { beginLongPress, useIsDraggingOccurrence } from '@/lib/dragEngine';

/** צ׳יפ זעיר לתוך תא בלוח - שורה אחת, רקע בגוון האירוע. */
export function MiniEventChip({
  occurrence,
  draggable = true,
}: {
  occurrence: Occurrence;
  draggable?: boolean;
}) {
  const isDragging = useIsDraggingOccurrence(occurrence.occurrenceId);

  return (
    <div
      className={`ev ev-${occurrence.color} overflow-hidden rounded-lg px-1.5 py-1 text-micro font-semibold leading-tight transition-opacity ${
        isDragging ? 'opacity-25' : ''
      }`}
      style={{ touchAction: draggable ? 'none' : undefined }}
      onPointerDown={draggable ? (e) => beginLongPress(e, occurrence) : undefined}
    >
      {/* בתא צר יש מקום רק לכותרת; השעה מופיעה בפאנל ובתצוגת היום */}
      <span className="block truncate">{occurrence.title}</span>
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
      transition={{ type: 'spring', stiffness: 600, damping: 32 }}
      onPointerDown={draggable ? (e) => beginLongPress(e, occurrence) : undefined}
      className={`ev ev-${occurrence.color} flex w-full items-center gap-3.5 rounded-2xl p-3 text-right`}
    >
      {/* תג השעה - מלא בצבע האירוע */}
      <span
        className="ev-solid flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-xl text-white"
        aria-hidden="true"
      >
        {occurrence.allDay ? (
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
            <Repeat size={15} className="shrink-0 opacity-60" strokeWidth={2.4} />
          )}
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption opacity-85">
          {meta && <span className="tnum font-medium">{meta}</span>}
          {occurrence.location && (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin size={14} strokeWidth={2.4} className="shrink-0" />
              <span className="truncate">{occurrence.location}</span>
            </span>
          )}
        </span>
      </span>
    </motion.button>
  );
}
