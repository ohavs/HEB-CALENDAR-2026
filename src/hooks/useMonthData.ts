/** חישוב הנתונים של חודש שלם - מועדים, זמנים ואירועי המשתמש. */
import { useMemo } from 'react';
import type { DateKey, DayInfo } from '@/types';
import { addDays, dateKey, monthGridDays, monthKey } from '@/lib/dates';
import { buildDays } from '@/lib/hebrew';
import { findCity } from '@/lib/locations';
import { expandEvents, type Occurrence } from '@/lib/recurrence';
import { toFilters, useSettings } from '@/store/settings';
import { useEvents } from '@/store/events';
import { useAuthStore } from '@/store/auth';
import { useSharedStore } from '@/store/shared';
import { mergeOccurrences, sharedOccurrences } from '@/lib/sharedCalendar';

/**
 * המופעים המשותפים בטווח, ממוזגים עם האישיים.
 *
 * הרשימות המשותפות אינן עוברות ב-`persist` והן מתעדכנות ב-onSnapshot,
 * ולכן זהות האובייקטים משתנה בכל תשובה מהשרת. החתימה היא מה שמונע
 * חישוב מחדש של הלוח כולו בכל פעימה כזו.
 */
function useWithShared(
  personal: Map<DateKey, Occurrence[]>,
  start: Date,
  end: Date,
): Map<DateKey, Occurrence[]> {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const lists = useSharedStore((s) => s.lists);
  const items = useSharedStore((s) => s.items);
  const range = `${dateKey(start)}..${dateKey(end)}`;

  const signature = lists
    .map((list) => `${list.id}:${list.name}:${(items[list.id] ?? []).length}`)
    .join('|');

  const shared = useMemo(
    () => sharedOccurrences(lists, items, uid, start, end),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, uid, range, items],
  );

  return useMemo(() => mergeOccurrences(personal, shared), [personal, shared]);
}

/** עוגן ליום שאינו פתוח. ראו `useDayData`. */
const EPOCH = new Date(0);

/** חתימה של ההגדרות שמשפיעות על החישוב, כדי לא לחשב מחדש לחינם. */
function filtersSignature(...values: unknown[]): string {
  return values.join('|');
}

/** אותה חתימה, נגזרת מההגדרות. מרוכזת כאן כדי שכל הוק ישתמש בה. */
function useFiltersSignature(settings: ReturnType<typeof useSettings>): string {
  return filtersSignature(
    settings.cityId,
    settings.showJewishHolidays,
    settings.showIsraeliHolidays,
    settings.showMinorHolidays,
    settings.showFasts,
    settings.showRoshChodesh,
    settings.showParsha,
    settings.showOmer,
    settings.showCandleTimes,
    settings.candleLightingMins,
    settings.havdalahMode,
    settings.havdalahDegrees,
    settings.havdalahMins,
  );
}

export type MonthData = {
  gridDays: Date[];
  days: Map<DateKey, DayInfo>;
  occurrences: Map<DateKey, Occurrence[]>;
};

export function useMonthData(month: Date): MonthData {
  const settings = useSettings();
  const events = useEvents();
  const mk = monthKey(month);

  const signature = useFiltersSignature(settings);

  const gridDays = useMemo(
    () => monthGridDays(month),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mk],
  );

  const days = useMemo(
    () =>
      buildDays(
        gridDays[0],
        gridDays[gridDays.length - 1],
        { ...toFilters(settings), city: findCity(settings.cityId) },
        month,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridDays, signature],
  );

  const personal = useMemo(
    () => expandEvents(events, gridDays[0], gridDays[gridDays.length - 1]),
    [events, gridDays],
  );
  const occurrences = useWithShared(personal, gridDays[0], gridDays[gridDays.length - 1]);

  return { gridDays, days, occurrences };
}

/** מפה ריקה יציבה, כדי שהוק שאין לו יום לא יפיל את ההשוואות במעלה הזרם */
const NO_OCCURRENCES: Map<DateKey, Occurrence[]> = new Map();

/** נתוני יום בודד, לתצוגת היום המורחבת. */
export function useDayData(date: Date | null) {
  const settings = useSettings();
  const events = useEvents();
  const key = date ? monthKey(date) + '-' + date.getDate() : '';

  const personal = useMemo(
    () => (date ? expandEvents(events, date, date) : NO_OCCURRENCES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, events],
  );
  /*
    ההוקים חייבים לרוץ גם כשאין יום פתוח, ולכן העוגן נופל ל-1 בינואר
    1970: הטווח ריק ממילא, והמיזוג מחזיר את המפה הריקה כמות שהיא.
  */
  const anchor = date ?? EPOCH;
  const merged = useWithShared(personal, anchor, anchor);

  return useMemo(() => {
    if (!date) return null;
    const map = buildDays(date, date, {
      ...toFilters(settings),
      city: findCity(settings.cityId),
      showCandleTimes: true,
    });
    const day = [...map.values()][0];
    return { day, occurrences: [...merged.values()].flat() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, merged, settings]);
}


/* ==========================================================================
   טווח חופשי - תצוגת שבוע וסדר יום
   ========================================================================== */

export type RangeData = {
  dates: Date[];
  days: Map<DateKey, DayInfo>;
  occurrences: Map<DateKey, Occurrence[]>;
};

/**
 * נתוני טווח תאריכים כלשהו. משרת גם את תצוגת השבוע וגם את סדר היום,
 * ונשען על אותו מטמון של buildDays - ולכן מעבר בין התצוגות אינו מחשב
 * מחדש את מה שכבר חושב.
 */
export function useRangeData(start: Date, end: Date): RangeData {
  const settings = useSettings();
  const events = useEvents();
  const signature = useFiltersSignature(settings);
  const range = `${dateKey(start)}..${dateKey(end)}`;

  const dates = useMemo(() => {
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const days = useMemo(
    () => buildDays(start, end, { ...toFilters(settings), city: findCity(settings.cityId) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range, signature],
  );

  const personal = useMemo(
    () => expandEvents(events, start, end),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, range],
  );
  const occurrences = useWithShared(personal, start, end);

  return { dates, days, occurrences };
}
