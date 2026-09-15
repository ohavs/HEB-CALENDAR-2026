/**
 * שדות טופס - שפה אחת לכל האפליקציה.
 *
 * כל שדה הוא כרטיס מעוגל עם תווית קטנה מעליו והערך מתחתיה, באותו גובה,
 * אותו רדיוס ואותו מצב מיקוד. שדות שבוחרים בהם ערך (תאריך, שעה, אפשרות,
 * מספר) אינם משתמשים בפקד המובנה של הדפדפן אלא פותחים בורר משלנו, כדי
 * שהמראה וההתנהגות יהיו זהים בכל מערכת - וגם באפליקציית האנדרואיד בהמשך.
 */
import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import {
  DatePickerSheet,
  NumberPickerSheet,
  OptionPickerSheet,
  TimePickerSheet,
  type PickerOption,
} from './Picker';
import { GREG_MONTHS_HE } from '@/lib/dates';
import { ICON, STROKE, TAP } from '@/lib/motion';

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
      className={`block rounded-2xl bg-well px-4 py-3.5 transition-shadow focus-within:ring-2 focus-within:ring-brand/35 ${className}`}
    >
      {label && (
        <span className="mb-1.5 flex items-center gap-2 text-caption font-medium text-muted">
          {icon}
          {label}
        </span>
      )}
      {children}
      {hint && <span className="mt-1.5 block text-caption text-faint">{hint}</span>}
    </label>
  );
}

/* -------------------------- שדה שפותח בורר -------------------------- */

/** שורה שנראית כמו שדה, אבל פותחת גיליון בחירה במקום לקבל הקלדה. */

export function PickerField({
  label,
  display,
  icon,
  hint,
  onOpen,
  variant = 'card',
}: {
  label: string;
  display: string;
  icon?: ReactNode;
  hint?: ReactNode;
  onOpen: () => void;
  /**
   * 'card' - תווית מעל, ערך מתחת. קריא, ועולה כ-68px.
   * 'row'  - תווית וערך באותה שורה, כ-50px. לטופס עם הרבה שדות,
   *          שבו הגובה של הכרטיס המוערם דוחף את רובם אל מחוץ למסך.
   */
  variant?: 'card' | 'row';
}) {
  if (variant === 'row') {
    return (
      <motion.button
        type="button"
        onClick={onOpen}
        whileTap={{ scale: 0.99 }}
        transition={TAP}
        className="flex w-full items-center gap-3 rounded-2xl bg-well px-4 py-3 text-right transition-colors active:bg-hairline"
      >
        {icon && <span className="shrink-0 text-muted">{icon}</span>}
        <span className="shrink-0 text-label font-medium text-ink">{label}</span>
        <span className="min-w-0 flex-1 text-end">
          <span className="block truncate text-label font-semibold text-ink">{display}</span>
          {hint && (
            <span className="mt-0.5 block truncate text-caption leading-none text-faint">
              {hint}
            </span>
          )}
        </span>
        <ChevronLeft size={ICON.md} strokeWidth={STROKE} className="shrink-0 text-faint" />
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.99 }}
      transition={TAP}
      className="flex w-full items-center gap-3 rounded-2xl bg-well px-4 py-3.5 text-right transition-colors active:bg-hairline"
    >
      <span className="min-w-0 flex-1">
        <span className="mb-1.5 flex items-center gap-2 text-caption font-medium text-muted">
          {icon}
          {label}
        </span>
        <span className="block truncate text-body font-semibold text-ink">{display}</span>
        {hint && <span className="mt-1.5 block truncate text-caption text-faint">{hint}</span>}
      </span>
      <ChevronLeft size={ICON.lg} strokeWidth={STROKE} className="shrink-0 text-faint" />
    </motion.button>
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

/* ------------------------------ אפשרויות ------------------------------ */

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  icon,
  hint,
  variant,
}: {
  label: string;
  value: T;
  options: PickerOption<T>[];
  onChange: (next: T) => void;
  icon?: ReactNode;
  hint?: ReactNode;
  variant?: 'card' | 'row';
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <PickerField
        label={label}
        display={current?.label ?? '—'}
        icon={icon}
        hint={hint}
        variant={variant}
        onOpen={() => setOpen(true)}
      />
      <OptionPickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        value={value}
        options={options}
        onChange={onChange}
      />
    </>
  );
}

/* ------------------------------- תאריך ------------------------------- */

/** "18 בספטמבר 2026" */
export function formatDateHe(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!Number.isFinite(d)) return 'בחירת תאריך';
  return `${d} ב${GREG_MONTHS_HE[m - 1]} ${y}`;
}

export function DateField({
  label,
  value,
  onChange,
  icon,
  hint,
  min,
  variant,
}: {
  label: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (next: string) => void;
  icon?: ReactNode;
  hint?: ReactNode;
  /** התאריך המוקדם ביותר שאפשר לבחור */
  min?: string;
  variant?: 'card' | 'row';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PickerField
        label={label}
        display={formatDateHe(value)}
        icon={icon}
        hint={hint}
        variant={variant}
        onOpen={() => setOpen(true)}
      />
      <DatePickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        value={value}
        onChange={onChange}
        min={min}
      />
    </>
  );
}

/* -------------------------------- שעה -------------------------------- */

export function TimeField({
  label,
  value,
  onChange,
  icon,
  minuteStep = 5,
  variant,
}: {
  label: string;
  /** HH:mm */
  value: string;
  onChange: (next: string) => void;
  icon?: ReactNode;
  minuteStep?: number;
  variant?: 'card' | 'row';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PickerField
        label={label}
        display={value}
        icon={icon}
        variant={variant}
        onOpen={() => setOpen(true)}
      />
      <TimePickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        value={value}
        onChange={onChange}
        minuteStep={minuteStep}
      />
    </>
  );
}

/* ------------------------------- מספר ------------------------------- */

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  icon,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  icon?: ReactNode;
  hint?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PickerField
        label={label}
        display={suffix ? `${value} ${suffix}` : String(value)}
        icon={icon}
        hint={hint}
        onOpen={() => setOpen(true)}
      />
      <NumberPickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        subtitle={hint ? String(hint) : undefined}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
      />
    </>
  );
}
