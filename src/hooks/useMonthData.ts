/** חישוב הנתונים של חודש שלם - מועדים, זמנים ואירועי המשתמש. */
import { useMemo } from 'react';
import type { DateKey, DayInfo } from '@/types';
import { addDays, dateKey, monthGridDays, monthKey } from '@/lib/dates';
import { buildDays } from '@/lib/hebrew';
import { findCity } from '@/lib/locations';
import { expandEvents, type Occurrence } from '@/lib/recurrence';
import { toFilters, useSettings } from '@/store/settings';
import { useEvents } from '@/store/events';

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

  const occurrences = useMemo(
    () => expandEvents(events, gridDays[0], gridDays[gridDays.length - 1]),
    [events, gridDays],
  );

  return { gridDays, days, occurrences };
}

/** נתוני יום בודד, לתצוגת היום המורחבת. */
export function useDayData(date: Date | null) {
  const settings = useSettings();
  const events = useEvents();
  const key = date ? monthKey(date) + '-' + date.getDate() : '';

  return useMemo(() => {
    if (!date) return null;
    const map = buildDays(date, date, {
      ...toFilters(settings),
      city: findCity(settings.cityId),
      showCandleTimes: true,
    });
    const day = [...map.values()][0];
    const occurrences = expandEvents(events, date, date);
    return { day, occurrences: [...occurrences.values()].flat() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, events, settings]);
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

  const occurrences = useMemo(
    () => expandEvents(events, start, end),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, range],
  );

  return { dates, days, occurrences };
}
