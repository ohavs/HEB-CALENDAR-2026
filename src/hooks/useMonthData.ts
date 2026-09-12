/** חישוב הנתונים של חודש שלם - מועדים, זמנים ואירועי המשתמש. */
import { useMemo } from 'react';
import type { DateKey, DayInfo } from '@/types';
import { monthGridDays, monthKey } from '@/lib/dates';
import { buildDays } from '@/lib/hebrew';
import { findCity } from '@/lib/locations';
import { expandEvents, type Occurrence } from '@/lib/recurrence';
import { toFilters, useSettings } from '@/store/settings';
import { useEvents } from '@/store/events';

/** חתימה של ההגדרות שמשפיעות על החישוב, כדי לא לחשב מחדש לחינם. */
function filtersSignature(...values: unknown[]): string {
  return values.join('|');
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

  const signature = filtersSignature(
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

  const gridDays = useMemo(
    () => monthGridDays(month, settings.weekStart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mk, settings.weekStart],
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
