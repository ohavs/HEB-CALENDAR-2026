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
      className={`ev ev-${occurrence.color} flex h-[15px] items-center gap-[3px] overflow-hidden rounded-[5px] pe-[3px] ps-[2px] text-[9.5px] font-medium leading-none transition-opacity ${
        isDragging ? 'opacity-25' : ''
      }`}
      onPointerDown={draggable ? (e) => beginLongPress(e, occurrence) : undefined}
      style={{ touchAction: draggable ? 'none' : undefined }}
    >
      {/* בתא צר יש מקום רק לכותרת; השעה מופיעה בפאנל ובתצוגת היום */}
      <span className="ev-bar h-[9px] w-[2.5px] shrink-0 rounded-full" />
      <span className="truncate">{occurrence.title}</span>
    </div>
  );
}

/** צ׳יפ מלא לרשימת האירועים ולתצוגת היום. */
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
      className={`ev ev-${occurrence.color} block w-full rounded-2xl p-3 text-right`}
    >
      <div className="flex items-start gap-2.5">
        <span className="ev-bar mt-1 h-[calc(100%-4px)] min-h-[22px] w-[3px] shrink-0 rounded-full" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14.5px] font-semibold leading-snug">
              {occurrence.title}
            </span>
            {occurrence.repeat !== 'none' && (
              <Repeat size={12} className="shrink-0 opacity-60" strokeWidth={2.4} />
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] opacity-80">
            {occurrence.allDay ? (
              <span>כל היום</span>
            ) : (
              <span className="tnum flex items-center gap-1">
                <Clock size={11.5} strokeWidth={2.4} />
                {occurrence.startTime}
                {occurrence.endTime ? `–${occurrence.endTime}` : ''}
                {duration ? ` · ${duration}` : ''}
              </span>
            )}
            {occurrence.location && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin size={11.5} strokeWidth={2.4} className="shrink-0" />
                <span className="truncate">{occurrence.location}</span>
              </span>
            )}
          </span>
        </span>
      </div>
    </motion.button>
  );
}
