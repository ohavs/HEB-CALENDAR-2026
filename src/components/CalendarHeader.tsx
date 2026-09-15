/** כותרת הלוח: פרופיל, שם החודש, חיפוש והוספה - בדיוק כמו בעיצוב הייחוס. */
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Columns3, LayoutGrid, List, Plus, Search, User } from 'lucide-react';
import type { CalendarView } from '@/types';
import { GREG_MONTHS_HE } from '@/lib/dates';
import { ICON, STROKE } from '@/lib/motion';

const VIEW_ICON = { month: LayoutGrid, week: Columns3, agenda: List } as const;
const VIEW_LABEL: Record<CalendarView, string> = {
  month: 'חודש',
  week: 'שבוע',
  agenda: 'סדר יום',
};

export function CalendarHeader({
  month,
  title,
  hebrewMonthLabel,
  showToday,
  view,
  onPickView,
  photoURL,
  onProfile,
  onSearch,
  onAdd,
  onToday,
  onTitle,
}: {
  month: Date;
  /** כיתוב מפורש, כשהתצוגה אינה חודש שלם */
  title?: string;
  hebrewMonthLabel?: string;
  showToday: boolean;
  view: CalendarView;
  onPickView: () => void;
  photoURL: string | null;
  onProfile: () => void;
  onSearch: () => void;
  onAdd: () => void;
  onToday: () => void;
  onTitle: () => void;
}) {
  const label = title ?? `${GREG_MONTHS_HE[month.getMonth()]} ${month.getFullYear()}`;
  const ViewIcon = VIEW_ICON[view];

  return (
    <header className="safe-t shrink-0 gutter-x pb-3.5 pt-5 lg:pb-6 lg:pt-9">
      <div className="flex items-center gap-2.5 lg:gap-3.5">
        <motion.button
          type="button"
          onClick={onProfile}
          whileTap={{ scale: 0.92 }}
          aria-label="חשבון והגדרות"
          className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-well ring-1 ring-hairline lg:h-[52px] lg:w-[52px]"
        >
          {photoURL ? (
            <img src={photoURL} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted">
              <User size={ICON.lg} strokeWidth={STROKE} />
            </span>
          )}
        </motion.button>

        <button
          type="button"
          onClick={onTitle}
          className="min-w-0 flex-1 text-center"
          aria-label="בחירת חודש"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, position: 'absolute' }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="block text-heading font-semibold leading-tight text-ink"
            >
              {label}
            </motion.span>
          </AnimatePresence>
          {hebrewMonthLabel && (
            <span className="mt-1 block text-caption leading-none text-muted">
              {hebrewMonthLabel}
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1 lg:gap-2">
          <AnimatePresence initial={false}>
            {showToday && (
              <motion.button
                type="button"
                onClick={onToday}
                initial={{ opacity: 0, scale: 0.8, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                exit={{ opacity: 0, scale: 0.8, width: 0 }}
                whileTap={{ scale: 0.92 }}
                aria-label="חזרה להיום"
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-muted lg:h-12 lg:w-12"
              >
                <CalendarDays size={ICON.xl} strokeWidth={2.1} />
              </motion.button>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={onPickView}
            whileTap={{ scale: 0.92 }}
            aria-label={`תצוגה: ${VIEW_LABEL[view]}`}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted lg:h-12 lg:w-12"
          >
            <ViewIcon size={ICON.xl} strokeWidth={2.1} />
          </motion.button>

          <motion.button
            type="button"
            onClick={onSearch}
            whileTap={{ scale: 0.92 }}
            aria-label="חיפוש"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted lg:h-12 lg:w-12"
          >
            <Search size={ICON.xl} strokeWidth={2.1} />
          </motion.button>

          <motion.button
            type="button"
            onClick={onAdd}
            whileTap={{ scale: 0.9 }}
            aria-label="אירוע חדש"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-raised lg:h-[52px] lg:w-[52px]"
          >
            <Plus size={ICON.xl} strokeWidth={STROKE} />
          </motion.button>
        </div>
      </div>
    </header>
  );
}

export { VIEW_LABEL, VIEW_ICON };
