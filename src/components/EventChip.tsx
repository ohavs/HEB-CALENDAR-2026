/**
 * ייצוגי האירוע: צ׳יפ זעיר לתא בלוח, וכרטיס מלא לרשימות.
 *
 * הצבע נישא על ידי רקע הכרטיס ותג השעה המלא, ולא על ידי פס דק בצד -
 * כך האירוע נקרא כיחידה אחת ולא כמלבן עם קישוט.
 */
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Check, MapPin, Repeat, Users } from 'lucide-react';
import { isSpanEnd, type Occurrence } from '@/lib/recurrence';
import { durationLabel } from '@/lib/dates';
import { beginLongPress, useIsDraggingOccurrence } from '@/lib/dragEngine';
import { haptic } from '@/lib/native';
import { ICON, STROKE, TAP, TAP_SCALE_LG } from '@/lib/motion';
import { MarqueeText } from './ui/MarqueeText';

/**
 * ייצוג האירוע בתוך תא בלוח, בשתי צורות לפי מה שהאירוע *הוא*:
 *
 * אירוע של יום אחד הוא נקודה בזמן, ולכן תווית: פס צבע בקצה ההתחלה
 * וטקסט על רקע התא. ברוחב תא של טלפון זה ההבדל בין "פגיש…" לבין
 * "פגישת צוות" - הגלולה לקחה כרבע מהרוחב לריפוד ולרקע.
 *
 * אירוע רב־יומי הוא טווח, ולכן פס מלא שנמשך על פני התאים: הפינות
 * מתעגלות רק בקצוות, המקטעים נמשכים אל המרווח שביניהם, וקו תחתון
 * רציף בצבע הרווי מחבר אותם לאובייקט אחד. רק היום הראשון של הפרישה
 * ותחילת כל שורת שבוע נושאים את הכותרת; בלי הקו התחתון מקטע ההמשך
 * היה מלבן פסטלי ריק, ואירוע של שלושה ימים נראה כאירוע של יום.
 */
export function MiniEventChip({
  occurrence,
  draggable = true,
  labelled = true,
  lines = 1,
}: {
  occurrence: Occurrence;
  draggable?: boolean;
  /** האם היום הזה נושא את הכותרת (רלוונטי רק לפס רב־יומי) */
  labelled?: boolean;
  /** כמה שורות טקסט מותר לתווית לתפוס, לפי המקום שנשאר בתא */
  lines?: 1 | 2;
}) {
  const isDragging = useIsDraggingOccurrence(occurrence.occurrenceId);
  const multiDay = occurrence.spanLength > 1;
  const isStart = occurrence.spanIndex === 0;
  const isEnd = isSpanEnd(occurrence);

  // הפינות בקצוות בלבד, ובאמצע הפס נמשך אל מחוץ לתא כדי לכסות את המרווח
  const shape = multiDay
    ? [
        'ev ev-span-rule px-1.5 py-1 font-semibold',
        isStart ? 'rounded-s-md' : '-ms-[3px] ps-[3px]',
        isEnd ? 'rounded-e-md' : '-me-[3px] pe-[3px]',
      ].join(' ')
    : 'ev-label ps-[5px] font-medium';

  return (
    <div
      className={`ev-${occurrence.color} overflow-hidden text-micro leading-[1.2] transition-opacity ${shape} ${
        isDragging ? 'opacity-25' : ''
      }`}
      style={{ touchAction: draggable ? 'none' : undefined }}
      onPointerDown={draggable ? (e) => beginLongPress(e, occurrence) : undefined}
    >
      {/*
        בתא צר יש מקום רק לכותרת; השעה מופיעה בפאנל ובתצוגת היום.

        לפריט מרשימה משותפת יש סימון קטן לפני הכותרת: בתא של הלוח
        "לחם" בלי הקשר נראה כמו אירוע שהמשתמש שכח שיצר, ולא כמו משהו
        שמישהו אחר הוסיף. שם הרשימה עצמו אינו נכנס לתא - הוא מופיע
        בכרטיס בחלונית היום.
      */}
      <span className={lines === 2 ? 'line-clamp-2' : 'block truncate'}>
        {occurrence.shared && !(multiDay && !labelled) && (
          <Users
            size={ICON.xs}
            strokeWidth={2.4}
            aria-hidden="true"
            className="-mt-px me-0.5 inline-block align-[-1px] opacity-80"
          />
        )}
        {multiDay && !labelled ? '\u00A0' : occurrence.title}
      </span>
    </div>
  );
}

/** מה שקורא מסך מקריא על הכרטיס: הכול בשורה אחת ובסדר הגיוני. */
function cardLabel(occ: Occurrence): string {
  const parts = [occ.title];
  if (occ.spanLength > 1) parts.push(`יום ${occ.spanIndex + 1} מתוך ${occ.spanLength}`);
  else if (occ.allDay) parts.push('כל היום');
  else if (occ.startTime) parts.push(occ.endTime ? `${occ.startTime} עד ${occ.endTime}` : occ.startTime);
  if (occ.location) parts.push(occ.location);
  if (occ.repeat !== 'none') parts.push('אירוע חוזר');
  if (occ.shared) parts.push(`מהרשימה המשותפת ${occ.shared.listName}`);
  return parts.join(', ');
}

/**
 * כרטיס אירוע מלא לרשימות ולתצוגת היום.
 * השעה יושבת בתג מלא בצבע האירוע, והכותרת לצידו.
 */
export function EventCard({
  occurrence,
  onClick,
  onMove,
  onToggleDone,
  draggable = false,
}: {
  occurrence: Occurrence;
  onClick?: () => void;
  /**
   * סימון "בוצע". כשהוא נמסר מופיעה תיבת סימון בקצה הכרטיס.
   * הסימון שייך למופע: משימה שחוזרת כל שבוע בוצעה השבוע בלבד.
   */
  onToggleDone?: (done: boolean) => void;
  /**
   * הזזה במקלדת - Alt+חיצים. זו החלופה לגרירה, שאין לה שום מקבילה
   * במקלדת: יום אחד בחיצים אופקיים, שבוע בחיצים אנכיים.
   */
  onMove?: (days: number) => void;
  draggable?: boolean;
}) {
  const duration =
    !occurrence.allDay && occurrence.startTime && occurrence.endTime
      ? durationLabel(occurrence.startTime, occurrence.endTime)
      : '';

  const meta = [duration, occurrence.endTime && !occurrence.allDay ? `עד ${occurrence.endTime}` : '']
    .filter(Boolean)
    .join(' · ');

  /** Alt+חיצים - החלופה לגרירה, שאין לה שום מקבילה במקלדת. */
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!onMove || !e.altKey) return;
    const delta = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    onMove(delta);
  };

  /*
    הכרטיס הוא עטיפה ולא כפתור: תיבת סימון בתוך כפתור אינה חוקית, ובלי
    ההפרדה הזו לחיצה על הסימון הייתה פותחת גם את העורך.
  */
  return (
    <div
      className={`ev ev-${occurrence.color} flex w-full items-center gap-2 rounded-2xl p-3 ${
        occurrence.done ? 'opacity-55' : ''
      }`}
    >
      {onToggleDone && (
        <motion.button
          type="button"
          role="checkbox"
          aria-checked={occurrence.done}
          aria-label={occurrence.done ? 'ביטול סימון כבוצע' : 'סימון כבוצע'}
          onClick={() => {
            void haptic('light');
            onToggleDone(!occurrence.done);
          }}
          whileTap={{ scale: 0.88 }}
          transition={TAP}
          className={`focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            occurrence.done ? 'ev-solid border-transparent text-white' : 'border-current opacity-45'
          }`}
        >
          {occurrence.done && <Check size={ICON.sm} strokeWidth={3} />}
        </motion.button>
      )}
      <motion.button
        type="button"
        onClick={onClick}
        onKeyDown={onKeyDown}
        whileTap={TAP_SCALE_LG}
        transition={TAP}
        onPointerDown={draggable ? (e) => beginLongPress(e, occurrence) : undefined}
        aria-label={cardLabel(occurrence)}
        aria-keyshortcuts={
          onMove ? 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown' : undefined
        }
        className="focus-ring flex min-w-0 flex-1 items-center gap-3.5 rounded-xl text-right"
      >
      {/* תג השעה - מלא בצבע האירוע */}
      <span
        className="ev-solid flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-xl text-white"
        aria-hidden="true"
      >
        {occurrence.spanLength > 1 ? (
          <>
            <span className="tnum text-label font-bold leading-none">
              {occurrence.spanIndex + 1}/{occurrence.spanLength}
            </span>
            <span className="mt-1 text-micro font-medium leading-none opacity-85">ימים</span>
          </>
        ) : occurrence.allDay ? (
          <span className="text-caption font-semibold leading-tight">כל היום</span>
        ) : (
          <span className="tnum text-label font-bold leading-none">
            {occurrence.startTime}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {/* כותרת ארוכה נגללת לאט במקום להיחתך - ראו `MARQUEE` */}
          <MarqueeText
            text={occurrence.title}
            className={`min-w-0 text-title font-semibold leading-snug ${
              occurrence.done ? 'line-through' : ''
            }`}
          />
          {occurrence.repeat !== 'none' && (
            <Repeat size={ICON.sm} className="shrink-0 opacity-60" strokeWidth={STROKE} />
          )}
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption opacity-85">
          {/*
            שם הרשימה, ולא רק "משותף": בלוח השאלה אינה אם הפריט משותף
            אלא *עם מי*, ורשימה אחת של קניות נראית אחרת מרשימה של עבודה.
          */}
          {occurrence.shared && (
            <span className="flex min-w-0 items-center gap-1.5 font-medium">
              <Users size={ICON.xs} strokeWidth={STROKE} className="shrink-0" />
              <span className="truncate">{occurrence.shared.listName}</span>
            </span>
          )}
          {meta && <span className="tnum font-medium">{meta}</span>}
          {occurrence.location && (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin size={ICON.xs} strokeWidth={STROKE} className="shrink-0" />
              <span className="truncate">{occurrence.location}</span>
            </span>
          )}
        </span>
        </span>
      </motion.button>
    </div>
  );
}
