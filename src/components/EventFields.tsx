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
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bell,
  CalendarDays,
  CalendarRange,
  Clock,
  MapPin,
  Navigation,
  Repeat,
  Tag,
} from 'lucide-react';
import type { DateKey, PlaceTrigger, UserEvent } from '@/types';
import {
  MAX_REPEAT_EVERY,
  REPEAT_LABELS,
  repeatEveryOf,
  repeatLabel,
  spanLengthOf,
} from '@/lib/recurrence';
import { REMINDER_OPTIONS, useEvents } from '@/store/events';
import { useSettings } from '@/store/settings';
import { addDays, dateKey, keyToDate, minutesToTime, timeToMinutes } from '@/lib/dates';
import { hebrewDateParts } from '@/lib/hebrew';
import {
  dayForTime,
  reminderEndTime,
  shiftEndWithStart,
  suggestReminderTime,
} from '@/lib/reminderCompose';
import { ICON, STROKE } from '@/lib/motion';
import {
  geoPermission,
  haptic,
  isNative,
  openAppSettings,
  requestGeoForeground,
  type GeoPermission,
} from '@/lib/native';
import { LocationPicker } from './LocationPicker';
import { NumberPickerSheet } from './ui/Picker';
import { Segmented, Toggle } from './ui/controls';
import {
  DateField,
  FieldGroup,
  PickerField,
  SelectField,
  SingleTimeRow,
  TextArea,
  TimeRangeRow,
} from './ui/fields';

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
  grouped = false,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** בתוך `FieldGroup` - בלי קופסה משלה */
  grouped?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2 ${grouped ? '' : 'rounded-2xl bg-well'}`}>
      <span className="shrink-0 text-muted">{icon}</span>
      <span className="flex-1 text-label font-medium text-ink">{label}</span>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

/** מתג קטן בצורת צ׳יפ, לשורה של כמה אפשרויות קצרות */
function ChipToggle({
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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        void haptic('light');
        onChange(!checked);
      }}
      className={`focus-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-medium transition-colors ${
        checked ? 'bg-brand text-white' : 'bg-surface text-muted'
      }`}
    >
      {icon}
      {label}
    </button>
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
  /** כל כמה יחידות חזרה. חסר = 1 */
  repeatEvery?: number;
  reminderMinutes: number | null;
  notes?: string;
};

export function EventFields({
  draft,
  patch,
  personal = true,
  scheduled = true,
  whenToggle,
  category,
  reminder = false,
  onDated,
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
  /**
   * שורה שנפתחת בראש קבוצת ה"מתי" - המתג "משויך ליום" של פריט משותף.
   * הוא שייך לשאלה "מתי", ולכן יושב בתוך הקופסה שלה ולא מעליה.
   */
  whenToggle?: ReactNode;
  /**
   * קטגוריה, כשיש מה לבחור. הרשימה נמסרת מבחוץ כי המקור שונה - הגדרות
   * לתזכורת אישית, מסמך הרשימה לפריט משותף - והמקום בטופס זהה בשניהם.
   */
  category?: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (next: string) => void;
    /** קטגוריה חדשה מתוך הבורר. מחזיר את המזהה, או null כשלא נוצרה. */
    onCreate?: (name: string) => string | null;
  };
  /**
   * תזכורת ולא אירוע. תזכורת היא רגע: שעה אחת במקום התחלה וסיום, והשעה
   * היא ההתראה עצמה - ולכן אין "כמה דקות לפני", אין פרישה על כמה ימים,
   * ואין חזרה אלא אם היא כבר חוזרת (כדי שאפשר יהיה לכבות אותה). הטופס
   * המלא נשאר לאירוע בלוח, ששם כל השאלות האלה באמת נשאלות.
   */
  reminder?: boolean;
  /**
   * שעה נבחרה לתזכורת בלי יום. שורת השעה מוצגת תמיד, גם בלי יום - ושעה
   * בלי יום אינה שעה, ולכן היא משייכת את התזכורת ליום הקרוב שבו השעה עוד
   * לפנינו (`dayForTime`). מי שמחזיק את "משויך ליום" מעדכן את עצמו כאן.
   */
  onDated?: () => void;
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

  /*
    בתזכורת גם בלי יום: "כשאגיע לסופר" היא בדיוק תזכורת שאין לה תאריך.
    באירוע ביומן ההתראה דרוכה ביום שלו, ובלי יום אין לה מתי.
  */
  const hasPlaceAlert = personal && (scheduled || reminder) && Boolean(savedPlace);

  /**
   * שעת התזכורת. `allDay` נגזר ממנה ולא נקבע לבד - אותו כלל של
   * `buildReminderDraft` - וכך גם ההתראה: יש שעה, מתריעים בה.
   */
  /*
    היום נקבע מהשעה כל עוד המשתמש לא בחר יום בעצמו. הגלגל כותב בכל גלילה,
    והפתיחה כבר שייכה את התזכורת ליום של השעה המוצעת - בלי זה, גלילה
    מ-18:30 ל-08:00 בערב הייתה משאירה אותה על היום, בשעה שכבר עברה.
  */
  const autoDay = useRef(false);
  const setReminderTime = (time: string | null) => {
    if (time !== null && !scheduled) {
      autoDay.current = true;
      onDated?.();
    }
    const assign = time !== null && autoDay.current;
    patch({
      ...(assign ? { date: dayForTime(time, new Date()) } : {}),
      allDay: time === null,
      startTime: time ?? draft.startTime,
      endTime: time ? reminderEndTime(time) : draft.endTime,
      ...(personal ? { reminderMinutes: time ? 0 : null } : {}),
    });
  };
  // בלי יום השעה המוצעת היא של היום: הבחירה עצמה תשייך ליום הנכון
  const isToday = !scheduled || draft.date === dateKey(new Date());

  /*
    שלוש קבוצות ושדה אחד, לפי השאלה שכל אחת עונה עליה: מתי, איפה, ומה
    עוד. כל קבוצה היא קופסה אחת עם קווים דקים, כך שהטופס קצר בלי שאף
    שורה תקטן - ובלי לדחוס הכול לקופסה אחת שבה כבר לא רואים מה שייך למה.
  */
  return (
    <>
      {(scheduled || whenToggle || reminder) && (
        <FieldGroup>
          {whenToggle}
          {reminder && (
            <>
              {scheduled && (
                <DateField
                  label="תאריך"
                  value={draft.date}
                  onChange={(d) => {
                    autoDay.current = false;
                    patch({ date: d });
                  }}
                  icon={<CalendarDays size={ICON.md} strokeWidth={STROKE} />}
                  hint={`${hebrew.day} ב${hebrew.month} ${hebrew.year}`}
                  variant="grouped"
                />
              )}
              <SingleTimeRow
                icon={<Bell size={ICON.md} strokeWidth={STROKE} />}
                label={personal ? 'שעת התראה' : 'שעה'}
                value={!scheduled || draft.allDay ? null : draft.startTime}
                suggested={suggestReminderTime(new Date(), isToday)}
                onChange={setReminderTime}
                emptyLabel={personal ? 'בלי התראה' : 'בלי שעה'}
              />
            </>
          )}
          {scheduled && !reminder && (
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
                variant="grouped"
              />

              {/*
                שני מתגים של "איך המועד בנוי" כצ׳יפים בשורה אחת. כשורות
                מלאות הם לקחו יותר מקום מהתאריך עצמו, ורוב האירועים אינם
                משתמשים באף אחד מהם.
              */}
              <div className="flex gap-2 px-4 py-2.5">
                <ChipToggle
                  icon={<Clock size={ICON.xs} strokeWidth={STROKE} />}
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
                {/* אירוע שנמשך כמה ימים - חופשה, טיול, אירוח */}
                <ChipToggle
                  icon={<CalendarRange size={ICON.xs} strokeWidth={STROKE} />}
                  label="כמה ימים"
                  checked={multiDay}
                  onChange={(on) =>
                    patch({ endDate: on ? dateKey(addDays(keyToDate(draft.date), 1)) : undefined })
                  }
                />
              </div>

              {multiDay && (
                <DateField
                  label="עד תאריך"
                  value={draft.endDate ?? draft.date}
                  onChange={(endDate) => patch({ endDate })}
                  icon={<CalendarRange size={ICON.md} strokeWidth={STROKE} />}
                  hint={spanHint}
                  min={draft.date}
                  variant="grouped"
                />
              )}

              {/*
                השעות נשארות על המסך גם כש"כל היום" דלוק, מעומעמות ולא
                לחיצות. כשהן נעלמו לגמרי, מי שפתח תזכורת (שהיא אירוע של כל
                היום) לא ראה שום רמז לכך שיש בכלל שעות.
              */}
              <TimeRangeRow
                icon={<Clock size={ICON.md} strokeWidth={STROKE} />}
                label="שעות"
                start={draft.startTime ?? DEFAULT_START}
                end={draft.endTime ?? defaultEndFor(draft.startTime ?? DEFAULT_START)}
                onStart={onStartChange}
                onEnd={(endTime) => patch({ endTime })}
                disabled={draft.allDay}
              />
            </>
          )}
        </FieldGroup>
      )}

      <FieldGroup>
        <PickerField
          label="מקום"
          display={draft.location || 'לא הוגדר'}
          icon={<MapPin size={ICON.md} strokeWidth={STROKE} />}
          hint={savedPlace ? 'מקום שמור' : undefined}
          onOpen={() => setLocationOpen(true)}
          variant="grouped"
        />

        {/*
          התראת מיקום אפשרית רק כשהמקום הוא מקום שמור: לטקסט חופשי
          ("אצל סבתא") אין נקודת ציון, ואין על מה לגדר.
        */}
        {hasPlaceAlert && savedPlace && (
          <div className="px-4 py-3">
            <span className="mb-2.5 flex items-center gap-2 text-caption font-medium text-muted">
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
            {draft.placeTrigger && <BackgroundLocationHint />}
            {draft.placeTrigger && (
              <p className="mt-2.5 text-caption leading-relaxed text-muted">
                {reminder && !scheduled
                  ? 'ההתראה דרוכה כל עוד התזכורת לא סומנה כבוצעה.'
                  : 'ההתראה דרוכה ביום האירוע בלבד, ונשלחת פעם אחת.'}
              </p>
            )}
          </div>
        )}
      </FieldGroup>

      {(category || (reminder ? scheduled && draft.repeat !== 'none' : scheduled || personal)) && (
        <FieldGroup>
          {category && (
            <SelectField<string>
              label="קטגוריה"
              value={category.value}
              onChange={category.onChange}
              icon={<Tag size={ICON.md} strokeWidth={STROKE} />}
              options={category.options}
              variant="grouped"
              create={
                category.onCreate
                  ? { placeholder: 'קטגוריה חדשה', onCreate: category.onCreate }
                  : undefined
              }
            />
          )}
          {scheduled && (!reminder || draft.repeat !== 'none') && (
            <SelectField<UserEvent['repeat']>
              label="חזרה"
              value={draft.repeat}
              onChange={(repeat) =>
                patch({ repeat, repeatEvery: repeat === 'none' ? undefined : draft.repeatEvery })
              }
              icon={<Repeat size={ICON.md} strokeWidth={STROKE} />}
              options={(Object.keys(REPEAT_LABELS) as UserEvent['repeat'][]).map((r) => ({
                value: r,
                label: REPEAT_LABELS[r],
              }))}
              variant="grouped"
            />
          )}
          {/*
            "כל כמה" - שורה משלה ולא עוד אפשרויות ברשימה: "כל 3 חודשים"
            ו"כל 5 שבועות" הם שילוב של יחידה ומספר, ורשימה שמונה את כולם
            הייתה אינסופית. היחידה נבחרת למעלה, והמספר כאן.
          */}
          {scheduled && draft.repeat !== 'none' && (
            <RepeatEveryRow
              repeat={draft.repeat}
              every={repeatEveryOf(draft)}
              onChange={(every) => patch({ repeatEvery: every > 1 ? every : undefined })}
            />
          )}
          {personal && !reminder && (
            <SelectField<string>
              label="תזכורת"
              value={String(draft.reminderMinutes)}
              onChange={(v) => patch({ reminderMinutes: v === 'null' ? null : Number(v) })}
              icon={<Bell size={ICON.md} strokeWidth={STROKE} />}
              options={REMINDER_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
              variant="grouped"
            />
          )}
        </FieldGroup>
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

/**
 * "לאפשר תמיד", כשהיא חסרה - כאן, ברגע הבחירה, ולא רק בהגדרות.
 *
 * בלי ההרשאה הזו הכול נראה תקין: המקום נשמר, ההתראה מסומנת - והיא לא
 * מגיעה, כי מערכת ההפעלה אינה מנטרת כשהאפליקציה סגורה. אנדרואיד אינו
 * מרשה לבקש אותה בדיאלוג, ולכן הכפתור מוביל למסך ההרשאות.
 */
function BackgroundLocationHint() {
  const [geo, setGeo] = useState<GeoPermission | null>(null);
  useEffect(() => {
    if (!isNative()) return;
    const read = () => void geoPermission().then(setGeo);
    read();
    const onVisible = () => document.visibilityState === 'visible' && read();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  if (!geo || geo.background) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (!geo.foreground) void requestGeoForeground().then(setGeo);
        else void openAppSettings();
      }}
      className="focus-ring mt-2.5 flex w-full items-start gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-right text-caption leading-relaxed text-brand-ink"
    >
      <Navigation size={ICON.xs} strokeWidth={STROKE} className="mt-0.5 shrink-0" />
      <span>
        {geo.foreground
          ? 'כדי שההתראה תגיע גם כשהאפליקציה סגורה, צריך לבחור ״לאפשר תמיד״ בהרשאת המיקום. הקשה פותחת את ההגדרות.'
          : 'צריך הרשאת מיקום מדויק כדי לזהות הגעה ויציאה. הקשה כדי לאשר.'}
      </span>
    </button>
  );
}

/** "תדירות: כל 3 חודשים" - הקשה פותחת גלגל של המספר */
function RepeatEveryRow({
  repeat,
  every,
  onChange,
}: {
  repeat: UserEvent['repeat'];
  every: number;
  onChange: (next: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PickerField
        label="תדירות"
        display={repeatLabel({ repeat, repeatEvery: every })}
        icon={<CalendarRange size={ICON.md} strokeWidth={STROKE} />}
        onOpen={() => setOpen(true)}
        variant="grouped"
      />
      <NumberPickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title="כל כמה"
        subtitle={repeatLabel({ repeat, repeatEvery: every })}
        value={every}
        onChange={onChange}
        min={1}
        max={MAX_REPEAT_EVERY}
      />
    </>
  );
}
