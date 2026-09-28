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
import { Plus, Tag } from 'lucide-react';
import type { DateKey, EventColor, EventTemplate, UserEvent } from '@/types';
import { sortOccurrences, type Occurrence } from '@/lib/recurrence';
import {
  buildReminderGroups,
  pendingCount,
  type ReminderGroup,
  type ReminderItem,
} from '@/lib/reminders';
import { NO_CATEGORY, sectionByCategory } from '@/lib/reminderSections';
import { countByCategory, type CategoryFilter } from '@/lib/sharedLists';
import { addDays, dateKey, startOfDay } from '@/lib/dates';
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
import { buildReminderDraft } from '@/lib/reminderCompose';
import { ComposeRow, useComposeRow } from './ui/ComposeRow';
import { announce } from '@/lib/announce';
import { haptic } from '@/lib/native';
import { ENTER, EXIT, GLIDE, ICON, SNAP, STROKE } from '@/lib/motion';
import { Segmented } from './ui/controls';
import { SharedReminders } from './SharedReminders';
import { TemplatesView } from './TemplatesView';
import { ReminderCategoriesSheet } from './ReminderCategoriesSheet';
import { CategoryChip, CategorySection, ReminderRow } from './ui/ReminderParts';
import { readRemindersView, writeRemindersView, type RemindersView } from '@/lib/remindersView';

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

  /*
    קטגוריות. אותו מודל של הרשימה המשותפת - `{ id, name }` ו-`categoryId`
    על הפריט - ולכן גם אותה חלוקה ואותם צ׳יפים. מזהה של קטגוריה שנמחקה
    נקרא כ"בלי קטגוריה", כדי שהפריט לא ייעלם יחד איתה.
  */
  const categories = settings.reminderCategories;
  const known = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const [category, setCategory] = useState<CategoryFilter>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const activeCategory = category && category !== NO_CATEGORY && !known.has(category) ? null : category;
  const categoryOf = (id: string | undefined) => (id && known.has(id) ? id : NO_CATEGORY);

  const counts = useMemo(
    () =>
      countByCategory(
        events.map((e) => (e.categoryId && !known.has(e.categoryId) ? { ...e, categoryId: undefined } : e)),
        dateKey(now),
      ),
    [events, known, now],
  );

  const visibleGroups = useMemo<ReminderGroup[]>(
    () =>
      activeCategory === null
        ? groups
        : groups.map((g) => ({
            ...g,
            items: g.items.filter((it) => categoryOf(it.categoryId) === activeCategory),
          })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, activeCategory, known],
  );

  /** "הכול" עם קטגוריות מתחלק לפיהן; קטגוריה אחת היא רשימה אחת */
  const sections = useMemo(
    () => (activeCategory === null && categories.length ? sectionByCategory(groups, categories) : null),
    [activeCategory, categories, groups],
  );

  const [view, setView] = useState<RemindersView>(readRemindersView);
  const [title, setTitle] = useState('');
  /*
    הצבע אינו נבחר כאן יותר: שורת הצבעים לקחה שורה שלמה בשביל בחירה
    שממילא יושבת ב"עוד". הוא עדיין נוסע בטיוטה, ומי שרוצה אחר בוחר שם.
  */
  const [color, setColor] = useState<EventColor>(settings.defaultEventColor);
  const compose = useComposeRow(now);
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

  /** מה שנשמר, לפי הכללים ב-`reminderCompose` - ולא לפי מה שהמסך זוכר */
  const draftOf = (): EventDraft | null => {
    const clean = title.trim();
    if (!clean) return null;
    const draft = buildReminderDraft({
      title: clean,
      color,
      date: compose.targetDate,
      time: compose.time,
      now,
    });
    // מה שנוסף בזמן שקטגוריה פתוחה שייך לה - אחרת הוא היה נעלם מהמסך מיד
    return activeCategory && activeCategory !== NO_CATEGORY
      ? { ...draft, categoryId: activeCategory }
      : draft;
  };

  /** אחרי הוספה או מסירה לעורך: השורה חוזרת נקייה */
  const resetCompose = () => {
    setTitle('');
    setColor(settings.defaultEventColor);
    compose.reset();
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

  const toggle = (item: ReminderItem, done: boolean) => {
    setDone(item.baseId, item.sourceKey, done);
    announce(`"${item.title}" ${done ? 'סומן כבוצע' : 'הוחזר לפתוח'}`);
  };
  const open = (item: ReminderItem) => onEditEvent(item.occurrence ?? item.event!);
  const remove = (item: ReminderItem) => {
    const occ = item.occurrence ?? pseudoOccurrence(item);
    if (occ) onDeleteEvent(occ);
  };

  return (
    <div
      // המנוע גולל את הרשימה כשגוררים אל הקצה שלה - בלי זה אפשר היה
      // להפיל רק על יום שגלוי כרגע, והגלילה חסומה ממילא בזמן גרירה
      data-drag-scroll
      className="no-scrollbar app-shell-narrow flex-1 overflow-y-auto overscroll-contain gutter-x"
      style={{ paddingBottom: bottomInset + 24 }}
    >
      <header className="safe-t flex items-start gap-3 pb-4 pt-5 lg:pt-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-heading font-semibold leading-tight text-ink">תזכורות</h1>
          {view === 'mine' && (
            <p className="mt-1 text-caption text-muted">{pendingLabel(pending)}</p>
          )}
        </div>
        {view === 'mine' && (
          <button
            type="button"
            onClick={() => setCategoriesOpen(true)}
            aria-label="קטגוריות"
            className="focus-ring mt-1 flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-surface px-3 text-caption font-medium text-muted shadow-raised"
          >
            <Tag size={ICON.sm} strokeWidth={STROKE} />
            קטגוריות
          </button>
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

      {/*
        הצ׳יפים באותה צורה של הרשימה המשותפת: "הכול", כל קטגוריה, ו"בלי
        קטגוריה", עם מונה של מה שפתוח. מוצגים רק כשיש קטגוריות.
      */}
      {categories.length > 0 && (
        <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto rounded-3xl bg-surface px-2.5 py-2.5 shadow-raised">
          <CategoryChip
            label="הכול"
            active={activeCategory === null}
            count={counts.get(null)}
            onClick={() => setCategory(null)}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.name}
              active={activeCategory === c.id}
              count={counts.get(c.id)}
              onClick={() => setCategory(c.id)}
            />
          ))}
          <CategoryChip
            label="בלי קטגוריה"
            active={activeCategory === NO_CATEGORY}
            count={counts.get(NO_CATEGORY)}
            onClick={() => setCategory(NO_CATEGORY)}
          />
        </div>
      )}

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
          <ComposeRow state={compose} now={now} onMore={openMore} />
        </motion.div>
      </div>

      {/* ------------------------------ הרשימה ------------------------------ */}
      <div className="mt-5 space-y-5">
        {sections ? (
          sections.map((section) => (
            <CategorySection
              key={section.id}
              collapseId={`reminders:mine:${section.id}`}
              name={section.name}
              open={section.open}
            >
              {section.groups.map((group) => (
                <Group
                  key={group.key}
                  groupKey={group.key}
                  label={group.label}
                  hebrew={group.hebrew}
                  items={group.items}
                  sectionId={section.id}
                  categoryOf={categoryOf}
                  onToggle={toggle}
                  onOpen={open}
                  onDelete={remove}
                />
              ))}
            </CategorySection>
          ))
        ) : (
          // כשאין כלום, מצב ריק אחד - לא כותרת יום עם "אין תזכורות" ומתחתיה עוד אחד
          visibleGroups.some((g) => g.items.length) &&
          visibleGroups.map((group) => (
            <Group
              key={group.key}
              groupKey={group.key}
              label={group.label}
              hebrew={group.hebrew}
              items={group.items}
              onToggle={toggle}
              onOpen={open}
              onDelete={remove}
            />
          ))
        )}

        {(sections ? !sections.length : visibleGroups.every((g) => !g.items.length)) && (
          <p className="rounded-2xl border border-dashed border-hairline px-4 py-10 text-center text-body text-muted">
            {activeCategory === null
              ? 'אין תזכורות. מה שתוסיפו כאן יופיע גם בוידג׳ט.'
              : 'אין תזכורות בקטגוריה הזו.'}
          </p>
        )}
      </div>

      <ReminderCategoriesSheet open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
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
  sectionId,
  categoryOf,
  onToggle,
  onOpen,
  onDelete,
}: {
  groupKey: DateKey | 'undated';
  label: string;
  hebrew: string;
  items: ReminderItem[];
  /**
   * הקטגוריה שהקבוצה יושבת בה, כשהרשימה מחולקת. אותו יום מופיע אז בכמה
   * קטגוריות, והתצוגה המקדימה של גרירה צריכה להופיע רק באחת - זו של
   * הפריט הנגרר, כי הגרירה מזיזה יום ולא קטגוריה.
   */
  sectionId?: string;
  categoryOf?: (id: string | undefined) => string;
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
  const inSection = !sectionId || !dragged || categoryOf?.(dragged.categoryId) === sectionId;
  const preview = isTarget && inSection && dragged && fromKey !== groupKey ? dragged : null;
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
  const dragging = useIsDraggingOccurrence(occurrence?.occurrenceId ?? '');

  return (
    <ReminderRow
      item={item}
      onToggle={(done) => onToggle(item, done)}
      onOpen={() => onOpen(item)}
      onDelete={() => onDelete(item)}
      onPointerDown={occurrence ? (e) => beginLongPress(e, occurrence) : undefined}
      dragging={dragging}
    />
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
