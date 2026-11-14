/**
 * אריחים - בחירה אחת מכמה, כשכל האפשרויות קצרות.
 *
 * `SelectField` מסתיר את האפשרויות מאחורי שורה: כדי לדעת שיש "יום לפני"
 * צריך לפתוח. כשרוב הבחירות הן אחת מחמש, האפשרויות עצמן הן הטופס.
 * "נבחר" בדיו מלא, כמו בכל האפליקציה.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { haptic } from '@/lib/native';
import { ICON, TAP } from '@/lib/motion';
import { CheckMark } from './controls';
import { OptionPickerSheet, type PickerOption } from './Picker';

/**
 * שורה נגללת של אריחים קצרים, עם "עוד" לרשימה המלאה.
 *
 * ערך שאינו בין האריחים (15 דקות, למשל, כשבשורה יש רק 10) אינו נעלם:
 * הוא יושב על אריח ה"עוד", נבחר, ואומר את עצמו.
 */
export function TileStrip<T extends string>({
  options,
  value,
  onChange,
  more,
  label,
}: {
  options: PickerOption<T>[];
  value: T;
  onChange: (next: T) => void;
  /** הרשימה המלאה, בגיליון. התווית של האריח כשהערך כן ביניהם. */
  more?: { label: string; title: string; options: PickerOption<T>[] };
  /** שם לקורא מסך */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const inStrip = options.some((o) => o.value === value);
  const pick = (next: T) => {
    void haptic('light');
    onChange(next);
  };
  const moreLabel = inStrip
    ? more?.label
    : (more?.options.find((o) => o.value === value)?.label ?? more?.label);

  return (
    <>
      <div
        role="radiogroup"
        aria-label={label}
        data-sheet-no-dismiss
        className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4"
      >
        {options.map((o) => (
          <Tile key={o.value} selected={o.value === value} onClick={() => pick(o.value)}>
            {o.label}
          </Tile>
        ))}
        {more && (
          <Tile selected={!inStrip} onClick={() => setOpen(true)} radio={false}>
            {moreLabel}
          </Tile>
        )}
      </div>
      {more && (
        <OptionPickerSheet
          open={open}
          onClose={() => setOpen(false)}
          title={more.title}
          value={value}
          options={more.options}
          onChange={onChange}
        />
      )}
    </>
  );
}

function Tile({
  selected,
  onClick,
  children,
  radio = true,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** "עוד" פותח רשימה ואינו אפשרות בעצמו */
  radio?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      transition={TAP}
      onClick={onClick}
      {...(radio
        ? { role: 'radio', 'aria-checked': selected }
        : { 'aria-haspopup': 'dialog' as const })}
      className={`focus-ring flex h-11 shrink-0 items-center whitespace-nowrap rounded-tile px-3.5 text-label transition-colors ${
        selected
          ? 'bg-inverse font-semibold text-on-inverse'
          : 'bg-surface font-medium text-ink active:bg-hairline'
      }`}
    >
      {children}
    </motion.button>
  );
}

/**
 * רשת של אריחים בשתי עמודות - לבחירה שנסגרת מיד, בגיליון.
 *
 * שש אפשרויות ברשימה לקחו את כל גובה החלונית; ברשת הן שלוש שורות,
 * ונקראות במבט אחד.
 */
export function TileGrid<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: PickerOption<T>[];
  /** null כשאף אריח אינו הבחירה - למשל כשנבחר משהו מותאם אישית */
  value: T | null;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <motion.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            whileTap={{ scale: 0.98 }}
            transition={TAP}
            onClick={() => {
              void haptic('light');
              onChange(o.value);
            }}
            className={`focus-ring flex min-h-[60px] items-center gap-2 rounded-field px-4 py-3 text-right transition-colors ${
              on ? 'bg-inverse text-on-inverse' : 'bg-well text-ink active:bg-hairline'
            }`}
          >
            <span className={`min-w-0 flex-1 text-body ${on ? 'font-semibold' : 'font-medium'}`}>
              {o.label}
            </span>
            {on && <CheckMark size={ICON.md} className="shrink-0" />}
          </motion.button>
        );
      })}
    </div>
  );
}
