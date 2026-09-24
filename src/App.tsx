/** שורש האפליקציה - מחבר את המסכים, החלוניות, הסנכרון והתזכורות. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import type { DateKey, EventTemplate, UserEvent } from '@/types';
import { eventsOnDay, expandEvents, type Occurrence } from '@/lib/recurrence';
import { sweepDone } from '@/lib/reminders';
import {
  addDays,
  addMonths,
  dateKey,
  dayTitleLabel,
  keyToDate,
  startOfDay,
  GREG_MONTHS_HE,
} from '@/lib/dates';
import { setDragCallbacks } from '@/lib/dragEngine';
import { availableViews, nextView } from '@/lib/calendarViews';
import { TEMPLATE_DRAG_PREFIX } from '@/components/TemplateStrip';
import { templateToEvent } from '@/lib/templates';
import {
  askServiceWorkerToFlush,
  notifyNow,
  refreshNativePermission,
  syncReminders,
} from '@/lib/notifications';
import { FENCE_HORIZON_DAYS, buildFences, startGeofenceWatch } from '@/lib/geofence';
import type { RemindersView } from '@/lib/remindersView';
import { setCustomCity } from '@/lib/locations';
import { initAnalytics } from '@/lib/firebase';
import { startSync } from '@/lib/sync';
import { saveItem as saveSharedItem, startShared, stopShared } from '@/lib/sharedSync';
import { syncPushToken } from '@/lib/pushTokens';
import { onPushOpened } from '@/lib/native';
import { useEvents, useEventsStore, type EventDraft } from '@/store/events';
import { applyTheme, useSettings, useSettingsStore } from '@/store/settings';
import {
  haptic,
  initNative,
  isNative,
  paintNativeChrome,
  syncNativeGeofences,
} from '@/lib/native';
import {
  checkForUpdate,
  dismissUpdate,
  isDismissed,
  notifyBundleReady,
  type UpdateInfo,
} from '@/lib/appUpdate';
import { UpdateSheet } from '@/components/UpdateSheet';
import { WelcomeSheet, markWelcomeSeen, welcomeSeen } from '@/components/WelcomeSheet';
import { useAuthStore, wasSignedIn } from '@/store/auth';
import { useSharedStore } from '@/store/shared';
import { useDayData } from '@/hooks/useMonthData';
import { useWidgets } from '@/hooks/useWidgets';
import { CalendarScreen } from '@/components/CalendarScreen';
import { VIEW_LABEL } from '@/components/CalendarHeader';
import type { PanelDetent } from '@/components/EventsPanel';
import { RemindersScreen } from '@/components/RemindersScreen';
import { ShabbatScreen } from '@/components/ShabbatScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { TabBar, TAB_BAR_HEIGHT, type TabId } from '@/components/TabBar';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { DayView } from '@/components/DayView';
import { EventEditor } from '@/components/EventEditor';
import { CityPicker } from '@/components/CityPicker';
import { SearchSheet } from '@/components/SearchSheet';
import { YearPicker } from '@/components/YearPicker';
import { DragLayer } from '@/components/DragLayer';
import { Toaster, toast } from '@/components/Toast';
import { announce, setAnnouncer } from '@/lib/announce';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { consumeLaunch, parseExternalUrl } from '@/lib/launchParams';
import { ScopeSheet, type EditScope } from '@/components/ScopeSheet';
import { ConfirmDeleteSheet } from '@/components/ConfirmDeleteSheet';
import { SharedItemSheet } from '@/components/SharedItemSheet';
import { useFindShared, type SharedTarget } from '@/hooks/useOccurrenceActions';
import { ConflictSheet } from '@/components/ConflictSheet';

const REMINDER_DEBOUNCE_MS = 700;

type EditorState = {
  open: boolean;
  date: DateKey;
  editing: Occurrence | UserEvent | null;
  /** שעת פתיחה לאירוע חדש, כשההקשה כבר אמרה אותה (תא בתצוגת שבוע) */
  startTime?: string;
  /** טיוטה שהגיעה מההוספה המהירה במסך התזכורות */
  prefill?: EventDraft | null;
};

export default function App() {
  const settings = useSettings();
  const events = useEvents();
  const move = useEventsStore((s) => s.move);
  const moveOccurrence = useEventsStore((s) => s.moveOccurrence);
  const authUser = useAuthStore((s) => s.user);
  /*
    לתצוגה בלבד: הזהות האחרונה שנראתה, עד ש-Firebase מאשר. ראו `profile`
    ב-store/auth - כל מה שמדבר עם הענן ממשיך לקרוא את `authUser`.
  */
  const shownUser = useAuthStore((s) => s.user ?? s.profile);
  const initAuth = useAuthStore((s) => s.init);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [tab, setTab] = useState<TabId>('calendar');
  const [monthState, setMonthState] = useState(() => ({
    month: new Date(today.getFullYear(), today.getMonth(), 1),
    direction: 0,
  }));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [panelDetent, setPanelDetent] = useState<PanelDetent>('peek');

  const [dayViewDate, setDayViewDate] = useState<Date | null>(null);
  const [editor, setEditor] = useState<EditorState>({
    open: false,
    date: dateKey(today),
    editing: null,
  });
  const [cityOpen, setCityOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  /** גרירה של מופע בסדרה חוזרת, שממתינה לתשובה על היקף ההזזה */
  const [pendingDrop, setPendingDrop] = useState<{ occurrence: Occurrence; to: DateKey } | null>(
    null,
  );
  /** אירוע שנגרר אל הפח וממתין לאישור המחיקה */
  const [pendingTrash, setPendingTrash] = useState<Occurrence | null>(null);
  /**
   * פריט משותף שנפתח מתוך הלוח.
   *
   * אותו גיליון של מסך הרשימות, כי זו אותה ישות: מה שנערך כאן נכתב
   * לענן ונראה אצל כל החברים. העורך האישי אינו יכול לשמש כאן - הוא
   * כותב לחנות המקומית, ושם הפריט הזה אינו קיים.
   */
  const [sharedEditing, setSharedEditing] = useState<SharedTarget | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [yearValue, setYearValue] = useState(today.getFullYear());

  const dayData = useDayData(dayViewDate);
  const isDesktop = useIsDesktop();

  // הוידג׳טים במסך הבית, ומה שנעשה בהם בזמן שהאפליקציה הייתה סגורה
  useWidgets();

  /* ------------------------------ ערכת נושא ------------------------------ */
  useEffect(() => {
    applyTheme(settings.theme);
    // באנדרואיד גם שורת הסטטוס צריכה להתהפך, אחרת היא נשארת בהירה על כהה
    void paintNativeChrome(document.documentElement.classList.contains('dark'));
  }, [settings.theme]);

  /* --------------------------- מסך פתיחה --------------------------- */
  /*
    נשאל פעם אחת, ורק למי שעוד לא התחבר: בלי חשבון כל הלוח חי באחסון
    שאנדרואיד רשאי למחוק. ההשהיה קצרה בכוונה - שהאפליקציה תצייר קודם,
    ולא תיפתח על גיליון.
  */
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    if (welcomeSeen() || wasSignedIn()) return;
    const timer = setTimeout(() => setWelcome(true), 900);
    return () => clearTimeout(timer);
  }, []);

  const closeWelcome = useCallback(() => {
    markWelcomeSeen();
    setWelcome(false);
  }, []);

  // התחברות מוצלחת סוגרת את המסך מעצמה
  useEffect(() => {
    if (authUser && welcome) closeWelcome();
  }, [authUser, welcome, closeWelcome]);

  /* -------------------------- אתחול נייטיבי -------------------------- */
  // מצב ההרשאה באנדרואיד נקרא אסינכרונית; הדגל הזה מרנדר מחדש אחרי שהוא ידוע
  const [, setNativeReady] = useState(false);
  useEffect(() => {
    if (!isNative()) return;
    void (async () => {
      // קודם כול: מאשרים שהחבילה הזו עלתה. חבילה שלא מדווחת בזמן
      // מתגלגלת אחורה לבד, וזו רשת הביטחון של העדכון החי.
      await notifyBundleReady();
      await refreshNativePermission();
      await initNative(document.documentElement.classList.contains('dark'));
      setNativeReady(true);
    })();
  }, []);

  /* ------------------------------ עדכון גרסה ------------------------------ */
  // האפליקציה אינה בחנות, ולכן היא מודיעה על גרסה חדשה בעצמה
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    if (!isNative()) return;
    const look = () =>
      void checkForUpdate().then((result) => {
        // בדיקה אוטומטית שנכשלה אינה אירוע - היא תרוץ שוב בפעם הבאה
        if (result.kind !== 'update') return;
        if (!isDismissed(result.update.versionCode)) setUpdate(result.update);
      });
    // לא ברגע העלייה: קודם שהאפליקציה תיפתח ותצייר
    const timer = setTimeout(look, 4000);
    const onVisible = () => document.visibilityState === 'visible' && look();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  /* -------------------------- התחברות וסנכרון -------------------------- */
  useEffect(() => {
    void initAuth();
    // אנליטיקס נטען רק למי שכבר מחובר, כדי לא למשוך את חבילת Firebase לחינם
    if (wasSignedIn()) void initAnalytics();
    return startSync();
  }, [initAuth]);

  /*
    הרשימות המשותפות נפתחות ונסגרות עם ההתחברות, ולא עם מסך התזכורות:
    הזמנה שממתינה צריכה להגיע גם למי שלא פתח את הלשונית, ומאזין שנשאר
    פתוח אחרי יציאה היה קורא נתונים של משתמש שכבר אינו כאן.
  */
  useEffect(() => {
    if (!authUser) {
      stopShared();
      return;
    }
    void startShared();
    /*
      הטוקן נרשם אחרי ההתחברות ולא בעלייה: הוא נשמר תחת המשתמש, ובלי
      uid אין לאן לכתוב אותו. ההרשמה גם מבקשת הרשאת התראות, וזו שאלה
      שיש לה הקשר רק אחרי שיש חשבון לשתף איתו.
    */
    void syncPushToken();
  }, [authUser]);

  /* ------------------------------- תזכורות ------------------------------- */
  const reminderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (reminderTimer.current) clearTimeout(reminderTimer.current);
    reminderTimer.current = setTimeout(() => {
      void syncReminders(settings, events);
    }, REMINDER_DEBOUNCE_MS);
    return () => {
      if (reminderTimer.current) clearTimeout(reminderTimer.current);
    };
  }, [settings, events]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // המשתמש יכול לשנות את הרשאת ההתראות במסך ההגדרות של המערכת
      if (isNative()) void refreshNativePermission().then(() => setNativeReady(true));
      else askServiceWorkerToFlush();
      void syncReminders(settings, events);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [settings, events]);

  /*
    ניקוי מה שבוצע.

    רץ בעלייה ובכל חזרה לחזית, ולא בטיימר: האפליקציה בטלפון אינה פתוחה
    שעות, והחזרה אליה היא בדיוק הרגע שבו הרשימה נקראת. `sweepDone` הוא
    שקובע מה נמחק, וכאן רק מיישמים.
  */
  const remove = useEventsStore((s) => s.remove);
  useEffect(() => {
    const sweep = () => {
      const days = useSettingsStore.getState().settings.doneCleanupDays;
      if (days <= 0) return;
      const ids = sweepDone(Object.values(useEventsStore.getState().byId), days);
      for (const id of ids) remove(id);
    };
    sweep();
    const onVisible = () => {
      if (document.visibilityState === 'visible') sweep();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [remove]);

  /* ------------------------ מיקום מדויק ומקומות ------------------------ */
  // המיקום המדויק נשמר בהגדרות; כאן רושמים אותו למודול המיקומים
  useEffect(() => {
    setCustomCity(settings.customLocation);
  }, [settings.customLocation]);

  const placesRef = useRef(settings.places);
  placesRef.current = settings.places;

  // המופעים של היום: מהם נגזרות ההתראות הדרוכות. נקראים דרך ref כדי
  // שהמעקב לא יתחיל מחדש בכל שינוי באירועים.
  const todayOccurrences = useMemo(() => eventsOnDay(events, today), [events, today]);
  const occurrencesRef = useRef(todayOccurrences);
  occurrencesRef.current = todayOccurrences;

  /*
    באנדרואיד מערכת ההפעלה היא שמנטרת.

    `startGeofenceWatch` רץ בתוך הדף, ולכן הוא מת ברגע שהמשתמש עוזב את
    האפליקציה - בדיוק הרגע שבו הוא יוצא לדרך. לכן שם רושמים גדרות
    אמיתיות, שממשיכות לחיות גם כשהאפליקציה סגורה, ובדפדפן נשאר המעקב
    בדף כי אין לו תחליף.

    הרישום הוא החלפה מלאה בכל שינוי באירועים או במקומות, מאותו שיקול של
    `scheduleNativeReminders`: הרשימה מחושבת מחדש ממילא, וניהול הפרשים
    היה מצב נוסף שיכול להיפרד מהאמת.
  */
  const fences = useMemo(() => {
    if (!settings.placeAlertsEnabled) return [];
    const upcoming = expandEvents(events, today, addDays(today, FENCE_HORIZON_DAYS));
    return buildFences(settings.places, [...upcoming.values()].flat(), today);
  }, [settings.placeAlertsEnabled, settings.places, events, today]);

  useEffect(() => {
    if (!isNative()) return;
    void syncNativeGeofences(fences);
  }, [fences]);

  useEffect(() => {
    // באנדרואיד הגדרות כבר רשומות במערכת, ומעקב בדף היה כפילות
    if (isNative()) return;
    if (!settings.placeAlertsEnabled || settings.places.length === 0) return;
    return startGeofenceWatch({
      getPlaces: () => placesRef.current,
      getOccurrences: () => occurrencesRef.current,
      onEvents: (alerts) => {
        for (const a of alerts) {
          void notifyNow(a.title, a.body, `place-${a.occurrence.occurrenceId}-${a.kind}`);
        }
      },
    });
  }, [settings.placeAlertsEnabled, settings.places.length]);

  /*
   * קיצורי דרך וקישורים עמוקים. רץ פעם אחת, אחרי שהמסך כבר קיים, והכתובת
   * מנוקה כדי שרענון לא יחזור על הפעולה.
   */
  useEffect(() => {
    const apply = (intent: ReturnType<typeof consumeLaunch>) => {
      if (intent.tab) setTab(intent.tab);
      if (intent.date) goToDate(intent.date);
      // וידג׳ט הרשימה המשותפת מוביל ללשונית הפנימית שלו, לא ל"שלי"
      if (intent.view) setRemindersView(intent.view);
      // במסך התזכורות "כתיבה" היא שדה ההוספה שבראשו, ולא עורך אירוע
      if (intent.compose && intent.tab === 'reminders') setComposeReminder(true);
      else if (intent.compose) openEditor(intent.compose);
    };
    apply(consumeLaunch());

    // כשהאפליקציה כבר פתוחה, לחיצה בוידג׳ט מגיעה כאירוע ולא ככתובת
    if (!isNative()) return;

    /*
      לחיצה על התראת הזמנה נכנסת לאותו מסלול בדיוק: היא מתורגמת לכתובת
      ועוברת באותו פענוח. מסלול שני היה מתפצל מהראשון ביום שמישהו ישנה
      אחד מהם.
    */
    void onPushOpened((url) => apply(parseExternalUrl(url)));

    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(({ App: CapApp }) =>
      CapApp.addListener('appUrlOpen', ({ url }) => apply(parseExternalUrl(url))).then((handle) => {
        remove = () => void handle.remove();
      }),
    );
    return () => remove?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * כפתור החזרה על לשונית שאינה הלוח מחזיר ללוח, כמקובל באנדרואיד, ורק
   * חזרה נוספת יוצאת מהאפליקציה.
   */
  useOverlayHistory(tab !== 'calendar', () => setTab('calendar'));

  /* ----------------------- הכרזות לקורא מסך ----------------------- */
  useEffect(() => {
    setAnnouncer(setAnnouncement);
    return () => setAnnouncer(null);
  }, []);

  /* ------------------------- התנגשויות סנכרון ------------------------- */
  const conflictCount = useEventsStore((s) => s.conflicts.length);
  const lastConflictCount = useRef(conflictCount);
  useEffect(() => {
    if (conflictCount > lastConflictCount.current) {
      toast(
        conflictCount === 1
          ? 'אירוע שונה גם במכשיר אחר'
          : `${conflictCount} אירועים שונו גם במכשיר אחר`,
        { label: 'הצגה', run: () => setConflictsOpen(true) },
      );
    }
    lastConflictCount.current = conflictCount;
  }, [conflictCount]);

  /* ---------------------------- ניווט בחודשים ---------------------------- */
  const goToMonth = useCallback((month: Date, direction: number) => {
    setMonthState({ month, direction });
    // מעבר חודש משנה את כל המסך בלי להזיז את המיקוד, ולכן הוא מוכרז
    announce(`${GREG_MONTHS_HE[month.getMonth()]} ${month.getFullYear()}`);
  }, []);

  const goToDate = useCallback((date: Date) => {
    const day = startOfDay(date);
    setSelectedDate(day);
    setMonthState((prev) => ({
      month: new Date(day.getFullYear(), day.getMonth(), 1),
      direction: day > prev.month ? 1 : -1,
    }));
    setTab('calendar');
  }, []);

  /* ------------------------- גרירת אירועים בלוח ------------------------- */
  const placeTemplateOn = useCallback((template: EventTemplate, dates: DateKey[]) => {
    if (!dates.length) return;
    const add = useEventsStore.getState().add;
    const created = dates.map((date) => add(templateToEvent(template, date)).id);

    const what = `"${template.title}"`;
    const many = dates.length > 1;
    announce(`${what} שובץ ל-${dates.length} ימים`);
    /*
      ביטול אחד לכל השיבוץ, ולא אחד לכל יום: מבחינת המשתמש זו הייתה
      פעולה אחת, ושלוש הודעות ביטול על בחירה אחת הן עונש ולא עזרה.
    */
    toast(many ? `${what} שובץ ל-${dates.length} ימים` : `${what} שובץ`, {
      label: 'ביטול',
      run: () => {
        const remove = useEventsStore.getState().remove;
        for (const id of created) remove(id);
      },
    });
  }, []);

  /** גרירה מפילה על יום אחד. אותו מסלול, רשימה באורך אחד. */
  const placeTemplate = useCallback(
    (template: EventTemplate, to: DateKey) => placeTemplateOn(template, [to]),
    [placeTemplateOn],
  );

  /*
    מקור אחד לאיתור הפריט שמאחורי מופע משותף, שנקרא גם מתוך מנוע
    הגרירה. הוא נקרא ב-`getState()` ולא דרך הוק, כי ההרשמה הזו קורית
    פעם אחת ואסור לה להיתלות בזהות של רשימות שמתחלפת בכל snapshot.
  */
  const sharedRef = useCallback((occurrence: Occurrence): SharedTarget | null => {
    const tag = occurrence.shared;
    if (!tag) return null;
    const { lists, items } = useSharedStore.getState();
    const list = lists.find((l) => l.id === tag.listId);
    const item = (items[tag.listId] ?? []).find((i) => i.id === occurrence.baseId);
    return list && item ? { list, item } : null;
  }, []);

  useEffect(() => {
    setDragCallbacks({
      onDrop: (baseId, to, occurrence) => {
        /*
          "בלי תאריך" הוא יעד לכל דבר מבחינת מנוע הגרירה, וכאן הוא מתפרש:
          גרירה אליו מנתקת מהיום, וגרירה ממנו משייכת. שניהם פעולה אחת על
          האירוע, ולא הזזה של מופע.
        */
        /*
          תבנית שנגררה אינה אירוע קיים אלא מקור ליצירה, ולכן היא לא
          "מוזזת" - היא משבצת אירוע חדש. הקידומת היא מה שמפריד, וכך מנוע
          הגרירה עצמו אינו צריך לדעת שתבניות קיימות.
        */
        if (baseId.startsWith(TEMPLATE_DRAG_PREFIX)) {
          const id = baseId.slice(TEMPLATE_DRAG_PREFIX.length);
          const template = useSettingsStore
            .getState()
            .settings.templates.find((t) => t.id === id);
          if (!template || (to as string) === 'undated') return;
          placeTemplate(template, to);
          return;
        }

        /*
          פריט מרשימה משותפת נכתב לענן, לא לחנות המקומית - שם הוא אינו
          קיים, וקריאה לחנות הייתה נבלעת בשקט. הזזה שלו מזיזה אותו
          אצל *כל* החברים, וזו בדיוק הכוונה: התאריך משותף.
        */
        if (occurrence.shared) {
          const target = sharedRef(occurrence);
          if (!target) return;
          const to_ = to as string;
          void saveSharedItem(target.list.id, {
            ...target.item,
            date: to_ === 'undated' ? target.item.date : to,
            undated: to_ === 'undated' ? true : undefined,
          });
          toast(
            to_ === 'undated'
              ? `"${occurrence.title}" הוסר מהתאריך אצל כל החברים`
              : `"${occurrence.title}" הועבר אצל כל חברי "${target.list.name}"`,
          );
          return;
        }

        const setReminderDate = useEventsStore.getState().setReminderDate;
        if ((to as string) === 'undated') {
          setReminderDate(baseId, null);
          toast(`"${occurrence.title}" ללא תאריך`);
          return;
        }
        if (occurrence.undated) {
          setReminderDate(baseId, to);
          toast(`"${occurrence.title}" שויך ליום`);
          return;
        }

        setSelectedDate(keyToDate(to));
        // גרירת מופע בסדרה חוזרת עמומה בכוונתה: שואלים לפני שמזיזים
        if (occurrence.repeat !== 'none') {
          setPendingDrop({ occurrence, to });
          return;
        }
        const previous = useEventsStore.getState().byId[baseId]?.date;
        move(baseId, to);
        toast(
          `"${occurrence.title}" הועבר`,
          previous ? { label: 'ביטול', run: () => move(baseId, previous) } : undefined,
        );
      },
      onEdge: (edge) => {
        setMonthState((prev) => ({
          month: addMonths(prev.month, edge === 'next' ? 1 : -1),
          direction: edge === 'next' ? 1 : -1,
        }));
      },
      /*
        המנוע רק מדווח שהשחרור היה על הפח. האישור הוא החלטה של המסך,
        ולא של הגרירה - תבנית שנגררה, למשל, אינה אירוע שאפשר למחוק.
      */
      onTrash: (occurrence) => {
        if (occurrence.baseId.startsWith(TEMPLATE_DRAG_PREFIX)) return;
        /*
          פריט משותף נמחק אצל כולם, ואין לו ביטול מקומי - הוא חי בענן.
          לכן הוא נשלח לגיליון שלו, שם ההסתרה האישית יושבת לצד המחיקה
          וההבדל ביניהן מנוסח במפורש.
        */
        if (occurrence.shared) {
          const target = sharedRef(occurrence);
          if (target) setSharedEditing(target);
          return;
        }
        setPendingTrash(occurrence);
      },
    });
  }, [move, placeTemplate, sharedRef]);

  /** מחיקה אחרי שאושרה. `scope` רלוונטי רק לסדרה חוזרת. */
  const applyTrash = useCallback(
    (scope: EditScope) => {
      if (!pendingTrash) return;
      const occurrence = pendingTrash;
      const { remove, restore, cancelOccurrence, restoreOccurrence } =
        useEventsStore.getState();
      setPendingTrash(null);

      if (scope === 'occurrence' && occurrence.repeat !== 'none') {
        cancelOccurrence(occurrence.baseId, occurrence.sourceKey);
        announce(`"${occurrence.title}" נמחק`);
        toast(`"${occurrence.title}" נמחק`, {
          label: 'ביטול',
          run: () => restoreOccurrence(occurrence.baseId, occurrence.sourceKey),
        });
        return;
      }

      remove(occurrence.baseId);
      announce(`"${occurrence.title}" נמחק`);
      toast(`"${occurrence.title}" נמחק`, {
        label: 'ביטול',
        run: () => restore(occurrence.baseId),
      });
    },
    [pendingTrash],
  );

  /**
   * שיבוץ תבנית ליום.
   *
   * אותה פעולה בדיוק להקשה ולגרירה - מקור אחד, כדי ששתי הדרכים לא
   * יתפצלו ביום שמישהו ישנה אחת מהן. האירוע שנוצר מנותק מהתבנית: מחיקת
   * התבנית לא תיגע בחופשות שכבר שובצו.
   */
  /** תשובה לשאלת ההיקף אחרי גרירה של מופע בסדרה חוזרת. */
  const applyDropScope = useCallback(
    (scope: EditScope) => {
      if (!pendingDrop) return;
      const { occurrence, to } = pendingDrop;
      if (scope === 'series') {
        const previous = useEventsStore.getState().byId[occurrence.baseId]?.date;
        move(occurrence.baseId, to);
        toast(
          `הסדרה "${occurrence.title}" הועברה`,
          previous
            ? { label: 'ביטול', run: () => move(occurrence.baseId, previous) }
            : undefined,
        );
      } else {
        moveOccurrence(occurrence.baseId, occurrence.sourceKey, to);
        toast(`"${occurrence.title}" הועבר למועד הזה בלבד`, {
          label: 'ביטול',
          run: () => moveOccurrence(occurrence.baseId, occurrence.sourceKey, occurrence.sourceKey),
        });
      }
      setPendingDrop(null);
    },
    [move, moveOccurrence, pendingDrop],
  );

  /*
    הכפתור מחליף תצוגה במקום לפתוח רשימה.

    שלוש אפשרויות בלבד, והאייקון כבר מראה באיזו נמצאים - גיליון בחירה
    היה שתי הקשות ומסך שנפתח ונסגר בשביל מה שהקשה אחת עושה. הסדר קבוע
    ומחזורי, ולכן אפשר ללמוד אותו באצבע בלי להסתכל.
  */
  const cycleView = useCallback(() => {
    const { settings: current, set } = useSettingsStore.getState();
    const next = nextView(current.view, availableViews(current));
    if (next === current.view) return;
    void haptic('light');
    set('view', next);
    // המסך מתחלף והמיקוד נשאר על הכפתור
    announce(`תצוגת ${VIEW_LABEL[next]}`);
  }, []);

  /* ------------------------------- חלוניות ------------------------------- */
  const openEditor = useCallback((date: DateKey, startTime?: string) => {
    setEditor({ open: true, date, editing: null, startTime });
  }, []);

  /**
   * המשך של הוספה מהירה בעורך המלא.
   *
   * הטיוטה נוסעת כמות שהיא ואינה נשמרת בדרך: מי שיסגור את העורך לא
   * ימצא אחר כך תזכורת חצי־מוכנה ברשימה.
   */
  const openEditorWith = useCallback((draft: EventDraft) => {
    setEditor({ open: true, date: draft.date, editing: null, prefill: draft });
  }, []);

  const findShared = useFindShared();

  /** פותח את העורך על מופע או על תזכורת בלי תאריך. */
  const editAnything = useCallback(
    (item: Occurrence | UserEvent) => {
      // פריט מרשימה משותפת נערך בגיליון שלו, לא בעורך האישי
      if ('shared' in item && item.shared) {
        const target = findShared(item as Occurrence);
        if (target) {
          setSharedEditing(target);
          return;
        }
      }
      setEditor({ open: true, date: item.date, editing: item });
    },
    [findShared],
  );

  /** נפתח מהוידג׳ט: שדה ההקלדה במסך התזכורות ממוקד מיד */
  const [composeReminder, setComposeReminder] = useState(false);
  /** לשונית פנימית שנכפתה מבחוץ (וידג׳ט). null = מה שהמשתמש בחר אחרון */
  const [remindersView, setRemindersView] = useState<RemindersView | null>(null);

  const editOccurrence = useCallback(
    (occurrence: Occurrence) => {
      const target = findShared(occurrence);
      if (target) {
        setSharedEditing(target);
        return;
      }
      setEditor({ open: true, date: occurrence.date, editing: occurrence });
    },
    [findShared],
  );

  /**
   * הזזה במקלדת - Alt+חיצים על כרטיס אירוע. זו החלופה לגרירה, שאין לה
   * שום מקבילה במקלדת. מופע בסדרה חוזרת מוזז לבדו: מי שמנווט במקלדת
   * לא אמור להיתקל בדיאלוג באמצע רצף הקשות.
   */
  const moveEventByKeyboard = useCallback(
    (occurrence: Occurrence, days: number) => {
      const to = dateKey(addDays(keyToDate(occurrence.spanStart), days));
      if (occurrence.repeat === 'none') move(occurrence.baseId, to);
      else moveOccurrence(occurrence.baseId, occurrence.sourceKey, to);
      setSelectedDate(keyToDate(to));
      announce(`"${occurrence.title}" הועבר ל${dayTitleLabel(keyToDate(to))}`);
    },
    [move, moveOccurrence],
  );

  // בדסקטופ סרגל הלשוניות צף מעל התוכן, ולכן צריך מרווח מעט גדול יותר
  const bottomInset = isDesktop ? TAB_BAR_HEIGHT + 28 : TAB_BAR_HEIGHT;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex h-full flex-col overflow-hidden bg-canvas">
        {/*
          המסכים מונפשים בשכבות חופפות (mode ברירת המחדל) ולא ב-"wait":
          כך מעבר לשונית לא ממתין לסיום אנימציית היציאה, ואין סיכון להיתקעות.
        */}
        <div className="relative min-h-0 flex-1">
          <AnimatePresence initial={false}>
            <motion.main
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex min-h-0 flex-col"
            >
            {tab === 'calendar' && (
              <CalendarScreen
                month={monthState.month}
                direction={monthState.direction}
                onMonthChange={goToMonth}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                panelDetent={panelDetent}
                onPanelDetentChange={setPanelDetent}
                onOpenDayView={setDayViewDate}
                onAddEvent={openEditor}
                onEditEvent={editOccurrence}
                onMoveEvent={moveEventByKeyboard}
                onProfile={() => setTab('settings')}
                onSearch={() => setSearchOpen(true)}
                onOpenYear={() => {
                  setYearValue(monthState.month.getFullYear());
                  setYearOpen(true);
                }}
                onPickView={cycleView}
                photoURL={shownUser?.photoURL ?? null}
                userName={shownUser?.name ?? shownUser?.email ?? null}
                onPlaceTemplate={placeTemplate}
                bottomInset={bottomInset}
              />
            )}

            {tab === 'shabbat' && (
              <ShabbatScreen onPickCity={() => setCityOpen(true)} bottomInset={bottomInset} />
            )}

            {tab === 'reminders' && (
              <RemindersScreen
                onEditEvent={editAnything}
                onDeleteEvent={setPendingTrash}
          onComposeMore={openEditorWith}
                composeOnMount={composeReminder}
                viewOverride={remindersView}
                onPlaceTemplate={placeTemplateOn}
                bottomInset={bottomInset}
              />
            )}

            {tab === 'settings' && (
              <SettingsScreen
                onPickCity={() => setCityOpen(true)}
                onOpenConflicts={() => setConflictsOpen(true)}
                onUpdateFound={setUpdate}
                bottomInset={bottomInset}
              />
            )}
            </motion.main>
          </AnimatePresence>
        </div>

        <TabBar active={tab} onChange={setTab} />
        <Toaster bottomInset={bottomInset} />

        {/*
          אזור ה-live היחיד באפליקציה. פעולות שמשנות את המסך בלי להזיז את
          המיקוד (הזזה בחיצים, מעבר חודש) מדווחות דרכו.
        */}
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </p>
      </div>

      {/* ------------------------------ חלוניות ------------------------------ */}
      <DayView
        open={dayViewDate !== null}
        onClose={() => setDayViewDate(null)}
        day={dayData?.day ?? null}
        occurrences={dayData?.occurrences ?? []}
        onNavigate={(date) => {
          setDayViewDate(date);
          setSelectedDate(startOfDay(date));
          setMonthState((prev) => ({
            month: new Date(date.getFullYear(), date.getMonth(), 1),
            direction: date > prev.month ? 1 : -1,
          }));
        }}
        onAddEvent={() => {
          if (dayViewDate) openEditor(dateKey(dayViewDate));
        }}
        onEditEvent={editOccurrence}
      />

      <ConflictSheet open={conflictsOpen} onClose={() => setConflictsOpen(false)} />

      <ScopeSheet
        open={pendingDrop !== null}
        onClose={() => setPendingDrop(null)}
        onChoose={applyDropScope}
        title="מה להזיז?"
        occurrenceLabel="המופע הזה בלבד"
        occurrenceHint="שאר המופעים יישארו במועדם"
        seriesLabel="את כל הסדרה"
        seriesHint="כל המופעים יזוזו באותו הפרש"
      />

      <WelcomeSheet open={welcome} onClose={closeWelcome} />

      <UpdateSheet
        update={update}
        onClose={() => {
          if (update) dismissUpdate(update.versionCode);
          setUpdate(null);
        }}
      />

      <EventEditor
        open={editor.open}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
        date={editor.date}
        startTime={editor.startTime}
        prefill={editor.prefill}
        editing={editor.editing}
      />

      {/*
        גרירה אל הפח. מופע בסדרה חוזרת נשאל "מה למחוק" - אותה שאלה
        שהעורך שואל - וכל השאר נשאל פעם אחת, כן או לא.
      */}
      <ScopeSheet
        open={Boolean(pendingTrash && pendingTrash.repeat !== 'none')}
        onClose={() => setPendingTrash(null)}
        onChoose={applyTrash}
        title="מה למחוק?"
        occurrenceLabel="המופע הזה בלבד"
        occurrenceHint="שאר המופעים יישארו במקומם"
        seriesLabel="את כל הסדרה"
        seriesHint="כל המופעים יימחקו"
        destructive
      />

      {sharedEditing && (
        <SharedItemSheet
          open
          onClose={() => setSharedEditing(null)}
          list={sharedEditing.list}
          item={sharedEditing.item}
        />
      )}

      <ConfirmDeleteSheet
        open={Boolean(pendingTrash && pendingTrash.repeat === 'none')}
        onClose={() => setPendingTrash(null)}
        onConfirm={() => applyTrash('series')}
        title={pendingTrash?.title ?? ''}
        hint={
          pendingTrash?.undated
            ? 'תזכורת בלי תאריך'
            : pendingTrash
              ? dayTitleLabel(keyToDate(pendingTrash.date))
              : ''
        }
      />

      <CityPicker open={cityOpen} onClose={() => setCityOpen(false)} cityId={settings.cityId} />

      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        year={monthState.month.getFullYear()}
        onPickDate={goToDate}
        onPickEvent={(event) => {
          goToDate(keyToDate(event.date));
          setEditor({ open: true, date: event.date, editing: event });
        }}
      />

      <YearPicker
        open={yearOpen}
        onClose={() => setYearOpen(false)}
        year={yearValue}
        focusMonth={monthState.month.getMonth()}
        onPick={goToDate}
        onYearChange={setYearValue}
      />

      <DragLayer />
    </MotionConfig>
  );
}
