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
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  CalendarRange,
  MapPin,
  Navigation,
  FilePen,
  Tag,
} from '@/components/ui/icons';
import type { DateKey, PlaceTrigger, UserEvent } from '@/types';
import { undatedRepeatHint } from '@/lib/recurrence';
import { REMINDER_OPTIONS, useEvents } from '@/store/events';
import { useSettings } from '@/store/settings';
import { addDays, dateKey, keyToDate, minutesToTime, timeToMinutes } from '@/lib/dates';
import { shiftEndWithStart } from '@/lib/reminderCompose';
import { shortDateLabel, whenSummary } from '@/lib/whenSummary';
import { ENTER, EXIT, GLIDE, ICON } from '@/lib/motion';
import {
  geoPermission,
  haptic,
  isNative,
  openAppSettings,
  requestGeoForeground,
  type GeoPermission,
} from '@/lib/native';
import { LocationPicker } from './LocationPicker';
import { RepeatField } from './RepeatField';
import { Segmented } from './ui/controls';
import { DayStrip } from './ui/DayStrip';
import { TimeTiles } from './ui/TimeTiles';
import { TileStrip } from './ui/tiles';
import { FieldGroup, FormSection, PickerField, SelectField, TextAreaRow } from './ui/fields';

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
 * "בלי תאריך | עם תאריך" - בראש קבוצת ה"מתי" של תזכורת ושל פריט משותף.
 *
 * מתג מצב ולא מתג דלוק־כבוי: שני המצבים הם תשובות שוות לשאלה "מתי",
 * ותזכורת בלי תאריך אינה תזכורת "כבויה". אותו רכיב בשני הטפסים, כדי
 * שיאמר אותו דבר בשניהם.
 */
export function DatedSwitch({
  dated,
  onChange,
}: {
  dated: boolean;
  onChange: (dated: boolean) => void;
}) {
  return (
    <Segmented<'undated' | 'dated'>
      label="תאריך ושעה"
      value={dated ? 'dated' : 'undated'}
      onChange={(v) => onChange(v === 'dated')}
      options={[
        { value: 'undated', label: 'בלי תאריך' },
        { value: 'dated', label: 'עם תאריך' },
      ]}
    />
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
      className={`focus-ring flex h-10 items-center gap-1.5 rounded-full px-3.5 text-label font-medium transition-colors ${
        checked ? 'bg-inverse text-on-inverse' : 'bg-surface text-muted'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * התזכורות שבשורה. חמש ולא כל תשע: אלה שנבחרות באמת, ו"עוד" לשאר.
 * 15 דקות ולא 10, כי זו ברירת המחדל של אירוע חדש - ברירת מחדל שיושבת
 * מאחורי "עוד" נראית כמו בחירה שמישהו עשה.
 */
const QUICK_REMINDERS: (number | null)[] = [null, 0, 15, 60, 1440];
const SHORT_REMINDER_LABEL: Record<string, string> = {
  null: 'בלי',
  0: 'בזמן',
  15: '15 דק׳',
  60: 'שעה לפני',
  1440: 'יום לפני',
};

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
   * שורה שנפתחת בראש קבוצת ה"מתי" - המתג "תאריך ושעה" של תזכורת ושל פריט
   * משותף. הוא שייך לשאלה "מתי", ולכן יושב בתוך הקופסה שלה ולא מעליה.
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
   * תזכורת ולא אירוע. כשיש לה יום, השדות הם בדיוק אלה של אירוע - כשהיו
   * לה שדות משלה (שעה אחת, בלי פרישה) שני הטפסים נקראו כשתי אפליקציות.
   * מה שנשאר שונה הוא רק מה שאין לו מתי: חזרה גם בלי יום ("פילטר כל
   * חודשיים", נספר מהסימון כבוצעה - `returnsAt`), והתראת מקום בלי יום.
   */
  reminder?: boolean;
}) {
  const settings = useSettings();
  const places = settings.places;
  const allEvents = useEvents();
  const [locationOpen, setLocationOpen] = useState(false);
  /** איזה קצה של הפרישה הרצועה בוחרת, באירוע של כמה ימים */
  const [spanEdge, setSpanEdge] = useState<'from' | 'to'>('to');

  /** המקום השמור שנבחר, אם נבחר כזה */
  const savedPlace = draft.placeId ? places.find((pl) => pl.id === draft.placeId) : undefined;
  const multiDay = Boolean(draft.endDate && draft.endDate > draft.date);
  const editingEnd = multiDay && spanEdge === 'to';

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

  const setAllDay = (allDay: boolean) => {
    // כיבוי "כל היום" הופך את מה שהשדות הראו לערך אמיתי בטיוטה
    if (allDay) {
      patch({ allDay });
      return;
    }
    const start = draft.startTime ?? DEFAULT_START;
    patch({ allDay, startTime: start, endTime: draft.endTime ?? defaultEndFor(start) });
  };

  const setMultiDay = (on: boolean) => {
    setSpanEdge('to');
    patch({ endDate: on ? dateKey(addDays(keyToDate(draft.date), 1)) : undefined });
  };

  const pickDay = (key: DateKey) => {
    if (editingEnd) {
      patch({ endDate: key });
      return;
    }
    // יום סיום שנשאר לפני ההתחלה הופך את הפרישה לחסרת משמעות
    patch({ date: key, endDate: draft.endDate && draft.endDate < key ? key : draft.endDate });
  };

  /*
    בתזכורת גם בלי יום: "כשאגיע לסופר" היא בדיוק תזכורת שאין לה תאריך.
    באירוע ביומן ההתראה דרוכה ביום שלו, ובלי יום אין לה מתי.
  */
  const hasPlaceAlert = personal && (scheduled || reminder) && Boolean(savedPlace);
  const reminderValue = String(draft.reminderMinutes);
  const showRepeatGroup = scheduled || reminder;

  /*
    שלוש קבוצות, לפי השאלה שכל אחת עונה עליה: מתי, חזרה ותזכורת, ואיפה
    ומה. כל קבוצה היא קופסה אחת עם כותרת קטנה מעליה, כך שהשורות גדולות
    בלי שהטופס יתארך - ובלי לדחוס הכול לקופסה אחת שבה כבר לא רואים מה
    שייך למה.
  */
  return (
    <>
      {(scheduled || whenToggle) && (
        <FormSection title="מתי">
          <div className="space-y-3 overflow-hidden rounded-group bg-well p-3">
            {whenToggle}
            {scheduled && (
              <>
                {/*
                  "בשעות" ו"כל היום" הם שתי תשובות לאותה שאלה, ולכן מתג
                  מצב ולא צ׳יפ דלוק־כבוי. במצב "כל היום" השעות מתקפלות:
                  המתג עצמו אומר שיש שעות, ואריחים מעומעמים בגודל כזה היו
                  תופסים חצי מסך בשביל רמז.
                */}
                <Segmented<'timed' | 'allDay'>
                  label="סוג המועד"
                  value={draft.allDay ? 'allDay' : 'timed'}
                  onChange={(v) => setAllDay(v === 'allDay')}
                  options={[
                    { value: 'timed', label: 'בשעות' },
                    { value: 'allDay', label: 'כל היום' },
                  ]}
                />

                <DayStrip
                  value={editingEnd ? (draft.endDate ?? draft.date) : draft.date}
                  onChange={pickDay}
                  min={editingEnd ? draft.date : undefined}
                  range={multiDay ? { from: draft.date, to: draft.endDate! } : undefined}
                  label={editingEnd ? 'יום הסיום' : 'תאריך'}
                  headerEnd={
                    /* אירוע שנמשך כמה ימים - חופשה, טיול, אירוח */
                    <ChipToggle
                      icon={<CalendarRange size={ICON.sm} />}
                      label="כמה ימים"
                      checked={multiDay}
                      onChange={setMultiDay}
                    />
                  }
                />

                {/*
                  רצועה אחת לשני הקצוות: המתג אומר איזה מהם הקשה תזיז.
                  שתי רצועות היו מכפילות את גובה הקבוצה בשביל אירוע שרוב
                  האנשים יוצרים פעם בחודש.
                */}
                {multiDay && (
                  <Segmented<'from' | 'to'>
                    size="sm"
                    label="איזה יום לבחור"
                    value={spanEdge}
                    onChange={setSpanEdge}
                    options={[
                      { value: 'from', label: `התחלה · ${shortDateLabel(draft.date)}` },
                      { value: 'to', label: `סיום · ${shortDateLabel(draft.endDate!)}` },
                    ]}
                  />
                )}

                <AnimatePresence initial={false}>
                  {!draft.allDay && (
                    <motion.div
                      key="times"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0, transition: { height: GLIDE, opacity: EXIT } }}
                      transition={{ height: GLIDE, opacity: ENTER }}
                      className="overflow-hidden"
                    >
                      <TimeTiles
                        start={draft.startTime ?? DEFAULT_START}
                        end={draft.endTime ?? defaultEndFor(draft.startTime ?? DEFAULT_START)}
                        onStart={onStartChange}
                        onEnd={(endTime) => patch({ endTime })}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <p className="px-1 text-caption leading-relaxed text-muted" aria-live="polite">
                  {whenSummary(draft)}
                </p>
              </>
            )}
          </div>
        </FormSection>
      )}

      {showRepeatGroup && (
        <FormSection title={personal && scheduled ? 'חזרה ותזכורת' : 'חזרה'}>
          <FieldGroup>
            <RepeatField
              repeat={draft.repeat}
              repeatEvery={draft.repeatEvery}
              onChange={(next) => patch(next)}
            />
            {reminder && !scheduled && draft.repeat !== 'none' && (
              <p className="px-4 py-3 text-caption leading-relaxed text-muted">
                {undatedRepeatHint(draft.repeat, draft.repeatEvery)}
              </p>
            )}
            {/* בלי יום אין רגע להקדים אליו */}
            {personal && scheduled && (
              <div className="space-y-2.5 px-4 pb-3.5 pt-3">
                <span className="flex items-center gap-3.5 text-body font-medium text-ink">
                  <span className="flex w-6 justify-center text-muted [&_svg]:h-5 [&_svg]:w-5">
                    <Bell size={ICON.lg} />
                  </span>
                  תזכורת
                </span>
                <TileStrip<string>
                  label="תזכורת"
                  value={reminderValue}
                  onChange={(v) => patch({ reminderMinutes: v === 'null' ? null : Number(v) })}
                  options={QUICK_REMINDERS.map((m) => ({
                    value: String(m),
                    label: SHORT_REMINDER_LABEL[String(m)],
                  }))}
                  more={{
                    label: 'עוד…',
                    title: 'תזכורת',
                    options: REMINDER_OPTIONS.map((o) => ({
                      value: String(o.value),
                      label: o.label,
                    })),
                  }}
                />
              </div>
            )}
          </FieldGroup>
        </FormSection>
      )}

      <FormSection title="איפה ומה">
        <FieldGroup>
          <PickerField
            label="מקום"
            display={draft.location || 'לא הוגדר'}
            icon={<MapPin size={ICON.md} />}
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
                <Navigation size={ICON.xs} />
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

          {category && (
            <SelectField<string>
              label="קטגוריה"
              value={category.value}
              onChange={category.onChange}
              icon={<Tag size={ICON.md} />}
              options={category.options}
              variant="grouped"
              create={
                category.onCreate
                  ? { placeholder: 'קטגוריה חדשה', onCreate: category.onCreate }
                  : undefined
              }
            />
          )}

          <TextAreaRow
            icon={<FilePen size={ICON.md} />}
            label="הערות"
            value={draft.notes ?? ''}
            onChange={(notes) => patch({ notes })}
            placeholder="הערות"
          />
        </FieldGroup>
      </FormSection>

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
      className="focus-ring mt-2.5 flex w-full items-start gap-2 rounded-tile bg-surface px-3 py-2.5 text-right text-caption leading-relaxed text-ink"
    >
      <Navigation size={ICON.xs} className="mt-0.5 shrink-0" />
      <span>
        {geo.foreground
          ? 'כדי שההתראה תגיע גם כשהאפליקציה סגורה, צריך לבחור ״לאפשר תמיד״ בהרשאת המיקום. הקשה פותחת את ההגדרות.'
          : 'צריך הרשאת מיקום מדויק כדי לזהות הגעה ויציאה. הקשה כדי לאשר.'}
      </span>
    </button>
  );
}
