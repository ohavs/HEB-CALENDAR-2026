/** שורש האפליקציה - מחבר את המסכים, החלוניות, הסנכרון והתזכורות. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import type { DateKey, UserEvent } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { addMonths, dateKey, keyToDate, startOfDay } from '@/lib/dates';
import { setDragCallbacks } from '@/lib/dragEngine';
import { askServiceWorkerToFlush, notifyNow, syncReminders } from '@/lib/notifications';
import { startGeofenceWatch } from '@/lib/geofence';
import { setCustomCity } from '@/lib/locations';
import { initAnalytics } from '@/lib/firebase';
import { startSync } from '@/lib/sync';
import { useEvents, useEventsStore } from '@/store/events';
import { applyTheme, useSettings } from '@/store/settings';
import { useAuthStore, wasSignedIn } from '@/store/auth';
import { useDayData } from '@/hooks/useMonthData';
import { CalendarScreen } from '@/components/CalendarScreen';
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

const REMINDER_DEBOUNCE_MS = 700;

type EditorState = {
  open: boolean;
  date: DateKey;
  editing: Occurrence | UserEvent | null;
};

export default function App() {
  const settings = useSettings();
  const events = useEvents();
  const move = useEventsStore((s) => s.move);
  const authUser = useAuthStore((s) => s.user);
  const initAuth = useAuthStore((s) => s.init);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [tab, setTab] = useState<TabId>('calendar');
  const [monthState, setMonthState] = useState(() => ({
    month: new Date(today.getFullYear(), today.getMonth(), 1),
    direction: 0,
  }));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [panelOpen, setPanelOpen] = useState(false);

  const [dayViewDate, setDayViewDate] = useState<Date | null>(null);
  const [editor, setEditor] = useState<EditorState>({
    open: false,
    date: dateKey(today),
    editing: null,
  });
  const [cityOpen, setCityOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [yearValue, setYearValue] = useState(today.getFullYear());

  const dayData = useDayData(dayViewDate);
  const isDesktop = useIsDesktop();

  /* ------------------------------ ערכת נושא ------------------------------ */
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  /* -------------------------- התחברות וסנכרון -------------------------- */
  useEffect(() => {
    void initAuth();
    // אנליטיקס נטען רק למי שכבר מחובר, כדי לא למשוך את חבילת Firebase לחינם
    if (wasSignedIn()) void initAnalytics();
    return startSync();
  }, [initAuth]);

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
      askServiceWorkerToFlush();
      void syncReminders(settings, events);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [settings, events]);

  /* ------------------------ מיקום מדויק ומקומות ------------------------ */
  // המיקום המדויק נשמר בהגדרות; כאן רושמים אותו למודול המיקומים
  useEffect(() => {
    setCustomCity(settings.customLocation);
  }, [settings.customLocation]);

  const placesRef = useRef(settings.places);
  placesRef.current = settings.places;

  useEffect(() => {
    if (!settings.placeAlertsEnabled || settings.places.length === 0) return;
    return startGeofenceWatch({
      getPlaces: () => placesRef.current,
      onEvents: (events) => {
        for (const e of events) {
          void notifyNow(e.title, e.body, `place-${e.place.id}-${e.kind}`);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.placeAlertsEnabled, settings.places.length]);

  /* ---------------------------- ניווט בחודשים ---------------------------- */
  const goToMonth = useCallback((month: Date, direction: number) => {
    setMonthState({ month, direction });
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
  useEffect(() => {
    setDragCallbacks({
      onDrop: (baseId, to, occurrence) => {
        const previous = useEventsStore.getState().byId[baseId]?.date;
        move(baseId, to);
        setSelectedDate(keyToDate(to));
        toast(
          occurrence.isRecurring
            ? `הסדרה "${occurrence.title}" הועברה`
            : `"${occurrence.title}" הועבר`,
          previous
            ? { label: 'ביטול', run: () => move(baseId, previous) }
            : undefined,
        );
      },
      onEdge: (edge) => {
        setMonthState((prev) => ({
          month: addMonths(prev.month, edge === 'next' ? 1 : -1),
          direction: edge === 'next' ? 1 : -1,
        }));
      },
    });
  }, [move]);

  /* ------------------------------- חלוניות ------------------------------- */
  const openEditor = useCallback((date: DateKey) => {
    setEditor({ open: true, date, editing: null });
  }, []);

  const editOccurrence = useCallback((occurrence: Occurrence) => {
    setEditor({ open: true, date: occurrence.date, editing: occurrence });
  }, []);

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
                panelOpen={panelOpen}
                onPanelOpenChange={setPanelOpen}
                onOpenDayView={setDayViewDate}
                onAddEvent={openEditor}
                onEditEvent={editOccurrence}
                onProfile={() => setTab('settings')}
                onSearch={() => setSearchOpen(true)}
                onOpenYear={() => {
                  setYearValue(monthState.month.getFullYear());
                  setYearOpen(true);
                }}
                photoURL={authUser?.photoURL ?? null}
                bottomInset={bottomInset}
              />
            )}

            {tab === 'shabbat' && (
              <ShabbatScreen onPickCity={() => setCityOpen(true)} bottomInset={bottomInset} />
            )}

            {tab === 'settings' && (
              <SettingsScreen onPickCity={() => setCityOpen(true)} bottomInset={bottomInset} />
            )}
            </motion.main>
          </AnimatePresence>
        </div>

        <TabBar active={tab} onChange={setTab} />
        <Toaster bottomInset={bottomInset} />
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

      <EventEditor
        open={editor.open}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
        date={editor.date}
        editing={editor.editing}
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
