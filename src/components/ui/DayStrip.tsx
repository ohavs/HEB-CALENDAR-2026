/**
 * רצועת ימים: אריחים גדולים במקום שורה של "תאריך ›".
 *
 * רוב האירועים נקבעים לימים הקרובים, ושורה שפותחת לוח חודשי בגיליון
 * נוסף ביקשה שלוש נגיעות בשביל "ביום רביעי". כאן היום הקרוב נמצא מתחת
 * לאצבע, עם התאריך העברי שלו, והחודש המלא נפרש במקום - הקשה על שם
 * החודש - בשביל מה שרחוק.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DateKey } from '@/types';
import {
  GREG_MONTHS_HE,
  WEEKDAYS_HE,
  addDays,
  dateKey,
  keyToDate,
} from '@/lib/dates';
import { hebrewDateParts } from '@/lib/hebrew';
import { ENTER, EXIT, GLIDE, ICON, SNAP } from '@/lib/motion';
import { ChevronDown } from './icons';
import { MonthCalendar } from './Picker';

/** שבוע אחורה וחמישה קדימה: מספיק לגלול, וקצר מספיק לבנות בכל ציור */
const WEEKS_BEFORE = 1;
const WEEKS_TOTAL = 6;

function weekStartKey(key: DateKey): DateKey {
  const d = keyToDate(key);
  return dateKey(addDays(d, -d.getDay()));
}

export function DayStrip({
  value,
  onChange,
  min,
  range,
  headerEnd,
  label = 'תאריך',
}: {
  value: DateKey;
  onChange: (next: DateKey) => void;
  /** היום המוקדם ביותר שאפשר לבחור - סיום של אירוע רב־יומי */
  min?: DateKey;
  /** פרישה של אירוע רב־יומי: הימים שבתוכה מסומנים */
  range?: { from: DateKey; to: DateKey };
  /** תוכן בקצה שורת החודש - הצ׳יפ "כמה ימים" */
  headerEnd?: ReactNode;
  label?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  /*
    החלון נעוץ בשבוע, ולא ממורכז סביב הבחירה: חלון שזז עם כל הקשה היה
    מזיז את האריחים מתחת לאצבע. הוא קופץ רק כשהבחירה יצאה ממנו - מהחודש
    הפרוש, למשל.
  */
  const [anchor, setAnchor] = useState(() => weekStartKey(value));
  const days = useMemo(() => {
    const first = addDays(keyToDate(anchor), -7 * WEEKS_BEFORE);
    return Array.from({ length: 7 * WEEKS_TOTAL }, (_, i) => addDays(first, i));
  }, [anchor]);
  const firstKey = dateKey(days[0]);
  const lastKey = dateKey(days[days.length - 1]);
  if (value < firstKey || value > lastKey) {
    // עדכון בזמן הציור, כמו ב-`usePageDirection`: החלון צריך להיות נכון כבר עכשיו
    setAnchor(weekStartKey(value));
  }

  const hebrew = useMemo(() => days.map((d) => hebrewDateParts(d).day), [days]);
  const todayKey = dateKey(new Date());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  /*
    ref של פונקציה ולא אפקט: הרצועה נבנית מחדש כשהחודש הפרוש נסגר, רק
    אחרי שהוא סיים לצאת, ואפקט על `value` היה רץ כשעוד אין לה אריחים.
    כך הגלילה קורית בדיוק כשאריח נבחר מופיע - בפתיחה, בבחירה, ובחזרה.

    `block: 'nearest'` כדי שהטופס עצמו לא יזוז: הרצועה גוללת הצידה
    בלבד. בפתיחה בלי אנימציה - הגיליון כבר נכנס, ועוד תנועה בתוכו רעש.
  */
  const revealSelected = useCallback((node: HTMLButtonElement | null) => {
    node?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: mounted.current ? 'smooth' : 'auto',
    });
  }, []);

  const shown = keyToDate(value);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="focus-ring -ms-1 flex h-10 items-center gap-1.5 rounded-tile px-1 text-body font-semibold text-ink"
        >
          {GREG_MONTHS_HE[shown.getMonth()]} {shown.getFullYear()}
          <motion.span
            className="text-muted"
            initial={false}
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={SNAP}
          >
            <ChevronDown size={ICON.md} weight="bold" />
          </motion.span>
        </button>
        <span className="flex-1" />
        {headerEnd}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {expanded ? (
          <motion.div
            key="month"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: GLIDE, opacity: ENTER }}
            className="overflow-hidden"
          >
            <MonthCalendar
              value={value}
              min={min}
              range={range}
              onWell
              onChange={(key) => {
                onChange(key);
                setExpanded(false);
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="strip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: EXIT }}
            transition={ENTER}
            role="radiogroup"
            aria-label={label}
            /*
              רצועה נגללת הצידה אינה ידית של הגיליון: המחווה שלה אופקית,
              וירידה קלה של האצבע באמצע גלילה הייתה סוגרת טופס מלא.
            */
            data-sheet-no-dismiss
            className="no-scrollbar -mx-3 flex snap-x gap-1.5 overflow-x-auto px-3 pb-0.5"
          >
            {days.map((d, i) => {
              const key = dateKey(d);
              const selected = key === value;
              const inRange = Boolean(range && key > range.from && key < range.to);
              const edge = Boolean(range && (key === range.from || key === range.to));
              const disabled = Boolean(min && key < min);
              return (
                <button
                  key={key}
                  ref={selected ? revealSelected : undefined}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${WEEKDAYS_HE[d.getDay()]} ${d.getDate()} ב${GREG_MONTHS_HE[d.getMonth()]}, ${hebrew[i]}`}
                  disabled={disabled}
                  onClick={() => onChange(key)}
                  className={`focus-ring relative flex h-[72px] w-14 shrink-0 snap-center flex-col items-center justify-center gap-0.5 rounded-field transition-colors disabled:opacity-30 ${
                    selected
                      ? 'bg-inverse text-on-inverse shadow-raised'
                      : edge
                        ? 'bg-ink/20 text-ink'
                        : inRange
                          ? 'bg-ink/10 text-ink'
                          : 'bg-surface text-ink'
                  }`}
                >
                  {/* היום מסומן בנקודה, כדי שאפשר יהיה לספור ממנו בלי לקרוא */}
                  {key === todayKey && (
                    <span
                      aria-hidden
                      className="absolute top-1.5 h-1 w-1 rounded-full bg-current"
                    />
                  )}
                  <span className={`text-tiny font-medium ${selected ? '' : 'text-muted'}`}>
                    {WEEKDAYS_HE[d.getDay()]}
                  </span>
                  <span className="tnum text-title font-semibold leading-none">{d.getDate()}</span>
                  <span className={`text-micro ${selected ? 'opacity-75' : 'text-faint'}`}>
                    {hebrew[i]}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
