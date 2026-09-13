/**
 * חיפוש באירועים ובמועדים.
 *
 * שלושה דברים שהחיפוש הקודם לא עשה:
 *   - חיפש רק בשנה הנוכחית ובזו שאחריה, כך ש"פסח" לא נמצא באפריל הבא
 *   - השווה מחרוזות גולמיות, כך שגרשיים או ניקוד הכשילו את ההתאמה
 *   - לא זכר כלום, כך שכל חיפוש חוזר הוקלד מחדש
 *
 * הדירוג: קודם עוצמת ההתאמה (ראו lib/search), ובאותה עוצמה - מה שקרוב
 * יותר להיום. מועד שעבר אינו נמחק אבל יורד למטה, כי "מתי היה פסח" היא
 * שאלה לגיטימית בדיוק כמו "מתי יהיה".
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Clock, Search, X } from 'lucide-react';
import { dateKey, dayTitleLabel, keyToDate, startOfDay } from '@/lib/dates';
import { yearHolidays, type YearHoliday } from '@/lib/hebrew';
import { findCity } from '@/lib/locations';
import { bestScore, clearRecentSearches, recentSearches, rememberSearch } from '@/lib/search';
import { toFilters, useSettings } from '@/store/settings';
import { useEvents } from '@/store/events';
import type { UserEvent } from '@/types';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE, TAP_SCALE } from '@/lib/motion';

/** כמה שנים אחורה וקדימה נסרקות אחרי מועדים */
const YEARS_BACK = 2;
const YEARS_FORWARD = 3;
/** אחרי כמה תווים מתחילים לחפש */
const MIN_QUERY = 2;

const MAX_HOLIDAYS = 24;
const MAX_EVENTS = 30;

/** מרחק בימים מהיום, לשבירת שוויון בדירוג. */
function daysFromToday(key: string, todayKey: string): number {
  return Math.abs(
    (keyToDate(key).getTime() - keyToDate(todayKey).getTime()) / 86_400_000,
  );
}

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
  const [recents, setRecents] = useState<string[]>([]);
  const q = query.trim();
  const active = q.length >= MIN_QUERY;

  const todayKey = dateKey(startOfDay(new Date()));

  // מרעננים את ההיסטוריה בכל פתיחה, ומנקים את השדה
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setRecents(recentSearches());
  }, [open]);

  /** שומרים את השאילתה רק כשבוחרים ממנה תוצאה - לא בכל הקשה. */
  const commit = (term: string) => {
    rememberSearch(term);
    setRecents(recentSearches());
  };

  const holidays = useMemo(() => {
    if (!active) return [];
    const city = findCity(settings.cityId);
    const options = { ...toFilters(settings), city };
    const all: YearHoliday[] = [];
    for (let y = year - YEARS_BACK; y <= year + YEARS_FORWARD; y += 1) {
      all.push(...yearHolidays(y, options));
    }
    return all
      .map((h) => ({ h, score: bestScore([h.title, h.hebrewDate], q) }))
      .filter((x) => x.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || daysFromToday(a.h.key, todayKey) - daysFromToday(b.h.key, todayKey),
      )
      .slice(0, MAX_HOLIDAYS)
      .map((x) => x.h);
  }, [active, q, year, settings, todayKey]);

  const matchedEvents = useMemo(() => {
    if (!active) return [];
    return events
      .map((e) => ({ e, score: bestScore([e.title, e.location, e.notes], q) }))
      .filter((x) => x.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || daysFromToday(a.e.date, todayKey) - daysFromToday(b.e.date, todayKey),
      )
      .slice(0, MAX_EVENTS)
      .map((x) => x.e);
  }, [active, q, events, todayKey]);

  const empty = active && !matchedEvents.length && !holidays.length;

  return (
    <Sheet open={open} onClose={onClose} size="tall" title="חיפוש">
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-well px-4 py-3.5">
        <Search size={ICON.lg} strokeWidth={STROKE} className="shrink-0 text-faint" />
        <input
          id="search-query"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="אירוע, חג או מועד"
          autoFocus
          className="field-reset bg-transparent p-0 text-body text-ink placeholder:text-faint"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="ניקוי החיפוש"
            className="focus-ring -me-1 shrink-0 rounded-full p-1 text-faint"
          >
            <X size={ICON.sm} strokeWidth={STROKE} />
          </button>
        )}
      </div>

      {/* מצב פתיחה: חיפושים אחרונים, או הסבר קצר אם אין */}
      {!active && (
        <>
          {recents.length > 0 ? (
            <section className="mb-4">
              <div className="mb-2 flex items-center justify-between px-2">
                <h3 className="text-caption font-semibold text-faint">חיפושים אחרונים</h3>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearches();
                    setRecents([]);
                  }}
                  className="focus-ring rounded-lg px-1 text-caption text-muted"
                >
                  ניקוי
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recents.map((term) => (
                  <motion.button
                    key={term}
                    type="button"
                    whileTap={TAP_SCALE}
                    onClick={() => setQuery(term)}
                    className="focus-ring flex items-center gap-2 rounded-2xl bg-well px-3.5 py-2.5 text-caption font-medium text-ink"
                  >
                    <Clock size={ICON.xs} strokeWidth={STROKE} className="text-faint" />
                    {term}
                  </motion.button>
                ))}
              </div>
            </section>
          ) : (
            <p className="py-8 text-center text-label text-muted">
              חפשו אירוע שיצרתם, או חג ומועד בלוח העברי
            </p>
          )}
        </>
      )}

      {empty && (
        <div className="py-10 text-center">
          <p className="text-label text-muted">לא נמצאו תוצאות עבור "{q}"</p>
          <p className="mt-1.5 text-caption text-faint">
            החיפוש סורק {YEARS_BACK + YEARS_FORWARD + 1} שנים סביב {year}
          </p>
        </div>
      )}

      {matchedEvents.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 px-2 text-caption font-semibold text-faint">האירועים שלי</h3>
          <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">
            {matchedEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  commit(q);
                  onPickEvent(e);
                  onClose();
                }}
                className="focus-ring-inset flex w-full items-center gap-3.5 px-4 py-4 text-right"
              >
                <span className={`ev ev-${e.color} ev-solid h-2.5 w-2.5 shrink-0 rounded-md`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-ink">{e.title}</span>
                  <span className="mt-0.5 block truncate text-caption text-muted">
                    {dayTitleLabel(keyToDate(e.date))}
                    {e.startTime ? ` · ${e.startTime}` : ''}
                    {e.location ? ` · ${e.location}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {holidays.length > 0 && (
        <section className="mb-4">
          <h3 className="mb-2 px-2 text-caption font-semibold text-faint">חגים ומועדים</h3>
          <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">
            {holidays.map((h) => (
              <button
                key={`${h.key}-${h.title}`}
                type="button"
                onClick={() => {
                  commit(q);
                  onPickDate(h.date);
                  onClose();
                }}
                className="focus-ring-inset flex w-full items-center gap-3.5 px-4 py-4 text-right"
              >
                <span className="w-5 shrink-0 text-center text-body">
                  {h.emoji ?? <CalendarDays size={ICON.sm} className="text-faint" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-ink">{h.title}</span>
                  <span className="mt-0.5 block truncate text-caption text-muted">
                    {dayTitleLabel(h.date)} · {h.hebrewDate}
                  </span>
                </span>
                {h.key < todayKey && (
                  <span className="shrink-0 text-micro text-faint">עבר</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </Sheet>
  );
}
