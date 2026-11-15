/**
 * ניהול רשימה משותפת: שם, קטגוריות, חברים והזמנות.
 *
 * ההזמנה נשלחת לכתובת אימייל ולא למשתמש קיים, כי בשלב ההזמנה אין לנו
 * דרך לדעת אם למי שמולנו יש בכלל חשבון. המסמך ממתין, והנמען רואה אותו
 * ברגע שהוא נכנס עם אותה כתובת.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Plus, Trash2, X } from '@/components/ui/icons';
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
import { Avatar } from './ui/Avatar';
import { haptic } from '@/lib/native';
import { ICON, TAP } from '@/lib/motion';

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
          <p className="mb-4 rounded-field bg-well px-4 py-3 text-label leading-relaxed text-ink" role="status">
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
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-full text-muted"
              >
                <X size={ICON.md} />
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
              className="field-reset field-shell h-12 min-w-0 flex-1 rounded-field bg-well px-4 text-body text-ink placeholder:text-faint"
            />
            <motion.button
              type="button"
              onClick={addCategory}
              disabled={busy || !category.trim()}
              whileTap={{ scale: 0.92 }}
              transition={TAP}
              aria-label="הוספת קטגוריה"
              className="focus-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-field bg-inverse text-on-inverse disabled:opacity-40"
            >
              <Plus size={ICON.md} weight="bold" />
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
            const name = member?.name?.trim() || member?.email || 'חבר';
            return (
              /*
                הפנים ולא אייקון בריבוע: זו שורה של אדם, וזו אותה תמונה
                שמופיעה בפינת כל פריט שהוא הוסיף. כך מזהים אותו בשני המקומות.
              */
              <div key={uid} className="flex min-h-[60px] items-center gap-3.5 px-4 py-3 lg:px-5">
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-well">
                  <Avatar photoURL={member?.photo ?? null} name={name} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium leading-snug text-ink">
                    {name}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-muted">
                    {uid === list.ownerUid ? 'בעלים' : member?.email}
                  </span>
                </span>
                {uid === user?.uid && (
                  <span className="shrink-0 rounded-full bg-well px-2.5 py-0.5 text-caption font-medium text-ink">
                    אני
                  </span>
                )}
              </div>
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
              className="field-reset field-shell h-12 min-w-0 flex-1 rounded-field bg-well px-4 text-body text-ink placeholder:text-faint"
            />
            <motion.button
              type="button"
              onClick={sendInvite}
              disabled={busy || !email.trim()}
              whileTap={{ scale: 0.92 }}
              transition={TAP}
              className="focus-ring h-12 shrink-0 rounded-field bg-inverse px-5 text-label font-semibold text-on-inverse disabled:opacity-40"
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
              icon={<Trash2 size={ICON.md} />}
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
                <span className="text-caption font-semibold text-danger">למחוק?</span>
              )}
            </SettingRow>
          ) : (
            <SettingRow
              title="יציאה מהרשימה"
              hint="היא תישאר אצל שאר החברים"
              icon={<LogOut size={ICON.md} />}
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
