/** רכיבי בקרה קטנים ואחידים לכל האפליקציה. */
import { motion } from 'framer-motion';
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { ENTER, EXIT, GLIDE, ICON, SNAP, STROKE, TAP } from '@/lib/motion';
import { isGroupCollapsed, setGroupCollapsed } from '@/lib/settingsCollapse';

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
      className={`relative h-[34px] w-[58px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-brand' : 'bg-hairline'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      {/*
        בממשק מימין-לשמאל הידית נעה שמאלה כשהמתג נדלק.
        המסלול: 58 (רוחב) − 28 (ידית) − 3 (שוליים) = 27.
      */}
      <motion.span
        className="absolute top-[3px] block h-7 w-7 rounded-full bg-white shadow-raised"
        animate={{ right: checked ? 27 : 3 }}
        transition={TAP}
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
      {...(onClick ? { type: 'button' as const, onClick, whileTap: { scale: 0.99 } } : {})}
      className="flex w-full items-center gap-3.5 px-5 py-4 text-right lg:px-6 lg:py-[18px]"
    >
      {icon && <span className="shrink-0 text-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-label font-medium text-ink">{title}</span>
        {hint && <span className="mt-1 block text-caption text-muted">{hint}</span>}
      </span>
      {children && <span className="shrink-0">{children}</span>}
    </Wrapper>
  );
}

/**
 * קבוצת הגדרות. קבוצה שקיבלה `id` אפשר לקפל, והבחירה נשמרת למכשיר.
 *
 * הקיפול מונפש בגובה ולא ב-`layoutId`: אנימציית פריסה משותפת בתוך המסך
 * הזה הייתה נתקעת בדיוק כפי שקרה ל-`Segmented`.
 */
export function SettingsGroup({
  id,
  title,
  children,
  footer,
}: {
  id?: string;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const collapsible = Boolean(id && title);
  const [collapsed, setCollapsed] = useState(() => (id ? isGroupCollapsed(id) : false));
  const panelId = useId();

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (id) setGroupCollapsed(id, next);
  };

  const body = (
    <>
      <div className="divide-y divide-hairline overflow-hidden rounded-3xl bg-surface shadow-raised">
        {children}
      </div>
      {footer && <p className="mt-2.5 px-2 text-caption leading-relaxed text-muted">{footer}</p>}
    </>
  );

  return (
    <section className="mb-7">
      {title &&
        (collapsible ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls={panelId}
            className="focus-ring -mx-1 mb-2.5 flex items-center gap-1 rounded-xl px-3 py-1 text-right"
          >
            <span className="text-caption font-semibold uppercase tracking-wide text-faint">
              {title}
            </span>
            <motion.span
              className="text-faint"
              initial={false}
              animate={{ rotate: collapsed ? 0 : 180 }}
              transition={SNAP}
            >
              <ChevronDown size={ICON.sm} strokeWidth={STROKE} />
            </motion.span>
          </button>
        ) : (
          <h3 className="mb-2.5 px-2 text-caption font-semibold uppercase tracking-wide text-faint">
            {title}
          </h3>
        ))}

      {collapsible ? (
        <motion.div
          id={panelId}
          // הריפוד השלילי נותן לצל מקום בתוך אזור הגזירה. ב-border-box
          // גובה 0 מאפס גם אותו, ולכן הקבוצה הסגורה באמת תופסת אפס.
          className="-mx-1 -mb-1 overflow-hidden px-1 pb-1"
          initial={false}
          animate={{ height: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 }}
          transition={{ height: GLIDE, opacity: collapsed ? EXIT : ENTER }}
          aria-hidden={collapsed}
        >
          {body}
        </motion.div>
      ) : (
        body
      )}
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
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null);
  const index = options.findIndex((o) => o.value === value);

  /*
    הגלולה נמדדת ולא מחושבת: הכפתורים נמתחים לפי הטקסט, וכיתוב עברי
    משנה רוחב בין אפשרות לאפשרות.

    למה לא layoutId: אנימציית פריסה משותפת נשארת תלויה כשהעץ שמכיל
    אותה מתפרק, וגיליון שנסגר אחרי בחירה כאן פשוט לא היה נעלם -
    AnimatePresence המתין לה לנצח. offsetLeft עובד גם ב-RTL, כי הוא
    פיזי.
  */
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const button = list.querySelectorAll<HTMLElement>('[data-seg]')[index];
      const next = button ? { x: button.offsetLeft, width: button.offsetWidth } : null;
      // בלי ההשוואה הזו כל מדידה הייתה יוצרת אובייקט חדש ומריצה רינדור נוסף
      setPill((prev) =>
        prev?.x === next?.x && prev?.width === next?.width ? prev : next,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [index, options.length]);

  return (
    <div
      ref={listRef}
      className={`relative flex gap-1 rounded-2xl bg-well p-1 ${
        size === 'sm' ? 'text-caption' : 'text-label'
      }`}
    >
      {pill && (
        <motion.span
          aria-hidden
          className="absolute inset-y-1 left-0 rounded-xl bg-brand"
          initial={false}
          animate={{ x: pill.x, width: pill.width }}
          transition={SNAP}
        />
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            data-seg
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative flex-1 whitespace-nowrap rounded-xl px-3.5 py-2.5 font-medium transition-colors ${
              active ? 'text-white' : 'text-muted'
            }`}
          >
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
    brand: 'bg-brand text-white shadow-raised',
    danger: 'bg-[rgb(240_118_149)] text-white',
    quiet: 'bg-well text-ink',
  } as const;
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={TAP}
      className={`w-full rounded-2xl py-4 text-label font-semibold transition-opacity ${tones[tone]} ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      {children}
    </motion.button>
  );
}

/* -------------------------------- תג בחירה -------------------------------- */

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
      className={`rounded-xl px-4 py-2.5 text-caption font-medium transition-colors ${
        active ? 'bg-brand text-white' : 'bg-well text-muted'
      } ${className}`}
    >
      {children}
    </button>
  );
}
