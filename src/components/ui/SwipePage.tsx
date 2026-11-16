/**
 * החלקה בין דפים של זמן, ללוח החודש ולרצועת השבוע כאחד.
 */
import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { animate, motion, useMotionValue, type ValueAnimationTransition } from 'framer-motion';
import { GLIDE, SNAP } from '@/lib/motion';
import { useAxisDrag } from '@/hooks/useAxisDrag';

/** מרחק/מהירות החלקה שמעבירים דף */
const SWIPE_DISTANCE = 58;
const SWIPE_VELOCITY = 320;

/*
  קדימה בזמן הוא שמאלה, כמו דפדוף בספר עברי.

  ב-RTL "הבא" יושב בשמאל, ולכן החודש הבא נכנס משמאל והנוכחי יוצא ימינה -
  והאצבע מביאה אותו בהחלקה ימינה, באותו כיוון שבו הרצועה זזה. קודם זה היה
  הפוך, כמו קרוסלה של שפה שנכתבת משמאל לימין: ההחלקה ימינה החזירה אחורה,
  והחודש הבא נכנס מהצד של "הקודם". התנועה הייתה נכונה, ובכל זאת נראתה
  כמו נסיגה.

  התוכן תמיד זז לכיוון האצבע, והחודש החדש תמיד נכנס מהצד שממנו היא באה.
  `x` של framer הוא פיזי ולא לוגי, ולכן הסימנים מפורשים ואינם מתהפכים
  לבד לפי `dir`.
*/
const variants = {
  enter: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%', opacity: 0.4 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0.4 }),
};

/**
 * דף של זמן - חודש בלוח, שבוע ברצועת הימים: נכנס מהצד, יוצא לצד השני,
 * ונגרר הצידה באצבע.
 *
 * רכיב משלו כי לכל דף ה-x שלו - הדף היוצא והנכנס זזים בו־זמנית. ref מועבר
 * כי `popLayout` של AnimatePresence מודד את הדף היוצא.
 */
export const SwipePage = forwardRef<
  HTMLDivElement,
  {
    direction: number;
    onPage: (delta: number) => void;
    /** כבוי בזמן שאירוע נגרר - הגרירה שלו גוברת */
    enabled?: boolean;
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
  }
>(function SwipePage({ direction, onPage, enabled = true, className = '', style, children }, ref) {
  const x = useMotionValue(0);
  /*
    החלקה ימינה מקדימה, החלקה שמאלה מחזירה. זה מודל "גוררים את הדף": האצבע
    מושכת את החודש הנוכחי החוצה ימינה, והבא נכנס משמאל - מאותו צד שבו
    יושב "הבא". ראו variants.

    לא `drag` של framer: הוא מודד את הפריסה בכל ציור של הדף, כלומר בכל
    הקשה על יום (ראו useAxisDrag).
  */
  const drag = useAxisDrag({
    axis: 'x',
    value: x,
    min: 0,
    max: 0,
    elastic: { min: 0.14, max: 0.14 },
    lock: true,
    enabled,
    onEnd: ({ offset, velocity }) => {
      if (offset > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) onPage(1);
      else if (offset < -SWIPE_DISTANCE || velocity < -SWIPE_VELOCITY) onPage(-1);
      else animate(x, 0, { ...(SNAP as ValueAnimationTransition<number>), velocity });
    },
  });

  return (
    <motion.div
      ref={ref}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ x: GLIDE, opacity: { duration: 0.18 } }}
      onPointerDown={(e) => {
        if (e.isPrimary && e.button === 0) drag.start(e);
      }}
      className={className}
      // pan-y: הגלילה האנכית של הדפדפן, והתנועה האופקית שלנו
      style={{ ...style, x, touchAction: 'pan-y' }}
    >
      {children}
    </motion.div>
  );
});
