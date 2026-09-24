/**
 * אירוע בתצוגת היום המורחבת - כל מה שיש בו, בלי לפתוח את העורך.
 *
 * הכרטיס ברשימות הוא תקציר: שורה אחת, שעה ומקום. כאן "מורחב" צריך
 * להיות אמת - הכותרת נשברת לשורות כמה שצריך, וההערות, החזרה, התזכורת
 * והרשימה המשותפת מוצגות כמות שהן. ברשימה שורה נוספת הייתה מפרקת את
 * הקצב; בתצוגה של יום אחד זה בדיוק מה שבאים לראות.
 */
import { motion } from 'framer-motion';
import { Bell, Check, MapPin, Repeat, Users } from 'lucide-react';
import type { Occurrence } from '@/lib/recurrence';
import { REPEAT_LABELS } from '@/lib/recurrence';
import { durationLabel } from '@/lib/dates';
import { haptic } from '@/lib/native';
import { REMINDER_OPTIONS } from '@/store/events';
import { ICON, STROKE, TAP, TAP_SCALE_LG } from '@/lib/motion';

function reminderText(minutes: number | null): string | null {
  if (minutes === null) return null;
  return REMINDER_OPTIONS.find((o) => o.value === minutes)?.label ?? `${minutes} דקות לפני`;
}

export function DayEventDetail({
  occurrence: occ,
  onClick,
  onToggleDone,
}: {
  occurrence: Occurrence;
  onClick: () => void;
  onToggleDone: (done: boolean) => void;
}) {
  const timed = !occ.allDay && occ.startTime;
  const duration = timed && occ.endTime ? durationLabel(occ.startTime!, occ.endTime) : null;
  const reminder = reminderText(occ.reminderMinutes);
  const facts: { icon: typeof Bell; text: string }[] = [];
  if (occ.repeat !== 'none') facts.push({ icon: Repeat, text: REPEAT_LABELS[occ.repeat] });
  if (reminder) facts.push({ icon: Bell, text: reminder });
  if (occ.shared) facts.push({ icon: Users, text: occ.shared.listName });

  return (
    <div
      className={`ev ev-${occ.color} flex items-start gap-3 rounded-2xl p-4 ${
        occ.done ? 'opacity-55' : ''
      }`}
    >
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={TAP_SCALE_LG}
        transition={TAP}
        className="focus-ring flex min-w-0 flex-1 items-stretch gap-3.5 rounded-xl text-right"
      >
        {/* עמודת הזמן: התחלה מעל סיום, והפס בצבע האירוע מחבר ביניהם */}
        <span className="flex w-14 shrink-0 flex-col items-center gap-1 pt-0.5">
          {occ.spanLength > 1 ? (
            <>
              <span className="tnum text-label font-bold leading-none">
                {occ.spanIndex + 1}/{occ.spanLength}
              </span>
              <span className="text-micro font-medium opacity-80">ימים</span>
            </>
          ) : timed ? (
            <span className="tnum text-label font-bold leading-none">{occ.startTime}</span>
          ) : (
            <span className="text-caption font-semibold leading-tight">כל היום</span>
          )}
          <span className="ev-solid my-0.5 w-[3px] flex-1 rounded-full opacity-60" aria-hidden="true" />
          {timed && occ.endTime && (
            <span className="tnum text-caption font-medium leading-none opacity-80">
              {occ.endTime}
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span
            className={`break-words text-title font-semibold leading-snug ${
              occ.done ? 'line-through' : ''
            }`}
          >
            {occ.title}
          </span>

          {duration && <span className="tnum text-caption font-medium opacity-85">{duration}</span>}

          {occ.location && (
            <span className="flex items-start gap-1.5 text-caption opacity-90">
              <MapPin size={ICON.xs} strokeWidth={STROKE} className="mt-0.5 shrink-0" />
              <span className="break-words">{occ.location}</span>
            </span>
          )}

          {facts.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {facts.map(({ icon: Icon, text }) => (
                <span
                  key={text}
                  className="flex items-center gap-1 rounded-full bg-surface/60 px-2.5 py-1 text-micro font-medium"
                >
                  <Icon size={ICON.xs} strokeWidth={STROKE} className="shrink-0" />
                  {text}
                </span>
              ))}
            </span>
          )}

          {/* ההערות כפי שנכתבו, כולל ירידות שורה */}
          {occ.notes && (
            <span className="selectable whitespace-pre-line break-words border-t border-hairline pt-2 text-caption leading-relaxed opacity-85">
              {occ.notes}
            </span>
          )}
        </span>
      </motion.button>

      <motion.button
        type="button"
        role="checkbox"
        aria-checked={occ.done}
        aria-label={occ.done ? 'ביטול סימון כבוצע' : 'סימון כבוצע'}
        onClick={() => {
          void haptic('light');
          onToggleDone(!occ.done);
        }}
        whileTap={{ scale: 0.88 }}
        transition={TAP}
        className={`focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          occ.done ? 'ev-solid border-transparent text-white' : 'border-current opacity-45'
        }`}
      >
        {occ.done && <Check size={ICON.sm} strokeWidth={3} />}
      </motion.button>
    </div>
  );
}

/** קו "עכשיו" בין האירועים של היום. */
export function NowMarker({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-2 px-1" role="presentation">
      <span className="tnum text-micro font-semibold text-brand">עכשיו {time}</span>
      <span className="h-px flex-1 bg-brand/50" />
      <span className="h-2 w-2 rounded-full bg-brand" />
    </div>
  );
}
