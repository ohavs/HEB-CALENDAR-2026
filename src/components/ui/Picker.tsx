/**
 * מערכת הבוררים של האפליקציה.
 *
 * במקום פקדים מובנים של הדפדפן (select, input[type=date], input[type=time])
 * ובמקום כפתורי + ו- זעירים, כל בחירת ערך נפתחת באותה חלונית תחתונה:
 *
 *   WheelPicker      גלגלת גלילה למספרים ולשעות
 *   OptionPicker     רשימת אפשרויות עם סימון
 *   DatePicker       לוח חודשי לבחירת תאריך
 *
 * המפעיל תמיד אותו רכיב (ValueButton), כך שכל מקום באפליקציה שבו בוחרים
 * ערך נראה ומתנהג אותו דבר.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus } from './icons';
import { Sheet } from './Sheet';
import { CheckMark } from './controls';
import {
  GREG_MONTHS_HE,
  addMonths,
  dateKey,
  isSameDay,
  keyToDate,
  monthGridDays,
  monthKey,
  orderedWeekdays,
} from '@/lib/dates';
import { useDateMarkers } from '@/hooks/useDateMarkers';
import { usePageDirection } from '@/hooks/usePageDirection';
import { ENTER, ICON, SNAP, TAP } from '@/lib/motion';
import { haptic } from '@/lib/native';

/* ==========================================================================
   מפעיל - הכפתור שמציג את הערך הנוכחי ופותח את הבורר
   ========================================================================== */

export function ValueButton({
  value,
  onClick,
  tone = 'default',
  ariaLabel,
}: {
  value: string;
  onClick: () => void;
  /** 'strong' לערכים שהם עיקר השדה (שעה, תאריך) */
  tone?: 'default' | 'strong';
  ariaLabel?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.97 }}
      transition={TAP}
      className={`flex shrink-0 items-center gap-2 rounded-2xl bg-well px-4 transition-colors active:bg-hairline ${
        tone === 'strong'
          ? 'tnum py-3 text-title font-semibold text-ink'
          : 'py-2.5 text-label font-semibold text-brand-ink'
      }`}
    >
      {value}
      <ChevronLeft size={ICON.md} className="text-faint" />
    </motion.button>
  );
}

/* ==========================================================================
   גלגלת
   ========================================================================== */

const ITEM_H = 52;
const VISIBLE = 5;

function buzz() {
  try {
    navigator.vibrate?.(4);
  } catch {
    /* לא נתמך */
  }
}

function WheelColumn({
  items,
  value,
  onChange,
  suffix,
}: {
  items: string[];
  value: string;
  onChange: (next: string) => void;
  suffix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmatic = useRef(false);
  const index = Math.max(0, items.indexOf(value));

  // מיישרים את הגלגלת על הערך הנוכחי כשהוא משתנה מבחוץ
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = index * ITEM_H;
    if (Math.abs(el.scrollTop - target) < 2) return;
    programmatic.current = true;
    el.scrollTo({ top: target, behavior: 'auto' });
    requestAnimationFrame(() => {
      programmatic.current = false;
    });
  }, [index]);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el || programmatic.current) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    // scroll-snap עושה את היישור; אנחנו רק קוראים את הערך אחרי שנח
    settleTimer.current = setTimeout(() => {
      const next = items[Math.round(el.scrollTop / ITEM_H)];
      if (next !== undefined && next !== value) {
        buzz();
        onChange(next);
      }
    }, 90);
  }, [items, onChange, value]);

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      /*
        הגלגלת גוללת בעצמה, ואסור שהגרירה שלה תסגור את החלונית. עצירת
        pointerdown לבדה לא הספיקה: ההכרעה נעשית ב-touchmove של הפאנל,
        והיא ראתה משיכה למטה - כלומר גלילה אחורה - וסגרה. ראו `useSheetDrag`.
      */
      data-sheet-no-dismiss
      className="no-scrollbar relative h-[260px] flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain"
      style={{
        scrollPaddingBlock: ITEM_H * 2,
        maskImage:
          'linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)',
      }}
    >
      <div style={{ height: ITEM_H * ((VISIBLE - 1) / 2) }} />
      {items.map((item, i) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          /*
            ספרות ב-Heebo ולא ב-Karantina: שם 07 ו-08 נקראו כאותיות, ושעה
            צריכה להיקרא במבט. Karantina נשארת למילים.
          */
          className={`flex w-full snap-center items-center justify-center transition-colors duration-150 ${
            i === index ? 'text-display font-semibold text-ink' : 'text-title font-medium text-faint'
          }`}
          style={{ height: ITEM_H }}
        >
          <span className="tnum">{item}</span>
          {suffix && i === index && (
            <span className="ms-1.5 text-caption font-medium text-muted">{suffix}</span>
          )}
        </button>
      ))}
      <div style={{ height: ITEM_H * ((VISIBLE - 1) / 2) }} />
    </div>
  );
}

/**
 * מסגרת הגלגלת עם רצועת ההדגשה במרכז.
 * שעות מוצגות תמיד משמאל לימין (23:15), גם בממשק עברי, כמו בכל שעון.
 */
function WheelFrame({
  children,
  ltr = false,
  onWell = false,
}: {
  children: React.ReactNode;
  ltr?: boolean;
  /** יושב בתוך קופסה בגוון `well`, ולכן הרצועה צריכה גוון אחר */
  onWell?: boolean;
}) {
  return (
    <div className="relative flex items-stretch gap-2" dir={ltr ? 'ltr' : undefined}>
      <div
        className={`pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-field ${
          onWell ? 'bg-surface' : 'bg-well'
        }`}
        style={{ height: ITEM_H }}
      />
      {children}
    </div>
  );
}

/* ==========================================================================
   בורר מספרים
   ========================================================================== */

export function NumberPickerSheet({
  open,
  onClose,
  title,
  subtitle,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const items = useMemo(() => {
    const out: string[] = [];
    for (let v = min; v <= max + 1e-9; v += step) {
      out.push(String(Math.round(v * 100) / 100));
    }
    return out;
  }, [min, max, step]);

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="pb-4">
        <WheelFrame>
          <WheelColumn
            items={items}
            value={String(value)}
            onChange={(v) => onChange(Number(v))}
            suffix={suffix}
          />
        </WheelFrame>
      </div>
    </Sheet>
  );
}

/* ==========================================================================
   בורר שעה
   ========================================================================== */

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

/**
 * גלגל השעה עצמו, בלי חלונית - כדי שהטופס יוכל לפרוש אותו במקום.
 *
 * בטופס האירוע השעה נבחרת מתחת לאריחים ולא בגיליון נוסף: גיליון מעל
 * גיליון מסתיר בדיוק את מה שהשעה משנה - את הסיום ואת שורת הסיכום.
 */
export function TimeWheel({
  value,
  onChange,
  minuteStep = 1,
  onWell = false,
}: {
  /** HH:mm */
  value: string;
  onChange: (next: string) => void;
  minuteStep?: number;
  /** ראו `WheelFrame` */
  onWell?: boolean;
}) {
  const [h, m] = value.split(':');
  const minutes = useMemo(
    () =>
      Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) =>
        String(i * minuteStep).padStart(2, '0'),
      ),
    [minuteStep],
  );
  // אם השעה שנשמרה אינה על הרשת, מוסיפים אותה כדי לא לאבד אותה
  const minuteItems = minutes.includes(m)
    ? minutes
    : [...minutes, m].sort((a, b) => Number(a) - Number(b));

  return (
    /* שעות משמאל, דקות מימין - 23:15 נקרא כמו בשעון */
    <WheelFrame ltr onWell={onWell}>
      <WheelColumn items={HOURS} value={h} onChange={(next) => onChange(`${next}:${m}`)} />
      <span
        aria-hidden="true"
        /* relative: הרצועה ממוקמת absolute, ובלי זה היא נצבעת מעל הנקודתיים */
        className="pointer-events-none relative flex w-3 shrink-0 items-center justify-center text-display font-bold text-muted"
      >
        :
      </span>
      <WheelColumn items={minuteItems} value={m} onChange={(next) => onChange(`${h}:${next}`)} />
    </WheelFrame>
  );
}

export function TimePickerSheet({
  open,
  onClose,
  title,
  subtitle,
  value,
  onChange,
  minuteStep = 1,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** HH:mm */
  value: string;
  onChange: (next: string) => void;
  minuteStep?: number;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="pb-4">
        <TimeWheel value={value} onChange={onChange} minuteStep={minuteStep} />
      </div>
    </Sheet>
  );
}

/* ==========================================================================
   בורר אפשרויות
   ========================================================================== */

export type PickerOption<T extends string | number> = {
  value: T;
  label: string;
  hint?: string;
};

export function OptionPickerSheet<T extends string | number>({
  open,
  onClose,
  title,
  subtitle,
  value,
  options,
  onChange,
  create,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  value: T;
  options: PickerOption<T>[];
  onChange: (next: T) => void;
  /**
   * הוספה של אפשרות חדשה מתוך הבורר עצמו - קטגוריה, למשל.
   *
   * מי שפתח את הבורר ולא מצא את מה שחיפש היה צריך לסגור את הטופס, לחפש
   * את מסך הניהול, להוסיף, ולחזור למלא מההתחלה. `onCreate` מחזיר את הערך
   * של מה שנוצר, והוא נבחר מיד; `null` כשלא נוצר (תקרה, שם ריק).
   */
  create?: { placeholder: string; onCreate: (name: string) => T | null };
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle}>
      {/*
        עד שמונה אפשרויות קצרות - אריחים בשתי עמודות, שנבחרים במבט אחד.
        עם הסבר לכל אפשרות, או רשימה ארוכה, צריך שורה ברוחב מלא.
      */}
      <div
        className={`pb-4 ${
          options.length <= 8 && options.every((o) => !o.hint && o.label.length <= 16)
            ? 'grid grid-cols-2 gap-2'
            : 'space-y-2'
        }`}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <motion.button
              key={String(o.value)}
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={TAP}
              aria-pressed={active}
              onClick={() => {
                void haptic('light');
                onChange(o.value);
                onClose();
              }}
              className={`focus-ring flex min-h-[56px] w-full items-center gap-3 rounded-field px-4 py-3 text-right transition-colors ${
                active ? 'bg-inverse text-on-inverse' : 'bg-well text-ink active:bg-hairline'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className={`block text-body ${active ? 'font-semibold' : 'font-medium'}`}>
                  {o.label}
                </span>
                {o.hint && (
                  <span className={`mt-0.5 block text-caption ${active ? 'opacity-75' : 'text-muted'}`}>
                    {o.hint}
                  </span>
                )}
              </span>
              {active && <CheckMark size={ICON.md} className="shrink-0" />}
            </motion.button>
          );
        })}
        {create && (
          <CreateOptionRow
            placeholder={create.placeholder}
            onCreate={(name) => {
              const next = create.onCreate(name);
              if (next === null) return false;
              onChange(next);
              onClose();
              return true;
            }}
          />
        )}
      </div>
    </Sheet>
  );
}

/** שורת "חדש" בתחתית בורר אפשרויות: שדה וכפתור, בלי מסך נוסף */
function CreateOptionRow({
  placeholder,
  onCreate,
}: {
  placeholder: string;
  /** מחזיר אם נוצר, כדי שהשדה יתרוקן רק אז */
  onCreate: (name: string) => boolean;
}) {
  const [name, setName] = useState('');
  const submit = () => {
    const clean = name.trim();
    if (!clean) return;
    if (onCreate(clean)) {
      setName('');
      void haptic('medium');
    }
  };
  return (
    <div className="col-span-2 flex items-center gap-2 pt-1">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field-reset field-shell min-w-0 flex-1 rounded-field bg-well px-4 py-4 text-body text-ink placeholder:text-faint"
      />
      <motion.button
        type="button"
        onClick={submit}
        disabled={!name.trim()}
        whileTap={{ scale: 0.92 }}
        transition={TAP}
        aria-label={placeholder}
        className="focus-ring flex h-14 w-14 shrink-0 items-center justify-center rounded-field bg-inverse text-on-inverse disabled:opacity-40"
      >
        <Plus size={ICON.md} weight="bold" />
      </motion.button>
    </div>
  );
}

/* ==========================================================================
   בורר תאריך
   ========================================================================== */

export function DatePickerSheet({
  open,
  onClose,
  title,
  value,
  onChange,
  min,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (next: string) => void;
  /** התאריך המוקדם ביותר שאפשר לבחור (YYYY-MM-DD) */
  min?: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="pb-4">
        <MonthCalendar
          value={value}
          min={min}
          onChange={(key) => {
            onChange(key);
            onClose();
          }}
        />
      </div>
    </Sheet>
  );
}

/**
 * חודש מלא לבחירת יום - בגיליון, או פרוש בתוך הטופס מתחת לרצועת הימים.
 *
 * החודש המוצג נגזר מהערך בכל פעם שהוא משתנה מבחוץ, כך שבחירה ברצועה
 * מזיזה גם את החודש הפרוש.
 */
export function MonthCalendar({
  value,
  onChange,
  min,
  range,
  onWell = false,
  picked,
}: {
  /** YYYY-MM-DD */
  value: string;
  onChange: (next: string) => void;
  /** התאריך המוקדם ביותר שאפשר לבחור (YYYY-MM-DD) */
  min?: string;
  /** פרישה של אירוע רב־יומי, לסימון הימים שבתוכה */
  range?: { from: string; to: string };
  /** פרוש בתוך קופסה בגוון `well` - הכפתורים והמועדים מקבלים גוון אחר */
  onWell?: boolean;
  /**
   * בחירה מרובה: הימים שנבחרו. `value` נשאר רק העוגן של החודש המוצג,
   * ו-`onChange` מקבל כל הקשה - הקורא מוסיף או מסיר.
   */
  picked?: ReadonlySet<string>;
}) {
  const raised = onWell ? 'bg-surface' : 'bg-well';
  const selected = keyToDate(value);
  const [month, setMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  useEffect(() => {
    setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const days = useMemo(() => monthGridDays(month), [month]);
  const markers = useDateMarkers(days);
  const direction = usePageDirection(monthKey(month));
  const today = new Date();
  const weekdays = orderedWeekdays();

  const holidayList = days
    .filter((d) => d.getMonth() === month.getMonth())
    .map((d) => ({ d, mark: markers.get(dateKey(d)) }))
    .filter((x) => x.mark && x.mark.holidays.length > 0);

  return (
    <div>
      {/* ניווט חודשים */}
      <div className="mb-4 flex items-center justify-between">
        {/* ב-RTL הזמן זורם שמאלה: אחורה בימין, קדימה בשמאל */}
        <button
          type="button"
          aria-label="החודש הקודם"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className={`focus-ring flex h-11 w-11 items-center justify-center rounded-tile text-muted active:bg-hairline ${raised}`}
        >
          <ChevronRight size={ICON.lg} />
        </button>
        <span className="text-title font-semibold text-ink" aria-live="polite">
          {GREG_MONTHS_HE[month.getMonth()]} {month.getFullYear()}
        </span>
        <button
          type="button"
          aria-label="החודש הבא"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className={`focus-ring flex h-11 w-11 items-center justify-center rounded-tile text-muted active:bg-hairline ${raised}`}
        >
          <ChevronLeft size={ICON.lg} />
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7">
        {weekdays.map((w) => (
          <span key={w} className="text-center text-caption font-medium text-faint">
            {w}
          </span>
        ))}
      </div>

      {/*
        החודש הבא נכנס משמאל, מהצד של "הבא" - הכיוון נגזר מהמפתח ולא
        מהכפתור (`usePageDirection`), כמו בלוח עצמו.
      */}
      <motion.div
        key={monthKey(month)}
        initial={direction === 0 ? false : { opacity: 0, x: direction > 0 ? -28 : 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ x: SNAP, opacity: ENTER }}
        className="grid grid-cols-7 gap-1"
      >
        {days.map((d) => {
          const key = dateKey(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isSelected = picked ? picked.has(key) : key === value;
          const inRange = Boolean(range && key >= range.from && key <= range.to);
          const mark = markers.get(key);
          const hasHoliday = Boolean(mark?.holidays.length);
          const disabled = Boolean(min && key < min);
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(key)}
              aria-pressed={isSelected}
              aria-label={hasHoliday ? `${d.getDate()} · ${mark!.holidays[0]}` : undefined}
              className="focus-ring flex flex-col items-center gap-1 rounded-tile py-1 disabled:opacity-30"
            >
              <span
                className={`tnum flex h-11 w-11 items-center justify-center rounded-tile text-label transition-colors ${
                  isSelected
                    ? 'bg-inverse font-semibold text-on-inverse'
                    : !inMonth
                      ? 'text-faint/60'
                      : inRange
                        ? 'bg-ink/10 font-semibold text-ink'
                        : hasHoliday
                          ? `${raised} font-semibold text-ink`
                          : isSameDay(d, today)
                            ? 'font-semibold text-ink ring-2 ring-inset ring-ink/35'
                            : 'text-ink'
                }`}
              >
                {d.getDate()}
              </span>

              {/* נקודות בצבעי האירועים של אותו יום */}
              <span className="flex h-1.5 items-center gap-[3px]">
                {mark?.eventColors.map((c) => (
                  <span key={c} className={`ev ev-${c} ev-solid block h-1.5 w-1.5 rounded-full`} />
                ))}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* רשימת המועדים של החודש, כדי שההדגשות לא יישארו מסתוריות */}
      {holidayList.length > 0 && (
        <div className={`mt-4 space-y-2 rounded-field px-4 py-3.5 ${raised}`}>
          {holidayList.map(({ d, mark }) => (
            <div key={dateKey(d)} className="flex items-baseline gap-3">
              <span className="tnum w-6 shrink-0 text-caption font-semibold text-ink">
                {d.getDate()}
              </span>
              <span className="min-w-0 flex-1 truncate text-caption text-muted">
                {mark!.holidays.join(' · ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
