/**
 * חזרה - שורה אחת, וחלונית אחת שבוחרת גם יחידה וגם מספר.
 *
 * קודם היו שתי שורות: "חזרה: כל חודש" ומתחתיה "תדירות: כל חודשיים". כל
 * אחת אמרה חצי, ויחד הן נקראו כסתירה. עכשיו השורה אומרת את המשפט כולו
 * ("כל חודשיים"), והחלונית מחזיקה את שתי השאלות במקום אחד: האפשרויות
 * הרגילות למעלה, ו"מותאם אישית" - מספר ויחידה - מתחתן.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Minus, Plus, Repeat } from 'lucide-react';
import type { UserEvent } from '@/types';
import {
  MAX_REPEAT_EVERY,
  REPEAT_LABELS,
  repeatEveryOf,
  repeatLabel,
  repeatUnitWord,
} from '@/lib/recurrence';
import { ICON, STROKE, TAP } from '@/lib/motion';
import { haptic } from '@/lib/native';
import { PickerField } from './ui/fields';
import { Sheet } from './ui/Sheet';

type Rule = UserEvent['repeat'];
type Unit = Exclude<Rule, 'none'>;

const PRESETS = Object.keys(REPEAT_LABELS) as Rule[];
const UNITS: Unit[] = ['daily', 'weekly', 'monthly', 'yearly', 'hebrew-yearly'];

/** שם היחידה בצ׳יפ: ברבים, כי במותאם אישית המספר הוא 2 ומעלה */
function unitChip(unit: Unit): string {
  return unit === 'hebrew-yearly' ? 'שנים (עברי)' : repeatUnitWord(unit, 3);
}

export function RepeatField({
  repeat,
  repeatEvery,
  onChange,
}: {
  repeat: Rule;
  repeatEvery?: number;
  onChange: (next: { repeat: Rule; repeatEvery?: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const every = repeatEveryOf({ repeatEvery });
  const custom = repeat !== 'none' && every > 1;

  const set = (rule: Rule, n: number) =>
    onChange({ repeat: rule, repeatEvery: rule !== 'none' && n > 1 ? n : undefined });

  /*
    המספר מתחיל מ-2: "כל 1" הוא אחת האפשרויות שלמעלה. בלי יחידה (ללא
    חזרה) הלחיצה הראשונה בוחרת חודש - הבחירה הנפוצה ביותר ל"כל כמה".
  */
  const step = (delta: number) => {
    void haptic('light');
    const unit: Unit = repeat === 'none' ? 'monthly' : repeat;
    const base = custom ? every : 1;
    set(unit, Math.min(MAX_REPEAT_EVERY, Math.max(1, base + delta)));
  };

  return (
    <>
      <PickerField
        label="חזרה"
        display={repeatLabel({ repeat, repeatEvery })}
        icon={<Repeat size={ICON.md} strokeWidth={STROKE} />}
        onOpen={() => setOpen(true)}
        variant="grouped"
      />
      <Sheet open={open} onClose={() => setOpen(false)} title="חזרה">
        <div className="space-y-2 pb-4">
          {PRESETS.map((rule) => {
            const active = rule === repeat && !custom;
            return (
              <motion.button
                key={rule}
                type="button"
                whileTap={{ scale: 0.99 }}
                transition={TAP}
                onClick={() => {
                  set(rule, 1);
                  setOpen(false);
                }}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-right transition-colors ${
                  active ? 'bg-brand-soft' : 'bg-well'
                }`}
              >
                <span
                  className={`min-w-0 flex-1 text-body font-medium ${
                    active ? 'text-brand-ink' : 'text-ink'
                  }`}
                >
                  {REPEAT_LABELS[rule]}
                </span>
                {active && <Check size={ICON.lg} strokeWidth={2.6} className="shrink-0 text-brand" />}
              </motion.button>
            );
          })}

          {/* מותאם אישית: המשפט עצמו, המספר, והיחידה - כולם יחד */}
          <section
            aria-label="מותאם אישית"
            className={`space-y-3 rounded-2xl px-4 py-4 transition-colors ${
              custom ? 'bg-brand-soft' : 'bg-well'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-caption font-medium text-muted">מותאם אישית</span>
                <span
                  className={`mt-0.5 block text-body font-semibold ${
                    custom ? 'text-brand-ink' : 'text-ink'
                  }`}
                  aria-live="polite"
                >
                  {custom ? repeatLabel({ repeat, repeatEvery }) : 'כל כמה ימים, שבועות או חודשים'}
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-1" dir="ltr">
                <StepButton label="פחות" onClick={() => step(-1)} disabled={!custom}>
                  <Minus size={ICON.sm} strokeWidth={2.5} />
                </StepButton>
                <span className="tnum w-8 text-center text-title font-semibold text-ink">
                  {custom ? every : '–'}
                </span>
                <StepButton label="יותר" onClick={() => step(1)} disabled={every >= MAX_REPEAT_EVERY}>
                  <Plus size={ICON.sm} strokeWidth={2.5} />
                </StepButton>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {UNITS.map((unit) => {
                const active = custom && repeat === unit;
                return (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => {
                      void haptic('light');
                      set(unit, custom ? every : 2);
                    }}
                    aria-pressed={active}
                    className={`focus-ring rounded-full px-3 py-1.5 text-caption font-medium transition-colors ${
                      active ? 'bg-brand text-white' : 'bg-surface text-muted'
                    }`}
                  >
                    {unitChip(unit)}
                  </button>
                );
              })}
            </div>
          </section>

          {custom && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={TAP}
              onClick={() => setOpen(false)}
              className="focus-ring w-full rounded-2xl bg-brand py-3.5 text-label font-semibold text-white"
            >
              {repeatLabel({ repeat, repeatEvery })}
            </motion.button>
          )}
        </div>
      </Sheet>
    </>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
      transition={TAP}
      aria-label={label}
      className="focus-ring flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink shadow-raised disabled:opacity-35"
    >
      {children}
    </motion.button>
  );
}
