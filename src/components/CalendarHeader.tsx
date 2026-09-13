/** כותרת הלוח: פרופיל, שם החודש, חיפוש והוספה - בדיוק כמו בעיצוב הייחוס. */
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Plus, Search, User } from 'lucide-react';
import { GREG_MONTHS_HE } from '@/lib/dates';

export function CalendarHeader({
  month,
  hebrewMonthLabel,
  showToday,
  photoURL,
  onProfile,
  onSearch,
  onAdd,
  onToday,
  onTitle,
}: {
  month: Date;
  hebrewMonthLabel?: string;
  showToday: boolean;
  photoURL: string | null;
  onProfile: () => void;
  onSearch: () => void;
  onAdd: () => void;
  onToday: () => void;
  onTitle: () => void;
}) {
  const label = `${GREG_MONTHS_HE[month.getMonth()]} ${month.getFullYear()}`;

  return (
    <header className="safe-t shrink-0 gutter-x pb-5 pt-7 lg:pb-6 lg:pt-9">
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
              <User size={20} strokeWidth={2.2} />
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
            <span className="mt-1.5 block text-caption leading-none text-muted">
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
                <CalendarDays size={21} strokeWidth={2.1} />
              </motion.button>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={onSearch}
            whileTap={{ scale: 0.92 }}
            aria-label="חיפוש"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted lg:h-12 lg:w-12"
          >
            <Search size={21} strokeWidth={2.1} />
          </motion.button>

          <motion.button
            type="button"
            onClick={onAdd}
            whileTap={{ scale: 0.9 }}
            aria-label="אירוע חדש"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-soft lg:h-[52px] lg:w-[52px]"
          >
            <Plus size={23} strokeWidth={2.4} />
          </motion.button>
        </div>
      </div>
    </header>
  );
}
