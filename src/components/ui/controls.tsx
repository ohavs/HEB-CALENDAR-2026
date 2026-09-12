/** רכיבי בקרה קטנים ואחידים לכל האפליקציה. */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/* ---------------------------------- מתג ---------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-brand' : 'bg-hairline'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      {/* בממשק מימין-לשמאל הידית נעה שמאלה כשהמתג נדלק */}
      <motion.span
        className="absolute top-[3px] block h-6 w-6 rounded-full bg-white shadow-chip"
        animate={{ right: checked ? 25 : 3 }}
        transition={{ type: 'spring', stiffness: 700, damping: 34 }}
      />
    </button>
  );
}

/* ------------------------------ שורת הגדרה ------------------------------ */

export function SettingRow({
  title,
  hint,
  children,
  onClick,
  icon,
}: {
  title: string;
  hint?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
}) {
  const Wrapper = onClick ? motion.button : motion.div;
  return (
    <Wrapper
      {...(onClick
        ? { type: 'button' as const, onClick, whileTap: { scale: 0.985 } }
        : {})}
      className="flex w-full items-center gap-3 px-4 py-3 text-right"
    >
      {icon && <span className="shrink-0 text-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-snug text-ink">{title}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{hint}</span>}
      </span>
      {children && <span className="shrink-0">{children}</span>}
    </Wrapper>
  );
}

export function SettingsGroup({
  title,
  children,
  footer,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="mb-5">
      {title && (
        <h3 className="mb-2 px-4 text-[12.5px] font-semibold uppercase tracking-wide text-faint">
          {title}
        </h3>
      )}
      <div className="divide-y divide-hairline overflow-hidden rounded-3xl bg-surface shadow-soft">
        {children}
      </div>
      {footer && <p className="mt-2 px-4 text-[12.5px] leading-relaxed text-muted">{footer}</p>}
    </section>
  );
}

/* ------------------------------ בחירה מפולחת ------------------------------ */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (next: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      className={`relative flex gap-1 rounded-full bg-well p-1 ${
        size === 'sm' ? 'text-[12.5px]' : 'text-[13.5px]'
      }`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative flex-1 whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition-colors ${
              active ? 'text-white' : 'text-muted'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map((o) => o.value).join('-')}`}
                className="absolute inset-0 rounded-full bg-brand"
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
              />
            )}
            <span className="relative flex items-center justify-center gap-1.5">
              {opt.icon}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------- מספרון -------------------------------- */

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 120,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex items-center gap-1 rounded-full bg-well p-1">
      <button
        type="button"
        aria-label="הפחתה"
        onClick={() => onChange(clamp(value - step))}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[17px] font-medium leading-none text-muted transition-colors active:bg-hairline"
      >
        −
      </button>
      <span className="tnum min-w-[52px] text-center text-[13.5px] font-semibold text-ink">
        {value}
        {suffix ? ` ${suffix}` : ''}
      </span>
      <button
        type="button"
        aria-label="הוספה"
        onClick={() => onChange(clamp(value + step))}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[17px] font-medium leading-none text-muted transition-colors active:bg-hairline"
      >
        +
      </button>
    </div>
  );
}

/* ------------------------------ כפתור ראשי ------------------------------ */

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
  tone = 'brand',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  tone?: 'brand' | 'danger' | 'quiet';
}) {
  const tones = {
    brand: 'bg-brand text-white shadow-soft',
    danger: 'bg-[rgb(240_118_149)] text-white',
    quiet: 'bg-well text-ink',
  } as const;
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={`w-full rounded-2xl py-3.5 text-[15px] font-semibold transition-opacity ${tones[tone]} ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      {children}
    </motion.button>
  );
}

/* -------------------------------- תג קטן -------------------------------- */

export function Pill({
  children,
  active,
  onClick,
  className = '',
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
        active ? 'bg-brand text-white' : 'bg-well text-muted'
      } ${className}`}
    >
      {children}
    </button>
  );
}
