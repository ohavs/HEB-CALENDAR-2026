/**
 * יצירה ועריכה של אירוע.
 * כל שדה שבוחרים בו ערך (תאריך, שעות, חזרה, תזכורת) פותח בורר משלנו
 * ולא פקד מובנה של הדפדפן, כדי לשמור על מראה אחיד בכל מכשיר.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import type { DateKey, EventColor, EventException, UserEvent } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { EVENT_COLORS, useEventsStore, type EventDraft } from '@/store/events';
import { ScopeSheet, type EditScope } from './ScopeSheet';
import { ConfirmDiscardSheet } from './ConfirmDiscardSheet';
import { DEFAULT_START, EventFields, defaultEndFor } from './EventFields';
import { keyToDate, dayTitleLabel } from '@/lib/dates';
import { hebrewDateParts } from '@/lib/hebrew';
import { isDraftDirty } from '@/lib/draftDirty';
import { useSettings } from '@/store/settings';
import { Sheet } from './ui/Sheet';
import { PrimaryButton } from './ui/controls';
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

function emptyDraft(date: DateKey, color: EventColor, startTime?: string): EventDraft {
  const start = startTime ?? DEFAULT_START;
  return {
    title: '',
    date,
    startTime: start,
    // 23:00 + שעה אינו 24:00 - נעצרים בסוף היממה ולא גולשים ליום הבא
    endTime: defaultEndFor(start),
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
  startTime,
  prefill,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  /** היום שבו נוצר האירוע החדש */
  date: DateKey;
  /**
   * שעת פתיחה לאירוע חדש.
   *
   * הקשה על תא בתצוגת שבוע כבר אמרה גם את היום וגם את השעה, ולפתוח
   * אחריה טופס שכתוב בו 09:00 זה לבקש מהמשתמש להקליד מה שהוא בדיוק
   * הראה באצבע. השדה נשאר לעריכה כרגיל.
   */
  startTime?: string;
  /**
   * טיוטה שהגיעה מוכנה מהוספה מהירה.
   *
   * ההוספה במסך התזכורות היא שורה אחת, ומי שצריך יותר ממנה ממשיך לכאן.
   * היא מוסרת את מה שכבר הוקלד במקום לשמור ואז לפתוח לעריכה - אחרת
   * ביטול היה משאיר אחריו תזכורת שאיש לא ביקש.
   */
  prefill?: EventDraft | null;
  /** אירוע קיים לעריכה, או null ליצירה */
  editing: Occurrence | UserEvent | null;
}) {
  const settings = useSettings();
  const { add, update, remove, updateOccurrence, cancelOccurrence } = useEventsStore();
  const [draft, setDraft] = useState<EventDraft>(() =>
    emptyDraft(date, settings.defaultEventColor, startTime),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** השאלה לפני יציאה שמאבדת את מה שמולא */
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  /**
   * הטופס כפי שנפתח, להשוואה.
   *
   * ב-ref ולא ב-state: הוא נקבע פעם אחת בפתיחה ואינו משתתף בציור, ולכן
   * `setState` עליו היה רק רינדור מיותר.
   */
  const baseline = useRef<EventDraft | null>(null);
  /** איזו שאלת היקף פתוחה, כשעורכים מופע בתוך סדרה חוזרת */
  const [askScope, setAskScope] = useState<'save' | 'delete' | null>(null);

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
    setConfirmDiscard(false);
    if (editing) {
      const start = editing.startTime ?? DEFAULT_START;
      const loaded: EventDraft = {
        title: editing.title,
        date: editing.date,
        /*
          תזכורת נשמרת בלי שעות (`allDay`), אבל שדות השעה מציגים ערך גם
          אז - מעומעמים. כשהטיוטה נשארה `null` השניים נפרדו: הכיבוי של
          "כל היום" חשף 09:00 ו-10:00 שאינם קיימים באמת, ולכן שינוי
          ההתחלה לא הזיז את הסיום - הוא נשאר על אותה עשר קבועה. הטיוטה
          מקבלת שעות אמיתיות כבר בפתיחה, ו-`payloadOf` מאפס אותן בחזרה
          כשהמתג דלוק.
        */
        startTime: start,
        endTime: editing.endTime ?? defaultEndFor(start),
        allDay: editing.allDay,
        location: editing.location ?? '',
        placeId: editing.placeId,
        placeTrigger: editing.placeTrigger,
        notes: editing.notes ?? '',
        color: editing.color,
        reminderMinutes: editing.reminderMinutes,
        repeat: editing.repeat,
        endDate: editing.endDate,
      };
      setDraft(loaded);
      /*
        על אירוע קיים הבסיס הוא מה שנטען, ולכן פתיחה וסגירה מיד אינה
        נחשבת שינוי. השעות שהושלמו כאן (ראו למעלה) נכללות בבסיס בכוונה -
        הן לא באו מהמשתמש, ואסור שהשלמה טכנית תעלה שאלה.
      */
      baseline.current = loaded;
    } else {
      setDraft(prefill ?? emptyDraft(date, settings.defaultEventColor, startTime));
      /*
        על אירוע חדש הבסיס הוא הטופס הריק - גם כשהגיעה טיוטה מוכנה
        מההוספה המהירה. מה שהוקלד שם הוא בדיוק המידע שאסור לאבד בשקט.
      */
      baseline.current = emptyDraft(date, settings.defaultEventColor, startTime);
    }
  }, [open, editing, date, startTime, prefill, settings.defaultEventColor]);

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

  /**
   * שער היציאה.
   *
   * `Sheet` קורא לו בכל ארבעת המוצאים - גרירה למטה, הקשה על הרקע, Esc
   * וכפתור החזרה - ולכן די בשער אחד. שמירה ומחיקה אינן עוברות כאן: הן
   * קוראות ל-`onClose` ישירות, ואין להן מה לאבד.
   */
  const beforeClose = useCallback((): boolean => {
    if (!baseline.current || !isDraftDirty(draft, baseline.current)) return true;
    setConfirmDiscard(true);
    return false;
  }, [draft]);


  return (
    <Sheet
      open={open}
      onClose={onClose}
      beforeClose={beforeClose}
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
          הכותרת היא השדה היחיד שחובה למלא, ולכן היא בולטת - אבל דרך
          הטיפוגרפיה ולא דרך צורה חריגה.

          קודם היא הייתה קו תחתון בלבד. הקו נראה כמו שובר בפריסה, וגרוע
          מזה: ל-`field-reset` יש טבעת מיקוד מלבנית משלה, ולשדה בלי
          קופסה היא צפה סביב הטקסט כמלבן חד באמצע מסך מעוגל. עכשיו יש
          קופסה אמיתית עם `focus-within`, כמו בכל שדה אחר, והגודל
          והמשקל הם שאומרים "כאן מתחילים".
        */}
        <div className="field-shell rounded-2xl bg-well px-4">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="שם האירוע"
            autoComplete="off"
            aria-label="כותרת האירוע"
            className="field-reset w-full bg-transparent py-3.5 text-title font-semibold text-ink placeholder:font-normal placeholder:text-faint"
          />
        </div>

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

        <EventFields draft={draft} patch={patch} />
      </div>

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

      <ConfirmDiscardSheet
        open={confirmDiscard}
        onKeepEditing={() => setConfirmDiscard(false)}
        onDiscard={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        hint={
          editing
            ? 'השינויים שעשיתם באירוע הזה עוד לא נשמרו'
            : 'האירוע הזה עוד לא נשמר'
        }
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
