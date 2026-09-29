/**
 * מסך הלוח הראשי.
 * כברירת מחדל רואים רק את הלוח, עם המועדים והאירועים ככיתובים על גבי הימים.
 * מעבר בין חודשים בהחלקה, והפאנל התחתון נפתח במשיכה למעלה.
 *
 * שלוש תצוגות חולקות את אותה כותרת ואת אותו מנוע נתונים:
 *   חודש   - רשת 42 הימים, התצוגה הראשית
 *   שבוע   - ציר שעות, לימים עמוסים
 *   סדר יום - רשימה רציפה, רק ימים שיש בהם משהו
 * החלונית התחתונה שייכת לתצוגת החודש והשבוע בלבד; בסדר יום כל התוכן
 * ממילא פרוש ברשימה, וחלונית נוספת רק תסתיר אותו.
 */
import { useCallback, useMemo } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import type { CalendarView, DateKey, DayInfo, EventTemplate } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import {
  addDays,
  addMonths,
  dateKey,
  isSameMonth,
  monthKey,
  startOfDay,
  GREG_MONTHS_HE,
} from '@/lib/dates';
import { hebrewMonthSpanLabel } from '@/lib/hebrew';
import { useMonthData, useRangeData } from '@/hooks/useMonthData';
import { useSettings } from '@/store/settings';
import { useDragActive } from '@/lib/dragEngine';
import { availableViews, canSwitchViews, resolveView } from '@/lib/calendarViews';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { usePageDirection } from '@/hooks/usePageDirection';
import { CalendarHeader } from './CalendarHeader';
import { MonthGrid, WeekdayHeader } from './MonthGrid';
import { WeekView } from './WeekView';
import { AgendaView } from './AgendaView';
import { DockedDayPanel, EventsPanel, type PanelDetent } from './EventsPanel';
import { OfflineBar } from './OfflineBar';
import { GLIDE } from '@/lib/motion';

/** מרחק/מהירות החלקה שמעבירים חודש */
const SWIPE_DISTANCE = 58;
const SWIPE_VELOCITY = 320;

/*
  קדימה בזמן הוא שמאלה, כמו דפדוף בספר עברי.

  ב-RTL "הבא" יושב בשמאל, ולכן החודש הבא נכנס משמאל והנוכחי יוצא ימינה -
  והאצבע מביאה אותו בהחלקה ימינה, באותו כיוון שבו הרצועה זזה. קודם זה היה
  הפוך, כמו קרוסלה של שפה שנכתבת משמאל לימין: ההחלקה ימינה החזירה אחורה,
  והחודש הבא נכנס מהצד של "הקודם". התנועה הייתה נכונה, ובכל זאת נראתה
  כמו נסיגה.

  התוכן תמיד זז לכיוון האצבע, והחודש החדש תמיד נכנס מהצד שממנו היא באה.
  `x` של framer הוא פיזי ולא לוגי, ולכן הסימנים מפורשים ואינם מתהפכים
  לבד לפי `dir`.
*/
const pageVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%', opacity: 0.4 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0.4 }),
};

/** תחילת השבוע שבו נמצא התאריך. השבוע מתחיל ביום ראשון. */
function weekStartOf(date: Date): Date {
  return addDays(startOfDay(date), -date.getDay());
}

/** "12–18 בספטמבר" או "27 בספטמבר – 3 באוקטובר" */
function weekLabel(start: Date): string {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startPart = sameMonth
    ? String(start.getDate())
    : `${start.getDate()} ב${GREG_MONTHS_HE[start.getMonth()]}`;
  return `${startPart}–${end.getDate()} ב${GREG_MONTHS_HE[end.getMonth()]}`;
}

export function CalendarScreen({
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  panelDetent,
  onPanelDetentChange,
  onOpenDayView,
  onAddEvent,
  onEditEvent,
  onMoveEvent,
  onProfile,
  onSearch,
  onOpenYear,
  onPickView,
  photoURL,
  userName,
  onPlaceTemplate,
  bottomInset,
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  panelDetent: PanelDetent;
  onPanelDetentChange: (next: PanelDetent) => void;
  onOpenDayView: (date: Date) => void;
  onAddEvent: (date: DateKey, startTime?: string) => void;
  onEditEvent: (occurrence: Occurrence) => void;
  /** הזזה במקלדת (Alt+חיצים) - החלופה לגרירה */
  onMoveEvent: (occurrence: Occurrence, days: number) => void;
  /** שיבוץ תבנית ליום, מהרצועה שבחלונית */
  onPlaceTemplate: (template: EventTemplate, date: DateKey) => void;
  onProfile: () => void;
  onSearch: () => void;
  onOpenYear: () => void;
  onPickView: () => void;
  photoURL: string | null;
  userName?: string | null;
  bottomInset: number;
}) {
  const settings = useSettings();
  /*
    התצוגה שמצוירת אינה בהכרח זו ששמורה: אפשר לכבות שבוע או סדר יום
    בהגדרות בזמן שנמצאים בהם. ההגדרה השמורה נשארת - מי שיחזיר אותה
    יחזור אליה - והמסך בינתיים נופל לחודש.
  */
  const views = useMemo(() => availableViews(settings), [settings]);
  const view: CalendarView = resolveView(settings.view, views);
  const data = useMonthData(month);
  const dragActive = useDragActive();
  const direction = usePageDirection(monthKey(month));
  const isDesktop = useIsDesktop();

  const selectedKey = dateKey(selectedDate);
  const selectedDay = data.days.get(selectedKey);
  const selectedOccurrences = useMemo(
    () => data.occurrences.get(selectedKey) ?? [],
    [data.occurrences, selectedKey],
  );

  /* --------------------------- נתוני תצוגת השבוע --------------------------- */
  const weekStart = useMemo(() => weekStartOf(selectedDate), [selectedDate]);
  const weekData = useRangeData(weekStart, addDays(weekStart, 6));

  const page = useCallback(
    (delta: number) => {
      if (view === 'week') {
        const next = addDays(weekStart, delta * 7);
        onSelectDate(next);
        if (!isSameMonth(next, month)) {
          onMonthChange(new Date(next.getFullYear(), next.getMonth(), 1));
        }
        return;
      }
      onMonthChange(addMonths(month, delta));
    },
    [month, onMonthChange, onSelectDate, view, weekStart],
  );

  /*
    החלקה ימינה מקדימה, החלקה שמאלה מחזירה. זה מודל "גוררים את הדף": האצבע
    מושכת את החודש הנוכחי החוצה ימינה, והבא נכנס משמאל - מאותו צד שבו
    יושב "הבא". ראו pageVariants.
  */
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) page(1);
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) page(-1);
  };

  /**
   * לחיצה על יום פותחת את מה שיש בו.
   *
   * קודם הלחיצה הראשונה רק הזיזה את עיגול הבחירה, והתוכן הגיע בלחיצה
   * שנייה. אבל להזיז עיגול אינה מטרה בפני עצמה: מי שנוגע ביום רוצה
   * לראות אותו. לכן כל לחיצה מרימה את החלונית לעצירת הביניים, גם ביום
   * ריק - שם היא מראה את המועד, את הזמנים, ואת הכפתור להוספה.
   *
   * לחיצה חוזרת על אותו יום מקפלת בחזרה: אותה אצבע פותחת וסוגרת.
   * תצוגת היום המורחבת נשארת בשורה שבראש החלונית עצמה.
   *
   * חלונית שכבר פתוחה במלואה לא יורדת בדילוג בין ימים.
   */
  const onSelectDay = useCallback(
    (day: DayInfo) => {
      if (day.key === selectedKey) {
        onPanelDetentChange(panelDetent === 'peek' ? 'half' : 'peek');
        return;
      }
      onSelectDate(day.date);
      if (!isSameMonth(day.date, month)) {
        onMonthChange(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
      }
      if (panelDetent === 'peek') onPanelDetentChange('half');
    },
    [selectedKey, onSelectDate, month, onMonthChange, panelDetent, onPanelDetentChange],
  );

  /** ניווט מקלדת: בוחר תאריך, ומחליף חודש אם צריך. */
  const goToDate = useCallback(
    (date: Date) => {
      onSelectDate(date);
      if (!isSameMonth(date, month)) {
        onMonthChange(new Date(date.getFullYear(), date.getMonth(), 1));
      }
    },
    [month, onMonthChange, onSelectDate],
  );

  const today = startOfDay(new Date());
  const goToToday = () => {
    onSelectDate(today);
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  /** התצוגה שמתחת לכותרת, בלי החלונית התחתונה. */
  const body = () => {
    if (view === 'agenda') {
      return (
        <AgendaView
          from={selectedDate < today ? selectedDate : today}
          onOpenDay={onOpenDayView}
          onAddEvent={() => onAddEvent(selectedKey)}
          onEditEvent={onEditEvent}
          onMoveEvent={onMoveEvent}
          onSearch={onSearch}
          bottomInset={isDesktop ? 0 : bottomInset}
        />
      );
    }

    if (view === 'week') {
      return (
        <div
          className="flex min-h-0 flex-1 flex-col"
          style={{ paddingBottom: isDesktop ? 0 : bottomInset + 62 }}
        >
          <WeekView
            data={weekData}
            settings={settings}
            selectedKey={selectedKey}
            onSelectDay={onSelectDay}
            onEditEvent={onEditEvent}
            onAddAt={(key, hour) => onAddEvent(key, `${String(hour).padStart(2, '0')}:00`)}
            onPage={page}
          />
        </div>
      );
    }

    return (
      <>
        <WeekdayHeader />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={monthKey(month)}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: GLIDE, opacity: { duration: 0.18 } }}
              drag={dragActive ? false : 'x'}
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.14}
              onDragEnd={onDragEnd}
              className="absolute inset-0 flex flex-col"
              style={{ paddingBottom: isDesktop ? 0 : bottomInset + 62 }}
            >
              <MonthGrid
                data={data}
                settings={settings}
                selectedKey={selectedKey}
                onSelectDay={onSelectDay}
                onNavigate={goToDate}
                layoutGroupId={monthKey(month)}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </>
    );
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="app-shell flex min-h-0 flex-1 flex-col">
        {/* במסך רחב: הלוח והפאנל זה לצד זה, והכותרת יושבת מעל עמודת הלוח */}
        <div
          className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-6 lg:px-6 lg:pt-8"
          style={{ paddingBottom: isDesktop ? bottomInset : 0 }}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <CalendarHeader
              month={month}
              title={
                view === 'week' ? weekLabel(weekStart) : view === 'agenda' ? 'סדר יום' : undefined
              }
              hebrewMonthLabel={
                settings.showHebrewMonths && view !== 'agenda'
                  ? hebrewMonthSpanLabel(month)
                  : undefined
              }
              view={view}
              onPickView={onPickView}
              canSwitchViews={canSwitchViews(views)}
              photoURL={photoURL}
              userName={userName}
              onProfile={onProfile}
              onToday={goToToday}
              onTitle={onOpenYear}
            />

            <OfflineBar />

            {body()}
          </div>

          {isDesktop && view !== 'agenda' && (
            <DockedDayPanel
              day={selectedDay}
              occurrences={selectedOccurrences}
              onOpenDay={() => onOpenDayView(selectedDate)}
              onAddEvent={() => onAddEvent(selectedKey)}
              onEditEvent={onEditEvent}
              onMoveEvent={onMoveEvent}
              onPlaceTemplate={onPlaceTemplate}
              showTemplates={view === 'month'}
            />
          )}
        </div>
      </div>

      {!isDesktop && view !== 'agenda' && (
        <EventsPanel
          day={selectedDay}
          occurrences={selectedOccurrences}
          detent={panelDetent}
          onDetentChange={onPanelDetentChange}
          onOpenDay={() => onOpenDayView(selectedDate)}
          onAddEvent={() => onAddEvent(selectedKey)}
          onEditEvent={onEditEvent}
          onMoveEvent={onMoveEvent}
          onPlaceTemplate={onPlaceTemplate}
          showTemplates={view === 'month'}
          bottomInset={bottomInset}
        />
      )}
    </div>
  );
}
