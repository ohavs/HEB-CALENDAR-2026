/**
 * "המופע הזה או כל הסדרה?"
 *
 * נשאל בכל פעם שפעולה על אירוע חוזר עלולה להשפיע על יותר ממה שהמשתמש
 * התכוון אליו. השאלה נשאלת אחרי שהמשתמש כבר עשה את הפעולה, ולכן היא
 * מנוסחת סביב מה שעומד לקרות ולא סביב מה שהוא רוצה.
 */
import { motion } from 'framer-motion';
import { CalendarRange, CalendarX } from '@/components/ui/icons';
import { Sheet } from './ui/Sheet';
import { ICON, TAP_SCALE } from '@/lib/motion';

export type EditScope = 'occurrence' | 'series';

export function ScopeSheet({
  open,
  onClose,
  onChoose,
  title,
  occurrenceLabel,
  seriesLabel,
  occurrenceHint,
  seriesHint,
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (scope: EditScope) => void;
  title: string;
  occurrenceLabel: string;
  seriesLabel: string;
  occurrenceHint: string;
  seriesHint: string;
  /** מסמן את בחירת הסדרה כפעולה שקשה לחזור ממנה */
  destructive?: boolean;
}) {
  const choose = (scope: EditScope) => {
    onChoose(scope);
    onClose();
  };

  /*
    שני אריחים זה לצד זה ולא שתי שורות זו מתחת לזו: זו בחירה בין שתי
    אפשרויות שוות, ושורות נקראו כרשימה שהראשונה בה היא ברירת המחדל.
    ההסבר יושב בתוך האריח, כי "המופע" ו"הסדרה" לבדם אינם אומרים מה
    יקרה לשאר.
  */
  const tile =
    'focus-ring flex min-h-[148px] flex-col items-start gap-3 rounded-group bg-well p-4 text-right active:bg-hairline';

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle="אירוע חוזר">
      <div className="grid grid-cols-2 gap-2.5 pb-3">
        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={() => choose('occurrence')}
          className={tile}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink">
            <CalendarX size={ICON.lg} />
          </span>
          <span>
            <span className="block text-body font-semibold leading-snug text-ink">
              {occurrenceLabel}
            </span>
            <span className="mt-1 block text-caption leading-snug text-muted">
              {occurrenceHint}
            </span>
          </span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={() => choose('series')}
          className={tile}
        >
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              destructive ? 'bg-danger-soft text-danger' : 'bg-surface text-ink'
            }`}
          >
            <CalendarRange size={ICON.lg} />
          </span>
          <span>
            <span
              className={`block text-body font-semibold leading-snug ${
                destructive ? 'text-danger' : 'text-ink'
              }`}
            >
              {seriesLabel}
            </span>
            <span className="mt-1 block text-caption leading-snug text-muted">{seriesHint}</span>
          </span>
        </motion.button>
      </div>
    </Sheet>
  );
}
