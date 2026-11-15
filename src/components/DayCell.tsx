/**
 * תא יום בלוח השנה.
 * נקי ושקט: מספר גדול ולשמאלו תאריך עברי קטן, ואז המועדים והאירועים.
 * התאריך העברי יושב באותה שורה ולא מתחתיו - שורה שלמה בכל תא רק בשבילו
 * דחקה החוצה כיתוב של אירוע. התא הוא גם יעד השחרור בגרירת אירועים.
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
import { planCell, type CellMetrics } from '@/lib/cellLayout';

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
 * מועד מודגש בדיו בהיר התחרה בו על תשומת הלב. במצב בהיר אין
 * בעיה כזו, כי המספר כהה משמעותית מהשם.
 */
function holidayTone(kind: HolidayKind): string {
  switch (kind) {
    case 'yomtov':
    case 'majorfast':
      return 'font-semibold dark:font-medium text-ink';
    case 'cholhamoed':
    case 'minor':
      return 'text-ink/85';
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
  /** המידות של התא והגופן, כפי שנמדדו ברשת */
  metrics: CellMetrics;
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
  metrics,
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
    מה שהמשתמש הכניס קודם למועדים.

    קודם היה הפוך: מועד אחד היה מובטח תמיד, והאירועים קיבלו את מה
    שנשאר. בחודש עמוס במועדים - תשרי, למשל - זה דחק החוצה בדיוק את מה
    שהמשתמש בא לראות. מועד הוא מידע שחוזר כל שנה ואפשר למצוא אותו
    בלשונית "שבת וחגים"; פגישה ב-15:00 קיימת רק כאן.

    מה שנדחק אינו נעלם: המונה בפינה סופר אותו, וחלונית היום מראה הכול.

    כותרת של אירוע נשברת לכמה שורות כמו שם של מועד, ולא נחתכת אחרי
    מילה: בתא של טלפון נכנסים כשישה תווים בשורה. כמה שורות כל אחד מקבל,
    ואיך זמן ההדלקה נשמר מראש בתקציב - ב-`planCell`.
  */
  const plan = planCell(
    occurrences.map((occ) => ({
      title: occ.title,
      multiDay: occ.spanLength > 1,
      icon: Boolean(occ.shared),
    })),
    holidays.length,
    Boolean(time),
    metrics,
  );
  const shownEvents = plan.eventLines.map((lines, i) => ({ occ: occurrences[i], lines }));
  const shownHolidays = holidays.slice(0, plan.holidays);

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
      } ${day.isShabbat && !dim ? 'bg-well/70' : ''}`}
      aria-label={cellLabel(day, shownHolidays, occurrences.length)}
      aria-selected={selected}
      aria-current={day.isToday ? 'date' : undefined}
    >
      {isDropTarget && (
        <motion.span
          layoutId="drop-target"
          className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-ink bg-ink/10"
          transition={TAP}
        />
      )}

      {/*
        מספר היום, ולשמאלו התאריך העברי. ב-RTL "לשמאל" הוא סוף השורה,
        ולכן הוא בא אחרי המספר. העיגולים נמדדים ביחס לגודל הגופן ולכן
        גדלים איתו. העטיפה של המספר רחבה כמו העיגול, כדי שהתאריך העברי
        יתחיל אחריו ולא ייבלע בו ביום הנוכחי או הנבחר.

        היום הוא עיגול דיו מלא, והנבחר טבעת. הפוך ממה שהיה: "היום" הוא
        עוגן שהעין מחפשת בכל פתיחה, והבחירה זזה בכל הקשה - טבעת שזזה
        שקטה יותר מעיגול מלא שקופץ בין תאים. כשהם אותו יום, העיגול קטן
        ונכנס לתוך הטבעת, כדי ששניהם ייקראו.
      */}
      <span className="relative flex shrink-0 items-baseline justify-center gap-[3px] text-daynum">
        <span className="relative flex min-w-[1.75em] items-center justify-center">
          {selected && (
            <motion.span
              layoutId={`day-selection-${layoutGroupId}`}
              className="absolute h-[1.75em] w-[1.75em] rounded-full border-[1.5px] border-ink"
              transition={SNAP}
            />
          )}
          {day.isToday && (
            <span
              className={`absolute rounded-full bg-inverse transition-[width,height] ${
                selected ? 'h-[1.4em] w-[1.4em]' : 'h-[1.75em] w-[1.75em]'
              }`}
            />
          )}
          <span
            className={`tnum relative leading-[1.6] ${
              day.isToday
                ? 'font-semibold text-on-inverse'
                : selected
                  ? 'font-semibold text-ink'
                  : day.isRestDay
                    ? 'font-medium text-ink'
                    : 'font-medium text-ink'
            }`}
          >
            {day.date.getDate()}
          </span>
        </span>

        {settings.showHebrewDates && (
          <span
            className={`text-[0.6em] leading-none ${
              day.hebrewDay === 'א׳' ? 'font-medium text-muted' : 'text-faint'
            }`}
          >
            {day.hebrewDay}
          </span>
        )}
      </span>

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
