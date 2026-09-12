/**
 * יצירה ועריכה של אירוע - בפריסה של עיצוב הייחוס:
 * כותרת גדולה, צ׳יפים לבחירת צבע, מקום, שעות, חזרה, תזכורת וכפתור ראשי.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Clock, MapPin, Repeat, Trash2 } from 'lucide-react';
import type { DateKey, EventColor, UserEvent } from '@/types';
import { REPEAT_LABELS, type Occurrence } from '@/lib/recurrence';
import { EVENT_COLORS, REMINDER_OPTIONS, useEventsStore, type EventDraft } from '@/store/events';
import { keyToDate, dayTitleLabel, minutesToTime, timeToMinutes } from '@/lib/dates';
import { hebrewDateParts } from '@/lib/hebrew';
import { useSettings } from '@/store/settings';
import { Sheet } from './ui/Sheet';
import { PrimaryButton, Toggle } from './ui/controls';
import { TimeField } from './ui/TimeField';

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
            whileTap={{ scale: 0.92 }}
            className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors ${
              confirmDelete
                ? 'bg-[rgb(240_118_149)] text-white'
                : 'bg-well text-[rgb(194_60_90)]'
            }`}
          >
            <Trash2 size={15} strokeWidth={2.3} />
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
      {/* כותרת */}
      <label className="mb-4 block">
        <span className="mb-1 block text-[12px] font-medium text-muted">כותרת</span>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="לדוגמה: ארוחת שבת אצל סבתא"
          autoComplete="off"
          className="w-full border-none bg-transparent p-0 text-[22px] font-semibold leading-snug text-ink outline-none placeholder:font-normal placeholder:text-faint"
        />
      </label>

      {/* צבעים */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {EVENT_COLORS.map((c) => {
          const active = draft.color === c.id;
          return (
            <motion.button
              key={c.id}
              type="button"
              onClick={() => patch({ color: c.id })}
              whileTap={{ scale: 0.92 }}
              className={`ev ${COLOR_SWATCH[c.id]} rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-shadow ${
                active ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface' : ''
              }`}
            >
              {c.label}
            </motion.button>
          );
        })}
      </div>

      {/* מקום */}
      <label className="mb-4 block">
        <span className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-muted">
          <MapPin size={13} strokeWidth={2.3} />
          מקום
        </span>
        <input
          type="text"
          value={draft.location ?? ''}
          onChange={(e) => patch({ location: e.target.value })}
          placeholder="לא הוגדר"
          autoComplete="off"
          className="w-full border-none bg-transparent p-0 text-[15.5px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      {/* כל היום */}
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-well px-4 py-3">
        <span className="flex items-center gap-2 text-[14.5px] font-medium text-ink">
          <Clock size={16} strokeWidth={2.2} className="text-muted" />
          כל היום
        </span>
        <Toggle
          label="כל היום"
          checked={draft.allDay}
          onChange={(allDay) => patch({ allDay })}
        />
      </div>

      {/* שעות */}
      {!draft.allDay && (
        <div className="mb-4 flex gap-3">
          <TimeField
            label="שעת התחלה"
            value={draft.startTime ?? '09:00'}
            onChange={onStartChange}
          />
          <TimeField
            label="שעת סיום"
            value={draft.endTime ?? '10:00'}
            onChange={(endTime) => patch({ endTime })}
          />
        </div>
      )}

      {/* חזרה */}
      <div className="mb-4 rounded-2xl bg-well px-4 py-3">
        <span className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted">
          <Repeat size={13} strokeWidth={2.3} />
          חזרה
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(REPEAT_LABELS) as UserEvent['repeat'][]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => patch({ repeat: r })}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                draft.repeat === r ? 'bg-brand text-white' : 'bg-surface text-muted'
              }`}
            >
              {REPEAT_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* תזכורת */}
      <div className="mb-4 rounded-2xl bg-well px-4 py-3">
        <span className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted">
          <Bell size={13} strokeWidth={2.3} />
          תזכורת
        </span>
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => patch({ reminderMinutes: opt.value })}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                draft.reminderMinutes === opt.value
                  ? 'bg-brand text-white'
                  : 'bg-surface text-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* הערות */}
      <label className="mb-2 block rounded-2xl bg-well px-4 py-3">
        <span className="mb-1 block text-[12px] font-medium text-muted">הערות</span>
        <textarea
          value={draft.notes ?? ''}
          onChange={(e) => patch({ notes: e.target.value })}
          rows={3}
          placeholder="פרטים נוספים"
          className="w-full resize-none border-none bg-transparent p-0 text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-faint"
        />
      </label>
    </Sheet>
  );
}
