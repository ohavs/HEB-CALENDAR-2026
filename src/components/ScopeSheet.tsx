/**
 * "המופע הזה או כל הסדרה?"
 *
 * נשאל בכל פעם שפעולה על אירוע חוזר עלולה להשפיע על יותר ממה שהמשתמש
 * התכוון אליו. השאלה נשאלת אחרי שהמשתמש כבר עשה את הפעולה, ולכן היא
 * מנוסחת סביב מה שעומד לקרות ולא סביב מה שהוא רוצה.
 */
import { motion } from 'framer-motion';
import { CalendarRange, CalendarX } from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE, TAP_SCALE } from '@/lib/motion';

export type EditScope = 'occurrence' | 'series';

export function ScopeSheet({
  open,
  onClose,
  onChoose,
  title,
  occurrenceLabel,
  seriesLabel,
  occurrenceHint,
  seriesHint,
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (scope: EditScope) => void;
  title: string;
  occurrenceLabel: string;
  seriesLabel: string;
  occurrenceHint: string;
  seriesHint: string;
  /** מסמן את בחירת הסדרה כפעולה שקשה לחזור ממנה */
  destructive?: boolean;
}) {
  const choose = (scope: EditScope) => {
    onChoose(scope);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle="אירוע חוזר">
      <div className="flex flex-col gap-2.5 pb-3">
        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={() => choose('occurrence')}
          className="focus-ring flex items-center gap-4 rounded-2xl bg-well px-4 py-4 text-right active:bg-hairline"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
            <CalendarX size={ICON.lg} strokeWidth={STROKE} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-ink">{occurrenceLabel}</span>
            <span className="mt-1 block text-caption text-muted">{occurrenceHint}</span>
          </span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={() => choose('series')}
          className="focus-ring flex items-center gap-4 rounded-2xl bg-well px-4 py-4 text-right active:bg-hairline"
        >
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              destructive
                ? 'bg-[rgb(253_231_236)] text-[rgb(194_60_90)] dark:bg-[rgb(65_28_40)] dark:text-[rgb(249_178_195)]'
                : 'bg-brand-soft text-brand-ink'
            }`}
          >
            <CalendarRange size={ICON.lg} strokeWidth={STROKE} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-ink">{seriesLabel}</span>
            <span className="mt-1 block text-caption text-muted">{seriesHint}</span>
          </span>
        </motion.button>
      </div>
    </Sheet>
  );
}
