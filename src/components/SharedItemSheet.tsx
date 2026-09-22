/**
 * עריכת פריט ברשימה משותפת.
 *
 * שלוש ההחלטות שהמסך הזה מגלם:
 *
 * 1. **התאריך משותף.** הוא נשמר על הפריט עצמו בענן, ולכן הוא נראה
 *    אותו דבר אצל כל החברים. זו הנקודה: "נקנה ביום חמישי" הוא מידע
 *    שכולם צריכים, ולא החלטה של אחד.
 * 2. **הנוכחות בלוח שלי היא אישית.** אותו פריט יכול להיות בלוח של
 *    אחד ולא של השני, בלי שהתאריך יזוז. ההסתרה אינה מחיקה ואינה
 *    משנה דבר אצל האחר.
 * 3. **מחיקה היא לכולם.** היא יושבת בשורה של הפריט ולא כאן, כי
 *    המרחק בינה לבין "הסתרה אצלי" חייב להיות ברור.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Clock, EyeOff, Tag, UserRound, Users } from 'lucide-react';
import type { EventColor } from '@/types';
import type { SharedItem, SharedList } from '@/lib/sharedLists';
import { isHiddenFor, memberLabel } from '@/lib/sharedLists';
import { saveItem, setItemHiddenForMe } from '@/lib/sharedSync';
import { useAuthStore } from '@/store/auth';
import { dateKey, dayTitleLabel, keyToDate } from '@/lib/dates';
import { hebrewDateParts } from '@/lib/hebrew';
import { Sheet } from './ui/Sheet';
import { PrimaryButton, Toggle } from './ui/controls';
import { ColorRow } from './ui/ColorRow';
import { DateField, SelectField, TextField, TimeField } from './ui/fields';
import { ICON, STROKE, TAP_SCALE } from '@/lib/motion';
import { announce } from '@/lib/announce';
import { haptic } from '@/lib/native';
import { isDraftDirty } from '@/lib/draftDirty';
import { ConfirmDiscardSheet } from './ConfirmDiscardSheet';

/** ברירת מחדל לשעה, כשמדליקים שעה לפריט שלא הייתה לו */
const DEFAULT_TIME = '09:00';

/** מה שהטופס מחזיק, במקום אחד - כדי שיהיה מה להשוות בסגירה */
type Form = {
  title: string;
  dated: boolean;
  date: string;
  timed: boolean;
  time: string;
  color: EventColor;
  category: string;
};

export function SharedItemSheet({
  open,
  draft = false,
  onClose,
  list,
  item,
}: {
  open: boolean;
  onClose: () => void;
  list: SharedList;
  item: SharedItem | null;
  /**
   * הפריט עדיין אינו בענן - הוא הגיע מההוספה המהירה ונשמר רק ב"שמירה".
   *
   * שני הבדלים נגזרים מזה: "להסתיר מהלוח שלי" כותבת לנתיב של מסמך
   * שאינו קיים, ולכן היא אינה מוצגת; והשאלה לפני יציאה נמדדת מול טופס
   * ריק, כי כאן *כל* מה שבטופס הוא מה שהמשתמש הקליד וטרם נשמר.
   */
  draft?: boolean;
}) {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const [title, setTitle] = useState('');
  const [dated, setDated] = useState(false);
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [timed, setTimed] = useState(false);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [color, setColor] = useState<EventColor>('violet');
  const [category, setCategory] = useState('none');
  const [busy, setBusy] = useState(false);
  /** השאלה לפני יציאה שמאבדת את מה שנערך */
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  /** הטופס כפי שנפתח, להשוואה. ראו `ConfirmDiscardSheet`. */
  const baseline = useRef<Form | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    const loaded: Form = {
      title: item.title,
      dated: !item.undated,
      date: item.date,
      timed: Boolean(item.startTime),
      time: item.startTime ?? DEFAULT_TIME,
      color: item.color,
      category: item.categoryId ?? 'none',
    };
    setTitle(loaded.title);
    setDated(loaded.dated);
    setDate(loaded.date);
    setTimed(loaded.timed);
    setTime(loaded.time);
    setColor(loaded.color);
    setCategory(loaded.category);
    setBusy(false);
    setConfirmDiscard(false);
    baseline.current = draft ? { ...loaded, title: '' } : loaded;
  }, [open, item, draft]);

  /*
    שער היציאה. `Sheet` קורא לו בכל ארבעת המוצאים, ולכן די באחד.
    השמירה אינה עוברת כאן - היא קוראת ל-`onClose` בעצמה.
  */
  const beforeClose = useCallback((): boolean => {
    const current: Form = { title, dated, date, timed, time, color, category };
    if (!baseline.current || !isDraftDirty(current, baseline.current)) return true;
    setConfirmDiscard(true);
    return false;
  }, [title, dated, date, timed, time, color, category]);

  if (!item) return null;

  const hidden = isHiddenFor(item, uid);

  const save = () => {
    const clean = title.trim();
    if (!clean) return;
    setBusy(true);
    void saveItem(list.id, {
      ...item,
      title: clean,
      color,
      categoryId: category === 'none' ? undefined : category,
      /*
        `undated` הוא דגל ולא `date: null` - בדיוק כמו בתזכורת אישית.
        התאריך נשמר גם כשהפריט חסר תאריך, וזה מה שמאפשר להחזיר אותו
        למקום שממנו הגיע במקום לנחש היום.
      */
      date: dated ? date : item.date,
      undated: dated ? undefined : true,
      allDay: !timed,
      startTime: dated && timed ? time : null,
      endTime: null,
    })
      .then(() => {
        announce(dated ? `"${clean}" שובץ ל${dayTitleLabel(keyToDate(date))}` : `"${clean}" נשמר`);
        onClose();
      })
      .finally(() => setBusy(false));
  };

  const toggleHidden = () => {
    void haptic('light');
    void setItemHiddenForMe(list.id, item.id, !hidden);
    announce(hidden ? 'הפריט יופיע בלוח שלכם' : 'הפריט לא יופיע בלוח שלכם');
  };

  const hebrew = hebrewDateParts(keyToDate(date));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      beforeClose={beforeClose}
      size="tall"
      title="פריט משותף"
      subtitle={list.name}
      footer={
        <PrimaryButton onClick={save} disabled={busy || !title.trim()}>
          {!title.trim() ? 'צריך שם לפריט' : draft ? 'הוספה לרשימה' : 'שמירה'}
        </PrimaryButton>
      }
    >
      <div className="space-y-2.5 pb-2">
        {/*
          אזהרה ראשונה ולא הערת שוליים: כל מה שנשמר כאן נראה מיד אצל
          כל חברי הרשימה, וזה ההבדל היחיד שמשנה בין המסך הזה לעריכת
          אירוע רגיל.
        */}
        <p className="flex items-start gap-2.5 rounded-2xl bg-brand-soft px-4 py-3 text-caption leading-relaxed text-brand-ink">
          <Users size={ICON.md} strokeWidth={STROKE} className="mt-0.5 shrink-0" />
          מה שתשנו כאן - כולל התאריך - יופיע אצל כל חברי "{list.name}".
        </p>

        <TextField label="שם" value={title} onChange={setTitle} placeholder="מה צריך" />

        {/*
          מי הוסיף. ברשימה שיש בה יותר מאדם אחד זו השאלה הראשונה שנשאלת
          על פריט שלא מזהים - ועד עכשיו התשובה הייתה קיימת בנתונים
          (`createdBy`) ולא מוצגת בשום מקום.

          לא מוצג בטיוטה: פריט שטרם נוסף הוסף על ידי מי שמסתכל בו.
        */}
        {!draft && item.createdBy && (
          <div className="flex items-center gap-3 rounded-2xl bg-well px-4 py-3">
            <span className="shrink-0 text-muted">
              <UserRound size={ICON.md} strokeWidth={STROKE} />
            </span>
            <span className="flex-1 text-label font-medium text-ink">נוסף על ידי</span>
            <span className="min-w-0 truncate text-label text-muted">
              {item.createdBy === uid ? 'אני' : memberLabel(list, item.createdBy)}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-2xl bg-well px-4 py-2.5">
          <span className="shrink-0 text-label font-medium text-ink">צבע</span>
          <div className="flex flex-1 justify-end">
            <ColorRow value={color} onChange={setColor} label="צבע הפריט" />
          </div>
        </div>

        {list.categories.length > 0 && (
          <SelectField
            label="קטגוריה"
            value={category}
            onChange={setCategory}
            icon={<Tag size={ICON.md} strokeWidth={STROKE} />}
            options={[
              { value: 'none', label: 'בלי קטגוריה' },
              ...list.categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        )}

        <div className="flex items-center gap-3 rounded-2xl bg-well px-4 py-2">
          <span className="shrink-0 text-muted">
            <CalendarDays size={ICON.md} strokeWidth={STROKE} />
          </span>
          <span className="flex-1 text-label font-medium text-ink">משויך ליום</span>
          <Toggle label="משויך ליום" checked={dated} onChange={setDated} />
        </div>

        {dated && (
          <>
            <DateField
              label="תאריך"
              value={date}
              onChange={setDate}
              hint={`${hebrew.day} ב${hebrew.month} ${hebrew.year}`}
              icon={<CalendarDays size={ICON.md} strokeWidth={STROKE} />}
            />

            <div className="flex items-center gap-3 rounded-2xl bg-well px-4 py-2">
              <span className="shrink-0 text-muted">
                <Clock size={ICON.md} strokeWidth={STROKE} />
              </span>
              <span className="flex-1 text-label font-medium text-ink">בשעה מסוימת</span>
              <Toggle label="בשעה מסוימת" checked={timed} onChange={setTimed} />
            </div>

            {timed && (
              <TimeField
                label="שעה"
                value={time}
                onChange={setTime}
                icon={<Clock size={ICON.md} strokeWidth={STROKE} />}
              />
            )}

            {/*
              הפעולה האישית היחידה במסך, ולכן היא מופרדת ומנוסחת בגוף
              ראשון. "אצלי בלבד" הוא כל ההבדל בינה לבין מחיקה.
            */}
            {!draft && (
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={toggleHidden}
              className={`focus-ring mt-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-right transition-colors ${
                hidden ? 'bg-brand-soft text-brand-ink' : 'bg-well text-ink'
              }`}
            >
              <EyeOff size={ICON.md} strokeWidth={STROKE} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-label font-semibold">
                  {hidden ? 'מוסתר מהלוח שלי' : 'להסתיר מהלוח שלי'}
                </span>
                <span className="mt-0.5 block text-caption opacity-75">
                  {hidden
                    ? 'הוא עדיין ברשימה, ובלוח של שאר החברים'
                    : 'לא ישנה כלום אצל שאר חברי הרשימה'}
                </span>
              </span>
            </motion.button>
            )}
          </>
        )}
      </div>

      <ConfirmDiscardSheet
        open={confirmDiscard}
        onKeepEditing={() => setConfirmDiscard(false)}
        onDiscard={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        hint={
          draft
            ? 'הפריט עוד לא נוסף לרשימה, ואיש מהחברים אינו רואה אותו'
            : 'השינויים בפריט המשותף עוד לא נשמרו, ושאר החברים לא יראו אותם'
        }
      />
    </Sheet>
  );
}
