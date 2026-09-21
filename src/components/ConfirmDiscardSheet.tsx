/**
 * אישור לפני שטופס שמולא נסגר בלי שנשמר.
 *
 * למה: לחלונית ארבעה מוצאים שקטים - גרירה למטה, הקשה על הרקע, Esc
 * וכפתור החזרה של אנדרואיד - ואצבע שהחליקה קצת יותר מדי נראית בדיוק
 * כמו כוונה לצאת. עד עכשיו כל מה שהוקלד נעלם בלי סימן.
 *
 * השאלה נשאלת רק כשיש מה לאבד (`isDraftDirty`), ולכן היא נדירה מספיק
 * כדי שיקראו אותה. "להמשיך לערוך" הוא הכפתור הבטוח, ולכן הוא המודגש.
 */
import { motion } from 'framer-motion';
import { FilePen } from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { PrimaryButton } from './ui/controls';
import { ICON, STROKE, TAP_SCALE } from '@/lib/motion';

export function ConfirmDiscardSheet({
  open,
  onKeepEditing,
  onDiscard,
  hint = 'מה שמילאתם כאן עוד לא נשמר',
}: {
  open: boolean;
  /** חזרה לטופס, בלי לגעת בו */
  onKeepEditing: () => void;
  /** יציאה בלי לשמור */
  onDiscard: () => void;
  hint?: string;
}) {
  return (
    <Sheet open={open} onClose={onKeepEditing} title="לצאת בלי לשמור?" showCloseButton={false}>
      <div className="flex flex-col gap-3 pb-3">
        <div className="flex items-center gap-4 rounded-2xl bg-well px-4 py-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgb(253_243_224)] text-[rgb(170_110_20)] dark:bg-[rgb(60_44_18)] dark:text-[rgb(240_200_130)]">
            <FilePen size={ICON.lg} strokeWidth={STROKE} />
          </span>
          <span className="min-w-0 flex-1 text-caption text-muted">{hint}</span>
        </div>

        <PrimaryButton onClick={onKeepEditing}>להמשיך לערוך</PrimaryButton>
        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={onDiscard}
          className="focus-ring w-full rounded-2xl py-4 text-label font-semibold text-muted"
        >
          לצאת בלי לשמור
        </motion.button>
      </div>
    </Sheet>
  );
}
