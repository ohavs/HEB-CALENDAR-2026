/**
 * מסך התזכורות.
 *
 * תזכורת היא אירוע - ראו `src/lib/reminders.ts` להסבר למה. המסך הזה הוא
 * עדשה שנייה על אותם נתונים: הלוח מראה אותם לפי מיקומם בחודש, וכאן הם
 * מוצגים כרשימה שאפשר לסמן ולסדר.
 *
 * הגרירה עוברת דרך מנוע הגרירה של הלוח, ולא דרך מנגנון שני: כל קבוצה
 * נושאת `data-day-key`, בדיוק כמו תא בלוח, ולכן לחיצה ארוכה, הרטט,
 * הרפאים והדגשת היעד מגיעים כמו שהם. `undated` הוא "יום" לכל דבר מבחינת
 * המנוע - וזה מה שמאפשר לגרור פריט אל מחוץ ללוח ובחזרה אליו.
 */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CalendarPlus, Check, MapPin, Plus, Repeat } from 'lucide-react';
import type { DateKey, UserEvent } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { buildReminderGroups, pendingCount, type ReminderItem } from '@/lib/reminders';
import { addDays, dateKey, keyToDate, startOfDay } from '@/lib/dates';
import { useEvents, useEventsStore } from '@/store/events';
import { useSettings } from '@/store/settings';
import { useRangeData } from '@/hooks/useMonthData';
import { beginLongPress, useDragActive, useIsDropTarget } from '@/lib/dragEngine';
import { DatePickerSheet } from './ui/Picker';
import { announce } from '@/lib/announce';
import { haptic } from '@/lib/native';
import { ENTER, EXIT, GLIDE, ICON, SNAP, STROKE, TAP } from '@/lib/motion';

/** מה הכפתור מציע כברירת מחדל: היום, מחר, או בלי תאריך */
type Slot = 'none' | 'today' | 'tomorrow' | 'pick';

export function RemindersScreen({
  onEditEvent,
  composeOnMount,
  bottomInset,
}: {
  onEditEvent: (occurrence: Occurrence | UserEvent) => void;
  /** נפתח מהוידג׳ט - שדה ההקלדה ממוקד מיד */
  composeOnMount?: boolean;
  bottomInset: number;
}) {
  const events = useEvents();
  const settings = useSettings();
  const add = useEventsStore((s) => s.add);
  const setDone = useEventsStore((s) => s.setOccurrenceDone);

  const now = useMemo(() => new Date(), []);
  const range = useRangeData(startOfDay(now), addDays(now, 120));
  const groups = useMemo(
    () => buildReminderGroups(events, range.occurrences, range.days, now),
    [events, range, now],
  );
  const pending = pendingCount(groups, dateKey(now));

  const [title, setTitle] = useState('');
  const [slot, setSlot] = useState<Slot>('none');
  const [picked, setPicked] = useState<DateKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** יש מה להוסיף: רק אז נפתחות אפשרויות התאריך והכפתור */
  const composing = title.trim().length > 0;

  useEffect(() => {
    if (composeOnMount) document.getElementById('reminder-input')?.focus();
  }, [composeOnMount]);

  /** התאריך שהפריט החדש יקבל, או null כשאין לו תאריך. */
  const targetDate = (): DateKey | null => {
    if (slot === 'none') return null;
    if (slot === 'today') return dateKey(now);
    if (slot === 'tomorrow') return dateKey(addDays(now, 1));
    return picked;
  };

  const submit = () => {
    const clean = title.trim();
    if (!clean) return;
    const date = targetDate();
    add({
      title: clean,
      // התאריך נשמר גם בפריט בלי תאריך, כדי שיהיה לו לאן לחזור
      date: date ?? dateKey(now),
      startTime: null,
      endTime: null,
      allDay: true,
      color: settings.defaultEventColor,
      reminderMinutes: null,
      repeat: 'none',
      ...(date ? {} : { undated: true as const }),
    });
    setTitle('');
    void haptic('medium');
    announce(date ? 'התזכורת נוספה ליום' : 'התזכורת נוספה בלי תאריך');
  };

  return (
    <div
      className="no-scrollbar app-shell-narrow flex-1 overflow-y-auto overscroll-contain gutter-x"
      style={{ paddingBottom: bottomInset + 24 }}
    >
      <header className="safe-t pb-4 pt-5 lg:pt-8">
        <h1 className="text-heading font-semibold leading-tight text-ink">תזכורות</h1>
        <p className="mt-1 text-caption text-muted">{pendingLabel(pending)}</p>
      </header>

      {/* ------------------------------ הוספה ------------------------------ */}
      {/*
        במנוחה זו שורה אחת נקייה. אפשרויות התאריך נפתחות רק כשיש מה
        לשייך: קודם הן ישבו שם תמיד, ארבע גלולות ברוחב משתנה מתחת לשדה
        ריק, ולקחו שליש מגובה הכרטיס כדי לענות על שאלה שאיש לא שאל.
      */}
      <div className="overflow-hidden rounded-2xl bg-surface shadow-raised">
        <div className="flex items-center gap-2 ps-4 pe-2">
          <input
            id="reminder-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="מה צריך לזכור?"
            className="field-reset min-w-0 flex-1 bg-transparent py-4 text-body text-ink placeholder:text-faint"
          />
          <AnimatePresence initial={false}>
            {composing && (
              <motion.button
                type="button"
                onClick={submit}
                initial={{ opacity: 0, scale: 0.6, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 36 }}
                exit={{ opacity: 0, scale: 0.6, width: 0 }}
                whileTap={{ scale: 0.9 }}
                transition={SNAP}
                aria-label="הוספת תזכורת"
                className="focus-ring flex h-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white"
              >
                <Plus size={ICON.md} strokeWidth={2.6} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          initial={false}
          animate={{ height: composing ? 'auto' : 0, opacity: composing ? 1 : 0 }}
          transition={{ height: GLIDE, opacity: composing ? ENTER : EXIT }}
          className="overflow-hidden"
          aria-hidden={!composing}
        >
          <div className="flex items-center gap-1.5 border-t border-hairline px-2.5 py-2">
            {(
              [
                ['none', 'בלי תאריך'],
                ['today', 'היום'],
                ['tomorrow', 'מחר'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  void haptic('light');
                  setSlot(id);
                }}
                aria-pressed={slot === id}
                className={`focus-ring flex-1 whitespace-nowrap rounded-lg py-1.5 text-caption font-medium transition-colors ${
                  slot === id ? 'bg-brand text-white' : 'bg-well text-muted'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-pressed={slot === 'pick'}
              aria-label="בחירת תאריך"
              className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-caption font-medium transition-colors ${
                slot === 'pick' ? 'bg-brand text-white' : 'bg-well text-muted'
              }`}
            >
              <CalendarPlus size={ICON.xs} strokeWidth={STROKE} />
              {slot === 'pick' && picked ? relativeShort(picked) : ''}
            </button>
          </div>
        </motion.div>
      </div>

      {/* ------------------------------ הרשימה ------------------------------ */}
      <div className="mt-5 space-y-5">
        {groups.map((group) => (
          <Group
            key={group.key}
            groupKey={group.key}
            label={group.label}
            hebrew={group.hebrew}
            items={group.items}
            onToggle={(item, done) => {
              setDone(item.baseId, item.sourceKey, done);
              announce(`"${item.title}" ${done ? 'סומן כבוצע' : 'הוחזר לפתוח'}`);
            }}
            onOpen={(item) => onEditEvent(item.occurrence ?? item.event!)}
          />
        ))}

        {groups.every((g) => !g.items.length) && (
          <p className="rounded-2xl border border-dashed border-hairline px-4 py-10 text-center text-body text-muted">
            אין תזכורות. מה שתוסיפו כאן יופיע גם בוידג׳ט.
          </p>
        )}
      </div>

      <DatePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="תאריך לתזכורת"
        value={picked ?? dateKey(now)}
        onChange={(next) => {
          setPicked(next);
          setSlot('pick');
        }}
      />
    </div>
  );
}

/** מה שממתין, בשורה אחת. */
function pendingLabel({ undated, today }: { undated: number; today: number }): string {
  const parts: string[] = [];
  if (undated) parts.push(undated === 1 ? 'אחת בלי תאריך' : `${undated} בלי תאריך`);
  if (today) parts.push(today === 1 ? 'אחת להיום' : `${today} להיום`);
  return parts.length ? parts.join(' · ') : 'אין מה לסמן היום';
}

/** "20 בספטמבר" - קצר, לצ׳יפ */
function relativeShort(key: DateKey): string {
  const date = keyToDate(key);
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

/* ==========================================================================
   קבוצה
   ========================================================================== */

function Group({
  groupKey,
  label,
  hebrew,
  items,
  onToggle,
  onOpen,
}: {
  groupKey: DateKey | 'undated';
  label: string;
  hebrew: string;
  items: ReminderItem[];
  onToggle: (item: ReminderItem, done: boolean) => void;
  onOpen: (item: ReminderItem) => void;
}) {
  // אותו מנגנון של תא בלוח: המנוע מזהה יעד לפי התכונה הזו
  const isTarget = useIsDropTarget(groupKey as DateKey);
  const dragging = useDragActive();

  return (
    <section
      data-day-key={groupKey}
      className={`rounded-3xl transition-colors ${
        isTarget ? 'bg-brand-soft ring-2 ring-brand' : ''
      }`}
    >
      <header className="flex items-baseline gap-2.5 px-2 pb-2">
        <h2 className="text-label font-semibold text-ink">{label}</h2>
        {hebrew && <span className="truncate text-caption text-faint">{hebrew}</span>}
      </header>

      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <Row key={item.key} item={item} onToggle={onToggle} onOpen={onOpen} />
          ))}
        </div>
      ) : dragging ? (
        <p className="rounded-2xl border border-dashed border-hairline px-4 py-6 text-center text-caption text-faint">
          גררו לכאן תזכורת
        </p>
      ) : (
        /*
          יום ריק הוא שורה, לא מסגרת בגובה 120px. ההזמנה לגרור מופיעה רק
          כשיש מה לגרור - אחרת היא תופסת רבע מסך כדי להסביר מחווה שאיש
          לא התחיל.
        */
        <p className="px-2 pb-1 text-caption text-faint">אין תזכורות</p>
      )}
    </section>
  );
}

/* ==========================================================================
   שורה
   ========================================================================== */

function Row({
  item,
  onToggle,
  onOpen,
}: {
  item: ReminderItem;
  onToggle: (item: ReminderItem, done: boolean) => void;
  onOpen: (item: ReminderItem) => void;
}) {
  /*
    מנוע הגרירה עובד על מופע. לפריט בלי תאריך אין כזה, ולכן מרכיבים לו
    מופע מדומה: זה מה שמאפשר לגרור אותו אל הלוח באותו מסלול בדיוק.
  */
  const occurrence: Occurrence | null = item.occurrence ?? pseudoOccurrence(item);

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
          void haptic('light');
          onToggle(item, !item.done);
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
        onClick={() => onOpen(item)}
        onPointerDown={occurrence ? (e) => beginLongPress(e, occurrence) : undefined}
        whileTap={{ scale: 0.99 }}
        transition={TAP}
        className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl text-right"
      >
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-body font-medium leading-snug ${
              item.done ? 'line-through' : ''
            }`}
          >
            {item.title}
          </span>
          {(item.hasPlace || item.hasAlarm || item.repeating) && (
            <span className="mt-1 flex items-center gap-2 opacity-75">
              {item.hasPlace && <MapPin size={ICON.xs} strokeWidth={STROKE} />}
              {item.hasAlarm && <Bell size={ICON.xs} strokeWidth={STROKE} />}
              {item.repeating && <Repeat size={ICON.xs} strokeWidth={STROKE} />}
            </span>
          )}
        </span>

        {item.time && <span className="tnum shrink-0 text-caption font-semibold">{item.time}</span>}
      </motion.button>
    </div>
  );
}

/** מופע מדומה לפריט בלי תאריך, כדי שמנוע הגרירה יוכל לשאת אותו. */
function pseudoOccurrence(item: ReminderItem): Occurrence | null {
  if (!item.event) return null;
  return {
    ...item.event,
    occurrenceId: item.event.id,
    baseId: item.event.id,
    isRecurring: false,
    sourceKey: item.event.date,
    hasException: false,
    done: item.done,
    spanIndex: 0,
    spanLength: 1,
    spanStart: item.event.date,
  };
}
