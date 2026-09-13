/** צ׳יפ אירוע - הן בתא הלוח (קומפקטי) והן ברשימות (מלא). */
import { motion } from 'framer-motion';
import { Clock, MapPin, Repeat } from 'lucide-react';
import type { Occurrence } from '@/lib/recurrence';
import { durationLabel } from '@/lib/dates';
import { beginLongPress, useIsDraggingOccurrence } from '@/lib/dragEngine';

/** צ׳יפ זעיר לתוך תא בלוח השנה - שורה אחת, עם פס צבע בצד. */
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
      className={`ev ev-${occurrence.color} overflow-hidden rounded-md border-s-[3px] px-1 py-[3px] text-micro font-medium leading-tight transition-opacity ${
        isDragging ? 'opacity-25' : ''
      }`}
      style={{
        touchAction: draggable ? 'none' : undefined,
        borderInlineStartColor: 'rgb(var(--ev-bar))',
      }}
      onPointerDown={draggable ? (e) => beginLongPress(e, occurrence) : undefined}
    >
      {/* בתא צר יש מקום רק לכותרת; השעה מופיעה בפאנל ובתצוגת היום */}
      <span className="block truncate">{occurrence.title}</span>
    </div>
  );
}

/** כרטיס אירוע מלא לרשימות ולתצוגת היום. */
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

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 600, damping: 32 }}
      onPointerDown={draggable ? (e) => beginLongPress(e, occurrence) : undefined}
      className={`ev ev-${occurrence.color} flex w-full items-stretch gap-3.5 overflow-hidden rounded-2xl p-4 text-right`}
    >
      {/* פס הצבע במלוא גובה הכרטיס */}
      <span className="ev-bar w-1 shrink-0 rounded-full" />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-title font-semibold leading-snug">
            {occurrence.title}
          </span>
          {occurrence.repeat !== 'none' && (
            <Repeat size={14} className="shrink-0 opacity-60" strokeWidth={2.4} />
          )}
        </span>

        <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption opacity-85">
          {occurrence.allDay ? (
            <span className="font-medium">כל היום</span>
          ) : (
            <span className="tnum flex items-center gap-1.5 font-medium">
              <Clock size={14} strokeWidth={2.4} />
              {occurrence.startTime}
              {occurrence.endTime ? `–${occurrence.endTime}` : ''}
              {duration ? ` · ${duration}` : ''}
            </span>
          )}
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
