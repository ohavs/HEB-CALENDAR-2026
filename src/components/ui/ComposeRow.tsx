/**
 * שורת האפשרויות של הוספה מהירה: יום, שעה, ומוצא לעורך המלא.
 *
 * רכיב אחד לשתי הרשימות - האישית והמשותפת - ולא העתקה בכל מסך. תזכורת
 * ופריט משותף נבדלים במקום שבו הם חיים, לא בשאלה "מתי", ושתי שורות
 * נפרדות היו נפרדות גם בהתנהגות ברגע שאחת מהן תשתנה.
 */
import { useState } from 'react';
import { CalendarPlus, Clock, SlidersHorizontal, X } from 'lucide-react';
import type { DateKey } from '@/types';
import { addDays, dateKey } from '@/lib/dates';
import { suggestReminderTime } from '@/lib/reminderCompose';
import { ICON, STROKE } from '@/lib/motion';
import { haptic } from '@/lib/native';
import { DatePickerSheet, TimePickerSheet } from './Picker';

/** מה נבחר: בלי תאריך, היום, מחר, או יום מהבורר */
export type Slot = 'none' | 'today' | 'tomorrow' | 'pick';

export type ComposeState = {
  slot: Slot;
  time: string | null;
  /** היום שנבחר, או null כשאין */
  targetDate: DateKey | null;
  setSlot: (next: Slot, date: DateKey | null) => void;
  setPicked: (key: DateKey) => void;
  setTime: (next: string | null) => void;
  reset: () => void;
  picked: DateKey | null;
};

/**
 * המצב של השורה.
 *
 * הוק ולא state במסך, כי הכלל "יום שנבחר מקבל שעה" הוא חלק מהשורה ולא
 * מהמסך שמכיל אותה.
 */
export function useComposeRow(now: Date): ComposeState {
  const [slot, setSlotRaw] = useState<Slot>('none');
  const [picked, setPicked] = useState<DateKey | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const targetDate =
    slot === 'none'
      ? null
      : slot === 'today'
        ? dateKey(now)
        : slot === 'tomorrow'
          ? dateKey(addDays(now, 1))
          : picked;

  /**
   * מעבר בין ימים.
   *
   * יום שנבחר מקבל שעה מיד, כי תזכורת לשעה מסוימת היא המקרה הרגיל -
   * וקודם כל תזכורת נולדה "כל היום" והמשתמש היה צריך לפתוח את העורך
   * ולכבות מתג כדי לקבוע שעה. "בלי תאריך" מאפס אותה: שעה בלי יום אינה
   * שעה. הבחירה הידנית גוברת - מרגע שנקבעה שעה היא אינה נדרסת במעבר
   * בין "היום" ל"מחר".
   */
  const setSlot = (next: Slot, date: DateKey | null) => {
    setSlotRaw(next);
    if (next === 'none') {
      setTime(null);
      return;
    }
    if (time === null) setTime(suggestReminderTime(now, date === dateKey(now)));
  };

  return {
    slot,
    time,
    picked,
    targetDate,
    setSlot,
    setPicked,
    setTime,
    reset: () => {
      setSlotRaw('none');
      setPicked(null);
      setTime(null);
    },
  };
}

/** תווית קצרה ליום שנבחר בבורר: "21.9" */
function shortDate(key: DateKey): string {
  const [, m, d] = key.split('-');
  return `${Number(d)}.${Number(m)}`;
}

export function ComposeRow({
  state,
  now,
  onMore,
}: {
  state: ComposeState;
  now: Date;
  /** פתיחת העורך המלא על מה שכבר הוקלד */
  onMore: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const { slot, time, picked, targetDate } = state;

  return (
    <>
      {/*
        אין כאן "בלי תאריך": זו ברירת המחדל ממילא, וצ׳יפ שמסמן את מצב
        המנוחה תפס רבע מהשורה כדי לומר מה שכבר נכון. במקומו יושב המוצא
        לעורך המלא. ההקשה על הצ׳יפ הנבחר מבטלת אותו וחוזרת לבלי תאריך -
        בלעדיה לא הייתה שום דרך לחזור.
      */}
      <div className="flex items-center gap-1.5 px-0.5 pt-2">
        {(
          [
            ['today', 'היום'],
            ['tomorrow', 'מחר'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              void haptic('light');
              if (slot === id) {
                state.setSlot('none', null);
                return;
              }
              state.setSlot(id, id === 'today' ? dateKey(now) : dateKey(addDays(now, 1)));
            }}
            aria-pressed={slot === id}
            className={`focus-ring flex-1 whitespace-nowrap rounded-lg py-1.5 text-caption font-medium transition-colors ${
              slot === id ? 'bg-brand text-white' : 'bg-well text-muted'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            void haptic('light');
            if (slot === 'pick') {
              state.setSlot('none', null);
              return;
            }
            setPickerOpen(true);
          }}
          aria-pressed={slot === 'pick'}
          aria-label={slot === 'pick' ? 'ביטול התאריך' : 'בחירת תאריך'}
          className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-caption font-medium transition-colors ${
            slot === 'pick' ? 'bg-brand text-white' : 'bg-well text-muted'
          }`}
        >
          <CalendarPlus size={ICON.xs} strokeWidth={STROKE} />
          {slot === 'pick' && picked ? shortDate(picked) : ''}
        </button>

        <button
          type="button"
          onClick={onMore}
          className="focus-ring flex shrink-0 items-center gap-1.5 rounded-lg bg-well px-2.5 py-1.5 text-caption font-medium text-muted"
        >
          <SlidersHorizontal size={ICON.xs} strokeWidth={STROKE} />
          עוד
        </button>
      </div>

      {/*
        שורת השעה מופיעה רק כשיש יום לתלות אותה בו. "בלי תאריך" עם שעה
        הוא סתירה, ולהראות שם שדה מעומעם זה להזמין ניסיון.
      */}
      {slot !== 'none' && (
        <div className="flex items-center gap-1.5 px-0.5 pb-0.5 pt-1.5">
          <div
            className={`flex items-center overflow-hidden rounded-lg ${
              time ? 'bg-brand text-white' : 'bg-well text-muted'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                void haptic('light');
                if (time) setTimeOpen(true);
                else state.setTime(suggestReminderTime(now, targetDate === dateKey(now)));
              }}
              className="focus-ring flex items-center gap-1.5 py-1.5 ps-2.5 pe-2 text-caption font-medium"
            >
              <Clock size={ICON.xs} strokeWidth={STROKE} />
              {time ?? 'כל היום'}
            </button>
            {/* ניקוי חוזר ל"כל היום" - בלי זה אי אפשר היה לוותר על השעה */}
            {time && (
              <button
                type="button"
                onClick={() => {
                  void haptic('light');
                  state.setTime(null);
                }}
                aria-label="בלי שעה"
                className="focus-ring py-1.5 pe-2.5 ps-1"
              >
                <X size={ICON.xs} strokeWidth={2.6} />
              </button>
            )}
          </div>
        </div>
      )}

      <DatePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="תאריך לתזכורת"
        value={picked ?? dateKey(now)}
        onChange={(next) => {
          state.setPicked(next);
          state.setSlot('pick', next);
        }}
      />

      <TimePickerSheet
        open={timeOpen}
        onClose={() => setTimeOpen(false)}
        title="שעה לתזכורת"
        value={time ?? suggestReminderTime(now, targetDate === dateKey(now))}
        onChange={state.setTime}
      />
    </>
  );
}
