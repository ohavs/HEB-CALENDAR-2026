/**
 * יצירה ועריכה של אירוע.
 * כל שדה שבוחרים בו ערך (תאריך, שעות, חזרה, תזכורת) פותח בורר משלנו
 * ולא פקד מובנה של הדפדפן, כדי לשמור על מראה אחיד בכל מכשיר.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, CalendarDays, CalendarRange, Clock, MapPin, Repeat, Trash2 } from 'lucide-react';
import type { DateKey, EventColor, EventException, UserEvent } from '@/types';
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
import { PrimaryButton, Toggle } from './ui/controls';
import {
  DateField,
  PickerField,
  SelectField,
  TextArea,
  TextField,
  TimeField,
} from './ui/fields';
import { ICON, STROKE } from '@/lib/motion';

const COLOR_SWATCH: Record<EventColor, string> = {
  violet: 'ev-violet',
  mint: 'ev-mint',
  rose: 'ev-rose',
  peach: 'ev-peach',
  sky: 'ev-sky',
  slate: 'ev-slate',
};

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

  const applyScope = (scope: EditScope) => {
    if (scope === 'series') update(occurrence!.baseId, payloadOf());
    else saveOccurrence();
    onClose();
  };

  const applyDeleteScope = (scope: EditScope) => {
    if (scope === 'series') remove(occurrence!.baseId);
    else cancelOccurrence(occurrence!.baseId, occurrence!.sourceKey);
    onClose();
  };

  const onSave = () => {
    if (!draft.title.trim()) return;
    if (!editing) {
      add(payloadOf());
      onClose();
      return;
    }
    if (isSeriesMember) {
      setAskScope('save');
      return;
    }
    update('baseId' in editing ? editing.baseId : editing.id, payloadOf());
    onClose();
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
    onClose();
  };

  const eventDate = keyToDate(draft.date);
  const hebrew = hebrewDateParts(eventDate);
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
          {editing ? 'שמירת שינויים' : 'יצירת אירוע'}
        </PrimaryButton>
      }
    >
      <div className="space-y-3 pb-2">
        <TextField
          label="כותרת"
          value={draft.title}
          onChange={(title) => patch({ title })}
          placeholder="לדוגמה: ארוחת שבת אצל סבתא"
          size="lg"
        />

        {/* צבע - ריבועים מעוגלים, לא גלולות */}
        <div className="rounded-2xl bg-well px-4 py-3.5">
          <span className="mb-3 block text-caption font-medium text-muted">צבע</span>
          <div className="flex flex-wrap gap-2.5">
            {EVENT_COLORS.map((c) => {
              const active = draft.color === c.id;
              return (
                <motion.button
                  key={c.id}
                  type="button"
                  onClick={() => patch({ color: c.id })}
                  whileTap={{ scale: 0.92 }}
                  aria-label={c.label}
                  aria-pressed={active}
                  className={`ev ${COLOR_SWATCH[c.id]} flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
                    active ? 'ring-2 ring-brand ring-offset-2 ring-offset-well' : ''
                  }`}
                >
                  <span className="ev-dot block h-4 w-4 rounded-lg" />
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
          icon={<CalendarDays size={ICON.sm} strokeWidth={STROKE} />}
          hint={`${hebrew.day} ב${hebrew.month} ${hebrew.year}`}
          weekStart={settings.weekStart}
        />

        {/* אירוע שנמשך כמה ימים - חופשה, טיול, אירוח */}
        <div className="flex items-center justify-between rounded-2xl bg-well px-4 py-3.5">
          <span className="flex items-center gap-2.5 text-body font-medium text-ink">
            <CalendarRange size={ICON.lg} strokeWidth={STROKE} className="text-muted" />
            נמשך כמה ימים
          </span>
          <Toggle
            label="נמשך כמה ימים"
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
            icon={<CalendarRange size={ICON.sm} strokeWidth={STROKE} />}
            hint={spanHint}
            weekStart={settings.weekStart}
            min={draft.date}
          />
        )}

        {/* כל היום */}
        <div className="flex items-center justify-between rounded-2xl bg-well px-4 py-3.5">
          <span className="flex items-center gap-2.5 text-body font-medium text-ink">
            <Clock size={ICON.lg} strokeWidth={STROKE} className="text-muted" />
            כל היום
          </span>
          <Toggle label="כל היום" checked={draft.allDay} onChange={(allDay) => patch({ allDay })} />
        </div>

        {!draft.allDay && (
          <div className="flex gap-3">
            <div className="flex-1">
              <TimeField
                label="שעת התחלה"
                value={draft.startTime ?? '09:00'}
                onChange={onStartChange}
              />
            </div>
            <div className="flex-1">
              <TimeField
                label="שעת סיום"
                value={draft.endTime ?? '10:00'}
                onChange={(endTime: string) => patch({ endTime })}
              />
            </div>
          </div>
        )}

        <PickerField
          label="מקום"
          display={draft.location || 'לא הוגדר'}
          icon={<MapPin size={ICON.sm} strokeWidth={STROKE} />}
          hint={
            draft.placeId && places.some((pl) => pl.id === draft.placeId)
              ? 'מקום שמור'
              : undefined
          }
          onOpen={() => setLocationOpen(true)}
        />

        <SelectField<UserEvent['repeat']>
          label="חזרה"
          value={draft.repeat}
          onChange={(repeat) => patch({ repeat })}
          icon={<Repeat size={ICON.sm} strokeWidth={STROKE} />}
          options={(Object.keys(REPEAT_LABELS) as UserEvent['repeat'][]).map((r) => ({
            value: r,
            label: REPEAT_LABELS[r],
          }))}
        />

        <SelectField<string>
          label="תזכורת"
          value={String(draft.reminderMinutes)}
          onChange={(v) => patch({ reminderMinutes: v === 'null' ? null : Number(v) })}
          icon={<Bell size={ICON.sm} strokeWidth={STROKE} />}
          options={REMINDER_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
        />

        <TextArea
          label="הערות"
          value={draft.notes ?? ''}
          onChange={(notes) => patch({ notes })}
          placeholder="פרטים נוספים"
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
