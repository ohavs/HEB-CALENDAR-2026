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
import type { CalendarView, DateKey, DayInfo } from '@/types';
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
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { CalendarHeader } from './CalendarHeader';
import { MonthGrid, WeekdayHeader } from './MonthGrid';
import { WeekView } from './WeekView';
import { AgendaView } from './AgendaView';
import { DockedDayPanel, EventsPanel } from './EventsPanel';
import { OfflineBar } from './OfflineBar';
import { GLIDE } from '@/lib/motion';

/** מרחק/מהירות החלקה שמעבירים חודש */
const SWIPE_DISTANCE = 58;
const SWIPE_VELOCITY = 320;

const pageVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0.4 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%', opacity: 0.4 }),
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
  direction,
  onMonthChange,
  selectedDate,
  onSelectDate,
  panelOpen,
  onPanelOpenChange,
  onOpenDayView,
  onAddEvent,
  onEditEvent,
  onMoveEvent,
  onProfile,
  onSearch,
  onOpenYear,
  onPickView,
  photoURL,
  bottomInset,
}: {
  month: Date;
  /** כיוון המעבר האחרון בין חודשים, לאנימציה */
  direction: number;
  onMonthChange: (month: Date, direction: number) => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  onOpenDayView: (date: Date) => void;
  onAddEvent: (date: DateKey) => void;
  onEditEvent: (occurrence: Occurrence) => void;
  /** הזזה במקלדת (Alt+חיצים) - החלופה לגרירה */
  onMoveEvent: (occurrence: Occurrence, days: number) => void;
  onProfile: () => void;
  onSearch: () => void;
  onOpenYear: () => void;
  onPickView: () => void;
  photoURL: string | null;
  bottomInset: number;
}) {
  const settings = useSettings();
  const view: CalendarView = settings.view;
  const data = useMonthData(month);
  const dragActive = useDragActive();
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
          onMonthChange(new Date(next.getFullYear(), next.getMonth(), 1), delta);
        }
        return;
      }
      onMonthChange(addMonths(month, delta), delta);
    },
    [month, onMonthChange, onSelectDate, view, weekStart],
  );

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // בעברית הימים מתקדמים מימין לשמאל: החלקה שמאלה = קדימה בזמן
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) page(1);
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) page(-1);
  };

  /** לחיצה על יום: בחירה; לחיצה חוזרת על היום הנבחר פותחת תצוגת יום. */
  const onSelectDay = useCallback(
    (day: DayInfo) => {
      if (day.key === selectedKey) {
        onOpenDayView(day.date);
        return;
      }
      onSelectDate(day.date);
      if (!isSameMonth(day.date, month)) {
        const delta = day.date > month ? 1 : -1;
        onMonthChange(new Date(day.date.getFullYear(), day.date.getMonth(), 1), delta);
      }
    },
    [selectedKey, onOpenDayView, onSelectDate, month, onMonthChange],
  );

  /** ניווט מקלדת: בוחר תאריך, ומחליף חודש אם צריך. */
  const goToDate = useCallback(
    (date: Date) => {
      onSelectDate(date);
      if (!isSameMonth(date, month)) {
        onMonthChange(
          new Date(date.getFullYear(), date.getMonth(), 1),
          date > month ? 1 : -1,
        );
      }
    },
    [month, onMonthChange, onSelectDate],
  );

  const today = startOfDay(new Date());
  const goToToday = () => {
    onSelectDate(today);
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1), today > month ? 1 : -1);
  };

  const showToday =
    view === 'week' ? today < weekStart || today > addDays(weekStart, 6) : !isSameMonth(month, today);

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
              showToday={showToday}
              view={view}
              onPickView={onPickView}
              photoURL={photoURL}
              onProfile={onProfile}
              onSearch={onSearch}
              onAdd={() => onAddEvent(selectedKey)}
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
            />
          )}
        </div>
      </div>

      {!isDesktop && view !== 'agenda' && (
        <EventsPanel
          day={selectedDay}
          occurrences={selectedOccurrences}
          open={panelOpen}
          onOpenChange={onPanelOpenChange}
          onOpenDay={() => onOpenDayView(selectedDate)}
          onAddEvent={() => onAddEvent(selectedKey)}
          onEditEvent={onEditEvent}
          onMoveEvent={onMoveEvent}
          bottomInset={bottomInset}
        />
      )}
    </div>
  );
}
