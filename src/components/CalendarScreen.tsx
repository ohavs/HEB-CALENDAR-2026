/**
 * מסך הלוח הראשי.
 * כברירת מחדל רואים רק את הלוח, עם המועדים והאירועים ככיתובים על גבי הימים.
 * מעבר בין חודשים בהחלקה, והפאנל התחתון נפתח במשיכה למעלה.
 */
import { useCallback, useMemo } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import type { DateKey, DayInfo } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { addMonths, dateKey, isSameMonth, monthKey, startOfDay } from '@/lib/dates';
import { hebrewMonthSpanLabel } from '@/lib/hebrew';
import { useMonthData } from '@/hooks/useMonthData';
import { useSettings } from '@/store/settings';
import { useDragActive } from '@/lib/dragEngine';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { CalendarHeader } from './CalendarHeader';
import { MonthGrid, WeekdayHeader } from './MonthGrid';
import { DockedDayPanel, EventsPanel } from './EventsPanel';

/** מרחק/מהירות החלקה שמעבירים חודש */
const SWIPE_DISTANCE = 58;
const SWIPE_VELOCITY = 320;

const pageVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0.4 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%', opacity: 0.4 }),
};

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
  onProfile,
  onSearch,
  onOpenYear,
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
  onProfile: () => void;
  onSearch: () => void;
  onOpenYear: () => void;
  photoURL: string | null;
  bottomInset: number;
}) {
  const settings = useSettings();
  const data = useMonthData(month);
  const dragActive = useDragActive();
  const isDesktop = useIsDesktop();

  const selectedKey = dateKey(selectedDate);
  const selectedDay = data.days.get(selectedKey);
  const selectedOccurrences = useMemo(
    () => data.occurrences.get(selectedKey) ?? [],
    [data.occurrences, selectedKey],
  );

  const page = useCallback(
    (delta: number) => onMonthChange(addMonths(month, delta), delta),
    [month, onMonthChange],
  );

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // בעברית הימים מתקדמים מימין לשמאל: החלקה שמאלה = החודש הבא
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
              hebrewMonthLabel={
                settings.showHebrewMonths ? hebrewMonthSpanLabel(month) : undefined
              }
              showToday={!isSameMonth(month, new Date())}
              photoURL={photoURL}
              onProfile={onProfile}
              onSearch={onSearch}
              onAdd={() => onAddEvent(selectedKey)}
              onToday={() => {
                const today = startOfDay(new Date());
                onSelectDate(today);
                onMonthChange(
                  new Date(today.getFullYear(), today.getMonth(), 1),
                  today > month ? 1 : -1,
                );
              }}
              onTitle={onOpenYear}
            />

            <WeekdayHeader weekStart={settings.weekStart} />

            <div className="relative min-h-0 flex-1 overflow-hidden">
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={monthKey(month)}
                  custom={direction}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: 'spring', stiffness: 380, damping: 36 },
                    opacity: { duration: 0.18 },
                  }}
                  drag={dragActive ? false : 'x'}
                  dragDirectionLock
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.14}
                  onDragEnd={onDragEnd}
                  className="absolute inset-0 flex flex-col"
                  style={{ paddingBottom: isDesktop ? 0 : bottomInset + 86 }}
                >
                  <MonthGrid
                    data={data}
                    settings={settings}
                    selectedKey={selectedKey}
                    onSelectDay={onSelectDay}
                    layoutGroupId={monthKey(month)}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {isDesktop && (
            <DockedDayPanel
              day={selectedDay}
              occurrences={selectedOccurrences}
              onOpenDay={() => onOpenDayView(selectedDate)}
              onAddEvent={() => onAddEvent(selectedKey)}
              onEditEvent={onEditEvent}
            />
          )}
        </div>
      </div>

      {!isDesktop && (
        <EventsPanel
          day={selectedDay}
          occurrences={selectedOccurrences}
          open={panelOpen}
          onOpenChange={onPanelOpenChange}
          onOpenDay={() => onOpenDayView(selectedDate)}
          onAddEvent={() => onAddEvent(selectedKey)}
          onEditEvent={onEditEvent}
          bottomInset={bottomInset}
        />
      )}
    </div>
  );
}
