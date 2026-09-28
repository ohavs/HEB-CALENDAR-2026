/**
 * הקטגוריות של התזכורות האישיות: הוספה ומחיקה.
 *
 * אותה צורה של ניהול הקטגוריות ברשימה משותפת, כדי שמי שלמד אחת יכיר את
 * השנייה. מחיקה אינה נוגעת בתזכורות: מה שהיה בקטגוריה שנמחקה עובר
 * ל"בלי קטגוריה" (`sectionByCategory`), ולא נעלם יחד איתה.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import type { ReminderCategory } from '@/types';
import { useSettings, useSettingsStore } from '@/store/settings';
import { newId } from '@/lib/sharedLists';
import { announce } from '@/lib/announce';
import { haptic } from '@/lib/native';
import { ICON, STROKE, TAP } from '@/lib/motion';
import { Sheet } from './ui/Sheet';

/** מעבר לזה הצ׳יפים כבר לא נכנסים בשורה, וזה סימן לרשימה ולא לקטגוריות */
export const MAX_REMINDER_CATEGORIES = 12;

export function ReminderCategoriesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { reminderCategories: categories } = useSettings();
  const [name, setName] = useState('');

  const write = (next: ReminderCategory[]) =>
    useSettingsStore.getState().set('reminderCategories', next);

  const add = () => {
    const clean = name.trim().slice(0, 30);
    if (!clean || categories.length >= MAX_REMINDER_CATEGORIES) return;
    write([...categories, { id: newId(), name: clean }]);
    setName('');
    void haptic('medium');
    announce(`נוספה הקטגוריה ${clean}`);
  };

  const remove = (category: ReminderCategory) => {
    write(categories.filter((c) => c.id !== category.id));
    void haptic('medium');
    announce(`הקטגוריה ${category.name} נמחקה. התזכורות שבה עברו לבלי קטגוריה`);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="קטגוריות"
      subtitle="לתזכורות שלי"
    >
      <div className="space-y-2.5 pb-2">
        {categories.length > 0 && (
          <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-1 pe-1.5 ps-4">
                <span className="min-w-0 flex-1 truncate text-label font-medium text-ink">{c.name}</span>
                <motion.button
                  type="button"
                  onClick={() => remove(c)}
                  whileTap={{ scale: 0.9 }}
                  transition={TAP}
                  aria-label={`מחיקת ${c.name}`}
                  className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl text-muted"
                >
                  <X size={ICON.md} strokeWidth={STROKE} />
                </motion.button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={categories.length ? 'קטגוריה נוספת' : 'למשל: בית, עבודה, קניות'}
            aria-label="שם הקטגוריה"
            className="field-reset field-shell min-w-0 flex-1 rounded-2xl bg-well px-4 py-3 text-label text-ink placeholder:text-faint"
          />
          <motion.button
            type="button"
            onClick={add}
            disabled={!name.trim() || categories.length >= MAX_REMINDER_CATEGORIES}
            whileTap={{ scale: 0.92 }}
            transition={TAP}
            aria-label="הוספת קטגוריה"
            className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white disabled:opacity-40"
          >
            <Plus size={ICON.md} strokeWidth={2.5} />
          </motion.button>
        </div>

        <p className="px-1 text-caption leading-relaxed text-muted">
          כשיש קטגוריות, הרשימה מתחלקת לפיהן וכל אחת מתקפלת בחץ. מחיקת קטגוריה
          אינה מוחקת תזכורות - הן עוברות ל״בלי קטגוריה״.
        </p>
      </div>
    </Sheet>
  );
}
