/** חיפוש באירועים ובמועדים. */
import { useMemo, useState } from 'react';
import { CalendarDays, Search } from 'lucide-react';
import { dayTitleLabel, keyToDate } from '@/lib/dates';
import { yearHolidays } from '@/lib/hebrew';
import { findCity } from '@/lib/locations';
import { toFilters, useSettings } from '@/store/settings';
import { useEvents } from '@/store/events';
import type { UserEvent } from '@/types';
import { Sheet } from './ui/Sheet';

export function SearchSheet({
  open,
  onClose,
  year,
  onPickDate,
  onPickEvent,
}: {
  open: boolean;
  onClose: () => void;
  year: number;
  onPickDate: (date: Date) => void;
  onPickEvent: (event: UserEvent) => void;
}) {
  const settings = useSettings();
  const events = useEvents();
  const [query, setQuery] = useState('');
  const q = query.trim();

  const holidays = useMemo(() => {
    if (!q) return [];
    const city = findCity(settings.cityId);
    // מחפשים בשנה הנוכחית ובשנה שאחריה
    return [
      ...yearHolidays(year, { ...toFilters(settings), city }),
      ...yearHolidays(year + 1, { ...toFilters(settings), city }),
    ]
      .filter((h) => h.title.includes(q))
      .slice(0, 20);
  }, [q, year, settings]);

  const matchedEvents = useMemo(() => {
    if (!q) return [];
    return events
      .filter(
        (e) =>
          e.title.includes(q) ||
          (e.location ?? '').includes(q) ||
          (e.notes ?? '').includes(q),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 30);
  }, [q, events]);

  return (
    <Sheet open={open} onClose={onClose} size="tall" title="חיפוש">
      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-well px-3.5 py-2.5">
        <Search size={16} strokeWidth={2.3} className="shrink-0 text-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="אירוע, חג או מועד"
          autoFocus
          className="w-full border-none bg-transparent p-0 text-[15px] text-ink outline-none placeholder:text-faint"
        />
      </div>

      {!q && (
        <p className="py-8 text-center text-[13.5px] text-muted">
          חפשו אירוע שיצרתם, או חג ומועד בלוח העברי
        </p>
      )}

      {q && matchedEvents.length === 0 && holidays.length === 0 && (
        <p className="py-8 text-center text-[13.5px] text-muted">לא נמצאו תוצאות</p>
      )}

      {matchedEvents.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-faint">
            האירועים שלי
          </h3>
          <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">
            {matchedEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  onPickEvent(e);
                  onClose();
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-right"
              >
                <span className={`ev ev-${e.color} h-8 w-1.5 shrink-0 rounded-full`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium text-ink">
                    {e.title}
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {dayTitleLabel(keyToDate(e.date))}
                    {e.startTime ? ` · ${e.startTime}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {holidays.length > 0 && (
        <section className="mb-4">
          <h3 className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-faint">
            חגים ומועדים
          </h3>
          <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">
            {holidays.map((h) => (
              <button
                key={`${h.key}-${h.title}`}
                type="button"
                onClick={() => {
                  onPickDate(h.date);
                  onClose();
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-right"
              >
                <span className="w-5 shrink-0 text-center text-[15px]">
                  {h.emoji ?? <CalendarDays size={15} className="text-faint" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium text-ink">
                    {h.title}
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {dayTitleLabel(h.date)} · {h.hebrewDate}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </Sheet>
  );
}
