/**
 * הסינון של סדר היום.
 *
 * גרסה קודמת פרשה שש קטגוריות כשורת צ׳יפים נגללת. זה תפס רוחב, חייב
 * גלילה אופקית כדי לראות את כולן, ובעיקר לא היה ברור: צ׳יפ מלא מול צ׳יפ
 * ריק לא אומר לאף אחד "מוצג" מול "מוסתר".
 *
 * במקומה פקד אחד קומפקטי שפותח גיליון עם מתגים - בדיוק מה שיש בהגדרות,
 * ולכן זה מובן בלי ללמוד כלום. הפקד עצמו נושא את הסיכום, כך שאפשר לדעת
 * מה מסונן בלי לפתוח אותו.
 */
import { motion } from 'framer-motion';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { AgendaCategory } from '@/types';
import { AGENDA_CATEGORIES } from '@/lib/agendaFilters';
import { Sheet } from './ui/Sheet';
import { Toggle } from './ui/controls';
import { ICON, STROKE, TAP_SCALE } from '@/lib/motion';

/** "חגים, צומות" או "3 קטגוריות" - סיכום שנכנס בשורה אחת. */
function summary(hidden: AgendaCategory[]): string {
  if (hidden.length === 0) return 'הכול מוצג';
  if (hidden.length >= 3) return `${hidden.length} קטגוריות מוסתרות`;
  const names = AGENDA_CATEGORIES.filter((c) => hidden.includes(c.id)).map((c) => c.label);
  return `${names.join(', ')} מוסתרים`;
}

export function AgendaFilterButton({
  hidden,
  onOpen,
}: {
  hidden: AgendaCategory[];
  onOpen: () => void;
}) {
  const filtering = hidden.length > 0;

  return (
    <div className="sticky top-0 z-20 -mx-[var(--gutter)] bg-canvas/95 px-[var(--gutter)] pb-3 pt-1 backdrop-blur">
      <motion.button
        type="button"
        whileTap={TAP_SCALE}
        onClick={onOpen}
        className={`focus-ring flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-right transition-colors ${
          filtering ? 'bg-brand-soft' : 'bg-well'
        }`}
      >
        <SlidersHorizontal
          size={ICON.sm}
          strokeWidth={STROKE}
          className={`shrink-0 ${filtering ? 'text-brand-ink' : 'text-muted'}`}
        />
        <span
          className={`min-w-0 flex-1 truncate text-caption font-semibold ${
            filtering ? 'text-brand-ink' : 'text-muted'
          }`}
        >
          {summary(hidden)}
        </span>
        <span
          className={`shrink-0 text-caption font-medium ${
            filtering ? 'text-brand-ink/70' : 'text-faint'
          }`}
        >
          סינון
        </span>
      </motion.button>
    </div>
  );
}

export function AgendaFilterSheet({
  open,
  onClose,
  hidden,
  onToggle,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  hidden: AgendaCategory[];
  onToggle: (category: AgendaCategory) => void;
  onReset: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="מה להציג"
      subtitle="בסדר היום בלבד; הלוח עצמו לא משתנה"
      headerAction={
        hidden.length > 0 ? (
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={onReset}
            className="focus-ring flex h-11 items-center gap-2 rounded-2xl bg-well px-4 text-caption font-semibold text-muted"
          >
            <RotateCcw size={ICON.xs} strokeWidth={STROKE} />
            הכול
          </motion.button>
        ) : undefined
      }
    >
      <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well pb-0">
        {AGENDA_CATEGORIES.map(({ id, label }) => (
          <div key={id} className="flex items-center justify-between gap-3 px-4 py-4">
            <span className="text-body font-medium text-ink">{label}</span>
            <Toggle label={label} checked={!hidden.includes(id)} onChange={() => onToggle(id)} />
          </div>
        ))}
      </div>
    </Sheet>
  );
}
