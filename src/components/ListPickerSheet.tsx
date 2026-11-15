/**
 * בחירת הרשימה המשותפת הפעילה.
 *
 * למה גיליון ולא שורת צ׳יפים: החלפת רשימה היא פעולה נדירה - רוב הזמן
 * יש רשימה אחת, ומי שיש לו שתיים נשאר באותה אחת לאורך כל השימוש. שורה
 * קבועה של צ׳יפים שילמה מקום ורעש ויזואלי על פעולה שכמעט אינה נעשית,
 * והתחרתה ויזואלית בקטגוריות, שדווקא כן מתחלפות.
 *
 * מה שכן זוכה למקום קבוע הוא *שם* הרשימה, ככותרת הכרטיס - כי "איפה
 * אני" היא שאלה שנשאלת כל הזמן, גם כשלא מחליפים.
 */
import { motion } from 'framer-motion';
import { Check, Plus, Users } from '@/components/ui/icons';
import type { DateKey } from '@/types';
import { countByCategory, type SharedItem, type SharedList } from '@/lib/sharedLists';
import { Sheet } from './ui/Sheet';
import { MemberStack } from './ui/Avatar';
import { ICON, TAP_SCALE } from '@/lib/motion';
import { haptic } from '@/lib/native';

export function ListPickerSheet({
  open,
  onClose,
  lists,
  items,
  todayKey,
  activeId,
  onSelect,
  onCreate,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  lists: SharedList[];
  /** הפריטים לפי רשימה, כדי להראות כמה ממתין בכל אחת */
  items: Record<string, SharedItem[]>;
  /** היום, לספירת "כמה פתוח" - אותה הגדרה בדיוק של הצ׳יפים */
  todayKey: DateKey;
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  busy: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="הרשימות שלי">
      <div className="flex flex-col gap-2 pb-2">
        {lists.map((list) => {
          const active = list.id === activeId;
          /*
            אותה ספירה בדיוק של צ׳יפ "הכול" בכרטיס: פתוח, ולא עתידי.
            שני מספרים שונים לאותה רשימה באותו מסך גרועים משניהם.
          */
          const open_ = countByCategory(items[list.id] ?? [], todayKey).get(null) ?? 0;
          return (
            <motion.button
              key={list.id}
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => {
                void haptic('light');
                onSelect(list.id);
                onClose();
              }}
              aria-pressed={active}
              /*
                הפעילה בדיו מלא, כמו כל "נבחר" באפליקציה. כשהיא הייתה
                `brand-soft` - שהפך ל-`well` - היא נראתה בדיוק כמו השאר.
              */
              className={`focus-ring flex min-h-[64px] items-center gap-3.5 rounded-group px-4 py-3 text-right transition-colors ${
                active ? 'bg-inverse text-on-inverse' : 'bg-well text-ink'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold">{list.name}</span>
                <span
                  className={`mt-1 flex items-center gap-2 truncate text-caption ${
                    active ? 'opacity-75' : 'text-muted'
                  }`}
                >
                  {list.memberUids.length > 1 ? (
                    <MemberStack list={list} max={3} ring={active ? 'ring-inverse' : 'ring-well'} />
                  ) : (
                    <Users size={ICON.xs} />
                  )}
                  {list.memberUids.length > 1 ? `${list.memberUids.length} חברים` : 'רק אתם'}
                  {open_ > 0 && ` · ${open_} פתוחים`}
                </span>
              </span>
              {active && <Check size={ICON.lg} weight="bold" className="shrink-0" />}
            </motion.button>
          );
        })}

        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          disabled={busy}
          onClick={() => {
            void haptic('light');
            onCreate();
            onClose();
          }}
          className="focus-ring mt-1 flex min-h-[64px] items-center gap-3.5 rounded-group border border-dashed border-hairline px-4 py-3 text-right disabled:opacity-50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-well text-ink">
            <Plus size={ICON.md} weight="bold" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-ink">רשימה משותפת חדשה</span>
            <span className="mt-0.5 block text-caption text-muted">
              אפשר להזמין אליה אחרי שהיא נוצרת
            </span>
          </span>
        </motion.button>
      </div>
    </Sheet>
  );
}
