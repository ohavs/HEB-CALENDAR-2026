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
 *
 * למסך שתי לשוניות פנימיות: "שלי" ו"משותף". ההפרדה מלאה בכוונה - רשימה
 * משותפת חיה בענן ולא במכשיר, יש לה חברים וקטגוריות, ולערבב אותה ברשימה
 * האישית היה מטשטש את השאלה "מי עוד רואה את זה". `SharedReminders` שם,
 * ומשתמש באותו מנוע.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  CalendarPlus,
  Check,
  Clock,
  MapPin,
  Plus,
  Repeat,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type { DateKey, EventColor, EventTemplate, UserEvent } from '@/types';
import { sortOccurrences, type Occurrence } from '@/lib/recurrence';
import { buildReminderGroups, pendingCount, type ReminderItem } from '@/lib/reminders';
import { addDays, dateKey, keyToDate, startOfDay } from '@/lib/dates';
import { useEvents, useEventsStore, type EventDraft } from '@/store/events';
import { useSettings } from '@/store/settings';
import { useRangeData } from '@/hooks/useMonthData';
import {
  beginLongPress,
  useDragActive,
  useDragStore,
  useIsDraggingOccurrence,
  useIsDropTarget,
} from '@/lib/dragEngine';
import { DatePickerSheet, TimePickerSheet } from './ui/Picker';
import { buildReminderDraft, suggestReminderTime } from '@/lib/reminderCompose';
import { announce } from '@/lib/announce';
import { haptic } from '@/lib/native';
import { ENTER, EXIT, GLIDE, ICON, SNAP, STROKE, TAP } from '@/lib/motion';
import { Segmented } from './ui/controls';
import { ColorRow } from './ui/ColorRow';
import { SharedReminders } from './SharedReminders';
import { TemplatesView } from './TemplatesView';
import { readRemindersView, writeRemindersView, type RemindersView } from '@/lib/remindersView';

/** מה הכפתור מציע כברירת מחדל: היום, מחר, או בלי תאריך */
type Slot = 'none' | 'today' | 'tomorrow' | 'pick';

export function RemindersScreen({
  onEditEvent,
  onDeleteEvent,
  onComposeMore,
  composeOnMount,
  viewOverride,
  onPlaceTemplate,
  bottomInset,
}: {
  onEditEvent: (occurrence: Occurrence | UserEvent) => void;
  /** מחיקה עם אישור. אותו מסלול שמשרת את הגרירה אל הפח. */
  onDeleteEvent: (occurrence: Occurrence) => void;
  /**
   * פתיחת העורך המלא על מה שכבר הוקלד כאן.
   *
   * ההוספה המהירה נועדה לשורה אחת, ולכן אין בה מקום, הערות וחזרה. במקום
   * להצמיח אותה לעורך שני - שהיה נפרד ממנו ברגע שהעורך ישתנה - היא
   * מוסרת את מה שיש לעורך האמיתי.
   */
  onComposeMore: (draft: EventDraft) => void;
  /** נפתח מהוידג׳ט - שדה ההקלדה ממוקד מיד */
  composeOnMount?: boolean;
  /** לשונית שנכפתה מבחוץ, למשל מוידג׳ט הרשימה המשותפת */
  viewOverride?: RemindersView | null;
  /** שיבוץ תבנית לימים שנבחרו. יושב ב-App, כדי שהודעת הביטול תהיה אחת */
  onPlaceTemplate: (template: EventTemplate, dates: DateKey[]) => void;
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

  const [view, setView] = useState<RemindersView>(readRemindersView);
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<EventColor>(settings.defaultEventColor);
  const [slot, setSlot] = useState<Slot>('none');
  const [picked, setPicked] = useState<DateKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** השעה שנבחרה, או null ל"כל היום" */
  const [time, setTime] = useState<string | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  /** יש מה להוסיף: רק אז נפתחות אפשרויות התאריך והכפתור */
  const composing = title.trim().length > 0;

  useEffect(() => {
    // הוידג׳ט מוסיף לרשימה האישית, ולכן הוא גם מחזיר אליה
    if (!composeOnMount) return;
    setView('mine');
    document.getElementById('reminder-input')?.focus();
  }, [composeOnMount]);

  /*
    לשונית שנכפתה מבחוץ אינה נשמרת כהעדפה: וידג׳ט שפתח את המשותף פעם
    אחת לא אמור לשנות את מה שהמשתמש בחר בעצמו.
  */
  useEffect(() => {
    if (viewOverride) setView(viewOverride);
  }, [viewOverride]);

  /** התאריך שהפריט החדש יקבל, או null כשאין לו תאריך. */
  const targetDate = (): DateKey | null => {
    if (slot === 'none') return null;
    if (slot === 'today') return dateKey(now);
    if (slot === 'tomorrow') return dateKey(addDays(now, 1));
    return picked;
  };

  /**
   * מעבר בין ימים.
   *
   * יום שנבחר מקבל שעה מיד, כי תזכורת לשעה מסוימת היא המקרה הרגיל -
   * וקודם כל תזכורת נולדה "כל היום" והמשתמש היה צריך לפתוח את העורך
   * ולכבות מתג כדי לקבוע שעה. "בלי תאריך" מאפס אותה: שעה בלי יום אינה
   * שעה. הבחירה הידנית גוברת - מרגע שנקבעה שעה היא אינה נדרסת במעבר בין
   * "היום" ל"מחר".
   */
  const chooseSlot = (next: Slot, date: DateKey | null) => {
    setSlot(next);
    if (next === 'none') {
      setTime(null);
      return;
    }
    if (time === null) setTime(suggestReminderTime(now, date === dateKey(now)));
  };

  /** מה שנשמר, לפי הכללים ב-`reminderCompose` - ולא לפי מה שהמסך זוכר */
  const draftOf = (): EventDraft | null => {
    const clean = title.trim();
    if (!clean) return null;
    return buildReminderDraft({ title: clean, color, date: targetDate(), time, now });
  };

  /** אחרי הוספה או מסירה לעורך: השורה חוזרת נקייה */
  const resetCompose = () => {
    setTitle('');
    setColor(settings.defaultEventColor);
    setSlot('none');
    setTime(null);
  };

  const submit = () => {
    const draft = draftOf();
    if (!draft) return;
    add(draft);
    resetCompose();
    void haptic('medium');
    announce(
      draft.undated
        ? 'התזכורת נוספה בלי תאריך'
        : draft.startTime
          ? `התזכורת נוספה ל-${draft.startTime}`
          : 'התזכורת נוספה ליום',
    );
  };

  /** מוסר לעורך המלא את מה שכבר הוקלד, בלי לשמור קודם */
  const openMore = () => {
    const draft = draftOf();
    if (!draft) return;
    resetCompose();
    void haptic('light');
    onComposeMore(draft);
  };

  return (
    <div
      // המנוע גולל את הרשימה כשגוררים אל הקצה שלה - בלי זה אפשר היה
      // להפיל רק על יום שגלוי כרגע, והגלילה חסומה ממילא בזמן גרירה
      data-drag-scroll
      className="no-scrollbar app-shell-narrow flex-1 overflow-y-auto overscroll-contain gutter-x"
      style={{ paddingBottom: bottomInset + 24 }}
    >
      <header className="safe-t pb-4 pt-5 lg:pt-8">
        <h1 className="text-heading font-semibold leading-tight text-ink">תזכורות</h1>
        {view === 'mine' && (
          <p className="mt-1 text-caption text-muted">{pendingLabel(pending)}</p>
        )}
      </header>

      {/*
        הכרטיס אינו קישוט: `Segmented` מצייר את המסילה שלו ב-`bg-well`,
        וברקע המסך - שהוא באותו גוון - היא נעלמת, והאפשרות שלא נבחרה
        נראית כמו טקסט מרחף. על `bg-surface` המסילה חוזרת להיראות.
      */}
      <div className="mb-4 rounded-3xl bg-surface p-1.5 shadow-raised">
        <Segmented
          value={view}
          onChange={(next) => {
            setView(next);
            writeRemindersView(next);
            announce(
              next === 'mine'
                ? 'התזכורות שלי'
                : next === 'shared'
                  ? 'תזכורות משותפות'
                  : 'תבניות',
            );
          }}
          options={[
            { value: 'mine', label: 'שלי' },
            { value: 'shared', label: 'משותף' },
            { value: 'templates', label: 'תבניות' },
          ]}
        />
      </div>

      {view === 'shared' ? (
        <SharedReminders bottomInset={bottomInset} />
      ) : view === 'templates' ? (
        <TemplatesView bottomInset={bottomInset} onPlace={onPlaceTemplate} />
      ) : (
        <>

      {/* ------------------------------ הוספה ------------------------------ */}
      {/*
        במנוחה זו שורה אחת נקייה. אפשרויות התאריך נפתחות רק כשיש מה
        לשייך: קודם הן ישבו שם תמיד, ארבע גלולות ברוחב משתנה מתחת לשדה
        ריק, ולקחו שליש מגובה הכרטיס כדי לענות על שאלה שאיש לא שאל.
      */}
      <div className="rounded-3xl bg-surface p-2.5 shadow-raised">
        {/*
          אותה שפה של שאר השדות באפליקציה: מגרעת `bg-well` שמצייר אותה
          ה-wrapper, וטבעת המיקוד עליו. ה-outline של ה-input עצמו נכבה -
          בתוך כרטיס עם פינות הוא נחתך לשני פסים אנכיים בקצוות, ונראה
          כמו מסגרת שבורה.
        */}
        <div className="field-shell flex items-center gap-2 rounded-2xl bg-well ps-4 pe-1.5">
          <input
            id="reminder-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="מה צריך לזכור?"
            className="field-reset min-w-0 flex-1 bg-transparent py-3.5 text-body text-ink placeholder:text-faint"
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
          {/*
            הצבע נבחר כאן ולא רק בעורך: תזכורת עם תאריך מופיעה על הלוח,
            ובלי בחירה כל התזכורות היו מקבלות את אותו צבע ברירת מחדל -
            כלומר הלוח היה חד-גוני בדיוק במקום שבו צבע הוא המידע.
          */}
          <div className="flex items-center justify-between gap-2 px-0.5 pt-2">
            <ColorRow value={color} onChange={setColor} label="צבע התזכורת" />
          </div>

          {/*
            אין כאן "בלי תאריך": זו ברירת המחדל ממילא, וצ׳יפ שמסמן את
            מצב המנוחה תפס רבע מהשורה כדי לומר מה שכבר נכון. במקומו יושב
            המוצא לעורך המלא. ההקשה על הצ׳יפ הנבחר מבטלת אותו וחוזרת
            לבלי תאריך - בלעדיה לא הייתה שום דרך לחזור.
          */}
          <div className="flex items-center gap-1.5 px-0.5 pt-2">
            {(
              [
                ['today', 'היום'],
                ['tomorrow', 'מחר'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  void haptic('light');
                  if (slot === id) {
                    chooseSlot('none', null);
                    return;
                  }
                  chooseSlot(id, id === 'today' ? dateKey(now) : dateKey(addDays(now, 1)));
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
              onClick={() => {
                void haptic('light');
                if (slot === 'pick') {
                  chooseSlot('none', null);
                  return;
                }
                setPickerOpen(true);
              }}
              aria-pressed={slot === 'pick'}
              aria-label={slot === 'pick' ? 'ביטול התאריך' : 'בחירת תאריך'}
              className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-caption font-medium transition-colors ${
                slot === 'pick' ? 'bg-brand text-white' : 'bg-well text-muted'
              }`}
            >
              <CalendarPlus size={ICON.xs} strokeWidth={STROKE} />
              {slot === 'pick' && picked ? relativeShort(picked) : ''}
            </button>

            {/*
              המוצא לעורך המלא. ההוספה כאן היא שורה אחת, ומה שדורש מקום,
              הערות, חזרה או התראה מוקדמת ממשיך לשם עם מה שכבר הוקלד.
            */}
            <button
              type="button"
              onClick={openMore}
              className="focus-ring flex shrink-0 items-center gap-1.5 rounded-lg bg-well px-2.5 py-1.5 text-caption font-medium text-muted"
            >
              <SlidersHorizontal size={ICON.xs} strokeWidth={STROKE} />
              עוד
            </button>
          </div>

          {/*
            שורת השעה מופיעה רק כשיש יום לתלות אותה בו. "בלי תאריך" עם
            שעה הוא סתירה, ולהראות שם שדה מעומעם זה להזמין ניסיון. ללא
            יום היא נסגרת לגמרי, ולא משאירה שורה ריקה מתחת לצ׳יפים.
          */}
          {slot !== 'none' && (
            <div className="flex items-center gap-1.5 px-0.5 pb-0.5 pt-1.5">
              <div
                className={`flex items-center overflow-hidden rounded-lg ${
                  time ? 'bg-brand text-white' : 'bg-well text-muted'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    void haptic('light');
                    if (time) setTimeOpen(true);
                    else setTime(suggestReminderTime(now, targetDate() === dateKey(now)));
                  }}
                  className="focus-ring flex items-center gap-1.5 py-1.5 ps-2.5 pe-2 text-caption font-medium"
                >
                  <Clock size={ICON.xs} strokeWidth={STROKE} />
                  {time ?? 'כל היום'}
                </button>
                {/* ניקוי חוזר ל"כל היום" - בלי זה אי אפשר היה לוותר על השעה */}
                {time && (
                  <button
                    type="button"
                    onClick={() => {
                      void haptic('light');
                      setTime(null);
                    }}
                    aria-label="בלי שעה"
                    className="focus-ring py-1.5 pe-2.5 ps-1"
                  >
                    <X size={ICON.xs} strokeWidth={2.6} />
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ------------------------------ הרשימה ------------------------------ */}
      <div className="mt-5 space-y-5">
        {/* כשאין כלום, מצב ריק אחד - לא כותרת יום עם "אין תזכורות" ומתחתיה עוד אחד */}
        {groups.some((g) => g.items.length) &&
          groups.map((group) => (
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
              onDelete={(item) => {
                const occ = item.occurrence ?? pseudoOccurrence(item);
                if (occ) onDeleteEvent(occ);
              }}
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
          chooseSlot('pick', next);
        }}
      />

      <TimePickerSheet
        open={timeOpen}
        onClose={() => setTimeOpen(false)}
        title="שעה לתזכורת"
        value={time ?? suggestReminderTime(now, targetDate() === dateKey(now))}
        onChange={setTime}
      />
        </>
      )}
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

/**
 * באיזה מקום בקבוצה הפריט הנגרר ייכנס.
 *
 * זה לא מקום האצבע אלא המקום האמיתי: לתזכורות אין סדר ידני, והן ממוינות
 * באותו `sortOccurrences` של הלוח - אירוע של כל היום קודם, אחר כך לפי
 * שעה. תצוגה מקדימה שהולכת אחרי האצבע הייתה משקרת, כי מיד אחרי השחרור
 * הפריט היה קופץ למקום אחר.
 */
function previewIndex(
  items: ReminderItem[],
  dragged: Occurrence,
  groupKey: DateKey | 'undated',
): number {
  if (groupKey === 'undated') {
    // הקבוצה חסרת התאריך ממוינת מהחדש לישן
    const i = items.findIndex((it) => (it.event?.createdAt ?? 0) < dragged.createdAt);
    return i === -1 ? items.length : i;
  }
  const i = items.findIndex((it) => it.occurrence && sortOccurrences(dragged, it.occurrence) < 0);
  return i === -1 ? items.length : i;
}

/** השורה שמראה לאן זה נוחת. אפורה ומקווקוות - מקום פנוי, לא פריט. */
function PreviewRow({ title }: { title: string }) {
  return (
    <div className="animate-fade-in flex w-full items-center gap-2 rounded-2xl border-2 border-dashed border-muted/40 p-3">
      <span className="h-8 w-8 shrink-0 rounded-full border-2 border-muted/30" />
      <span className="min-w-0 flex-1 truncate text-body font-medium text-muted/80">{title}</span>
    </div>
  );
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
  onDelete,
}: {
  groupKey: DateKey | 'undated';
  label: string;
  hebrew: string;
  items: ReminderItem[];
  onToggle: (item: ReminderItem, done: boolean) => void;
  onOpen: (item: ReminderItem) => void;
  onDelete: (item: ReminderItem) => void;
}) {
  // אותו מנגנון של תא בלוח: המנוע מזהה יעד לפי התכונה הזו
  const isTarget = useIsDropTarget(groupKey as DateKey);
  const dragging = useDragActive();
  const dragged = useDragStore((s) => s.occurrence);
  const fromKey = useDragStore((s) => s.fromKey);
  /* לא מציגים תצוגה מקדימה בקבוצה שממנה הפריט יצא - שם הוא כבר קיים */
  const preview = isTarget && dragged && fromKey !== groupKey ? dragged : null;
  const at = preview ? previewIndex(items, preview, groupKey) : -1;

  return (
    /*
      אזור ההשלכה הוא רשימת הפריטים בלבד, והכותרת נשארת מעליו.
      קודם המסגרת עטפה את שתיהן, והתאריך נראה כאילו הוא נדחס לתוך
      המלבן יחד עם התזכורת שנגררת.

      ה-data-day-key נשאר על ה-section כולו, כך ששחרור מעל הכותרת עדיין
      נתפס: שטח הפגיעה רחב מהסימון הוויזואלי, וזה בדיוק מה שרוצים.
    */
    <section data-day-key={groupKey}>
      <header className="flex items-baseline gap-2.5 px-2 pb-2">
        <h2 className="text-label font-semibold text-ink">{label}</h2>
        {hebrew && <span className="truncate text-caption text-faint">{hebrew}</span>}
      </header>

      {items.length || preview ? (
        <div
          // שוליים שליליים כנגד הריפוד: המסגרת מקיפה את השורות מבחוץ
          // בלי להזיז אותן כשהיא מופיעה
          className={`-mx-1.5 space-y-2 rounded-2xl p-1.5 transition-colors ${
            isTarget ? 'bg-brand-soft ring-2 ring-brand' : ''
          }`}
        >
          {items.map((item, i) => (
            <Fragment key={item.key}>
              {i === at && preview && <PreviewRow title={preview.title} />}
              <Row item={item} onToggle={onToggle} onOpen={onOpen} onDelete={onDelete} />
            </Fragment>
          ))}
          {preview && at >= items.length && <PreviewRow title={preview.title} />}
        </div>
      ) : dragging ? (
        <p
          className={`-mx-1.5 rounded-2xl border border-dashed px-4 py-6 text-center text-caption transition-colors ${
            isTarget
              ? 'border-brand bg-brand-soft text-brand-ink'
              : 'border-hairline text-faint'
          }`}
        >
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
  onDelete,
}: {
  item: ReminderItem;
  onToggle: (item: ReminderItem, done: boolean) => void;
  onOpen: (item: ReminderItem) => void;
  onDelete: (item: ReminderItem) => void;
}) {
  /*
    מנוע הגרירה עובד על מופע. לפריט בלי תאריך אין כזה, ולכן מרכיבים לו
    מופע מדומה: זה מה שמאפשר לגרור אותו אל הלוח באותו מסלול בדיוק.
  */
  const occurrence: Occurrence | null = item.occurrence ?? pseudoOccurrence(item);
  /*
    השורה נשארת במקומה כרפאים חיוורים כל עוד היא נגררת. בלעדיה נראו שתי
    תזכורות בו־זמנית - המקור בעוצמה מלאה והצל מעליו - וזה נקרא כאילו
    אחת נדחסת לתוך השנייה.
  */
  const dragging = useIsDraggingOccurrence(occurrence?.occurrenceId ?? '');

  return (
    <div
      className={`ev ev-${item.color} flex w-full items-center gap-2 rounded-2xl p-3 transition-opacity ${
        item.done ? 'opacity-55' : ''
      } ${dragging ? 'opacity-25' : ''}`}
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

      {/*
        מחיקה מהשורה עצמה.

        קודם היא הייתה קיימת רק בשני מקומות שצריך לגלות: פתיחת העורך,
        וגרירה אל הפח. הצ׳קבוקס היה הפעולה היחידה שנראית, ולכן המסך
        אמר "אפשר רק לסמן שבוצע". סימון ומחיקה אינם אותו דבר - פריט
        שבוצע הוא רשומה, פריט שנמחק הוא טעות.

        אותו מסלול אישור בדיוק כמו הגרירה אל הפח, מאותו מקור: מופע
        בסדרה חוזרת נשאל "מה למחוק", וכל השאר נשאל פעם אחת.
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
