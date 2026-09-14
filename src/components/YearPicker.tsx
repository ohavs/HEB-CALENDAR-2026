/**
 * תצוגת שנה - רשימת חודשים עם רשת ימים זעירה, כמו במסך השלישי בעיצוב הייחוס.
 * לחיצה על יום קופצת אליו בלוח.
 */
import { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GREG_MONTHS_HE, dateKey, isSameDay, monthGridDays, orderedWeekdays } from '@/lib/dates';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE } from '@/lib/motion';

export function YearPicker({
  open,
  onClose,
  year,
  focusMonth,
  onPick,
  onYearChange,
}: {
  open: boolean;
  onClose: () => void;
  year: number;
  /** החודש המוצג כרגע בלוח, כדי לגלול אליו */
  focusMonth: number;
  onPick: (date: Date) => void;
  onYearChange: (year: number) => void;
}) {
  const scrollTarget = useRef<HTMLDivElement>(null);
  const today = new Date();

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) => ({
        month: m,
        days: monthGridDays(new Date(year, m, 1)),
      })),
    [year],
  );

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      scrollTarget.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }, 120);
    return () => clearTimeout(timer);
  }, [open, focusMonth]);

  const weekdays = orderedWeekdays();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="tall"
      title={String(year)}
      headerAction={
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="שנה קודמת"
            onClick={() => onYearChange(year - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-well text-muted active:bg-hairline"
          >
            <ChevronRight size={ICON.md} strokeWidth={STROKE} />
          </button>
          <button
            type="button"
            aria-label="שנה הבאה"
            onClick={() => onYearChange(year + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-well text-muted active:bg-hairline"
          >
            <ChevronLeft size={ICON.md} strokeWidth={STROKE} />
          </button>
        </div>
      }
    >
      <div className="space-y-6 pb-4">
        {months.map(({ month, days }) => (
          <section key={month} ref={month === focusMonth ? scrollTarget : undefined}>
            <h3 className="mb-1.5 text-title font-semibold text-ink">
              {GREG_MONTHS_HE[month]}
            </h3>
            <div className="mb-1 grid grid-cols-7">
              {weekdays.map((w) => (
                <span key={w} className="text-center text-micro text-faint">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {days.map((d) => {
                const inMonth = d.getMonth() === month;
                const isToday = isSameDay(d, today);
                return (
                  <button
                    key={dateKey(d)}
                    type="button"
                    onClick={() => {
                      onPick(d);
                      onClose();
                    }}
                    className="flex items-center justify-center py-0.5"
                  >
                    <span
                      className={`tnum flex h-7 w-7 items-center justify-center rounded-xl text-caption ${
                        !inMonth
                          ? 'text-faint/50'
                          : isToday
                            ? 'bg-brand font-semibold text-white'
                            : d.getDay() === 6
                              ? 'font-medium text-brand-ink'
                              : 'text-ink'
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
