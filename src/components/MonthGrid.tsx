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
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type ValueAnimationTransition,
} from 'framer-motion';
import type { DayInfo, Settings } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { addDays, dateKey, orderedWeekdays } from '@/lib/dates';
import { useElementSize } from '@/hooks/useElementSize';
import type { CellMetrics } from '@/lib/cellLayout';
import type { MonthData } from '@/hooks/useMonthData';
import { DayCell } from './DayCell';
import { SNAP } from '@/lib/motion';

export function WeekdayHeader() {
  const names = orderedWeekdays();
  return (
    <div className="grid shrink-0 grid-cols-7 px-1.5 pb-2.5 lg:pb-3.5" role="row">
      {names.map((name, i) => (
        <span
          key={name}
          role="columnheader"
          className={`text-center text-tiny font-medium ${
            i === 6 ? 'text-muted' : 'text-faint'
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

/** יום בלי אירועים. מערך אחד לכולם, כדי ש-`memo` של התא יחזיק. */
const NO_OCCURRENCES: Occurrence[] = [];

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
}: {
  data: MonthData;
  settings: Settings;
  selectedKey: string;
  onSelectDay: (day: DayInfo) => void;
  /** ניווט מקלדת אל תאריך שאינו בהכרח ברשת הנוכחית */
  onNavigate: (date: Date) => void;
}) {
  const { ref, width, height } = useElementSize<HTMLDivElement>();

  /*
    הקשה מציירת מחדש שני תאים, לא את כל הרשת.

    `onSelectDay` נבנה מחדש בכל בחירה, כי הוא תלוי ביום הנבחר ובמצב
    החלונית - וכשהוא עבר כמות שהיא, `memo` של התא נשבר בכל הקשה וכל
    שלושים וחמישה התאים חישבו מחדש את התכנית שלהם (`planCell`) בדיוק
    בפריים שבו החלונית מתחילה לעלות. התא מקבל פונקציה יציבה, והיא קוראת
    לגרסה העדכנית.
  */
  const onSelectRef = useRef(onSelectDay);
  onSelectRef.current = onSelectDay;
  const selectDay = useCallback((day: DayInfo) => onSelectRef.current(day), []);
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
                  occurrences={data.occurrences.get(key) ?? NO_OCCURRENCES}
                  selected={key === selectedKey}
                  settings={settings}
                  metrics={metrics}
                  onSelect={selectDay}
                  focusable={key === selectedKey}
                />
              );
            })}
          </div>
        ))}
      <SelectionRing
        gridRef={ref}
        selectedKey={selectedKey}
        layoutKey={`${width}x${height}:${fontsTick}`}
      />
    </div>
  );
}

/** גודל הטבעת ביחס לגופן של מספר היום - כמו העיגול של "היום" בתא */
const RING_EM = 1.75;

/**
 * טבעת הבחירה: אחת לכל הרשת, ולא אחת בכל תא.

 * היא הייתה `layoutId` שעבר בין התאים, ואנימציית פריסה משותפת של framer
 * אינה נשארת בגבולות שלה: כל עוד היא קיימת, כל commit בכל מקום
 * באפליקציה מודד מחדש את הפריסה (קריאת `scrollLeft` על השורש) - גם
 * בכניסה למסך התזכורות, כשהלוח רק דוהה החוצה. זה היה כמעט חצי מזמן
 * החלפת הלשונית. עכשיו היא נמדדת אל המספר של התא הנבחר
 * (`data-day-num`) ונוסעת ב-`x`/`y` - רק טרנספורם, והיא גם כבר לא
 * נחתכת בקצה התא בדרך.
 *
 * המדידה ב-getBoundingClientRect ולא בשרשרת offset*: אלה מעוגלים
 * לפיקסלים שלמים, ושלוש רמות של עיגול הזיזו את הטבעת מהמרכז. הרשת יושבת
 * בתוך טרנספורמים (החלקת חודש, כניסת מסך), ולכן ההפרש מחולק בקנה המידה.
 */
function SelectionRing({
  gridRef,
  selectedKey,
  layoutKey,
}: {
  gridRef: React.RefObject<HTMLDivElement>;
  selectedKey: string;
  /** משתנה כשהרשת משנה גודל או גופן - אז הטבעת קופצת למקומה בלי לנסוע */
  layoutKey: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [size, setSize] = useState(0);
  const placedFor = useRef<string | null>(null);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const num = grid?.querySelector<HTMLElement>(
      `[data-day-key="${selectedKey}"] [data-day-num]`,
    );
    if (!grid || !num || grid.offsetWidth === 0) {
      placedFor.current = null;
      setSize(0);
      return;
    }
    const gridRect = grid.getBoundingClientRect();
    const numRect = num.getBoundingClientRect();
    const scale = gridRect.width / grid.offsetWidth || 1;
    const diameter = parseFloat(getComputedStyle(num).fontSize) * RING_EM;
    const nextX = (numRect.left - gridRect.left + numRect.width / 2) / scale - diameter / 2;
    const nextY = (numRect.top - gridRect.top + numRect.height / 2) / scale - diameter / 2;
    setSize(diameter);

    // הצבה ראשונה, או רשת שהשתנתה מתחתיה: אין מאיפה לנסוע
    if (placedFor.current !== layoutKey || reduceMotion) {
      placedFor.current = layoutKey;
      x.set(nextX);
      y.set(nextY);
      return;
    }
    const ax = animate(x, nextX, SNAP as ValueAnimationTransition<number>);
    const ay = animate(y, nextY, SNAP as ValueAnimationTransition<number>);
    return () => {
      ax.stop();
      ay.stop();
    };
  }, [gridRef, selectedKey, layoutKey, reduceMotion, x, y]);

  if (size === 0) return null;
  return (
    <motion.span
      aria-hidden="true"
      // left ולא start: המדידה פיזית (מ-getBoundingClientRect), גם ב-RTL
      className="pointer-events-none absolute left-0 top-0 rounded-full border-[1.5px] border-ink"
      style={{ x, y, width: size, height: size }}
    />
  );
}
