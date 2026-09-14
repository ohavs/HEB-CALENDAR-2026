/**
 * סרגל הסינון של סדר היום.
 *
 * שורה אחת של צ׳יפים שנדבקת לראש הרשימה בזמן גלילה, כי החלטה על סינון
 * מתקבלת בדיוק כשרואים את מה שמפריע - ולא רק בראש הרשימה.
 *
 * הסימון הוא מילוי מלא ולא סימן וי: בשש אפשרויות, המילוי נקרא במבט אחד
 * ולא דורש לקרוא כל צ׳יפ בנפרד. צ׳יפ כבוי נשאר קריא ולא דהוי לגמרי,
 * אחרת קשה לדעת מה בכלל אפשר להחזיר.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import type { AgendaCategory } from '@/types';
import { AGENDA_CATEGORIES } from '@/lib/agendaFilters';
import { ENTER, EXIT, ICON, STROKE, TAP_SCALE } from '@/lib/motion';

export function AgendaFilterBar({
  hidden,
  onToggle,
  onReset,
}: {
  hidden: AgendaCategory[];
  onToggle: (category: AgendaCategory) => void;
  onReset: () => void;
}) {
  const filtering = hidden.length > 0;

  return (
    <div
      className="sticky top-0 z-20 -mx-[var(--gutter)] bg-canvas/95 px-[var(--gutter)] pb-2.5 pt-1 backdrop-blur"
      role="group"
      aria-label="סינון סדר היום"
    >
      <div className="no-scrollbar fade-inline -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
        {AGENDA_CATEGORIES.map(({ id, label }) => {
          const on = !hidden.includes(id);
          return (
            <motion.button
              key={id}
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => onToggle(id)}
              aria-pressed={on}
              className={`focus-ring shrink-0 whitespace-nowrap rounded-2xl px-3.5 py-2 text-caption font-semibold transition-colors ${
                on
                  ? 'bg-brand-soft text-brand-ink'
                  : 'bg-well text-faint ring-1 ring-inset ring-hairline'
              }`}
            >
              {label}
            </motion.button>
          );
        })}

        {/* איפוס מופיע רק כשיש מה לאפס */}
        <AnimatePresence initial={false}>
          {filtering && (
            <motion.button
              type="button"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto', transition: ENTER }}
              exit={{ opacity: 0, width: 0, transition: EXIT }}
              whileTap={TAP_SCALE}
              onClick={onReset}
              aria-label="הצגת הכול"
              className="focus-ring flex shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-2xl px-3 py-2 text-caption font-medium text-muted"
            >
              <RotateCcw size={ICON.xs} strokeWidth={STROKE} />
              הכול
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
