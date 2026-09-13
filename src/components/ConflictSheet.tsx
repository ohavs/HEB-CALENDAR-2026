/**
 * התנגשויות סנכרון.
 *
 * הסנכרון הוא last-write-wins לפי חותמת זמן, וזה בסדר - חוץ ממקרה אחד:
 * שני מכשירים ששינו את אותו אירוע במצב לא־מקוון. אחד מהם מפסיד, וקודם
 * הוא הפסיד בשקט. כאן הגרסה שנדחתה מוצגת לצד זו שניצחה, והמשתמש בוחר.
 *
 * ההשוואה מראה רק את מה שבאמת שונה בין שתי הגרסאות. שורה זהה בשתיהן
 * היא רעש שמסתיר את ההבדל האמיתי.
 */
import { motion } from 'framer-motion';
import { Check, CloudOff } from 'lucide-react';
import type { UserEvent } from '@/types';
import { useEventsStore, type SyncConflict } from '@/store/events';
import { REPEAT_LABELS } from '@/lib/recurrence';
import { dayTitleLabel, keyToDate } from '@/lib/dates';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE, TAP_SCALE } from '@/lib/motion';

/** השדות שמוצגים בהשוואה, בסדר שבו משתמש קורא אירוע. */
const FIELDS: { key: keyof UserEvent; label: string; render: (ev: UserEvent) => string }[] = [
  { key: 'title', label: 'כותרת', render: (e) => e.title },
  { key: 'date', label: 'תאריך', render: (e) => dayTitleLabel(keyToDate(e.date)) },
  {
    key: 'startTime',
    label: 'שעה',
    render: (e) =>
      e.allDay ? 'כל היום' : [e.startTime, e.endTime].filter(Boolean).join(' – ') || '—',
  },
  { key: 'location', label: 'מקום', render: (e) => e.location || '—' },
  { key: 'notes', label: 'הערות', render: (e) => e.notes || '—' },
  { key: 'repeat', label: 'חזרה', render: (e) => REPEAT_LABELS[e.repeat] },
];

function relativeTime(at: number): string {
  const mins = Math.round((Date.now() - at) / 60_000);
  if (mins < 1) return 'הרגע';
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? 'לפני שעה' : `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'אתמול' : `לפני ${days} ימים`;
}

function ConflictRow({ conflict }: { conflict: SyncConflict }) {
  const keepLocal = useEventsStore((s) => s.keepLocalVersion);
  const dismiss = useEventsStore((s) => s.dismissConflict);

  // רק השדות שבאמת נבדלים; שורה זהה בשתי הגרסאות היא רעש
  const differing = FIELDS.filter(
    (f) => f.render(conflict.local) !== f.render(conflict.remote),
  );

  return (
    <article className="overflow-hidden rounded-2xl bg-well">
      <header className="px-4 pb-3 pt-4">
        <h3 className="text-body font-semibold text-ink">
          {conflict.remote.title || conflict.local.title}
        </h3>
        <p className="mt-1 text-caption text-muted">
          שונה בשני מקומות · זוהה {relativeTime(conflict.detectedAt)}
        </p>
      </header>

      <dl className="border-t border-hairline px-4 py-3">
        {differing.map((f) => (
          <div key={String(f.key)} className="flex flex-wrap gap-x-3 gap-y-1 py-2">
            <dt className="w-20 shrink-0 text-caption text-faint">{f.label}</dt>
            <dd className="m-0 min-w-0 flex-1 text-caption">
              <span className="block text-ink">
                <span className="text-faint">כאן: </span>
                {f.render(conflict.local)}
              </span>
              <span className="mt-0.5 block text-ink">
                <span className="text-faint">במכשיר האחר: </span>
                {f.render(conflict.remote)}
              </span>
            </dd>
          </div>
        ))}
        {differing.length === 0 && (
          <p className="py-2 text-caption text-muted">
            שתי הגרסאות זהות בתוכן. אפשר פשוט לסגור.
          </p>
        )}
      </dl>

      <div className="flex gap-2 border-t border-hairline p-3">
        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={() => keepLocal(conflict.id)}
          className="focus-ring flex-1 rounded-xl bg-brand-soft py-3 text-caption font-semibold text-brand-ink"
        >
          להחזיר את הגרסה שלי
        </motion.button>
        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={() => dismiss(conflict.id)}
          className="focus-ring flex-1 rounded-xl bg-surface py-3 text-caption font-semibold text-muted"
        >
          להשאיר את החדשה
        </motion.button>
      </div>
    </article>
  );
}

export function ConflictSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const conflicts = useEventsStore((s) => s.conflicts);
  const clear = useEventsStore((s) => s.clearConflicts);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="tall"
      title="שינויים שהתנגשו"
      subtitle={
        conflicts.length === 1 ? 'אירוע אחד' : `${conflicts.length} אירועים`
      }
      headerAction={
        conflicts.length > 1 ? (
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => {
              clear();
              onClose();
            }}
            className="focus-ring flex h-11 items-center rounded-2xl bg-well px-4 text-caption font-semibold text-muted"
          >
            לסגור הכול
          </motion.button>
        ) : undefined
      }
    >
      <div className="space-y-3 pb-2">
        {conflicts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-well px-4 py-12 text-center">
            <Check size={ICON.xl} strokeWidth={STROKE} className="text-muted" />
            <p className="text-body text-muted">הכול מסונכרן</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-brand-soft px-4 py-3.5">
              <CloudOff
                size={ICON.md}
                strokeWidth={STROKE}
                className="mt-0.5 shrink-0 text-brand-ink"
              />
              <p className="text-caption leading-relaxed text-brand-ink">
                האירועים האלה שונו גם כאן וגם במכשיר אחר. השארנו את הגרסה
                החדשה יותר, אבל שלכם עדיין שמורה.
              </p>
            </div>
            {conflicts.map((c) => (
              <ConflictRow key={c.id} conflict={c} />
            ))}
          </>
        )}
      </div>
    </Sheet>
  );
}
