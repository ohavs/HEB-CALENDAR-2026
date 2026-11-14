/**
 * רשת החודש - שורת שמות הימים וחמש שורות של תאים, ושש רק בחודש שחוצה
 * שישה שבועות (`monthWeekCount`).
 *
 * נגישות: הרשת היא role="grid" עם שורות ותאים, וניווט בחיצים כמו בכל
 * לוח שנה. רק תא אחד נושא tabIndex=0 בכל רגע (roving tabindex), אחרת
 * יציאה מהלוח במקלדת הייתה דורשת 42 הקשות Tab.
 *
 * שורות ה-role="row" מוגדרות `display: contents` כדי שלא ישברו את
 * פריסת ה-grid בת שבע העמודות - הסמנטיקה נוספת בלי לשנות את המראה.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LayoutGroup } from 'framer-motion';
import type { DayInfo, Settings } from '@/types';
import { addDays, dateKey, orderedWeekdays } from '@/lib/dates';
import { useElementSize } from '@/hooks/useElementSize';
import type { CellMetrics } from '@/lib/cellLayout';
import type { MonthData } from '@/hooks/useMonthData';
import { DayCell } from './DayCell';

export function WeekdayHeader() {
  const names = orderedWeekdays();
  return (
    <div className="grid shrink-0 grid-cols-7 px-1.5 pb-2.5 lg:pb-3.5" role="row">
      {names.map((name, i) => (
        <span
          key={name}
          role="columnheader"
          className={`text-center text-tiny font-medium ${
            i === 6 ? 'text-brand-ink/70' : 'text-faint'
          }`}
        >
          {name}
        </span>
      ))}
    </div>
  );
}

/** טקסט מייצג למדידת רוחב תו: עברית רגילה, עם רווחים, כמו כותרת של אירוע */
const PROBE_TEXT = 'פגישה עם הצוות בבית הספר';

/** עד המדידה הראשונה: מידות של טלפון, בלי גובה - כלומר אירוע אחד בשורה אחת */
const FALLBACK: CellMetrics = {
  space: 0,
  textWidth: 0,
  firstLine: 18,
  extraLine: 13,
  row: 18,
  charWidth: 0,
};

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
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const probeRef = useRef<HTMLSpanElement>(null);
  const [metrics, setMetrics] = useState<CellMetrics>(FALLBACK);
  // הגופן ארוז אבל נטען אחרי הציור הראשון, ורוחב התו משתנה איתו
  const [fontsTick, setFontsTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => alive && setFontsTick((t) => t + 1));
    return () => {
      alive = false;
    };
  }, []);

  const weeks: Date[][] = [];
  for (let i = 0; i < data.gridDays.length; i += 7) {
    weeks.push(data.gridDays.slice(i, i + 7));
  }
  const rows = weeks.length;

  /*
    כמה מקום יש בתא, ובאיזה גופן.

    הטיפוגרפיה נוזלית, ולכן לא מנחשים מספרים אלא מודדים שורות דוגמה
    באותן מחלקות של התא: מספר היום, שורת אירוע ושורת מועד. נמדד
    ב-offset* ולא ב-getBoundingClientRect, כי הרשת נמצאת בתוך אנימציית
    החלקה ומלבן מושפע מהטרנספורם.
  */
  useLayoutEffect(() => {
    const grid = ref.current;
    const probe = probeRef.current;
    if (!grid || !probe || width <= 0 || height <= 0) return;
    const [num, chip, row] = Array.from(probe.children) as HTMLElement[];
    const style = getComputedStyle(grid);
    const colGap = parseFloat(style.columnGap) || 0;
    const rowGap = parseFloat(style.rowGap) || 0;
    const cellWidth = (width - colGap * 6) / 7;
    const rowHeight = (height - rowGap * (rows - 1)) / rows;
    const next: CellMetrics = {
      // ריפוד התא למעלה ולמטה (pt-1.5, pb-1) והמרווח מתחת למספר (mt-1)
      space: rowHeight - num.offsetHeight - 14,
      // ריפוד התא (px-1) וריפוד הבלוק (px-[3px])
      textWidth: cellWidth - 14,
      // ריפוד אנכי של הבלוק (py-px) והמרווח בין בלוקים
      firstLine: chip.offsetHeight + 5,
      extraLine: chip.offsetHeight,
      row: row.offsetHeight + 3,
      charWidth: chip.offsetWidth / PROBE_TEXT.length,
    };
    setMetrics((prev) =>
      (Object.keys(next) as (keyof CellMetrics)[]).every(
        (k) => Math.abs(prev[k] - next[k]) < 0.5,
      )
        ? prev
        : next,
    );
  }, [ref, width, height, rows, fontsTick]);

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
      else if (e.key === 'Home') target = addDays(currentDate, -currentDate.getDay());
      else if (e.key === 'End') target = addDays(currentDate, 6 - currentDate.getDay());
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
    [data.days, onNavigate, ref],
  );

  return (
    <div
      ref={ref}
      role="grid"
      aria-label="לוח החודש"
      aria-rowcount={rows}
      aria-colcount={7}
      onKeyDown={onKeyDown}
      className="relative mb-auto grid max-h-[760px] lg:max-h-none min-h-0 flex-1 grid-cols-7 gap-[2px] overflow-hidden px-1.5 lg:gap-1.5"
      style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      <span
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute start-0 top-0 flex flex-col items-start"
      >
        <span className="text-daynum leading-[1.6]">30</span>
        <span className="whitespace-nowrap text-micro font-medium leading-[1.15]">
          {PROBE_TEXT}
        </span>
        <span className="text-tiny leading-[1.2]">א</span>
      </span>
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
                  metrics={metrics}
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
