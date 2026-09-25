/**
 * שורת האפשרויות של הוספה מהירה: יום, שעה, ומוצא לעורך המלא.
 *
 * רכיב אחד לשתי הרשימות - האישית והמשותפת - ולא העתקה בכל מסך. תזכורת
 * ופריט משותף נבדלים במקום שבו הם חיים, לא בשאלה "מתי", ושתי שורות
 * נפרדות היו נפרדות גם בהתנהגות ברגע שאחת מהן תשתנה.
 */
import { useState, type ReactNode } from 'react';
import { CalendarDays, Clock, SlidersHorizontal, X } from 'lucide-react';
import type { DateKey } from '@/types';
import { addDays, dateKey } from '@/lib/dates';
import { dayForTime, suggestReminderTime } from '@/lib/reminderCompose';
import { ICON, STROKE } from '@/lib/motion';
import { haptic } from '@/lib/native';
import { DatePickerSheet, TimePickerSheet } from './Picker';

export type ComposeState = {
  /** היום שנבחר, או null כשאין */
  targetDate: DateKey | null;
  time: string | null;
  setDate: (next: DateKey | null) => void;
  setTime: (next: string | null) => void;
  reset: () => void;
};

/**
 * המצב של השורה.
 *
 * הוק ולא state במסך, כי שני הכללים כאן שייכים לשורה ולא למסך שמכיל
 * אותה: יום שנבחר מקבל שעה מוצעת, ושעה שנבחרה בלי יום מקבלת את היום
 * הקרוב שבו היא עוד לפנינו.
 */
export function useComposeRow(now: Date): ComposeState {
  const [targetDate, setTargetDate] = useState<DateKey | null>(null);
  const [time, setTimeRaw] = useState<string | null>(null);

  return {
    targetDate,
    time,
    /**
     * יום שנבחר מקבל שעה מיד, כי תזכורת לשעה מסוימת היא המקרה הרגיל.
     * ניקוי היום מנקה גם את השעה: שעה בלי יום אינה שעה. שעה שכבר נקבעה
     * ביד אינה נדרסת במעבר בין ימים.
     */
    setDate: (next) => {
      setTargetDate(next);
      if (next === null) setTimeRaw(null);
      else if (time === null) setTimeRaw(suggestReminderTime(now, next === dateKey(now)));
    },
    /** שעה בלי יום מקבלת את היום הקרוב שבו היא עוד לפנינו */
    setTime: (next) => {
      setTimeRaw(next);
      if (next === null || targetDate !== null) return;
      setTargetDate(dayForTime(next, now));
    },
    reset: () => {
      setTargetDate(null);
      setTimeRaw(null);
    },
  };
}

/** "היום", "מחר", או "21.9" */
function dayChipLabel(key: DateKey, now: Date): string {
  if (key === dateKey(now)) return 'היום';
  if (key === dateKey(addDays(now, 1))) return 'מחר';
  const [, m, d] = key.split('-');
  return `${Number(d)}.${Number(m)}`;
}

/**
 * צ׳יפ עם ערך: הקשה פותחת בורר, ו-× מנקה. בלעדי ה-× לא הייתה דרך לוותר
 * על יום או על שעה בלי לפתוח את העורך המלא.
 */
function ValueChip({
  icon,
  empty,
  value,
  onOpen,
  onClear,
  clearLabel,
}: {
  icon: ReactNode;
  empty: string;
  value: string | null;
  onOpen: () => void;
  onClear: () => void;
  clearLabel: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg transition-colors ${
        value ? 'bg-brand text-white' : 'bg-well text-muted'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          void haptic('light');
          onOpen();
        }}
        className={`focus-ring flex min-w-0 items-center gap-1.5 py-1.5 text-caption font-medium ${
          value ? 'ps-2.5 pe-1' : 'px-2.5'
        }`}
      >
        {icon}
        <span className="tnum truncate">{value ?? empty}</span>
      </button>
      {value && (
        <button
          type="button"
          onClick={() => {
            void haptic('light');
            onClear();
          }}
          aria-label={clearLabel}
          className="focus-ring py-1.5 pe-2.5 ps-1"
        >
          <X size={ICON.xs} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

export function ComposeRow({
  state,
  now,
  onMore,
}: {
  state: ComposeState;
  now: Date;
  /** פתיחת העורך המלא על מה שכבר הוקלד */
  onMore: () => void;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const { targetDate, time } = state;

  return (
    <>
      {/*
        שלושה צ׳יפים: יום, שעה, ומוצא לעורך המלא. קודם היו כאן "היום"
        ו"מחר" כצ׳יפים נפרדים, והשעה הופיעה רק בשורה שנייה אחרי שנבחר
        יום - כלומר את מה שבאמת משתנה בין תזכורת לתזכורת, השעה, היה הכי
        רחוק להגיע אליו. "היום" ו"מחר" עדיין נאמרים, כתווית של היום שנבחר.
      */}
      <div className="flex items-center gap-1.5 px-0.5 pt-2">
        <ValueChip
          icon={<CalendarDays size={ICON.xs} strokeWidth={STROKE} className="shrink-0" />}
          empty="יום"
          value={targetDate ? dayChipLabel(targetDate, now) : null}
          onOpen={() => setDateOpen(true)}
          onClear={() => state.setDate(null)}
          clearLabel="בלי יום"
        />
        <ValueChip
          icon={<Clock size={ICON.xs} strokeWidth={STROKE} className="shrink-0" />}
          empty="שעה"
          value={time}
          onOpen={() => setTimeOpen(true)}
          onClear={() => state.setTime(null)}
          clearLabel="בלי שעה"
        />
        <button
          type="button"
          onClick={onMore}
          className="focus-ring flex shrink-0 items-center gap-1.5 rounded-lg bg-well px-2.5 py-1.5 text-caption font-medium text-muted"
        >
          <SlidersHorizontal size={ICON.xs} strokeWidth={STROKE} />
          כל האפשרויות
        </button>
      </div>

      <DatePickerSheet
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        title="איזה יום"
        value={targetDate ?? dateKey(now)}
        onChange={state.setDate}
      />

      <TimePickerSheet
        open={timeOpen}
        onClose={() => setTimeOpen(false)}
        title="באיזו שעה"
        value={time ?? suggestReminderTime(now, (targetDate ?? dateKey(now)) === dateKey(now))}
        onChange={state.setTime}
      />
    </>
  );
}
