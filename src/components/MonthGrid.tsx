/** רשת החודש - שורת שמות הימים ו-6 שורות של תאים. */
import { LayoutGroup } from 'framer-motion';
import type { DayInfo, Settings } from '@/types';
import { dateKey, orderedWeekdays } from '@/lib/dates';
import { useElementSize } from '@/hooks/useElementSize';
import type { MonthData } from '@/hooks/useMonthData';
import { DayCell } from './DayCell';

export function WeekdayHeader({ weekStart }: { weekStart: 0 | 1 }) {
  const names = orderedWeekdays(weekStart);
  return (
    <div className="grid shrink-0 grid-cols-7 px-1.5 pb-2.5 lg:pb-3.5">
      {names.map((name, i) => (
        <span
          key={name}
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

export function MonthGrid({
  data,
  settings,
  selectedKey,
  onSelectDay,
  layoutGroupId,
}: {
  data: MonthData;
  settings: Settings;
  selectedKey: string;
  onSelectDay: (day: DayInfo) => void;
  layoutGroupId: string;
}) {
  const { ref, height } = useElementSize<HTMLDivElement>();
  // גובה שורה בפועל, פחות שורת המספר והתאריך העברי, חלקי גובה שורת כיתוב
  const rowHeight = height > 0 ? height / 6 : 0;
  // הטיפוגרפיה נוזלית, ולכן מודדים את גובה השורה בפועל מול גובה שורת כיתוב
  // משוער: מספר היום והתאריך העברי תופסים כ-58px, וכל כיתוב כ-17px.
  const capacity =
    rowHeight > 0 ? Math.max(1, Math.min(4, Math.floor((rowHeight - 58) / 17))) : 2;

  return (
    <div
      ref={ref}
      className="mb-auto grid max-h-[620px] lg:max-h-none min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-[2px] overflow-hidden px-1.5 lg:gap-1.5"
    >
      <LayoutGroup id={layoutGroupId}>
        {data.gridDays.map((date) => {
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
            />
          );
        })}
      </LayoutGroup>
    </div>
  );
}
