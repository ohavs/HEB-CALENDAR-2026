/**
 * סימונים לבורר התאריכים: נקודה לכל יום שיש בו אירוע של המשתמש,
 * ונקודה לכל יום שיש בו מועד משמעותי.
 *
 * "משמעותי" בכוונה מצומצם: ימים טובים, חול המועד, צומות, מועדים מדרבנן
 * (חנוכה, פורים) ומועדי ישראל. לא נכללים ראש חודש, פרשת השבוע, ספירת
 * העומר, ערבי חג וזמני כניסת ויציאת שבת - אחרת כמעט כל יום היה מסומן.
 *
 * הנקודות מגיעות משני מקורות - האירועים האישיים והפריטים המשותפים
 * שמשובצים ליום - כי הבורר עונה על שאלה אחת: "מה כבר יש לי ביום הזה".
 * בורר שסופר רק חצי מהתשובה גרוע מבורר שלא סופר כלל, והוא נפתח גם
 * מתוך עריכת פריט משותף - בדיוק המקום שבו הפריטים האלה חשובים.
 *
 * הן מוגבלות לשלוש, ובכוונה: הבורר נועד לבחור יום, לא לקרוא בו.
 */
import { useMemo } from 'react';
import type { DateKey, EventColor, HolidayKind } from '@/types';
import { buildDays } from '@/lib/hebrew';
import { findCity } from '@/lib/locations';
import { expandEvents } from '@/lib/recurrence';
import { toFilters, useSettings } from '@/store/settings';
import { useEvents } from '@/store/events';
import { useAuthStore } from '@/store/auth';
import { useSharedStore } from '@/store/shared';
import { sharedOccurrences } from '@/lib/sharedCalendar';

const SIGNIFICANT: ReadonlySet<HolidayKind> = new Set<HolidayKind>([
  'yomtov',
  'cholhamoed',
  'majorfast',
  'minorfast',
  'minor',
  'modern',
]);

export type DayMarker = {
  /** שמות המועדים המשמעותיים באותו יום */
  holidays: string[];
  /** צבעי האירועים של המשתמש באותו יום, עד שלושה */
  eventColors: EventColor[];
};

export function useDateMarkers(days: Date[]): Map<DateKey, DayMarker> {
  const settings = useSettings();
  const events = useEvents();
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const lists = useSharedStore((s) => s.lists);
  const items = useSharedStore((s) => s.items);
  const first = days[0];
  const last = days[days.length - 1];
  const rangeKey = first && last ? `${first.getTime()}-${last.getTime()}` : '';

  return useMemo(() => {
    const out = new Map<DateKey, DayMarker>();
    if (!first || !last) return out;

    const upsert = (key: DateKey): DayMarker => {
      const existing = out.get(key);
      if (existing) return existing;
      const fresh: DayMarker = { holidays: [], eventColors: [] };
      out.set(key, fresh);
      return fresh;
    };

    const dayInfos = buildDays(first, last, {
      ...toFilters(settings),
      city: findCity(settings.cityId),
      showCandleTimes: false,
      showParsha: false,
      showOmer: false,
      showRoshChodesh: false,
    });
    for (const [key, info] of dayInfos) {
      const notable = info.holidays.filter((h) => SIGNIFICANT.has(h.kind));
      if (notable.length) upsert(key).holidays = notable.map((h) => h.shortTitle);
    }

    const colors = new Map<DateKey, EventColor[]>();
    const collect = (source: Map<DateKey, { color: EventColor }[]>) => {
      for (const [key, list] of source) {
        if (!list.length) continue;
        const existing = colors.get(key) ?? [];
        colors.set(key, [...existing, ...list.map((o) => o.color)]);
      }
    };
    collect(expandEvents(events, first, last));
    collect(sharedOccurrences(lists, items, uid, first, last));

    for (const [key, list] of colors) {
      upsert(key).eventColors = [...new Set(list)].slice(0, 3);
    }

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, events, settings, lists, items, uid]);
}
