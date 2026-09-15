/**
 * יצירה ועריכה של אירוע.
 * כל שדה שבוחרים בו ערך (תאריך, שעות, חזרה, תזכורת) פותח בורר משלנו
 * ולא פקד מובנה של הדפדפן, כדי לשמור על מראה אחיד בכל מכשיר.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  CalendarDays,
  CalendarRange,
  Clock,
  MapPin,
  Navigation,
  Repeat,
  Trash2,
} from 'lucide-react';
import type { DateKey, EventColor, EventException, PlaceTrigger, UserEvent } from '@/types';
import { REPEAT_LABELS, spanLengthOf, type Occurrence } from '@/lib/recurrence';
import {
  EVENT_COLORS,
  REMINDER_OPTIONS,
  useEvents,
  useEventsStore,
  type EventDraft,
} from '@/store/events';
import { ScopeSheet, type EditScope } from './ScopeSheet';
import { LocationPicker } from './LocationPicker';
import { addDays, dateKey, keyToDate, dayTitleLabel, minutesToTime, timeToMinutes } from '@/lib/dates';
import { hebrewDateParts } from '@/lib/hebrew';
import { useSettings } from '@/store/settings';
import { Sheet } from './ui/Sheet';
import { PrimaryButton, Segmented, Toggle } from './ui/controls';
import {
  DateField,
  PickerField,
  SelectField,
  TextArea,
  TimeField,
} from './ui/fields';
import { ICON, STROKE } from '@/lib/motion';
import { haptic } from '@/lib/native';
import { announce } from '@/lib/announce';

const COLOR_SWATCH: Record<EventColor, string> = {
  violet: 'ev-violet',
  mint: 'ev-mint',
  rose: 'ev-rose',
  peach: 'ev-peach',
  sky: 'ev-sky',
  slate: 'ev-slate',
};

/**
 * שורת מתג. קודם כל בוליאני ישב בכרטיס בגובה 60px, ושני מתגים לקחו
 * חמישית מהמסך בשביל שתי מילים.
 */
function ToggleRow({
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

function emptyDraft(date: DateKey, color: EventColor): EventDraft {
  return {
    title: '',
    date,
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    location: '',
    notes: '',
    color,
    reminderMinutes: 15,
    repeat: 'none',
  };
}

export function EventEditor({
  open,
  onClose,
  date,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  /** היום שבו נוצר האירוע החדש */
  date: DateKey;
  /** אירוע קיים לעריכה, או null ליצירה */
  editing: Occurrence | UserEvent | null;
}) {
  const settings = useSettings();
  const places = settings.places;
  const { add, update, remove, updateOccurrence, cancelOccurrence } = useEventsStore();
  const [draft, setDraft] = useState<EventDraft>(() =>
    emptyDraft(date, settings.defaultEventColor),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** איזו שאלת היקף פתוחה, כשעורכים מופע בתוך סדרה חוזרת */
  const [askScope, setAskScope] = useState<'save' | 'delete' | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const allEvents = useEvents();

  /**
   * עריכה של מופע בתוך סדרה חוזרת חייבת לשאול על מה היא חלה. אירוע
   * חד־פעמי, והמופע הראשון שהוא גם האירוע עצמו, לא מעלים את השאלה.
   */
  const occurrence = editing && 'sourceKey' in editing ? editing : null;
  const isSeriesMember = Boolean(occurrence && occurrence.repeat !== 'none');

  // מאתחלים את הטופס בכל פתיחה
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setAskScope(null);
    setLocationOpen(false);
    if (editing) {
      setDraft({
        title: editing.title,
        date: editing.date,
        startTime: editing.startTime,
        endTime: editing.endTime,
        allDay: editing.allDay,
        location: editing.location ?? '',
        placeId: editing.placeId,
        placeTrigger: editing.placeTrigger,
        notes: editing.notes ?? '',
        color: editing.color,
        reminderMinutes: editing.reminderMinutes,
        repeat: editing.repeat,
        endDate: editing.endDate,
      });
    } else {
      setDraft(emptyDraft(date, settings.defaultEventColor));
    }
  }, [open, editing, date, settings.defaultEventColor]);

  const patch = (values: Partial<EventDraft>) => setDraft((d) => ({ ...d, ...values }));

  const payloadOf = (): EventDraft => ({
    ...draft,
    title: draft.title.trim(),
    location: draft.location?.trim() || undefined,
    placeId: draft.placeId,
    // בלי מקום שמור אין על מה לגדר
    placeTrigger: draft.placeId ? draft.placeTrigger : undefined,
    // עריכת תזכורת בלי תאריך לא משייכת אותה ליום בשקט
    undated: editing && 'undated' in editing ? editing.undated : undefined,
    notes: draft.notes?.trim() || undefined,
    startTime: draft.allDay ? null : draft.startTime,
    endTime: draft.allDay ? null : draft.endTime,
  });

  /** שמירה על המופע הזה בלבד: רק השדות שבאמת השתנו נרשמים כחריג. */
  const saveOccurrence = () => {
    if (!occurrence) return;
    const p = payloadOf();
    const exception: EventException = {};
    if (p.title !== occurrence.title) exception.title = p.title;
    if (p.allDay !== occurrence.allDay) exception.allDay = p.allDay;
    if (p.startTime !== occurrence.startTime) exception.startTime = p.startTime;
    if (p.endTime !== occurrence.endTime) exception.endTime = p.endTime;
    if ((p.location ?? '') !== (occurrence.location ?? '')) exception.location = p.location;
    if (p.placeId !== occurrence.placeId) exception.placeId = p.placeId;
    if (p.placeTrigger !== occurrence.placeTrigger) exception.placeTrigger = p.placeTrigger;
    if ((p.notes ?? '') !== (occurrence.notes ?? '')) exception.notes = p.notes;
    if (p.endDate !== occurrence.endDate) exception.endDate = p.endDate;
    if (p.color !== occurrence.color) exception.color = p.color;
    if (p.reminderMinutes !== occurrence.reminderMinutes) {
      exception.reminderMinutes = p.reminderMinutes;
    }
    // שינוי התאריך במופע בודד הוא הזזה שלו, לא של הסדרה
    if (p.date !== occurrence.date) exception.movedTo = p.date;
    updateOccurrence(occurrence.baseId, occurrence.sourceKey, exception);
  };

  /*
    כתיבה ומחיקה הן הדרגה הכבדה בסולם המישוש: אלה הפעולות שמשנות נתונים
    וסוגרות את הגיליון, והאצבע צריכה לדעת שהן קרו. ההכרזה נשלחת באותה
    נקודה בדיוק - הגיליון נסגר, המסך משתנה, והמיקוד לא זז לשום מקום
    שמסביר מה קרה.
  */
  const saved = (message: string) => {
    void haptic('medium');
    announce(message);
    onClose();
  };

  const applyScope = (scope: EditScope) => {
    if (scope === 'series') update(occurrence!.baseId, payloadOf());
    else saveOccurrence();
    saved(scope === 'series' ? 'כל הסדרה עודכנה' : 'המופע עודכן');
  };

  const applyDeleteScope = (scope: EditScope) => {
    if (scope === 'series') remove(occurrence!.baseId);
    else cancelOccurrence(occurrence!.baseId, occurrence!.sourceKey);
    saved(scope === 'series' ? 'הסדרה נמחקה' : 'המופע נמחק');
  };

  const onSave = () => {
    if (!draft.title.trim()) return;
    if (!editing) {
      add(payloadOf());
      saved(`"${draft.title.trim()}" נוסף`);
      return;
    }
    if (isSeriesMember) {
      setAskScope('save');
      return;
    }
    update('baseId' in editing ? editing.baseId : editing.id, payloadOf());
    saved('האירוע נשמר');
  };

  const onDelete = () => {
    if (!editing) return;
    if (isSeriesMember) {
      setAskScope('delete');
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    remove('baseId' in editing ? editing.baseId : editing.id);
    saved('האירוע נמחק');
  };

  const eventDate = keyToDate(draft.date);
  const hebrew = hebrewDateParts(eventDate);
  /** המקום השמור שנבחר, אם נבחר כזה */
  const savedPlace = draft.placeId ? places.find((pl) => pl.id === draft.placeId) : undefined;
  const multiDay = Boolean(draft.endDate && draft.endDate > draft.date);
  const spanDays = spanLengthOf({ date: draft.date, endDate: draft.endDate });
  const spanHint = multiDay ? `${spanDays} ימים` : '';

  /** שינוי שעת ההתחלה מזיז גם את שעת הסיום, כדי לשמור על המשך */
  const onStartChange = (value: string) => {
    if (!draft.startTime || !draft.endTime) {
      patch({ startTime: value });
      return;
    }
    const delta = timeToMinutes(draft.endTime) - timeToMinutes(draft.startTime);
    patch({ startTime: value, endTime: minutesToTime(timeToMinutes(value) + Math.max(0, delta)) });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="tall"
      title={editing ? 'עריכת אירוע' : 'אירוע חדש'}
      subtitle={`${dayTitleLabel(eventDate)} · ${hebrew.day} ב${hebrew.month}`}
      headerAction={
        editing ? (
          <motion.button
            type="button"
            onClick={onDelete}
            whileTap={{ scale: 0.95 }}
            className={`flex h-11 items-center gap-2 rounded-2xl px-4 text-caption font-semibold transition-colors ${
              !isSeriesMember && confirmDelete
                ? 'bg-[rgb(240_118_149)] text-white'
                : 'bg-well text-[rgb(194_60_90)]'
            }`}
          >
            <Trash2 size={ICON.md} strokeWidth={STROKE} />
            {!isSeriesMember && confirmDelete ? 'למחוק?' : 'מחיקה'}
          </motion.button>
        ) : undefined
      }
      footer={
        <PrimaryButton onClick={onSave} disabled={!draft.title.trim()}>
          {/* כפתור מושבת שאומר למה עדיף על כפתור מושבת ששותק */}
          {!draft.title.trim()
            ? 'צריך שם לאירוע'
            : editing
              ? 'שמירת שינויים'
              : 'יצירת אירוע'}
        </PrimaryButton>
      }
    >
      <div className="space-y-2.5 pb-2">
        {/*
          הכותרת יוצאת ממערכת הכרטיסים. היא השדה היחיד שחובה למלא,
          וכשהיא נראתה כמו "מקום" - אותו רקע, אותו רדיוס, אותו משקל -
          שום דבר במסך לא אמר במה להתחיל.
        */}
        <input
          type="text"
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="שם האירוע"
          autoComplete="off"
          aria-label="כותרת האירוע"
          className="field-reset w-full border-b border-hairline bg-transparent px-1 pb-3 pt-1 text-title font-semibold text-ink placeholder:font-normal placeholder:text-faint"
        />

        {/* צבע - שורה אחת של ריבועים, לא כרטיס בגובה 100px */}
        <div className="flex items-center gap-3 rounded-2xl bg-well px-4 py-2.5">
          <span className="shrink-0 text-label font-medium text-ink">צבע</span>
          <div className="flex flex-1 justify-end gap-2">
            {EVENT_COLORS.map((c) => {
              const active = draft.color === c.id;
              return (
                <motion.button
                  key={c.id}
                  type="button"
                  onClick={() => patch({ color: c.id })}
                  whileTap={{ scale: 0.9 }}
                  aria-label={c.label}
                  aria-pressed={active}
                  className={`ev ${COLOR_SWATCH[c.id]} flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                    active ? 'ring-2 ring-brand ring-offset-2 ring-offset-well' : ''
                  }`}
                >
                  <span className="ev-dot block h-3 w-3 rounded-md" />
                </motion.button>
              );
            })}
          </div>
        </div>

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
          onChange={(allDay) => patch({ allDay })}
        />

        {!draft.allDay && (
          <div className="flex gap-2.5">
            <div className="flex-1">
              <TimeField
                label="התחלה"
                value={draft.startTime ?? '09:00'}
                onChange={onStartChange}
                variant="row"
              />
            </div>
            <div className="flex-1">
              <TimeField
                label="סיום"
                value={draft.endTime ?? '10:00'}
                onChange={(endTime: string) => patch({ endTime })}
                variant="row"
              />
            </div>
          </div>
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
        {savedPlace && (
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

        <SelectField<string>
          label="תזכורת"
          value={String(draft.reminderMinutes)}
          onChange={(v) => patch({ reminderMinutes: v === 'null' ? null : Number(v) })}
          icon={<Bell size={ICON.md} strokeWidth={STROKE} />}
          options={REMINDER_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
          variant="row"
        />

        <TextArea
          label="הערות"
          value={draft.notes ?? ''}
          onChange={(notes) => patch({ notes })}
          placeholder="פרטים נוספים"
          rows={2}
        />
      </div>

      <LocationPicker
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        value={{ location: draft.location, placeId: draft.placeId }}
        onChange={(next) => patch({ location: next.location ?? '', placeId: next.placeId })}
        events={allEvents}
        places={places}
      />

      <ScopeSheet
        open={askScope === 'save'}
        onClose={() => setAskScope(null)}
        onChoose={applyScope}
        title="על מה לשמור?"
        occurrenceLabel="המופע הזה בלבד"
        occurrenceHint={`השינוי יחול רק על ${dayTitleLabel(eventDate)}`}
        seriesLabel="כל הסדרה"
        seriesHint="השינוי יחול על כל המופעים, כולל אלה שכבר עברו"
      />

      <ScopeSheet
        open={askScope === 'delete'}
        onClose={() => setAskScope(null)}
        onChoose={applyDeleteScope}
        title="מה למחוק?"
        occurrenceLabel="המופע הזה בלבד"
        occurrenceHint="שאר המופעים יישארו במקומם"
        seriesLabel="את כל הסדרה"
        seriesHint="כל המופעים יימחקו. אי אפשר לבטל"
        destructive
      />
    </Sheet>
  );
}
