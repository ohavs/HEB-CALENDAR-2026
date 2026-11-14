/**
 * התחלה וסיום כשני אריחים גדולים, והגלגל נפרש מתחתם.
 *
 * השעה היא מה שמשתנה הכי הרבה בין אירוע לאירוע, ולכן היא הדבר הגדול
 * בטופס - בספרות ענק ב-Heebo, כי ספרות Karantina נקראות כאותיות. הגלגל
 * נפרש בתוך הטופס ולא בגיליון נוסף: גיליון מעל גיליון הסתיר בדיוק את מה
 * שהשעה משנה, את הסיום ואת שורת הסיכום.
 *
 * גרירת ספרות (כמו ב-noted) נשקלה ונדחתה: היא מתנגשת בגרירה לסגירה.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { durationLabel } from '@/lib/dates';
import { ENTER, EXIT, GLIDE, TAP } from '@/lib/motion';
import { TimeWheel } from './Picker';

type Which = 'start' | 'end';

export function TimeTiles({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string;
  onStart: (next: string) => void;
  onEnd: (next: string) => void;
}) {
  const [open, setOpen] = useState<Which | null>(null);
  const duration = durationLabel(start, end);

  const tile = (which: Which, label: string, value: string) => {
    const active = open === which;
    return (
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        transition={TAP}
        onClick={() => setOpen(active ? null : which)}
        aria-expanded={active}
        aria-label={`${label} ${value}`}
        className={`focus-ring flex min-w-0 flex-col items-start gap-1 rounded-field px-4 pb-3 pt-2.5 text-right transition-colors ${
          active ? 'bg-inverse text-on-inverse shadow-raised' : 'bg-surface text-ink'
        }`}
      >
        <span className={`truncate text-caption font-medium ${active ? 'opacity-75' : 'text-muted'}`}>
          {label}
        </span>
        {/* שעה נקראת משמאל לימין גם בממשק עברי */}
        <span dir="ltr" className="tnum text-hero font-semibold leading-none">
          {value}
        </span>
      </motion.button>
    );
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {tile('start', 'התחלה', start)}
        {tile('end', duration ? `סיום · ${duration}` : 'סיום', end)}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="wheel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { height: GLIDE, opacity: EXIT } }}
            transition={{ height: GLIDE, opacity: ENTER }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              {/* מפתח לפי האריח: גלגל חדש מתיישר על הערך שלו מההתחלה */}
              <TimeWheel
                key={open}
                onWell
                value={open === 'start' ? start : end}
                onChange={open === 'start' ? onStart : onEnd}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
