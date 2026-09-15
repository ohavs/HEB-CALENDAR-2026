/** הצל שנגרר עם האצבע בזמן העברת אירוע בין ימים, ויעד המחיקה שמתחתיו. */
import { AnimatePresence, motion, useTransform } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { ghostX, ghostY, useDragStore } from '@/lib/dragEngine';
import { TEMPLATE_DRAG_PREFIX } from './TemplateStrip';
import { GREG_MONTHS_HE, keyToDate } from '@/lib/dates';
import { ICON, SNAP, STROKE } from '@/lib/motion';

/**
 * יעד המחיקה.
 *
 * צף בתחתית המסך רק בזמן גרירה, ובמרכז: זה המקום שאליו האגודל מגיע
 * בלי לשנות אחיזה, ובעברית או באנגלית הוא אותו מקום.
 *
 * `pointer-events-none` הוא חובה - הגרירה נמדדת ב-`elementFromPoint`,
 * ושכבה שמקבלת אירועי מצביע הייתה מסתירה את הימים שמתחתיה. במקומה
 * מנוע הגרירה מודד את המלבן של העיגול הזה ישירות.
 */
function TrashTarget() {
  const over = useDragStore((s) => s.overTrash);

  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[59] flex justify-center"
      style={{
        paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), var(--inset-bottom, 0px)) + 26px)',
      }}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 28 }}
      transition={SNAP}
    >
      <motion.div
        data-drag-trash
        animate={{ scale: over ? 1.18 : 1 }}
        transition={SNAP}
        className={`flex h-[62px] w-[62px] items-center justify-center rounded-full shadow-floating ring-[3px] ring-canvas transition-colors ${
          over
            ? 'bg-[rgb(194_60_90)] text-white'
            : 'bg-surface text-[rgb(194_60_90)] dark:text-[rgb(249_178_195)]'
        }`}
      >
        <Trash2 size={ICON.lg} strokeWidth={STROKE} />
      </motion.div>
    </motion.div>
  );
}

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

  /*
    תבנית שנגררת אינה אירוע קיים אלא מקור ליצירה, ואין מה למחוק בה.
    בלי התנאי היעד היה נדלק תחת האצבע ואז לא קורה דבר - וזה גרוע
    מיעד שלא הופיע כלל.
  */
  const deletable = Boolean(occurrence && !occurrence.baseId.startsWith(TEMPLATE_DRAG_PREFIX));

  return createPortal(
    <AnimatePresence>
      {active && deletable && <TrashTarget key="trash" />}
      {active && occurrence && (
        <motion.div
          key="ghost"
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
