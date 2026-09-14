/**
 * מחזיק את הוידג׳טים במסך הבית מעודכנים.
 *
 * הוידג׳ט מצויר בתהליך של מערכת ההפעלה גם כשהאפליקציה סגורה, ולכן הוא
 * אינו יכול לחשב כלום בעצמו. כל עוד האפליקציה פתוחה ההוק הזה מפרסם לו
 * תמונת מצב מוכנה, בכל שינוי באירועים או בהגדרות.
 *
 * הכיוון השני: מה שנעשה בוידג׳ט בזמן שהאפליקציה הייתה סגורה - סימון
 * "בוצע", הוספת תזכורת - ממתין בתור, ומיושם כאן ברגע שהאפליקציה חוזרת
 * לחזית. רק אחרי היישום מפרסמים מחדש, אחרת הפרסום היה דורס את מה שעוד
 * לא הספקנו לקרוא.
 */
import { useEffect, useRef, useState } from 'react';
import { addDays, dateKey, monthGridDays } from '@/lib/dates';
import { buildDays, upcomingShabbatot } from '@/lib/hebrew';
import { findCity } from '@/lib/locations';
import { expandEvents } from '@/lib/recurrence';
import { toFilters, useSettings } from '@/store/settings';
import { useEvents, useEventsStore } from '@/store/events';
import { isNative } from '@/lib/native';
import {
  REMINDER_HORIZON_DAYS,
  buildCalendarWidget,
  buildRemindersWidget,
  buildShabbatWidget,
  parseOccurrenceRef,
  type WidgetAction,
} from '@/lib/widgetData';
import { publishWidgets, takeWidgetActions } from '@/lib/widgetBridge';

/** מאחדים פרסומים צפופים: שינוי אחד של המשתמש מרעיד כמה עדכוני חנות. */
const DEBOUNCE_MS = 400;

export function useWidgets(): void {
  const settings = useSettings();
  const events = useEvents();
  const setDone = useEventsStore((s) => s.setOccurrenceDone);
  const add = useEventsStore((s) => s.add);
  /** משתנה כשהתור יושם, כדי לפרסם מחדש אחריו */
  const [applied, setApplied] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ------------------------------ פרסום ------------------------------ */
  useEffect(() => {
    if (!isNative()) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const now = new Date();
      const month = new Date(now.getFullYear(), now.getMonth(), 1);
      const grid = monthGridDays(month);
      const city = findCity(settings.cityId);
      const options = { ...toFilters(settings), city };

      // טווח אחד שמכסה גם את רשת החודש וגם את אופק התזכורות
      const from = grid[0] < now ? grid[0] : now;
      const to = addDays(now, REMINDER_HORIZON_DAYS + 25);
      const days = buildDays(from, to, options, month);
      const occurrences = expandEvents(events, from, to);

      void publishWidgets(
        buildCalendarWidget(month, grid, days, occurrences, now),
        buildRemindersWidget(events, days, occurrences, now),
        buildShabbatWidget(upcomingShabbatot(now, 8, options), city.name, now),
      );
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [settings, events, applied]);

  /* ---------------------- יישום מה שנעשה בוידג׳ט ---------------------- */
  useEffect(() => {
    if (!isNative()) return;

    const apply = (action: WidgetAction) => {
      if (action.type === 'done') {
        const ref = parseOccurrenceRef(action.ref);
        if (ref) setDone(ref.baseId, ref.sourceKey, action.done);
        return;
      }
      const title = action.title.trim();
      if (!title) return;
      // תזכורת שנוספה מהוידג׳ט היא פריט של יום שלם: לא נשאלה שם שעה
      add({
        title,
        date: action.date || dateKey(new Date()),
        startTime: null,
        endTime: null,
        allDay: true,
        color: settings.defaultEventColor,
        reminderMinutes: null,
        repeat: 'none',
      });
    };

    const drain = () => {
      void takeWidgetActions().then((actions) => {
        if (!actions.length) return;
        for (const action of actions) apply(action);
        setApplied((n) => n + 1);
      });
    };

    drain();
    const onVisible = () => {
      if (document.visibilityState === 'visible') drain();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // ההגדרות נקראות בתוך apply, אבל אין טעם לרשום מאזין מחדש בכל שינוי שלהן
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
