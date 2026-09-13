/**
 * שדות טופס - שפה אחת לכל האפליקציה.
 *
 * כל שדה הוא "באר" מעוגלת עם תווית קטנה מעליו והפקד מתחתיה, באותו גובה,
 * אותו רדיוס ואותו מצב מיקוד. העיצוב המובנה של הדפדפן מבוטל (.field-reset)
 * כדי שתפריט נפתח, שדה תאריך ושדה טקסט ייראו זהים בכל דפדפן ובכל מערכת.
 */
import { CalendarDays, ChevronDown } from 'lucide-react';
import { GREG_MONTHS_HE } from '@/lib/dates';
import type { ReactNode } from 'react';

/* ------------------------------ מעטפת שדה ------------------------------ */

export function Field({
  label,
  hint,
  children,
  icon,
  className = '',
}: {
  label?: string;
  hint?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`block rounded-2xl bg-well px-4 py-3 transition-shadow focus-within:ring-2 focus-within:ring-brand/35 ${className}`}
    >
      {label && (
        <span className="mb-1.5 flex items-center gap-1.5 text-caption font-medium text-muted">
          {icon}
          {label}
        </span>
      )}
      {children}
      {hint && <span className="mt-1 block text-caption text-faint">{hint}</span>}
    </label>
  );
}

/* -------------------------------- טקסט -------------------------------- */

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  hint,
  size = 'md',
  autoFocus,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  hint?: ReactNode;
  /** 'lg' לכותרת האירוע, 'md' לשאר */
  size?: 'md' | 'lg';
  autoFocus?: boolean;
}) {
  return (
    <Field label={label} icon={icon} hint={hint}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        className={`field-reset bg-transparent p-0 text-ink placeholder:text-faint ${
          size === 'lg' ? 'text-heading font-semibold' : 'text-body'
        }`}
      />
    </Field>
  );
}

/* ------------------------------- טקסט ארוך ------------------------------- */

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  icon,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  icon?: ReactNode;
}) {
  return (
    <Field label={label} icon={icon}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="field-reset resize-none bg-transparent p-0 text-body leading-relaxed text-ink placeholder:text-faint"
      />
    </Field>
  );
}

/* ------------------------------ תפריט נפתח ------------------------------ */

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
};

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  icon,
  hint,
  compact = false,
}: {
  label?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (next: T) => void;
  icon?: ReactNode;
  hint?: ReactNode;
  /** גרסה צרה לשורת הגדרה, בלי תווית מעל */
  compact?: boolean;
}) {
  const isNumeric = typeof value === 'number';

  const select = (
    <span className="relative flex items-center">
      <select
        value={String(value)}
        onChange={(e) =>
          onChange((isNumeric ? Number(e.target.value) : e.target.value) as T)
        }
        className={`field-reset cursor-pointer bg-transparent pe-7 ps-0 text-ink ${
          compact ? 'text-label font-medium' : 'text-body'
        }`}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={2.4}
        aria-hidden="true"
        className="pointer-events-none absolute start-0 text-faint"
      />
    </span>
  );

  if (compact) {
    return (
      <span className="inline-flex items-center rounded-full bg-well px-3.5 py-2 transition-shadow focus-within:ring-2 focus-within:ring-brand/35">
        {select}
      </span>
    );
  }

  return (
    <Field label={label} icon={icon} hint={hint}>
      {select}
    </Field>
  );
}

/* ------------------------------- תאריך ------------------------------- */

export function DateField({
  label,
  value,
  onChange,
  icon,
  hint,
}: {
  label?: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (next: string) => void;
  icon?: ReactNode;
  hint?: ReactNode;
}) {
  // הבוחר המובנה של הדפדפן מציג תאריך בפורמט המקומי שלו (למשל 09/18/2026),
  // ולכן מציגים כיתוב עברי משלנו ומניחים מעליו input שקוף שפותח את הבוחר.
  const [y, m, d] = value.split('-').map(Number);
  const display = Number.isFinite(d)
    ? `${d} ב${GREG_MONTHS_HE[m - 1]} ${y}`
    : 'בחירת תאריך';

  return (
    <Field label={label} icon={icon} hint={hint}>
      <span className="relative flex items-center justify-between gap-2">
        <span className="text-body font-semibold text-ink">{display}</span>
        <CalendarDays size={18} strokeWidth={2.2} aria-hidden="true" className="text-faint" />
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label={label ?? 'תאריך'}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
    </Field>
  );
}

/* ------------------------------- מספרון ------------------------------- */

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  suffix,
  icon,
  hint,
}: {
  label?: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  icon?: ReactNode;
  hint?: ReactNode;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  return (
    <Field label={label} icon={icon} hint={hint}>
      <span className="flex items-center justify-between gap-3">
        <span className="tnum text-title font-semibold text-ink">
          {value}
          {suffix ? <span className="ms-1 text-caption font-medium text-muted">{suffix}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <StepButton label="הפחתה" onClick={() => onChange(clamp(value - step))}>
            −
          </StepButton>
          <StepButton label="הוספה" onClick={() => onChange(clamp(value + step))}>
            +
          </StepButton>
        </span>
      </span>
    </Field>
  );
}

function StepButton({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-title font-medium leading-none text-muted shadow-chip transition-colors active:bg-hairline lg:h-10 lg:w-10"
    >
      {children}
    </button>
  );
}
