/** הצל שנגרר עם האצבע בזמן העברת אירוע בין ימים. */
import { AnimatePresence, motion, useTransform } from 'framer-motion';
import { createPortal } from 'react-dom';
import { ghostX, ghostY, useDragStore } from '@/lib/dragEngine';
import { GREG_MONTHS_HE, keyToDate } from '@/lib/dates';
import { SNAP } from '@/lib/motion';

export function DragLayer() {
  const occurrence = useDragStore((s) => s.occurrence);
  const active = useDragStore((s) => s.active);
  const overKey = useDragStore((s) => s.overKey);
  const fromKey = useDragStore((s) => s.fromKey);

  /*
    הכול מעל האצבע, ולא מעט מעליה: ביד ימין האצבע מכסה כ-60px, וכיתוב
    היעד שישב מתחת לכרטיס היה בדיוק שם - המשתמש ראה שמשהו קופץ אבל לא
    מה הוא אומר. לכן הכיתוב עלה מעל הכרטיס, והכרטיס התרחק.
  */
  const x = useTransform(ghostX, (v) => v - 70);
  const y = useTransform(ghostY, (v) => v - 104);

  return createPortal(
    <AnimatePresence>
      {active && occurrence && (
        <motion.div
          className="pointer-events-none fixed left-0 top-0 z-[60]"
          style={{ x, y }}
          initial={{ opacity: 0, scale: 0.86, rotate: 0 }}
          animate={{ opacity: 1, scale: 1.05, rotate: -2.5 }}
          exit={{ opacity: 0, scale: 0.9, rotate: 0 }}
          transition={SNAP}
        >
          {overKey && overKey !== fromKey && (
            <div className="mb-1.5 text-center">
              <span className="rounded-xl bg-ink/85 px-2.5 py-1 text-tiny font-medium text-canvas">
                {overKey === 'undated'
                  ? 'העברה לבלי תאריך'
                  : (() => {
                      const d = keyToDate(overKey);
                      return `העברה ל־${d.getDate()} ב${GREG_MONTHS_HE[d.getMonth()]}`;
                    })()}
              </span>
            </div>
          )}
          {/*
            טבעת בצבע הקנבס חותכת את הכרטיס מכל מה שמתחתיו, וההטיה הקלה
            אומרת "מורם". בלעדיהן הצל נראה כמו עוד שורה ברשימה שנדחסה
            בין שתיים אחרות.
          */}
          <div
            className={`ev ev-${occurrence.color} w-[150px] rounded-xl px-3 py-2.5 shadow-floating ring-[3px] ring-canvas`}
          >
            <span className="block truncate text-caption font-semibold leading-tight">
              {occurrence.title}
            </span>
            {!occurrence.allDay && occurrence.startTime && (
              <span className="tnum mt-1 block text-tiny font-medium opacity-75">
                {occurrence.startTime}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
