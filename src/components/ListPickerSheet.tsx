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
import { Check, Plus, Users } from 'lucide-react';
import type { DateKey } from '@/types';
import { countByCategory, type SharedItem, type SharedList } from '@/lib/sharedLists';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE, TAP_SCALE } from '@/lib/motion';
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
              className={`focus-ring flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-right transition-colors ${
                active ? 'bg-brand-soft' : 'bg-well'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  active ? 'bg-brand text-white' : 'bg-surface text-muted'
                }`}
              >
                {active ? (
                  <Check size={ICON.md} strokeWidth={3} />
                ) : (
                  <Users size={ICON.md} strokeWidth={STROKE} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-body font-semibold ${
                    active ? 'text-brand-ink' : 'text-ink'
                  }`}
                >
                  {list.name}
                </span>
                <span
                  className={`mt-0.5 block truncate text-caption ${
                    active ? 'text-brand-ink/70' : 'text-muted'
                  }`}
                >
                  {list.memberUids.length > 1 ? `${list.memberUids.length} חברים` : 'רק אתם'}
                  {open_ > 0 && ` · ${open_} פתוחים`}
                </span>
              </span>
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
          className="focus-ring mt-1 flex items-center gap-3.5 rounded-2xl border border-dashed border-hairline px-4 py-3.5 text-right disabled:opacity-50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
            <Plus size={ICON.md} strokeWidth={2.5} />
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
