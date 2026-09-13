/** הצל שנגרר עם האצבע בזמן העברת אירוע בין ימים. */
import { AnimatePresence, motion, useTransform } from 'framer-motion';
import { createPortal } from 'react-dom';
import { ghostX, ghostY, useDragStore } from '@/lib/dragEngine';
import { GREG_MONTHS_HE, keyToDate } from '@/lib/dates';

export function DragLayer() {
  const occurrence = useDragStore((s) => s.occurrence);
  const active = useDragStore((s) => s.active);
  const overKey = useDragStore((s) => s.overKey);

  // ממורכז מעל האצבע, מעט מעליה כדי שהאצבע לא תסתיר את הטקסט
  const x = useTransform(ghostX, (v) => v - 66);
  const y = useTransform(ghostY, (v) => v - 44);

  return createPortal(
    <AnimatePresence>
      {active && occurrence && (
        <motion.div
          className="pointer-events-none fixed left-0 top-0 z-[60]"
          style={{ x, y }}
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
        >
          <div
            className={`ev ev-${occurrence.color} flex w-[132px] items-center gap-1.5 rounded-xl px-2.5 py-2 shadow-lift`}
          >
            <span className="ev-bar h-4 w-[3px] shrink-0 rounded-full" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-tiny font-semibold leading-tight">
                {occurrence.title}
              </span>
              {!occurrence.allDay && occurrence.startTime && (
                <span className="tnum block text-micro opacity-75">{occurrence.startTime}</span>
              )}
            </span>
          </div>
          {overKey && (
            <div className="mt-1.5 text-center">
              <span className="rounded-xl bg-ink/85 px-2.5 py-1 text-tiny font-medium text-canvas">
                {(() => {
                  const d = keyToDate(overKey);
                  return `העברה ל־${d.getDate()} ב${GREG_MONTHS_HE[d.getMonth()]}`;
                })()}
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
