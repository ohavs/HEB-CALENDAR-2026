/**
 * שורת "אין חיבור".
 *
 * מופיעה מתחת לכותרת ולא מעליה, כדי שלא תדחוף את כל המסך למטה בכל
 * הבהוב רשת. הטקסט אומר מה שחשוב באמת - שהנתונים לא אבדו - ולא רק
 * שאין רשת, שזה דבר שהמשתמש כבר יודע.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnline';
import { ENTER, EXIT, ICON, STROKE } from '@/lib/motion';

export function OfflineBar() {
  const online = useOnline();

  return (
    <AnimatePresence initial={false}>
      {!online && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: ENTER }}
          exit={{ height: 0, opacity: 0, transition: EXIT }}
          className="shrink-0 overflow-hidden gutter-x"
          role="status"
        >
          <div className="mb-2 flex items-center gap-2.5 rounded-2xl bg-well px-4 py-2.5">
            <CloudOff size={ICON.sm} strokeWidth={STROKE} className="shrink-0 text-muted" />
            <span className="text-caption text-muted">
              אין חיבור. הכול נשמר במכשיר ויסונכרן כשהרשת תחזור.
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
