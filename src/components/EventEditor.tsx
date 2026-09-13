/**
 * יצירה ועריכה של אירוע.
 * כל שדה שבוחרים בו ערך (תאריך, שעות, חזרה, תזכורת) פותח בורר משלנו
 * ולא פקד מובנה של הדפדפן, כדי לשמור על מראה אחיד בכל מכשיר.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, CalendarDays, Clock, MapPin, Repeat, Trash2 } from 'lucide-react';
import type { DateKey, EventColor, UserEvent } from '@/types';
import { REPEAT_LABELS, type Occurrence } from '@/lib/recurrence';
import { EVENT_COLORS, REMINDER_OPTIONS, useEventsStore, type EventDraft } from '@/store/events';
import { keyToDate, dayTitleLabel, minutesToTime, timeToMinutes } from '@/lib/dates';
import { hebrewDateParts } from '@/lib/hebrew';
import { useSettings } from '@/store/settings';
import { Sheet } from './ui/Sheet';
import { PrimaryButton, Toggle } from './ui/controls';
import { DateField, SelectField, TextArea, TextField, TimeField } from './ui/fields';

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
  const { add, update, remove } = useEventsStore();
  const [draft, setDraft] = useState<EventDraft>(() =>
    emptyDraft(date, settings.defaultEventColor),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  // מאתחלים את הטופס בכל פתיחה
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      setDraft({
        title: editing.title,
        date: editing.date,
        startTime: editing.startTime,
        endTime: editing.endTime,
        allDay: editing.allDay,
        location: editing.location ?? '',
        notes: editing.notes ?? '',
        color: editing.color,
        reminderMinutes: editing.reminderMinutes,
        repeat: editing.repeat,
      });
    } else {
      setDraft(emptyDraft(date, settings.defaultEventColor));
    }
  }, [open, editing, date, settings.defaultEventColor]);

  const patch = (values: Partial<EventDraft>) => setDraft((d) => ({ ...d, ...values }));

  const onSave = () => {
    const title = draft.title.trim();
    if (!title) return;
    const payload: EventDraft = {
      ...draft,
      title,
      location: draft.location?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
      startTime: draft.allDay ? null : draft.startTime,
      endTime: draft.allDay ? null : draft.endTime,
    };
    if (editing) {
      const baseId = 'baseId' in editing ? editing.baseId : editing.id;
      update(baseId, payload);
    } else {
      add(payload);
    }
    onClose();
  };

  const onDelete = () => {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const baseId = 'baseId' in editing ? editing.baseId : editing.id;
    remove(baseId);
    onClose();
  };

  const eventDate = keyToDate(draft.date);
  const hebrew = hebrewDateParts(eventDate);

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
              confirmDelete
                ? 'bg-[rgb(240_118_149)] text-white'
                : 'bg-well text-[rgb(194_60_90)]'
            }`}
          >
            <Trash2 size={17} strokeWidth={2.3} />
            {confirmDelete ? 'למחוק?' : 'מחיקה'}
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
          label="תאריך"
          value={draft.date}
          onChange={(d) => patch({ date: d })}
          icon={<CalendarDays size={15} strokeWidth={2.3} />}
          hint={`${hebrew.day} ב${hebrew.month} ${hebrew.year}`}
          weekStart={settings.weekStart}
        />

        {/* כל היום */}
        <div className="flex items-center justify-between rounded-2xl bg-well px-4 py-3.5">
          <span className="flex items-center gap-2.5 text-body font-medium text-ink">
            <Clock size={19} strokeWidth={2.2} className="text-muted" />
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

        <TextField
          label="מקום"
          value={draft.location ?? ''}
          onChange={(location) => patch({ location })}
          placeholder="לא הוגדר"
          icon={<MapPin size={15} strokeWidth={2.3} />}
        />

        <SelectField<UserEvent['repeat']>
          label="חזרה"
          value={draft.repeat}
          onChange={(repeat) => patch({ repeat })}
          icon={<Repeat size={15} strokeWidth={2.3} />}
          options={(Object.keys(REPEAT_LABELS) as UserEvent['repeat'][]).map((r) => ({
            value: r,
            label: REPEAT_LABELS[r],
          }))}
        />

        <SelectField<string>
          label="תזכורת"
          value={String(draft.reminderMinutes)}
          onChange={(v) => patch({ reminderMinutes: v === 'null' ? null : Number(v) })}
          icon={<Bell size={15} strokeWidth={2.3} />}
          options={REMINDER_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
        />

        <TextArea
          label="הערות"
          value={draft.notes ?? ''}
          onChange={(notes) => patch({ notes })}
          placeholder="פרטים נוספים"
        />
      </div>
    </Sheet>
  );
}
