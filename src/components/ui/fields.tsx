/**
 * שדות טופס - שפה אחת לכל האפליקציה.
 *
 * כל שדה הוא כרטיס מעוגל עם תווית קטנה מעליו והערך מתחתיה, באותו גובה,
 * אותו רדיוס ואותו מצב מיקוד. שדות שבוחרים בהם ערך (תאריך, שעה, אפשרות,
 * מספר) אינם משתמשים בפקד המובנה של הדפדפן אלא פותחים בורר משלנו, כדי
 * שהמראה וההתנהגות יהיו זהים בכל מערכת - וגם באפליקציית האנדרואיד בהמשך.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from './icons';
import {
  NumberPickerSheet,
  OptionPickerSheet,
  TimePickerSheet,
  type PickerOption,
} from './Picker';
import { ICON, TAP } from '@/lib/motion';

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
      className={`field-shell block rounded-field bg-well px-4 py-3.5 ${className}`}
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
 * האייקון של שורה, בגודל אחד (ICON.lg) - גם כשהקורא העביר אייקון קטן
 * יותר. שורות של 56 עם אייקונים בשלושה גדלים נראו כמו שלושה טפסים.
 */
function RowIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex w-6 shrink-0 items-center justify-center text-muted [&_svg]:h-5 [&_svg]:w-5">
      {children}
    </span>
  );
}

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
    <div className="divide-y divide-hairline overflow-hidden rounded-group bg-well">{children}</div>
  );
}

/**
 * כותרת של טופס - שדה גדול בלי מסגרת.
 *
 * זה השדה היחיד שחובה למלא, ולכן הוא הטקסט הגדול בטופס ולא עוד קופסה
 * בין קופסאות. הקופסה מופיעה רק בפוקוס (`focus-within`), כדי שיהיה ברור
 * איפה מקלידים - ו-`field-shell` מצייר את טבעת המיקוד על הצורה המעוגלת
 * ולא מלבן סביב הטקסט.
 */
export function TitleField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** שם לקורא מסך */
  label: string;
}) {
  return (
    /*
      הגודל והמשקל על המעטפת ולא על השדה: `.field-reset` קובע
      `font: inherit` וגובר על מחלקות באותו אלמנט, ולכן שדה שנשא
      `text-heading` עצמו יצא בגודל של גוף הטקסט.
    */
    <div className="field-shell rounded-field px-4 text-heading font-bold transition-colors focus-within:bg-well">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={label}
        className="field-reset w-full bg-transparent py-3 text-ink placeholder:font-semibold placeholder:text-faint"
      />
    </div>
  );
}

/**
 * הערות כשורה בתוך `FieldGroup`, עם אייקון כמו שאר השורות.
 *
 * שורה אחת שגדלה עם הטקסט: רוב האירועים בלי הערות, ושתי שורות ריקות
 * קבועות עלו כמו שורה נוספת בטופס בשביל שדה שלא ממלאים.
 *
 * טבעת המיקוד פנימית (`inset`): הקבוצה חותכת את מה שחורג ממנה, וטבעת
 * חיצונית הייתה נקטעת בפינה המעוגלת של השורה האחרונה.
 */
export function TextAreaRow({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // הגובה לפי התוכן. קודם מאפסים, אחרת שדה שהתקצר נשאר בגובה הקודם.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <label className="field-shell flex min-h-[56px] items-start gap-3.5 px-4 py-3.5 text-body leading-relaxed focus-within:!shadow-[inset_0_0_0_2px_rgb(var(--c-ink)/0.3)]">
      <span className="pt-0.5">
        <RowIcon>{icon}</RowIcon>
      </span>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={1}
        aria-label={label}
        className="field-reset block min-w-0 flex-1 resize-none overflow-hidden bg-transparent p-0 text-ink placeholder:text-faint"
      />
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
        className={`flex min-h-[56px] w-full items-center gap-3.5 px-4 py-2.5 text-right transition-colors active:bg-hairline ${
          variant === 'row' ? 'rounded-field bg-well' : ''
        }`}
      >
        {icon && <RowIcon>{icon}</RowIcon>}
        <span className="shrink-0 text-body font-medium text-ink">{label}</span>
        <span className="min-w-0 flex-1 text-end">
          <span className="block truncate text-body font-semibold text-ink">{display}</span>
          {hint && (
            <span className="mt-0.5 block truncate text-caption leading-none text-faint">
              {hint}
            </span>
          )}
        </span>
        <ChevronLeft size={ICON.md} className="shrink-0 text-faint" />
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.99 }}
      transition={TAP}
      className="flex w-full items-center gap-3 rounded-field bg-well px-4 py-3.5 text-right transition-colors active:bg-hairline"
    >
      <span className="min-w-0 flex-1">
        <span className="mb-1.5 flex items-center gap-2 text-caption font-medium text-muted">
          {icon}
          {label}
        </span>
        <span className="block truncate text-body font-semibold text-ink">{display}</span>
        {hint && <span className="mt-1.5 block truncate text-caption text-faint">{hint}</span>}
      </span>
      <ChevronLeft size={ICON.lg} className="shrink-0 text-faint" />
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
  create,
}: {
  label: string;
  value: T;
  options: PickerOption<T>[];
  onChange: (next: T) => void;
  icon?: ReactNode;
  hint?: ReactNode;
  variant?: FieldVariant;
  /** ראו `create` ב-`OptionPickerSheet` */
  create?: { placeholder: string; onCreate: (name: string) => T | null };
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
        create={create}
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
  minuteStep = 1,
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
