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
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Sheet } from './Sheet';
import {
  GREG_MONTHS_HE,
  addMonths,
  dateKey,
  isSameDay,
  keyToDate,
  monthGridDays,
  orderedWeekdays,
} from '@/lib/dates';
import { useDateMarkers } from '@/hooks/useDateMarkers';
import { ICON, STROKE, TAP } from '@/lib/motion';

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
      <ChevronLeft size={ICON.md} strokeWidth={STROKE} className="text-faint" />
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
      // הגלגלת גוללת בעצמה, ואסור שהגרירה שלה תסגור את החלונית
      onPointerDown={(e) => e.stopPropagation()}
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
          className={`flex w-full snap-center items-center justify-center transition-colors duration-150 ${
            i === index
              ? 'text-heading font-semibold text-ink'
              : 'text-title font-medium text-faint'
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
}: {
  children: React.ReactNode;
  ltr?: boolean;
}) {
  return (
    <div className="relative flex items-stretch gap-2" dir={ltr ? 'ltr' : undefined}>
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-2xl bg-brand-soft"
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

export function TimePickerSheet({
  open,
  onClose,
  title,
  subtitle,
  value,
  onChange,
  minuteStep = 5,
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
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="pb-4">
        {/* שעות משמאל, דקות מימין - 23:15 נקרא כמו בשעון */}
        <WheelFrame ltr>
          <WheelColumn items={HOURS} value={h} onChange={(next) => onChange(`${next}:${m}`)} />
          <span
            aria-hidden="true"
            className="pointer-events-none flex w-3 shrink-0 items-center justify-center text-heading font-bold text-muted"
          >
            :
          </span>
          <WheelColumn
            items={minuteItems}
            value={m}
            onChange={(next) => onChange(`${h}:${next}`)}
          />
        </WheelFrame>
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  value: T;
  options: PickerOption<T>[];
  onChange: (next: T) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="space-y-2 pb-4">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <motion.button
              key={String(o.value)}
              type="button"
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                onChange(o.value);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-right transition-colors ${
                active ? 'bg-brand-soft' : 'bg-well'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-body font-medium ${
                    active ? 'text-brand-ink' : 'text-ink'
                  }`}
                >
                  {o.label}
                </span>
                {o.hint && <span className="mt-0.5 block text-caption text-muted">{o.hint}</span>}
              </span>
              {active && (
                <Check size={ICON.lg} strokeWidth={2.6} className="shrink-0 text-brand" />
              )}
            </motion.button>
          );
        })}
      </div>
    </Sheet>
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
  const selected = keyToDate(value);
  const [month, setMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  // כשנפתח מחדש, חוזרים לחודש של הערך הנבחר
  useEffect(() => {
    if (open) setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const days = useMemo(() => monthGridDays(month), [month]);
  const markers = useDateMarkers(days);
  const today = new Date();
  const weekdays = orderedWeekdays();

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="pb-4">
        {/* ניווט חודשים */}
        <div className="mb-4 flex items-center justify-between">
          {/* ב-RTL הזמן זורם שמאלה: אחורה בימין, קדימה בשמאל */}
          <button
            type="button"
            aria-label="החודש הקודם"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-well text-muted active:bg-hairline"
          >
            <ChevronRight size={ICON.lg} strokeWidth={STROKE} />
          </button>
          <span className="text-title font-semibold text-ink">
            {GREG_MONTHS_HE[month.getMonth()]} {month.getFullYear()}
          </span>
          <button
            type="button"
            aria-label="החודש הבא"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-well text-muted active:bg-hairline"
          >
            <ChevronLeft size={ICON.lg} strokeWidth={STROKE} />
          </button>
        </div>

        <div className="mb-1.5 grid grid-cols-7">
          {weekdays.map((w) => (
            <span key={w} className="text-center text-caption font-medium text-faint">
              {w}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = dateKey(d);
            const inMonth = d.getMonth() === month.getMonth();
            const isSelected = key === value;
            const mark = markers.get(key);
            const hasHoliday = Boolean(mark?.holidays.length);
            const disabled = Boolean(min && key < min);
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(key);
                  onClose();
                }}
                aria-label={hasHoliday ? `${d.getDate()} · ${mark!.holidays[0]}` : undefined}
                className="focus-ring flex flex-col items-center gap-1 rounded-2xl py-1 disabled:opacity-30"
              >
                <span
                  className={`tnum flex h-11 w-11 items-center justify-center rounded-2xl text-label transition-colors ${
                    isSelected
                      ? 'bg-brand font-semibold text-white'
                      : !inMonth
                        ? 'text-faint/60'
                        : hasHoliday
                          ? 'bg-brand-soft font-semibold text-brand-ink'
                          : isSameDay(d, today)
                            ? 'font-semibold text-brand-ink ring-2 ring-inset ring-brand/35'
                            : d.getDay() === 6
                              ? 'font-medium text-brand-ink'
                              : 'text-ink'
                  }`}
                >
                  {d.getDate()}
                </span>

                {/* נקודות בצבעי האירועים של אותו יום */}
                <span className="flex h-1.5 items-center gap-[3px]">
                  {mark?.eventColors.map((c) => (
                    <span
                      key={c}
                      className={`ev ev-${c} ev-solid block h-1.5 w-1.5 rounded-full`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {/* רשימת המועדים של החודש, כדי שההדגשות לא יישארו מסתוריות */}
        {(() => {
          const list = days
            .filter((d) => d.getMonth() === month.getMonth())
            .map((d) => ({ d, mark: markers.get(dateKey(d)) }))
            .filter((x) => x.mark && x.mark.holidays.length > 0);
          if (!list.length) return null;
          return (
            <div className="mt-4 space-y-2 rounded-2xl bg-well px-4 py-3.5">
              {list.map(({ d, mark }) => (
                <div key={dateKey(d)} className="flex items-baseline gap-3">
                  <span className="tnum w-6 shrink-0 text-caption font-semibold text-brand-ink">
                    {d.getDate()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-caption text-muted">
                    {mark!.holidays.join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </Sheet>
  );
}
