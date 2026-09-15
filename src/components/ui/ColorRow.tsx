/**
 * שורת בחירת צבע קומפקטית, לשדות הוספה מהירה.
 *
 * למה רכיב ולא העתקה: אותה שורה נדרשת בהוספת תזכורת ובהוספת תבנית,
 * ושתי העתקות היו נפרדות ביום שמישהו משנה אחת מהן. בעורך האירוע המלא
 * יש בורר גדול יותר - שם יש מקום, וכאן אין.
 *
 * הנקודות עגולות וגדולות דיין לאצבע (44px אזור מגע), אף שהצבע עצמו
 * קטן: מטרה קטנה מדי היא הסיבה הנפוצה ביותר לבחירה שגויה במגע.
 */
import { motion } from 'framer-motion';
import type { EventColor } from '@/types';
import { EVENT_COLORS } from '@/store/events';
import { haptic } from '@/lib/native';
import { TAP } from '@/lib/motion';

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
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
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
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-full"
          >
            <span
              className={`ev ev-${c.id} block rounded-full transition-all ${
                on ? 'h-5 w-5 ring-2 ring-brand ring-offset-2 ring-offset-surface' : 'h-4 w-4'
              }`}
            >
              <span className="ev-solid block h-full w-full rounded-full" />
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
