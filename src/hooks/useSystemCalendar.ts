/**
 * מפרסם את האירועים ללוח "לוח עברי" ביומן של המכשיר.
 *
 * הלוח שם הוא מראה ולא מקור: כל פרסום מחליף את כולו, והצד הנייטיבי
 * מדלג כשלא השתנה דבר. החלון זז קדימה בכל עלייה של האפליקציה, ולכן
 * אירוע חוזר ממשיך להופיע גם בעוד שנה - בתנאי שהאפליקציה נפתחה.
 */
import { useEffect, useRef } from 'react';
import { addDays, startOfDay } from '@/lib/dates';
import { expandEvents } from '@/lib/recurrence';
import { mergeOccurrences, sharedOccurrences } from '@/lib/sharedCalendar';
import {
  SYSTEM_AHEAD_DAYS,
  SYSTEM_PAST_DAYS,
  buildSystemEvents,
} from '@/lib/systemCalendar';
import { isNative, syncSystemCalendar } from '@/lib/native';
import { useEvents } from '@/store/events';
import { useSettings } from '@/store/settings';
import { useAuthStore } from '@/store/auth';
import { useSharedStore } from '@/store/shared';

/** שינוי אחד של המשתמש מרעיד כמה עדכוני חנות; כתיבה ליומן אחת מספיקה */
const DEBOUNCE_MS = 1500;

export function useSystemCalendar(): void {
  const { systemCalendar } = useSettings();
  const events = useEvents();
  const lists = useSharedStore((s) => s.lists);
  const items = useSharedStore((s) => s.items);
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isNative() || !systemCalendar) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const today = startOfDay(new Date());
      const from = addDays(today, -SYSTEM_PAST_DAYS);
      const to = addDays(today, SYSTEM_AHEAD_DAYS);
      const merged = mergeOccurrences(
        expandEvents(events, from, to),
        sharedOccurrences(lists, items, uid, from, to),
      );
      void syncSystemCalendar(buildSystemEvents([...merged.values()].flat()));
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [systemCalendar, events, lists, items, uid]);
}
