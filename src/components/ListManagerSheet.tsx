/**
 * ניהול רשימה משותפת: שם, קטגוריות, חברים והזמנות.
 *
 * ההזמנה נשלחת לכתובת אימייל ולא למשתמש קיים, כי בשלב ההזמנה אין לנו
 * דרך לדעת אם למי שמולנו יש בכלל חשבון. המסמך ממתין, והנמען רואה אותו
 * ברגע שהוא נכנס עם אותה כתובת.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Plus, Trash2, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import {
  deleteList,
  invite,
  leaveList,
  renameList,
  setCategories,
} from '@/lib/sharedSync';
import {
  isOwner,
  newId,
  normalizeEmail,
  type ListCategory,
  type SharedList,
} from '@/lib/sharedLists';
import { Sheet } from './ui/Sheet';
import { PrimaryButton, SettingRow, SettingsGroup } from './ui/controls';
import { TextField } from './ui/fields';
import { haptic } from '@/lib/native';
import { ICON, STROKE, TAP } from '@/lib/motion';

/** כתובת שנראית כמו אימייל. ולידציה מלאה שייכת לשרת, ואין לנו כזה. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ListManagerSheet({
  open,
  onClose,
  list,
}: {
  open: boolean;
  onClose: () => void;
  list: SharedList;
}) {
  const user = useAuthStore((s) => s.user);
  const owner = isOwner(list, user?.uid ?? null);

  const [name, setName] = useState(list.name);
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (fn: () => Promise<void>, message?: string) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      if (message) setNote(message);
    } catch (e) {
      setNote((e as Error)?.message ?? 'הפעולה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = () => {
    const clean = normalizeEmail(email);
    if (!EMAIL.test(clean)) {
      setNote('כתובת אימייל לא תקינה');
      return;
    }
    if (clean === normalizeEmail(user?.email ?? '')) {
      setNote('זו הכתובת שלכם');
      return;
    }
    void run(async () => {
      await invite(list, clean);
      setEmail('');
    }, `ההזמנה ממתינה ל־${clean}`);
  };

  const addCategory = () => {
    const clean = category.trim().slice(0, 30);
    if (!clean) return;
    const next: ListCategory[] = [
      ...list.categories,
      { id: newId(), name: clean, color: list.color },
    ];
    void run(async () => {
      await setCategories(list.id, next);
      setCategory('');
    });
  };

  const removeCategory = (id: string) =>
    void run(() => setCategories(list.id, list.categories.filter((c) => c.id !== id)));

  return (
    <Sheet open={open} onClose={onClose} size="tall" title="ניהול הרשימה" subtitle={list.name}>
      <div className="pb-2">
        {note && (
          <p className="mb-4 rounded-xl bg-brand-soft px-3.5 py-2.5 text-caption leading-relaxed text-brand-ink">
            {note}
          </p>
        )}

        {/* ------------------------------- שם ------------------------------- */}
        {owner && (
          <SettingsGroup id="shared-name" title="שם הרשימה">
            <div className="px-5 py-4 lg:px-6">
              <TextField
                label="שם"
                value={name}
                onChange={setName}
                placeholder="קניות, בית, עבודה"
              />
              <div className="mt-3">
                <PrimaryButton
                  tone="quiet"
                  disabled={busy || !name.trim() || name.trim() === list.name}
                  onClick={() => void run(() => renameList(list.id, name), 'השם עודכן')}
                >
                  שמירת השם
                </PrimaryButton>
              </div>
            </div>
          </SettingsGroup>
        )}

        {/* ---------------------------- קטגוריות ---------------------------- */}
        {/*
          מקופלת כל עוד אין קטגוריות.

          רשימה משותפת נוצרת כדי לשתף אותה, לא כדי לסווג אותה: ברשימה
          שנוצרה הרגע ואין בה אף פריט, סקציה פתוחה עם פסקת הסבר מבקשת
          לסווג משהו שעוד לא קיים - ומציגה בחירת רשות כאילו היא שלב
          בהקמה. ברשימה שכבר יש בה קטגוריות זו כבר החלטה פעילה, והיא
          נפתחת רגיל.
        */}
        <SettingsGroup
          id="shared-categories"
          title="קטגוריות"
          defaultCollapsed={list.categories.length === 0}
          footer="קטגוריה מסננת את הרשימה, ובוידג׳ט אפשר לבחור איזו מהן מוצגת. אפשר גם בלי."
        >
          {list.categories.map((c) => (
            <SettingRow key={c.id} title={c.name}>
              <motion.button
                type="button"
                onClick={() => removeCategory(c.id)}
                disabled={busy}
                whileTap={{ scale: 0.9 }}
                transition={TAP}
                aria-label={`מחיקת ${c.name}`}
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-xl text-muted"
              >
                <X size={ICON.md} strokeWidth={STROKE} />
              </motion.button>
            </SettingRow>
          ))}
          <div className="flex items-center gap-2 px-5 py-4 lg:px-6">
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="קטגוריה חדשה"
              className="field-reset field-shell min-w-0 flex-1 rounded-xl bg-well px-3.5 py-2.5 text-label text-ink placeholder:text-faint"
            />
            <motion.button
              type="button"
              onClick={addCategory}
              disabled={busy || !category.trim()}
              whileTap={{ scale: 0.92 }}
              transition={TAP}
              aria-label="הוספת קטגוריה"
              className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white disabled:opacity-40"
            >
              <Plus size={ICON.md} strokeWidth={2.5} />
            </motion.button>
          </div>
        </SettingsGroup>

        {/* ------------------------------ חברים ------------------------------ */}
        <SettingsGroup
          id="shared-members"
          title="חברים"
          footer="ההזמנה ממתינה לכתובת. ברגע שמי שהזמנתם ייכנס עם אותו חשבון גוגל, הוא יראה אותה."
        >
          {list.memberUids.map((uid) => {
            const member = list.members[uid];
            return (
              <SettingRow
                key={uid}
                title={member?.name?.trim() || member?.email || 'חבר'}
                hint={uid === list.ownerUid ? 'בעלים' : member?.email}
              >
                {uid === user?.uid && (
                  <span className="text-caption font-medium text-faint">אני</span>
                )}
              </SettingRow>
            );
          })}
          <div className="flex items-center gap-2 px-5 py-4 lg:px-6">
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
              placeholder="אימייל להזמנה"
              className="field-reset field-shell min-w-0 flex-1 rounded-xl bg-well px-3.5 py-2.5 text-label text-ink placeholder:text-faint"
            />
            <motion.button
              type="button"
              onClick={sendInvite}
              disabled={busy || !email.trim()}
              whileTap={{ scale: 0.92 }}
              transition={TAP}
              className="focus-ring shrink-0 rounded-xl bg-brand px-4 py-2.5 text-caption font-semibold text-white disabled:opacity-40"
            >
              הזמנה
            </motion.button>
          </div>
        </SettingsGroup>

        {/* ------------------------------ יציאה ------------------------------ */}
        <SettingsGroup id="shared-danger" title="אזור מסוכן">
          {owner ? (
            <SettingRow
              title={confirmDelete ? 'למחוק את הרשימה לכולם?' : 'מחיקת הרשימה'}
              hint={confirmDelete ? 'אי אפשר לבטל' : 'הרשימה תיעלם אצל כל החברים'}
              icon={<Trash2 size={ICON.md} strokeWidth={STROKE} />}
              onClick={() => {
                void haptic('medium');
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                void run(async () => {
                  await deleteList(list.id);
                  onClose();
                });
              }}
            >
              {confirmDelete && (
                <span className="text-caption font-semibold text-[rgb(194_60_90)]">למחוק?</span>
              )}
            </SettingRow>
          ) : (
            <SettingRow
              title="יציאה מהרשימה"
              hint="היא תישאר אצל שאר החברים"
              icon={<LogOut size={ICON.md} strokeWidth={STROKE} />}
              onClick={() => {
                void haptic('medium');
                void run(async () => {
                  await leaveList(list.id);
                  onClose();
                });
              }}
            />
          )}
        </SettingsGroup>
      </div>
    </Sheet>
  );
}
