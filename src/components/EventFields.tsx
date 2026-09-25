/**
 * השדות של "מתי ואיפה": תאריך, פרישה, שעות, מקום, חזרה, תזכורת והערות.
 *
 * רכיב אחד לעורך האירוע ולעורך הפריט המשותף. פריט משותף הוא `UserEvent`
 * בתוספת שיוך, והשאלה "מתי" נענית בשניהם באותה צורה - כששני טפסים ענו
 * עליה בנפרד, לפריט המשותף הייתה שעת התחלה בלבד, בלי סיום, בלי פרישה
 * ובלי מקום, ואיש לא שם לב עד שמישהו ניסה.
 *
 * מה שאינו חל על שניהם נשלט מבחוץ: התראת מקום ותזכורת קיימות רק לאירוע
 * אישי. שדה שמוצג ואינו עושה דבר גרוע משדה שאינו מוצג.
 */
import { useState, type ReactNode } from 'react';
import { Bell, CalendarDays, CalendarRange, Clock, MapPin, Navigation, Repeat } from 'lucide-react';
import type { DateKey, PlaceTrigger, UserEvent } from '@/types';
import { REPEAT_LABELS, spanLengthOf } from '@/lib/recurrence';
import { REMINDER_OPTIONS, useEvents } from '@/store/events';
import { useSettings } from '@/store/settings';
import { addDays, dateKey, keyToDate, minutesToTime, timeToMinutes } from '@/lib/dates';
import { hebrewDateParts } from '@/lib/hebrew';
import { shiftEndWithStart } from '@/lib/reminderCompose';
import { ICON, STROKE } from '@/lib/motion';
import { LocationPicker } from './LocationPicker';
import { Segmented, Toggle } from './ui/controls';
import { DateField, PickerField, SelectField, TextArea, TimeField } from './ui/fields';

/** ברירת המחדל, כשאיש לא אמר שעה */
export const DEFAULT_START = '09:00';
/** משך האירוע החדש, בדקות */
const DEFAULT_LENGTH = 60;
/** הדקה האחרונה ביממה. סיום אינו גולש ליום הבא. */
const LAST_MINUTE = 23 * 60 + 59;

/**
 * הסיום שנגזר מהתחלה.
 *
 * מקור אחד, כי קודם היה כאן `'10:00'` כתוב ביד בתוך ה-JSX - ולכן אירוע
 * שהתחיל ב-14:00 הציג סיום ב-10:00, שעות לפני שהתחיל.
 */
export function defaultEndFor(start: string): string {
  return minutesToTime(Math.min(LAST_MINUTE, timeToMinutes(start) + DEFAULT_LENGTH));
}

/**
 * שורת מתג. קודם כל בוליאני ישב בכרטיס בגובה 60px, ושני מתגים לקחו
 * חמישית מהמסך בשביל שתי מילים.
 */
export function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-well px-4 py-2">
      <span className="shrink-0 text-muted">{icon}</span>
      <span className="flex-1 text-label font-medium text-ink">{label}</span>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

/** מה שהשדות קוראים וכותבים - החלק המשותף לאירוע ולפריט משותף */
export type TimingDraft = {
  date: DateKey;
  endDate?: DateKey;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  location?: string;
  placeId?: string;
  placeTrigger?: PlaceTrigger;
  repeat: UserEvent['repeat'];
  reminderMinutes: number | null;
  notes?: string;
};

export function EventFields({
  draft,
  patch,
  personal = true,
  scheduled = true,
}: {
  draft: TimingDraft;
  patch: (values: Partial<TimingDraft>) => void;
  /**
   * אירוע אישי. בלעדיו אין התראת מקום ואין תזכורת: שתיהן נקבעות במכשיר
   * לפי האירועים האישיים בלבד, ובפריט משותף הן היו נשמרות ולא מצלצלות.
   */
  personal?: boolean;
  /**
   * האם יש "מתי". בלעדיו נשארים רק המקום וההערות - פריט ברשימה משותפת
   * יכול להיות בלי יום ("לקנות סוללות") ועדיין עם מקום ("בסופר ליד
   * הבית"). קודם שניהם הסתתרו מאחורי "משויך ליום".
   */
  scheduled?: boolean;
}) {
  const settings = useSettings();
  const places = settings.places;
  const allEvents = useEvents();
  const [locationOpen, setLocationOpen] = useState(false);

  const eventDate = keyToDate(draft.date);
  const hebrew = hebrewDateParts(eventDate);
  /** המקום השמור שנבחר, אם נבחר כזה */
  const savedPlace = draft.placeId ? places.find((pl) => pl.id === draft.placeId) : undefined;
  const multiDay = Boolean(draft.endDate && draft.endDate > draft.date);
  const spanDays = spanLengthOf({ date: draft.date, endDate: draft.endDate });
  const spanHint = multiDay ? `${spanDays} ימים` : '';

  /**
   * שינוי שעת ההתחלה מזיז גם את שעת הסיום, כדי לשמור על המשך.
   *
   * הנפילה לאחור היא בדיוק זו של השדות, כדי שהחישוב ייעשה על מה
   * שהמשתמש רואה.
   */
  const onStartChange = (value: string) => {
    const from = draft.startTime ?? DEFAULT_START;
    const end = draft.endTime ?? defaultEndFor(from);
    patch({ startTime: value, endTime: shiftEndWithStart(from, end, value) });
  };

  return (
    <>
      {scheduled && (
        <>
          <DateField
            label={multiDay ? 'מתאריך' : 'תאריך'}
            value={draft.date}
            onChange={(d) =>
              // יום סיום שנשאר לפני ההתחלה הופך את הפרישה לחסרת משמעות
              patch({ date: d, endDate: draft.endDate && draft.endDate < d ? d : draft.endDate })
            }
            icon={<CalendarDays size={ICON.md} strokeWidth={STROKE} />}
            hint={`${hebrew.day} ב${hebrew.month} ${hebrew.year}`}
            variant="row"
          />

          {/* אירוע שנמשך כמה ימים - חופשה, טיול, אירוח */}
          <ToggleRow
            icon={<CalendarRange size={ICON.md} strokeWidth={STROKE} />}
            label="נמשך כמה ימים"
            checked={multiDay}
            onChange={(on) =>
              patch({ endDate: on ? dateKey(addDays(keyToDate(draft.date), 1)) : undefined })
            }
          />

          {multiDay && (
            <DateField
              label="עד תאריך"
              value={draft.endDate ?? draft.date}
              onChange={(endDate) => patch({ endDate })}
              icon={<CalendarRange size={ICON.md} strokeWidth={STROKE} />}
              hint={spanHint}
              min={draft.date}
              variant="row"
            />
          )}

          <ToggleRow
            icon={<Clock size={ICON.md} strokeWidth={STROKE} />}
            label="כל היום"
            checked={draft.allDay}
            onChange={(allDay) => {
              // כיבוי המתג הופך את מה שהשדות הראו לערך אמיתי בטיוטה
              if (allDay) {
                patch({ allDay });
                return;
              }
              const start = draft.startTime ?? DEFAULT_START;
              patch({ allDay, startTime: start, endTime: draft.endTime ?? defaultEndFor(start) });
            }}
          />

          {/*
            שדות השעה נשארים על המסך גם כש"כל היום" דלוק, מעומעמים ולא
            לחיצים. קודם הם נעלמו לגמרי, והמסך קפץ מהמתג ישר ל"מקום" - מי
            שפתח תזכורת (שהיא אירוע של כל היום) לא ראה שום רמז לכך שיש
            בכלל שעות, ולא היה לו איך לנחש שהמתג הוא מה שחושף אותן.

            aria-hidden ולא disabled על השדות עצמם: הם עדיין מציגים ערך
            אמיתי, והם פשוט אינם חלק מהטופס במצב הזה.
          */}
          <div
            className={`flex gap-2.5 transition-opacity ${
              draft.allDay ? 'pointer-events-none opacity-40' : ''
            }`}
            aria-hidden={draft.allDay}
          >
            <div className="flex-1">
              <TimeField
                label="התחלה"
                value={draft.startTime ?? DEFAULT_START}
                onChange={onStartChange}
                variant="row"
              />
            </div>
            <div className="flex-1">
              <TimeField
                label="סיום"
                value={draft.endTime ?? defaultEndFor(draft.startTime ?? DEFAULT_START)}
                onChange={(endTime: string) => patch({ endTime })}
                variant="row"
              />
            </div>
          </div>
        </>
      )}

      <PickerField
        label="מקום"
        display={draft.location || 'לא הוגדר'}
        icon={<MapPin size={ICON.md} strokeWidth={STROKE} />}
        hint={savedPlace ? 'מקום שמור' : undefined}
        onOpen={() => setLocationOpen(true)}
        variant="row"
      />

      {/*
        התראת מיקום אפשרית רק כשהמקום הוא מקום שמור: לטקסט חופשי
        ("אצל סבתא") אין נקודת ציון, ואין על מה לגדר.
      */}
      {personal && scheduled && savedPlace && (
        <div className="rounded-2xl bg-well px-4 py-3.5">
          <span className="mb-3 flex items-center gap-2 text-caption font-medium text-muted">
            <Navigation size={ICON.xs} strokeWidth={STROKE} />
            תזכורת כשאני
          </span>
          <Segmented<'none' | PlaceTrigger>
            value={draft.placeTrigger ?? 'none'}
            onChange={(v) => patch({ placeTrigger: v === 'none' ? undefined : v })}
            options={[
              { value: 'none', label: 'בלי' },
              { value: 'arrive', label: `מגיע ל${savedPlace.name}` },
              { value: 'leave', label: `יוצא מ${savedPlace.name}` },
            ]}
          />
          {draft.placeTrigger && (
            <p className="mt-3 text-caption leading-relaxed text-muted">
              ההתראה דרוכה ביום האירוע בלבד, ונשלחת פעם אחת.
            </p>
          )}
        </div>
      )}

      {scheduled && (
        <SelectField<UserEvent['repeat']>
          label="חזרה"
          value={draft.repeat}
          onChange={(repeat) => patch({ repeat })}
          icon={<Repeat size={ICON.md} strokeWidth={STROKE} />}
          options={(Object.keys(REPEAT_LABELS) as UserEvent['repeat'][]).map((r) => ({
            value: r,
            label: REPEAT_LABELS[r],
          }))}
          variant="row"
        />
      )}

      {personal && (
        <SelectField<string>
          label="תזכורת"
          value={String(draft.reminderMinutes)}
          onChange={(v) => patch({ reminderMinutes: v === 'null' ? null : Number(v) })}
          icon={<Bell size={ICON.md} strokeWidth={STROKE} />}
          options={REMINDER_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
          variant="row"
        />
      )}

      <TextArea
        label="הערות"
        value={draft.notes ?? ''}
        onChange={(notes) => patch({ notes })}
        placeholder="פרטים נוספים"
        rows={2}
      />

        <LocationPicker
          open={locationOpen}
          onClose={() => setLocationOpen(false)}
          value={{ location: draft.location, placeId: draft.placeId }}
          onChange={(next) => patch({ location: next.location ?? '', placeId: next.placeId })}
          events={allEvents}
          places={places}
        />
    </>
  );
}
