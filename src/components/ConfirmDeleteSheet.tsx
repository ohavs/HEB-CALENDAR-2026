/**
 * אישור למחיקה שהתחילה בגרירה.
 *
 * למה בכלל לשאול: גרירה אל הפח היא תנועה אחת רציפה, ואצבע שהחליקה
 * לתחתית המסך נראית בדיוק כמו כוונה למחוק. בכל שאר המקומות באפליקציה
 * המחיקה דורשת הקשה שנייה על אותו כפתור; כאן אין כפתור, ולכן השאלה.
 *
 * מופע בתוך סדרה חוזרת אינו עובר כאן אלא דרך `ScopeSheet` - שם השאלה
 * "מה למחוק" ממילא כוללת את האישור.
 */
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { PrimaryButton } from './ui/controls';
import { ICON, STROKE, TAP_SCALE } from '@/lib/motion';

export function ConfirmDeleteSheet({
  open,
  onClose,
  onConfirm,
  title,
  hint,
  note = 'אפשר יהיה לבטל מיד אחרי',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** שם האירוע שעומד להימחק */
  title: string;
  hint: string;
  /**
   * מה קורה אחרי. ברירת המחדל מבטיחה ביטול, וזה נכון לתזכורת אישית -
   * היא נמחקת מקומית ויש לה `restore`. פריט ברשימה משותפת נמחק בענן
   * אצל כל החברים, ואין לו ביטול; הבטחה כוזבת שם גרועה מאין הבטחה.
   */
  note?: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="למחוק?" subtitle={hint}>
      <div className="flex flex-col gap-3 pb-3">
        <div className="flex items-center gap-4 rounded-2xl bg-well px-4 py-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgb(253_231_236)] text-[rgb(194_60_90)] dark:bg-[rgb(65_28_40)] dark:text-[rgb(249_178_195)]">
            <Trash2 size={ICON.lg} strokeWidth={STROKE} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-semibold text-ink">{title}</span>
            <span className="mt-1 block text-caption text-muted">{note}</span>
          </span>
        </div>

        <PrimaryButton tone="danger" onClick={onConfirm}>
          מחיקה
        </PrimaryButton>
        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={onClose}
          className="focus-ring w-full rounded-2xl py-4 text-label font-semibold text-muted"
        >
          ביטול
        </motion.button>
      </div>
    </Sheet>
  );
}
