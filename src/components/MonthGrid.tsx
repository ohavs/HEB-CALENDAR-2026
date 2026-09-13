/**
 * רשת החודש - שורת שמות הימים ו-6 שורות של תאים.
 *
 * נגישות: הרשת היא role="grid" עם שורות ותאים, וניווט בחיצים כמו בכל
 * לוח שנה. רק תא אחד נושא tabIndex=0 בכל רגע (roving tabindex), אחרת
 * יציאה מהלוח במקלדת הייתה דורשת 42 הקשות Tab.
 *
 * שורות ה-role="row" מוגדרות `display: contents` כדי שלא ישברו את
 * פריסת ה-grid בת שבע העמודות - הסמנטיקה נוספת בלי לשנות את המראה.
 */
import { useCallback } from 'react';
import { LayoutGroup } from 'framer-motion';
import type { DayInfo, Settings } from '@/types';
import { addDays, dateKey, orderedWeekdays } from '@/lib/dates';
import { useElementSize } from '@/hooks/useElementSize';
import type { MonthData } from '@/hooks/useMonthData';
import { DayCell } from './DayCell';

export function WeekdayHeader({ weekStart }: { weekStart: 0 | 1 }) {
  const names = orderedWeekdays(weekStart);
  return (
    <div className="grid shrink-0 grid-cols-7 px-1.5 pb-2.5 lg:pb-3.5" role="row">
      {names.map((name, i) => (
        <span
          key={name}
          role="columnheader"
          className={`text-center text-tiny font-medium ${
            (weekStart === 0 && i === 6) || (weekStart === 1 && i === 5)
              ? 'text-brand-ink/70'
              : 'text-faint'
          }`}
        >
          {name}
        </span>
      ))}
    </div>
  );
}

/** כמה ימים כל מקש מזיז. ב-RTL הזמן זורם שמאלה. */
const KEY_DELTA: Record<string, number> = {
  ArrowLeft: 1,
  ArrowRight: -1,
  ArrowDown: 7,
  ArrowUp: -7,
};

export function MonthGrid({
  data,
  settings,
  selectedKey,
  onSelectDay,
  onNavigate,
  layoutGroupId,
}: {
  data: MonthData;
  settings: Settings;
  selectedKey: string;
  onSelectDay: (day: DayInfo) => void;
  /** ניווט מקלדת אל תאריך שאינו בהכרח ברשת הנוכחית */
  onNavigate: (date: Date) => void;
  layoutGroupId: string;
}) {
  const { ref, height } = useElementSize<HTMLDivElement>();
  // גובה שורה בפועל, פחות שורת המספר והתאריך העברי, חלקי גובה שורת כיתוב
  const rowHeight = height > 0 ? height / 6 : 0;
  // הטיפוגרפיה נוזלית, ולכן מודדים את גובה השורה בפועל מול גובה שורת כיתוב
  // משוער: מספר היום והתאריך העברי תופסים כ-58px, וכל כיתוב כ-17px.
  const capacity =
    rowHeight > 0 ? Math.max(1, Math.min(4, Math.floor((rowHeight - 58) / 17))) : 2;

  const weeks: Date[][] = [];
  for (let i = 0; i < data.gridDays.length; i += 7) {
    weeks.push(data.gridDays.slice(i, i + 7));
  }

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const focused = (e.target as HTMLElement).closest<HTMLElement>('[data-day-key]');
      if (!focused) return;
      const current = focused.dataset.dayKey!;
      const currentDate = data.days.get(current)?.date;
      if (!currentDate) return;

      const delta = KEY_DELTA[e.key];
      let target: Date | null = null;

      if (delta !== undefined) target = addDays(currentDate, delta);
      else if (e.key === 'Home') target = addDays(currentDate, -((currentDate.getDay() - settings.weekStart + 7) % 7));
      else if (e.key === 'End') target = addDays(currentDate, 6 - ((currentDate.getDay() - settings.weekStart + 7) % 7));
      else if (e.key === 'PageDown') target = addDays(currentDate, 28);
      else if (e.key === 'PageUp') target = addDays(currentDate, -28);
      else return;

      e.preventDefault();
      onNavigate(target);

      // אם היעד נמצא באותה רשת, מעבירים אליו את המיקוד מיד; אחרת החודש
      // מתחלף וה-effect שלמטה יתפוס את התא החדש
      const key = dateKey(target);
      const next = ref.current?.querySelector<HTMLElement>(`[data-day-key="${key}"]`);
      next?.focus();
    },
    [data.days, onNavigate, ref, settings.weekStart],
  );

  return (
    <div
      ref={ref}
      role="grid"
      aria-label="לוח החודש"
      aria-rowcount={6}
      aria-colcount={7}
      onKeyDown={onKeyDown}
      className="mb-auto grid max-h-[620px] lg:max-h-none min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-[2px] overflow-hidden px-1.5 lg:gap-1.5"
    >
      <LayoutGroup id={layoutGroupId}>
        {weeks.map((week, rowIndex) => (
          <div
            key={dateKey(week[0])}
            role="row"
            aria-rowindex={rowIndex + 1}
            style={{ display: 'contents' }}
          >
            {week.map((date) => {
              const key = dateKey(date);
              const day = data.days.get(key);
              if (!day) return <span key={key} />;
              return (
                <DayCell
                  key={key}
                  day={day}
                  occurrences={data.occurrences.get(key) ?? []}
                  selected={key === selectedKey}
                  settings={settings}
                  capacity={capacity}
                  onSelect={onSelectDay}
                  layoutGroupId={layoutGroupId}
                  focusable={key === selectedKey}
                />
              );
            })}
          </div>
        ))}
      </LayoutGroup>
    </div>
  );
}
