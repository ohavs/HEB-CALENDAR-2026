/** רכיבי בקרה קטנים ואחידים לכל האפליקציה. */
import { motion, type MotionValue } from 'framer-motion';
import { forwardRef, useId, useState, type ReactNode } from 'react';
import { useLens, useLensLight, type LensSlot } from '@/hooks/useLens';
import { ChevronDown } from './icons';
import { EASE, ENTER, EXIT, GLIDE, ICON, SNAP, TAP } from '@/lib/motion';
import { isGroupCollapsed, setGroupCollapsed } from '@/lib/settingsCollapse';
import { haptic } from '@/lib/native';

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
      onClick={() => {
        void haptic('light');
        onChange(!checked);
      }}
      className={`focus-ring relative h-[34px] w-[58px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-inverse' : 'bg-ink/15'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      {/*
        בממשק מימין-לשמאל הידית נעה שמאלה כשהמתג נדלק.
        הידית בצבע ההפוך למסילה ולא לבנה קבועה: בלילה המסילה הדלוקה בהירה.
        המסלול: 58 (רוחב) − 28 (ידית) − 3 (שוליים) = 27.
      */}
      <motion.span
        className={`absolute top-[3px] block h-7 w-7 rounded-full shadow-raised transition-colors duration-200 ${
          checked ? 'bg-on-inverse' : 'bg-white'
        }`}
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
      className="flex min-h-[60px] w-full items-center gap-3.5 px-4 py-3 text-right lg:px-5"
    >
      {/*
        האייקון בריבוע שקוע ולא חשוף: שורה בלי אייקון ושורה עם אייקון
        מתיישרות לאותו קו, ורשימה ארוכה נקראת כעמודה אחת.
      */}
      {icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-well text-ink [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium leading-snug text-ink">{title}</span>
        {hint && <span className="mt-1 block text-caption text-muted">{hint}</span>}
      </span>
      {children && <span className="shrink-0">{children}</span>}
    </Wrapper>
  );
}

/**
 * קבוצת הגדרות - כרטיס אחד שנפתח ונסגר.
 *
 * קודם הכותרת הייתה כיתוב זעיר מרחף מעל הכרטיס, וכשהקבוצה נסגרה היא
 * הפכה בעצמה לכרטיס. שני מראות לאותו דבר, והחץ קפץ בין שני מקומות.
 * כאן יש מראה אחד: שורת כותרת בראש הכרטיס, בדיוק באותו ריפוד של
 * `SettingRow`, והחץ תמיד בקצה הסיום. מה שמשתנה הוא רק מה שמתחתיה.
 *
 * הקיפול מונפש בגובה ולא ב-`layoutId`: אנימציית פריסה משותפת בתוך המסך
 * הזה הייתה נתקעת בדיוק כפי שקרה ל-`Segmented`.
 */
export function SettingsGroup({
  id,
  title,
  children,
  footer,
  defaultCollapsed = false,
}: {
  id?: string;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * קבוצה שנפתחת מקופלת עד שנוגעים בה.
   *
   * למה שתהיה כזו: סקציה שהיא רשות ועוד אין בה כלום מציגה בחירה כאילו
   * היא שלב בהקמה. מקופלת היא עדיין שם, למי שמחפש אותה.
   */
  defaultCollapsed?: boolean;
}) {
  const collapsible = Boolean(id && title);
  const [collapsed, setCollapsed] = useState(() =>
    id ? isGroupCollapsed(id, defaultCollapsed) : false,
  );
  const panelId = useId();
  const open = !collapsible || !collapsed;

  const toggle = () => {
    void haptic('light');
    const next = !collapsed;
    setCollapsed(next);
    if (id) setGroupCollapsed(id, next);
  };

  return (
    <section className="mb-4">
      <div className="overflow-hidden rounded-group bg-surface shadow-raised">
        {title &&
          (collapsible ? (
            <motion.button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={panelId}
              whileTap={{ scale: 0.995 }}
              transition={TAP}
              className="focus-ring-inset flex min-h-[60px] w-full items-center gap-3 px-5 py-3 text-right transition-colors active:bg-well lg:px-6"
            >
              <span className="flex-1 text-body font-semibold text-ink">{title}</span>
              <motion.span
                className="shrink-0 text-muted"
                initial={false}
                animate={{ rotate: open ? 180 : 0 }}
                transition={SNAP}
              >
                <ChevronDown size={ICON.lg} />
              </motion.span>
            </motion.button>
          ) : (
            <div className="flex min-h-[60px] items-center px-5 py-3 lg:px-6">
              <span className="text-body font-semibold text-ink">{title}</span>
            </div>
          ))}

        <motion.div
          id={panelId}
          className="overflow-hidden"
          initial={false}
          animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
          transition={{ height: GLIDE, opacity: open ? ENTER : EXIT }}
          aria-hidden={!open}
        >
          <div className={`divide-y divide-hairline ${title ? 'border-t border-hairline' : ''}`}>
            {children}
          </div>
        </motion.div>
      </div>

      {footer && open && (
        <p className="mt-2.5 px-2 text-caption leading-relaxed text-muted">{footer}</p>
      )}
    </section>
  );
}

/* ------------------------------ בחירה מפולחת ------------------------------ */

/**
 * בחירה אחת מכמה - בעדשה של סרגל הלשוניות, בדיו.
 *
 * אותו מנגנון (`useLens`): נמתחת בתנועה, נגררת, ומדליקה לפי מרחק. כשהיו
 * כאן גלולה בקפיץ אחר ובסרגל עדשה, האפליקציה נקראה כשתי מערכות. ההבדל
 * היחיד הוא המראה - בתוך התוכן "נבחר" הוא דיו מלא, לא זכוכית.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (next: T) => void;
  size?: 'sm' | 'md';
  /** שם לקורא מסך, כשאין כותרת גלויה לידו */
  label?: string;
}) {
  const index = options.findIndex((o) => o.value === value);
  const lens = useLens({
    count: options.length,
    index,
    onSelect: (i) => {
      // שינוי מצב, לא ניווט - ולכן רטט קל (הטבלה ב-CLAUDE.md)
      void haptic('light');
      onChange(options[i].value);
    },
  });

  return (
    <div
      {...lens.rowProps}
      role="radiogroup"
      aria-label={label}
      className={`relative flex gap-1 rounded-full bg-well p-1 ${
        size === 'sm' ? 'h-11 text-caption' : 'h-[52px] text-label'
      }`}
    >
      {lens.ready && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-0 rounded-full bg-inverse shadow-raised"
          style={lens.lensStyle}
        />
      )}
      {options.map((opt, i) => (
        <SegmentedOption
          key={opt.value}
          ref={lens.itemRef(i)}
          label={opt.label}
          icon={opt.icon}
          selected={i === index}
          slot={lens.slots[i]}
          lensCenter={lens.center}
          onClick={lens.click(i)}
        />
      ))}
    </div>
  );
}

const SegmentedOption = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    icon?: ReactNode;
    selected: boolean;
    slot: LensSlot | undefined;
    lensCenter: MotionValue<number>;
    onClick: () => void;
  }
>(function SegmentedOption({ label, icon, selected, slot, lensCenter, onClick }, ref) {
  const { lit, dim } = useLensLight(lensCenter, slot, selected);
  const content = (
    <>
      {icon}
      <span>{label}</span>
    </>
  );
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
      /*
        flex-auto ולא flex-1: כל אפשרות גדלה מרוחב הכיתוב שלה. ברוחב שווה
        "מערכת" נחתכה ל"מע…" בשורת הגדרות צרה, בזמן ש"בהיר" קיבלה אוויר.
      */
      className="focus-ring-inset relative flex-auto whitespace-nowrap rounded-full px-3.5 font-medium"
    >
      <motion.span
        className="flex items-center justify-center gap-1.5 text-muted"
        style={{ opacity: dim }}
      >
        {content}
      </motion.span>
      {/* השכבה הנבחרת: טקסט הפוך על הדיו. on-inverse ולא לבן, כי בלילה הדיו בהיר */}
      <motion.span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center gap-1.5 px-3.5 font-semibold text-on-inverse"
        style={{ opacity: lit }}
      >
        {content}
      </motion.span>
    </button>
  );
});

/* ------------------------------ כפתור ראשי ------------------------------ */

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
  tone = 'inverse',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  tone?: 'inverse' | 'danger' | 'quiet';
}) {
  const tones = {
    inverse: 'bg-inverse text-on-inverse shadow-raised',
    danger: 'bg-danger text-on-danger',
    quiet: 'bg-well text-ink',
  } as const;
  /*
    מושבת הוא מצב אחר, לא אותו כפתור חיוור. שקיפות לבדה השאירה כפתור
    מלא בצבע המותג שנראה כמעט לחיץ; כאן המילוי יורד לגמרי ונשאר מתאר,
    וזה קריא גם למי שלא מבחין בהפרש של 50% שקיפות.
  */
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={TAP}
      className={`focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-field px-5 text-body font-semibold transition-colors ${
        disabled ? 'border border-hairline bg-transparent text-faint' : tones[tone]
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
      className={`focus-ring h-10 rounded-full px-4 text-label font-medium transition-colors ${
        active ? 'bg-inverse text-on-inverse' : 'bg-well text-muted'
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* -------------------------------- סימון וי -------------------------------- */

/**
 * וי שנכתב, לא מופיע: הקו נמתח מתחילתו לסופו (`pathLength`).
 *
 * זה הרגע שבו משהו "בוצע", והוא חוזר עשרות פעמים ביום. וי שקופץ למקומו
 * נראה כמו החלפת תמונה; וי שנכתב נראה כמו סימון ביד. משותף לתזכורת,
 * לכרטיס בלוח ולתצוגת היום, כדי שהסימון ייראה אותו דבר בכל מקום.
 */
export function CheckMark({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28, ease: EASE }}
      />
    </svg>
  );
}
