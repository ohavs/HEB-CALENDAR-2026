/**
 * תזכורות משותפות.
 *
 * אותו מנוע בדיוק של התזכורות האישיות - `expandEvents` מרחיב, ו-
 * `buildReminderGroups` מחלק לימים - ולכן חזרות, פריטים בלי תאריך
 * וסימון "בוצע" עובדים כאן בלי שורה אחת של לוגיקה חדשה.
 *
 * מה שנוסף הוא מה שמשותף מחייב: מי חבר, מי כתב מה, וקטגוריות.
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus, Settings2, Trash2, UserPlus, Users } from 'lucide-react';
import { addDays, dateKey, startOfDay } from '@/lib/dates';
import { expandEvents } from '@/lib/recurrence';
import { buildReminderGroups, type ReminderItem } from '@/lib/reminders';
import { useRangeData } from '@/hooks/useMonthData';
import { useAuthStore } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { useSelectedList, useSharedStore } from '@/store/shared';
import {
  acceptInvite,
  createList,
  declineInvite,
  retryShared,
  saveItem,
  removeItem,
  setItemDone,
} from '@/lib/sharedSync';
import {
  countByCategory,
  matchesCategory,
  memberLabel,
  newId,
  type SharedItem,
} from '@/lib/sharedLists';
import { isFirebaseConfigured } from '@/lib/firebase';
import { announce } from '@/lib/announce';
import { haptic } from '@/lib/native';
import { ENTER, GLIDE, ICON, SNAP, STROKE, TAP } from '@/lib/motion';
import { ListManagerSheet } from './ListManagerSheet';
import { ConfirmDeleteSheet } from './ConfirmDeleteSheet';
import { SharedItemSheet } from './SharedItemSheet';
import { PrimaryButton } from './ui/controls';

export function SharedReminders({ bottomInset }: { bottomInset: number }) {
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signInWithGoogle);
  const settings = useSettings();

  const lists = useSharedStore((s) => s.lists);
  const loaded = useSharedStore((s) => s.loaded);
  const invites = useSharedStore((s) => s.invites);
  const itemsByList = useSharedStore((s) => s.items);
  const error = useSharedStore((s) => s.error);
  const category = useSharedStore((s) => s.category);
  const setCategory = useSharedStore((s) => s.setCategory);
  const select = useSharedStore((s) => s.select);
  const list = useSelectedList();

  const [title, setTitle] = useState('');
  const [managerOpen, setManagerOpen] = useState(false);
  /*
    פריט שממתין לאישור מחיקה. כאן אין "ביטול" אחרי הפעולה כמו בתזכורות
    האישיות: הפריט חי בענן ונמחק אצל כל החברים באותו רגע, ולכן השאלה
    נשאלת לפני.
  */
  const [pendingDelete, setPendingDelete] = useState<ReminderItem | null>(null);
  /** הפריט שפתוח לעריכה. שיבוץ התאריך קורה שם. */
  const [editing, setEditing] = useState<SharedItem | null>(null);
  const [busy, setBusy] = useState(false);

  const now = useMemo(() => new Date(), []);
  const todayKey = dateKey(now);
  const range = useRangeData(startOfDay(now), addDays(now, 120));

  const allItems = useMemo(() => (list ? (itemsByList[list.id] ?? []) : []), [itemsByList, list]);
  const items = useMemo(
    () => allItems.filter((it) => matchesCategory(it, category)),
    [allItems, category],
  );
  const counts = useMemo(() => countByCategory(allItems, todayKey), [allItems, todayKey]);

  const groups = useMemo(() => {
    const occurrences = expandEvents(items, startOfDay(now), addDays(now, 120));
    return buildReminderGroups(items, occurrences, range.days, now);
  }, [items, range.days, now]);

  /* ---------------------------- אין חשבון ---------------------------- */
  if (!isFirebaseConfigured) {
    return <Notice>שיתוף דורש חיבור לענן, והוא אינו מוגדר בגרסה הזו.</Notice>;
  }
  if (!user) {
    return (
      <div className="pb-8">
        <Notice>
          רשימה משותפת חיה בחשבון ולא במכשיר - זו הדרך היחידה ששני אנשים יראו
          את אותה רשימה. התחברו כדי להתחיל.
        </Notice>
        <div className="mt-4">
          <PrimaryButton onClick={() => void signIn()}>התחברות עם גוגל</PrimaryButton>
        </div>
      </div>
    );
  }

  const submit = async () => {
    const clean = title.trim();
    if (!clean || !list || busy) return;
    setBusy(true);
    const item: SharedItem = {
      id: newId(),
      title: clean,
      date: todayKey,
      startTime: null,
      endTime: null,
      allDay: true,
      color: list.color ?? settings.defaultEventColor,
      reminderMinutes: null,
      repeat: 'none',
      undated: true,
      categoryId: category && category !== 'none' ? category : undefined,
      createdBy: user.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      await saveItem(list.id, item);
      setTitle('');
      void haptic('medium');
      announce('נוסף לרשימה המשותפת');
    } finally {
      setBusy(false);
    }
  };

  const addList = async () => {
    setBusy(true);
    try {
      const id = await createList('רשימה משותפת', settings.defaultEventColor);
      select(id);
      setManagerOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-4" style={{ paddingBottom: bottomInset + 16 }}>
      {/* ---------------------------- הזמנות ---------------------------- */}
      <AnimatePresence initial={false}>
        {invites.map((inv) => (
          <motion.div
            key={inv.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ height: GLIDE, opacity: ENTER }}
            className="overflow-hidden"
          >
            <div className="mb-3 rounded-2xl bg-brand-soft p-4">
              <p className="text-label font-semibold text-brand-ink">
                {inv.fromName || 'מישהו'} הזמין אתכם ל״{inv.listName}״
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void acceptInvite(inv).then(() => select(inv.listId))}
                  className="focus-ring flex-1 rounded-xl bg-brand py-2.5 text-caption font-semibold text-white"
                >
                  להצטרף
                </button>
                <button
                  type="button"
                  onClick={() => void declineInvite(inv)}
                  className="focus-ring rounded-xl bg-surface px-4 py-2.5 text-caption font-medium text-muted"
                >
                  לא תודה
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ---------------------------- רשימות ---------------------------- */}
      {/*
        שלושה מצבים לפני שיש רשימות, ולכל אחד תצוגה משלו. קודם היה כאן
        `loaded && (...)`, וכל עוד המאזין לא ענה המסך היה ריק לגמרי -
        בלי כותרת, בלי כפתור ובלי סיבה. מסך ריק אינו מצב; הוא באג.
      */}
      {error ? (
        <div className="pt-2">
          <Notice>
            לא הצלחנו לטעון את הרשימות המשותפות.
            <span className="mt-2 block text-caption text-faint">{error}</span>
          </Notice>
          <div className="mt-4">
            <PrimaryButton
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void retryShared().finally(() => setBusy(false));
              }}
            >
              לנסות שוב
            </PrimaryButton>
          </div>
        </div>
      ) : !loaded ? (
        <p className="py-10 text-center text-label text-muted">טוען רשימות…</p>
      ) : !lists.length ? (
        <div className="pt-2">
          <Notice>
            עוד אין רשימות משותפות. צרו אחת, ואז הזמינו אליה מישהו לפי כתובת
            הגוגל שלו - מאותו רגע כל מה שתוסיפו יופיע גם אצלו.
          </Notice>
          <div className="mt-4">
            <PrimaryButton onClick={() => void addList()} disabled={busy}>
              רשימה משותפת חדשה
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {lists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    void haptic('light');
                    select(l.id);
                  }}
                  aria-pressed={l.id === list?.id}
                  className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-caption font-medium transition-colors ${
                    l.id === list?.id ? 'bg-brand text-white' : 'bg-surface text-muted shadow-raised'
                  }`}
                >
                  {l.name}
                  {l.memberUids.length > 1 && (
                    <span className="flex items-center gap-0.5 opacity-75">
                      <Users size={ICON.xs} strokeWidth={STROKE} />
                      {l.memberUids.length}
                    </span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void addList()}
                aria-label="רשימה חדשה"
                className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-muted shadow-raised"
              >
                <Plus size={ICON.md} strokeWidth={STROKE} />
              </button>
            </div>
            {list && (
              <button
                type="button"
                onClick={() => setManagerOpen(true)}
                aria-label="ניהול הרשימה"
                className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-muted shadow-raised"
              >
                <Settings2 size={ICON.md} strokeWidth={STROKE} />
              </button>
            )}
          </div>

          {/*
            --------------------------- קטגוריות ---------------------------
            הצ׳יפים כאן יושבים על רקע המסך ולא בתוך כרטיס, ולכן הרקע שלהם
            הוא `bg-surface` ולא `bg-well` - `bg-well` הוא באותו גוון של
            רקע המסך, וצ׳יפ שאינו נבחר היה נעלם.
          */}
          {list && list.categories.length > 0 && (
            <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
              <CategoryChip label="הכול" active={category === null} count={counts.get(null)} onClick={() => setCategory(null)} />
              {list.categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  label={c.name}
                  active={category === c.id}
                  count={counts.get(c.id)}
                  onClick={() => setCategory(c.id)}
                />
              ))}
              <CategoryChip
                label="בלי קטגוריה"
                active={category === 'none'}
                count={counts.get('none')}
                onClick={() => setCategory('none')}
              />
            </div>
          )}

          {/*
            רשימה משותפת עם חבר אחד אינה משותפת. ההזמנה ישבה עד כה רק
            מאחורי גלגל השיניים, וזו בדיוק הפעולה שצריך לעשות עכשיו -
            ולכן היא מופיעה כשורה, ונעלמת ברגע שיש עם מי לחלוק.
          */}
          {list && list.memberUids.length === 1 && (
            <button
              type="button"
              onClick={() => {
                void haptic('light');
                setManagerOpen(true);
              }}
              className="focus-ring mb-3 flex w-full items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3.5 text-right"
            >
              <UserPlus size={ICON.md} strokeWidth={STROKE} className="shrink-0 text-brand-ink" />
              <span className="min-w-0 flex-1">
                <span className="block text-label font-semibold text-brand-ink">
                  הזמינו מישהו ל״{list.name}״
                </span>
                <span className="mt-0.5 block text-caption text-brand-ink/70">
                  לפי כתובת הגוגל שלו. עד אז הרשימה היא שלכם בלבד.
                </span>
              </span>
            </button>
          )}

          {/* ---------------------------- הוספה ---------------------------- */}
          <div className="rounded-3xl bg-surface p-2.5 shadow-raised">
            <div className="field-shell flex items-center gap-2 rounded-2xl bg-well ps-4 pe-1.5">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
                placeholder={list ? `להוסיף ל״${list.name}״` : 'מה צריך לזכור?'}
                className="field-reset min-w-0 flex-1 bg-transparent py-3.5 text-body text-ink placeholder:text-faint"
              />
              <AnimatePresence initial={false}>
                {title.trim() && (
                  <motion.button
                    type="button"
                    onClick={() => void submit()}
                    disabled={busy}
                    initial={{ opacity: 0, scale: 0.6, width: 0 }}
                    animate={{ opacity: 1, scale: 1, width: 36 }}
                    exit={{ opacity: 0, scale: 0.6, width: 0 }}
                    whileTap={{ scale: 0.9 }}
                    transition={SNAP}
                    aria-label="הוספה"
                    className="focus-ring flex h-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white disabled:opacity-50"
                  >
                    <Plus size={ICON.md} strokeWidth={2.6} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ---------------------------- הרשימה ---------------------------- */}
          <div className="mt-5 space-y-5">
            {groups.some((g) => g.items.length) ? (
              groups
                .filter((g) => g.items.length)
                .map((group) => (
                  <section key={group.key}>
                    <header className="flex items-baseline gap-2.5 px-2 pb-2">
                      <h2 className="text-label font-semibold text-ink">{group.label}</h2>
                      {group.hebrew && (
                        <span className="truncate text-caption text-faint">{group.hebrew}</span>
                      )}
                    </header>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <SharedRow
                          key={item.key}
                          item={item}
                          listId={list!.id}
                          source={allItems.find((i) => i.id === item.baseId)}
                          who={
                            allItems.find((i) => i.id === item.baseId)?.createdBy === user.uid
                              ? null
                              : memberLabel(
                                  list!,
                                  allItems.find((i) => i.id === item.baseId)?.createdBy ?? '',
                                )
                          }
                          onDelete={setPendingDelete}
                          onOpen={setEditing}
                        />
                      ))}
                    </div>
                  </section>
                ))
            ) : (
              <p className="rounded-2xl border border-dashed border-hairline px-4 py-10 text-center text-body text-muted">
                {category === null
                  ? 'הרשימה ריקה. מה שתוסיפו כאן יופיע גם אצל שאר החברים.'
                  : 'אין פריטים בקטגוריה הזו.'}
              </p>
            )}
          </div>
        </>
      )}

      {list && (
        <ListManagerSheet open={managerOpen} onClose={() => setManagerOpen(false)} list={list} />
      )}

      {list && (
        <SharedItemSheet
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          list={list}
          item={editing}
        />
      )}

      <ConfirmDeleteSheet
        open={Boolean(pendingDelete && list)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          const item = pendingDelete;
          setPendingDelete(null);
          if (!item || !list) return;
          void removeItem(list.id, item.baseId);
          announce(`"${item.title}" נמחק`);
        }}
        title={pendingDelete?.title ?? ''}
        hint="הפריט יימחק אצל כל חברי הרשימה"
        note="אי אפשר לבטל"
      />
    </div>
  );
}

/* ==========================================================================
   חלקים קטנים
   ========================================================================== */

/**
 * מצב ריק, באותה שפה של הרשימה האישית: מסגרת מקווקוות ולא מלבן מלא.
 * `bg-well` נעלם כאן - רקע המסך הוא באותו גוון.
 */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-hairline px-5 py-6 text-body leading-relaxed text-muted">
      {children}
    </p>
  );
}

function CategoryChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void haptic('light');
        onClick();
      }}
      aria-pressed={active}
      className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-caption font-medium transition-colors ${
        active ? 'bg-brand text-white' : 'bg-surface text-muted shadow-raised'
      }`}
    >
      {label}
      {count ? <span className="tnum opacity-75">{count}</span> : null}
    </button>
  );
}

function SharedRow({
  item,
  listId,
  source,
  who,
  onDelete,
  onOpen,
}: {
  item: ReminderItem;
  listId: string;
  source: SharedItem | undefined;
  who: string | null;
  onDelete: (item: ReminderItem) => void;
  onOpen: (item: SharedItem) => void;
}) {
  return (
    <div
      className={`ev ev-${item.color} flex w-full items-center gap-2 rounded-2xl p-3 ${
        item.done ? 'opacity-55' : ''
      }`}
    >
      <motion.button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.done ? 'ביטול סימון כבוצע' : 'סימון כבוצע'}
        onClick={() => {
          if (!source) return;
          void haptic('light');
          void setItemDone(listId, source, item.sourceKey, !item.done);
        }}
        whileTap={{ scale: 0.88 }}
        transition={TAP}
        className={`focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          item.done ? 'ev-solid border-transparent text-white' : 'border-current opacity-45'
        }`}
      >
        {item.done && <Check size={ICON.sm} strokeWidth={3} />}
      </motion.button>

      <motion.button
        type="button"
        onClick={() => source && onOpen(source)}
        whileTap={{ scale: 0.99 }}
        transition={TAP}
        className="focus-ring min-w-0 flex-1 rounded-xl text-right"
      >
        <span
          className={`block truncate text-body font-medium leading-snug ${
            item.done ? 'line-through' : ''
          }`}
        >
          {item.title}
        </span>
        {/*
          מי הוסיף - רק כשזה לא אני. ברשימה משותפת זו העובדה שחסרה.
          בלי אייקון: כל אייקון של אדם באזור הזה נקרא כפעולה ("הוספת
          חבר") ולא כייחוס, והשם לבדו ברור יותר.
        */}
        {/*
          מתי, ומי הוסיף. התאריך הוא החדש כאן: פריט משובץ נראה אחרת
          מפריט שממתין, ובלי הכיתוב הזה שני המצבים נראים זהים ברשימה.
        */}
        <span className="mt-0.5 flex items-center gap-2 text-caption opacity-70">
          {item.time && <span className="tnum font-medium">{item.time}</span>}
          {who && <span className="truncate">{who}</span>}
        </span>
      </motion.button>

      {/*
        גם כאן הצ׳קבוקס היה הפעולה היחידה, ופריט שנוסף בטעות נשאר
        ברשימה של כולם. `removeItem` היה קיים ולא נקרא מאף מקום.
      */}
      <motion.button
        type="button"
        onClick={() => {
          void haptic('medium');
          onDelete(item);
        }}
        whileTap={{ scale: 0.88 }}
        transition={TAP}
        aria-label={`מחיקת ${item.title}`}
        className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-45 transition-opacity active:opacity-90"
      >
        <Trash2 size={ICON.sm} strokeWidth={STROKE} />
      </motion.button>
    </div>
  );
}
