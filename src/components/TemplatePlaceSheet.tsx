/**
 * שיבוץ תבנית על יום אחד או על כמה.
 *
 * למה בורר ייעודי ולא `DatePickerSheet`: זו הנקודה שבה התבנית מצדיקה את
 * עצמה. "חופש מהעבודה" נלקח לשלושה ימים רצופים, לא לאחד, ובורר של תאריך
 * יחיד היה מחייב לפתוח אותו שלוש פעמים. כאן כל הקשה מוסיפה או מסירה יום,
 * והשיבוץ קורה פעם אחת על כל מה שנבחר.
 *
 * הרשת כאן מכוונת ליד ולא לעין: היא מציגה מספרים בלבד, בלי מועדים ובלי
 * אירועים. מי שצריך להחליט *מתי* מסתכל בלוח; כאן הוא כבר יודע.
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DateKey, EventTemplate } from '@/types';
import {
  addMonths,
  dateKey,
  isSameMonth,
  monthGridDays,
  monthLabel,
  startOfDay,
} from '@/lib/dates';
import { Sheet } from './ui/Sheet';
import { PrimaryButton } from './ui/controls';
import { haptic } from '@/lib/native';
import { ICON, STROKE, TAP } from '@/lib/motion';

const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export function TemplatePlaceSheet({
  open,
  onClose,
  template,
  onPlace,
}: {
  open: boolean;
  onClose: () => void;
  template: EventTemplate | null;
  onPlace: (template: EventTemplate, dates: DateKey[]) => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [picked, setPicked] = useState<Set<DateKey>>(new Set());

  const days = useMemo(() => monthGridDays(month), [month]);
  const todayKey = dateKey(today);

  const toggle = (key: DateKey) => {
    void haptic('light');
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const step = (n: number) => setMonth((m) => addMonths(m, n));

  const submit = () => {
    if (!template || !picked.size) return;
    void haptic('medium');
    // ממוין, כדי שההודעה והביטול יתייחסו לימים לפי הסדר שבו הם על הלוח
    onPlace(template, [...picked].sort());
    setPicked(new Set());
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="tall"
      title="שיבוץ לימים"
      subtitle={template?.title}
    >
      <div className="pb-2">
        {/* ב-RTL הזמן זורם שמאלה: "הקודם" מימין, "הבא" משמאל */}
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            aria-label="החודש הבא"
            onClick={() => step(1)}
            className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl bg-well text-muted"
          >
            <ChevronLeft size={ICON.md} strokeWidth={STROKE} />
          </button>
          <span className="flex-1 text-center text-label font-semibold text-ink">
            {monthLabel(month)}
          </span>
          <button
            type="button"
            aria-label="החודש הקודם"
            onClick={() => step(-1)}
            className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl bg-well text-muted"
          >
            <ChevronRight size={ICON.md} strokeWidth={STROKE} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 pb-1">
          {WEEKDAYS.map((d) => (
            <span key={d} className="pb-1 text-center text-tiny font-semibold text-faint">
              {d}
            </span>
          ))}
          {days.map((date) => {
            const key = dateKey(date);
            const inMonth = isSameMonth(date, month);
            const on = picked.has(key);
            return (
              <motion.button
                key={key}
                type="button"
                whileTap={{ scale: 0.9 }}
                transition={TAP}
                onClick={() => toggle(key)}
                aria-pressed={on}
                aria-label={key}
                className={`focus-ring tnum flex h-11 items-center justify-center rounded-xl text-label transition-colors ${
                  on
                    ? 'bg-brand font-semibold text-white'
                    : inMonth
                      ? 'bg-well text-ink'
                      : 'text-faint'
                } ${key === todayKey && !on ? 'ring-1 ring-brand/50' : ''}`}
              >
                {date.getDate()}
              </motion.button>
            );
          })}
        </div>

        <div className="mt-5">
          <PrimaryButton onClick={submit} disabled={!picked.size}>
            {picked.size === 0
              ? 'בחרו ימים'
              : picked.size === 1
                ? 'שיבוץ ליום אחד'
                : `שיבוץ ל-${picked.size} ימים`}
          </PrimaryButton>
        </div>
      </div>
    </Sheet>
  );
}
