/**
 * תא יום בלוח השנה.
 * נקי ושקט: מספר גדול, תאריך עברי קטן מתחתיו, ואז המועדים והאירועים
 * ככיתובים דקים. התא הוא גם יעד השחרור בגרירת אירועים.
 *
 * כל המידות כאן נגזרות מגודל הגופן (יחידות em) כדי שהתא יגדל יחד עם
 * הסקאלה הנוזלית כשעוברים מטלפון למסך גדול.
 */
import { memo } from 'react';
import { motion } from 'framer-motion';
import type { DayInfo, HolidayItem, HolidayKind, Settings } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { MiniEventChip } from './EventChip';
import { useIsDropTarget } from '@/lib/dragEngine';
import { SNAP, TAP } from '@/lib/motion';

/**
 * מה שקורא מסך מקריא על התא. הכיתוב הקודם היה המספר והתאריך העברי
 * בלבד, כך שמשתמש עיוור לא ידע שיש ביום הזה חג או אירועים.
 */
function cellLabel(day: DayInfo, holidays: HolidayItem[], eventCount: number): string {
  const parts = [`${day.date.getDate()} ${day.hebrewFull}`];
  if (day.isToday) parts.push('היום');
  for (const h of holidays) parts.push(h.title);
  if (eventCount === 1) parts.push('אירוע אחד');
  else if (eventCount > 1) parts.push(`${eventCount} אירועים`);
  return parts.join(', ');
}

/**
 * צבע הכיתוב של מועד לפי סוגו.
 *
 * במצב כהה המשקל יורד: מספר היום מצויר ב-`text-ink` שהוא כמעט לבן, ושם
 * מועד מודגש ב-`brand-ink` בהיר התחרה בו על תשומת הלב. במצב בהיר אין
 * בעיה כזו, כי המספר כהה משמעותית מהשם.
 */
function holidayTone(kind: HolidayKind): string {
  switch (kind) {
    case 'yomtov':
    case 'majorfast':
      return 'font-semibold dark:font-medium text-brand-ink';
    case 'cholhamoed':
    case 'minor':
      return 'text-brand-ink/85';
    case 'modern':
      return 'text-[rgb(var(--c-shabbat))]';
    default:
      return 'text-muted';
  }
}

type Props = {
  day: DayInfo;
  occurrences: Occurrence[];
  selected: boolean;
  settings: Settings;
  /** כמה שורות כיתוב נכנסות בתא לפי הגובה בפועל */
  capacity: number;
  onSelect: (day: DayInfo) => void;
  layoutGroupId: string;
  /**
   * רק תא אחד ברשת נושא tabIndex=0 בכל רגע (roving tabindex), כדי
   * שהמקלדת לא תצטרך לעבור דרך 42 תאים כדי לצאת מהלוח.
   */
  focusable: boolean;
};

function DayCellInner({
  day,
  occurrences,
  selected,
  settings,
  capacity,
  onSelect,
  layoutGroupId,
  focusable,
}: Props) {
  const isDropTarget = useIsDropTarget(day.key);
  const dim = !day.inCurrentMonth;
  const compact = settings.density === 'compact';

  const holidays = settings.showJewishHolidays ? day.holidays : [];

  const candles = settings.showCandleTimes
    ? day.times.find((t) => t.kind === 'candles')
    : undefined;
  const havdalah = settings.showCandleTimes
    ? day.times.find((t) => t.kind === 'havdalah')
    : undefined;
  const time = candles ?? havdalah;

  /*
    תקציב השורות של התא, אחרי שזמן ההדלקה לוקח את שלו.

    הזמן מוצמד לתחתית התא ולכן הוא יורד מהתקציב כאן ולא בנוסחה
    הכללית: בלעדיו ימי שישי ושבת היו מציגים אירוע אחד פחות מכל יום
    אחר בלי שאיש החליט על כך, וזה מה שגרם לתוצאה להשתנות מתא לתא.
  */
  const budget = Math.max(1, capacity - (time ? 1 : 0));

  /*
    מה שהמשתמש הכניס בעצמו קודם למועדים.

    קודם היה הפוך: מועד אחד היה מובטח תמיד, והאירועים קיבלו את מה
    שנשאר. בחודש עמוס במועדים - תשרי, למשל - זה דחק החוצה בדיוק את מה
    שהמשתמש בא לראות. מועד הוא מידע שחוזר כל שנה ואפשר למצוא אותו
    בלשונית "שבת וחגים"; פגישה ב-15:00 קיימת רק כאן.

    מה שנדחק אינו נעלם: המונה בפינה סופר אותו, וחלונית היום מראה הכול.

    אירוע מקבל שתי שורות רק כשיש עודף גם אחרי שמובטחת שורה לכל אירוע
    שעוד ממתין, אחרת הראשון היה בולע את המקום של השני. פס רב־יומי נשאר
    בשורה אחת כדי שגובהו יהיה זהה בכל הימים שהוא חוצה.
  */
  const shownEvents: { occ: Occurrence; lines: 1 | 2 }[] = [];
  let left = budget;
  occurrences.forEach((occ, i) => {
    if (left <= 0) return;
    const waiting = occurrences.length - i - 1;
    const lines: 1 | 2 = left - waiting >= 2 && occ.spanLength === 1 ? 2 : 1;
    shownEvents.push({ occ, lines });
    left -= lines;
  });

  // המועדים לוקחים את מה שנשאר
  const shownHolidays = holidays.slice(0, Math.max(0, left));

  const hidden =
    holidays.length - shownHolidays.length + (occurrences.length - shownEvents.length);

  return (
    <button
      type="button"
      role="gridcell"
      data-day-key={day.key}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onSelect(day)}
      className={`focus-ring-inset relative flex min-h-0 select-none flex-col items-stretch overflow-hidden rounded-2xl px-1 pb-1 pt-1.5 text-center transition-colors ${
        dim ? 'opacity-45' : ''
      } ${day.isShabbat && !dim ? 'bg-brand/[0.045] dark:bg-brand/[0.12]' : ''}`}
      aria-label={cellLabel(day, shownHolidays, occurrences.length)}
      aria-selected={selected}
      aria-current={day.isToday ? 'date' : undefined}
    >
      {isDropTarget && (
        <motion.span
          layoutId="drop-target"
          className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-brand bg-brand/10"
          transition={TAP}
        />
      )}

      {/* מספר היום - עיגול הבחירה נמדד ביחס לגודל הגופן ולכן גדל איתו */}
      <span className="relative flex shrink-0 items-center justify-center text-daynum">
        {selected && (
          <motion.span
            layoutId={`day-selection-${layoutGroupId}`}
            className="absolute h-[1.75em] w-[1.75em] rounded-full bg-brand"
            transition={SNAP}
          />
        )}
        {day.isToday && !selected && (
          <span className="absolute h-[1.75em] w-[1.75em] rounded-full bg-brand-soft" />
        )}
        <span
          className={`tnum relative leading-[1.6] ${
            selected
              ? 'font-semibold text-white'
              : day.isToday
                ? 'font-semibold text-brand-ink'
                : day.isRestDay
                  ? 'font-medium text-brand-ink'
                  : 'font-medium text-ink'
          }`}
        >
          {day.date.getDate()}
        </span>
      </span>

      {/* תאריך עברי */}
      {settings.showHebrewDates && (
        <span
          className={`mt-px shrink-0 text-micro leading-none ${
            day.hebrewDay === 'א׳' ? 'font-medium text-brand-ink/70' : 'text-faint'
          }`}
        >
          {day.hebrewDay}
        </span>
      )}

      {/* מועדים, אירועים וזמנים */}
      <span className="mt-1 flex min-h-0 flex-col items-stretch gap-[3px] text-start">
        {/*
          במצב קומפקטי התא מוותר על הכיתובים: מועד אחד בשורה קצרה,
          והאירועים כנקודות צבע. במסך צר זה ההבדל בין תא שאפשר לקרוא
          לבין ארבעה כיתובים חתוכים.
        */}
        {compact ? (
          <>
            {shownHolidays.slice(0, 1).map((h) => (
              <span
                key={h.id}
                className={`truncate text-tiny leading-[1.2] ${holidayTone(h.kind)}`}
              >
                {h.shortTitle}
              </span>
            ))}
            {occurrences.length > 0 && (
              <span className="mt-0.5 flex flex-wrap justify-center gap-[3px]">
                {occurrences.slice(0, 4).map((occ) => (
                  <span
                    key={occ.occurrenceId}
                    className={`ev ev-${occ.color} ev-dot h-1.5 w-1.5 rounded-full`}
                  />
                ))}
              </span>
            )}
          </>
        ) : (
          <>
            {shownEvents.map(({ occ, lines }) => (
              <MiniEventChip
                key={occ.occurrenceId}
                occurrence={occ}
                lines={lines}
                // פס רב־יומי נושא כותרת בתחילתו, ושוב בתחילת כל שורת שבוע -
                // אחרת השורה השנייה של החופשה היא פס צבע בלי שם
                labelled={occ.spanIndex === 0 || day.date.getDay() === 0}
              />
            ))}

            {shownHolidays.map((h, i) => (
              <span
                key={h.id}
                className={`text-tiny leading-[1.2] ${holidayTone(h.kind)} ${
                  i === 0 && shownEvents.length === 0 ? 'line-clamp-2' : 'truncate'
                }`}
              >
                {h.shortTitle}
              </span>
            ))}
          </>
        )}

        {!compact && hidden > 0 && (
          <span className="text-micro font-medium leading-none text-faint">+{hidden}</span>
        )}
      </span>

      {/*
        זמן ההדלקה יושב מיד אחרי הכיתובים ולא נצמד לתחתית התא: הצמדה
        הייתה משאירה אותו מרחף 60px מתחת למספר בתא ריק, מנותק מהיום
        שהוא שייך לו. מה שכן השתנה הוא שהוא שמור מראש בתקציב למעלה,
        ולכן הוא כבר לא גוזל שורת אירוע בשקט.
      */}
      {time && (
        <span className="tnum flex shrink-0 items-center justify-center gap-0.5 pt-0.5 text-micro leading-none text-[rgb(var(--c-shabbat))]">
          <span aria-hidden="true">{candles ? '🕯' : '✦'}</span>
          {time.time}
        </span>
      )}
    </button>
  );
}

export const DayCell = memo(DayCellInner);
