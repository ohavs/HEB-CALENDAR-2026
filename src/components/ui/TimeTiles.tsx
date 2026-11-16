/**
 * התחלה וסיום כשני אריחים גדולים, והגלגל קופץ בחלון באמצע המסך.
 *
 * השעה היא מה שמשתנה הכי הרבה בין אירוע לאירוע, ולכן היא הדבר הגדול
 * בטופס - בספרות ענק ב-Heebo, כי ספרות Karantina נקראות כאותיות.
 *
 * הגלגל נפרש קודם בתוך הטופס, ודחף את כל מה שמתחתיו מחוץ למסך - ובמסך
 * קטן גם את הגלגל עצמו, שנחתך בתחתית. חלון במרכז מראה את כל הגלגל בבת
 * אחת, ומה שהגיליון התחתון הסתיר (הסיום והמשך) כתוב בתוכו: השורה מתחת
 * לגלגל אומרת את הטווח שייצא, לפני שמאשרים.
 *
 * הבחירה נשמרת רק ב"בחירה": גלגל שהוזז בטעות ונסגר ברקע אינו משנה דבר.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { durationLabel } from '@/lib/dates';
import { shiftEndWithStart } from '@/lib/reminderCompose';
import { TAP } from '@/lib/motion';
import { TimeWheel } from './Picker';
import { Sheet } from './Sheet';
import { PrimaryButton } from './controls';

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
  /** מה שהגלגל מראה, עד שמאשרים */
  const [temp, setTemp] = useState(start);
  const duration = durationLabel(start, end);

  const openFor = (which: Which) => {
    setTemp(which === 'start' ? start : end);
    setOpen(which);
  };
  const close = () => setOpen(null);
  const confirm = () => {
    if (open === 'start') onStart(temp);
    else if (open === 'end') onEnd(temp);
    close();
  };

  // הטווח שייצא מהבחירה - שינוי ההתחלה מזיז גם את הסיום, כמו בטופס
  const range =
    open === 'start'
      ? { from: temp, to: shiftEndWithStart(start, end, temp) }
      : { from: start, to: temp };
  const rangeDuration = durationLabel(range.from, range.to);

  const tile = (which: Which, label: string, value: string) => (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      transition={TAP}
      onClick={() => openFor(which)}
      aria-haspopup="dialog"
      aria-label={`${label} ${value}`}
      className="focus-ring flex min-w-0 flex-col items-start gap-1 rounded-field bg-surface px-4 pb-3 pt-2.5 text-right text-ink"
    >
      <span className="truncate text-caption font-medium text-muted">{label}</span>
      {/* שעה נקראת משמאל לימין גם בממשק עברי */}
      <span dir="ltr" className="tnum text-hero font-bold leading-none">
        {value}
      </span>
    </motion.button>
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {tile('start', 'התחלה', start)}
        {tile('end', duration ? `סיום · ${duration}` : 'סיום', end)}
      </div>

      <Sheet
        open={open !== null}
        onClose={close}
        placement="center"
        title={open === 'end' ? 'שעת סיום' : 'שעת התחלה'}
        footer={
          /* הראשי ראשון - בימין, מאיפה שהעין מתחילה לקרוא */
          <div className="grid grid-cols-2 gap-2">
            <PrimaryButton onClick={confirm}>בחירה</PrimaryButton>
            <PrimaryButton tone="quiet" onClick={close}>
              ביטול
            </PrimaryButton>
          </div>
        }
      >
        {open && (
          <>
            {/* מפתח לפי האריח: גלגל חדש מתיישר על הערך שלו מההתחלה */}
            <TimeWheel key={open} value={temp} onChange={setTemp} />
            <p className="mt-3 text-center text-label text-muted" aria-live="polite">
              <span dir="ltr" className="tnum font-semibold text-ink">
                {range.from}–{range.to}
              </span>
              {rangeDuration && ` · ${rangeDuration}`}
            </p>
          </>
        )}
      </Sheet>
    </>
  );
}
