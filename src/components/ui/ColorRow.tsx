/**
 * שורת בחירת צבע קומפקטית, לשדות הוספה מהירה.
 *
 * למה רכיב ולא העתקה: אותה שורה נדרשת בהוספת תזכורת ובהוספת תבנית,
 * ושתי העתקות היו נפרדות ביום שמישהו משנה אחת מהן. בעורך האירוע המלא
 * יש בורר גדול יותר - שם יש מקום, וכאן אין.
 *
 * אזור המגע 44px והעיגול 32: מטרה קטנה מדי היא הסיבה הנפוצה ביותר
 * לבחירה שגויה במגע, וצבע שרואים בנקודה זעירה אינו נקרא כצבע.
 */
import { motion } from 'framer-motion';
import type { EventColor } from '@/types';
import { EVENT_COLORS } from '@/store/events';
import { haptic } from '@/lib/native';
import { TAP } from '@/lib/motion';
import { CheckMark } from './controls';

// המחלקות נבנות דינמית (`ev-${color}`), ו-Tailwind מוחק מחלקה של שכבת
// components שאינה כתובה במלואה באף קובץ. הטבלה הזו היא מה ששומר אותן.
export const COLOR_SWATCH: Record<EventColor, string> = {
  graphite: 'ev-graphite',
  butter: 'ev-butter',
  peach: 'ev-peach',
  rose: 'ev-rose',
  violet: 'ev-violet',
  sky: 'ev-sky',
  mint: 'ev-mint',
  sage: 'ev-sage',
  slate: 'ev-slate',
};

export function ColorRow({
  value,
  onChange,
  label = 'צבע',
}: {
  value: EventColor;
  onChange: (color: EventColor) => void;
  label?: string;
}) {
  return (
    /*
      רשת של תשעה ולא שורה גמישה: תשעה עיגולים ברוחב 44 לא נכנסים בטלפון,
      ושורה שנגלשת לשתיים נראית כמו שתי בחירות. כאן כל תא מתכווץ, והגובה
      נשאר 44 - מספיק לאצבע.
    */
    <div
      className="grid items-center justify-items-center"
      style={{ gridTemplateColumns: `repeat(${EVENT_COLORS.length}, minmax(0, 1fr))` }}
      role="radiogroup"
      aria-label={label}
    >
      {EVENT_COLORS.map((c) => {
        const on = c.id === value;
        return (
          <motion.button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={c.label}
            whileTap={{ scale: 0.85 }}
            transition={TAP}
            onClick={() => {
              void haptic('light');
              onChange(c.id);
            }}
            className="focus-ring flex h-11 w-full max-w-[44px] items-center justify-center rounded-full"
          >
            {/*
              הנבחר מקבל טבעת דיו ווי, ולא רק הגדלה: הבדל של כמה פיקסלים
              בגודל אינו נקרא במבט, ובלי צבע (עיוורון צבעים) אינו נקרא בכלל.
            */}
            <span
              /* outline ולא ring-offset: הרווח שקוף, ולכן נכון על כל רקע */
              className={`ev ${COLOR_SWATCH[c.id]} flex h-8 w-8 items-center justify-center rounded-full ${
                on ? 'outline outline-2 outline-offset-2 outline-ink' : ''
              }`}
            >
              <span className="ev-solid flex h-full w-full items-center justify-center rounded-full text-white">
                {on && <CheckMark size={14} />}
              </span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
