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
      className={`field-shell block rounded-2xl bg-well px-4 py-3.5 ${className}`}
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

/* ------------------------------ קבוצות ------------------------------ */

/**
 * 'card'    - תווית מעל, ערך מתחת. קריא, ועולה כ-68px.
 * 'row'     - תווית וערך באותה שורה, בקופסה משלה, כ-50px.
 * 'grouped' - אותה שורה בלי קופסה, בתוך `FieldGroup`.
 */
export type FieldVariant = 'card' | 'row' | 'grouped';

/**
 * כמה שורות שעונות על שאלה אחת - "מתי", "איפה" - בקופסה אחת עם קווים
 * דקים ביניהן.
 *
 * טופס שבו כל שדה הוא קופסה משלו נקרא כמו רשימה של עשרה דברים שווים,
 * והרווחים ביניהן לבד אכלו מסך שלם. הקבוצה אומרת מה שייך למה, וחוסכת
 * את הרווחים בלי להקטין אף שורה.
 */
export function FieldGroup({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">{children}</div>
  );
}

/**
 * התחלה וסיום בשורה אחת: "09:00 – 10:00".
 *
 * שתי שורות נפרדות אמרו פעמיים "שעה", וכל אחת לקחה גובה של שורה מלאה
 * בשביל חמישה תווים. כאן שני הערכים נלחצים כל אחד לבד.
 */
export function TimeRangeRow({
  icon,
  label,
  start,
  end,
  onStart,
  onEnd,
  disabled = false,
}: {
  icon?: ReactNode;
  label: string;
  start: string;
  end: string;
  onStart: (next: string) => void;
  onEnd: (next: string) => void;
  /** "כל היום": השעות נשארות על המסך, מעומעמות, כרמז שהן קיימות */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<'start' | 'end' | null>(null);
  const value = (which: 'start' | 'end', text: string, aria: string) => (
    <button
      type="button"
      onClick={() => setOpen(which)}
      aria-label={`${aria} ${text}`}
      className="tnum focus-ring rounded-lg px-2 py-1 text-label font-semibold text-ink active:bg-hairline"
    >
      {text}
    </button>
  );
  return (
    <>
      <div
        className={`flex items-center gap-3 px-4 py-2 transition-opacity ${
          disabled ? 'pointer-events-none opacity-40' : ''
        }`}
        aria-hidden={disabled}
      >
        {icon && <span className="shrink-0 text-muted">{icon}</span>}
        <span className="flex-1 text-label font-medium text-ink">{label}</span>
        <span className="flex items-center gap-0.5">
          {value('start', start, 'התחלה')}
          <span className="text-faint">–</span>
          {value('end', end, 'סיום')}
        </span>
      </div>
      <TimePickerSheet
        open={open === 'start'}
        onClose={() => setOpen(null)}
        title="התחלה"
        value={start}
        onChange={onStart}
        minuteStep={5}
      />
      <TimePickerSheet
        open={open === 'end'}
        onClose={() => setOpen(null)}
        title="סיום"
        value={end}
        onChange={onEnd}
        minuteStep={5}
      />
    </>
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
  /** ראו `FieldVariant` */
  variant?: FieldVariant;
}) {
  if (variant === 'row' || variant === 'grouped') {
    return (
      <motion.button
        type="button"
        onClick={onOpen}
        whileTap={variant === 'row' ? { scale: 0.99 } : undefined}
        transition={TAP}
        className={`flex w-full items-center gap-3 px-4 py-3 text-right transition-colors active:bg-hairline ${
          variant === 'row' ? 'rounded-2xl bg-well' : ''
        }`}
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
  variant?: FieldVariant;
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
  variant?: FieldVariant;
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
  variant?: FieldVariant;
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
