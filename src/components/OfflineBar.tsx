/**
 * שורת "אין חיבור".
 *
 * מופיעה מתחת לכותרת ולא מעליה, כדי שלא תדחוף את כל המסך למטה בכל
 * הבהוב רשת. הטקסט אומר מה שחשוב באמת - שהנתונים לא אבדו - ולא רק
 * שאין רשת, שזה דבר שהמשתמש כבר יודע.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff } from '@/components/ui/icons';
import { useOnline } from '@/hooks/useOnline';
import { ENTER, EXIT, ICON } from '@/lib/motion';

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
          {/*
            גלולה קטנה במרכז ולא פס לרוחב המסך: פס נקרא כתקלה, וזה מצב
            רגיל שאין בו מה לעשות. היא נשארת בזרימה ואינה זכוכית מרחפת -
            מרחפת היא הייתה מסתירה את השבוע הראשון בלוח, שאינו נגלל.
          */}
          <div className="flex justify-center pb-2">
            <div className="flex max-w-full items-center gap-2 rounded-full bg-well px-4 py-2">
              <CloudOff size={ICON.sm} className="shrink-0 text-muted" />
              <span className="text-caption text-muted">אין חיבור. הכול נשמר ויסונכרן אחר כך</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
