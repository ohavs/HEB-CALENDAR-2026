/**
 * לשונית התבניות, בתוך מסך התזכורות.
 *
 * למה כאן ולא בהגדרות: תבנית אינה העדפה שקובעים פעם אחת ושוכחים - היא
 * כלי שמשתמשים בו. הגדרות הן המקום שבו מתארים דברים; זהו המקום שבו
 * *עושים* איתם משהו. מכאן גם שהיצירה והשיבוץ יושבים באותו מסך: מי שיוצר
 * "חופש מהעבודה" רוצה לשבץ אותו מיד, ולא לנדוד למסך אחר.
 *
 * השיבוץ עצמו הוא בורר של כמה ימים (`TemplatePlaceSheet`), ולא גרירה:
 * גרירה עובדת על יום אחד, וזו תבנית שנועדה לכמה. הגרירה עדיין קיימת
 * ברצועה שבחלונית היום, למי שכבר מסתכל על יום מסוים.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarPlus, Pencil, Plus } from 'lucide-react';
import type { DateKey, EventColor, EventTemplate } from '@/types';
import { useSettings, useSettingsStore } from '@/store/settings';
import { EVENT_COLORS } from '@/store/events';
import {
  MAX_TEMPLATES,
  addTemplate,
  emptyTemplate,
  isValidTemplate,
  removeTemplate,
  templateHint,
  updateTemplate,
} from '@/lib/templates';
import { TemplatePlaceSheet } from './TemplatePlaceSheet';
import { Sheet } from './ui/Sheet';
import { PrimaryButton } from './ui/controls';
import { ColorRow } from './ui/ColorRow';
import { TextField } from './ui/fields';
import { announce } from '@/lib/announce';
import { haptic } from '@/lib/native';
import { ENTER, EXIT, GLIDE, ICON, SNAP, STROKE, TAP } from '@/lib/motion';

export function TemplatesView({
  bottomInset,
  onPlace,
}: {
  bottomInset: number;
  onPlace: (template: EventTemplate, dates: DateKey[]) => void;
}) {
  const settings = useSettings();
  const patch = useSettingsStore((s) => s.patch);
  const templates = settings.templates;

  const [title, setTitle] = useState('');
  const [color, setColor] = useState<EventColor>(settings.defaultEventColor);
  const [editing, setEditing] = useState<EventTemplate | null>(null);
  const [placing, setPlacing] = useState<EventTemplate | null>(null);

  const full = templates.length >= MAX_TEMPLATES;
  const composing = title.trim().length > 0;

  const create = () => {
    const clean = title.trim();
    if (!clean || full) return;
    const next = addTemplate(templates, { ...emptyTemplate(color), title: clean });
    if (!next) return;
    patch({ templates: next });
    setTitle('');
    setColor(settings.defaultEventColor);
    void haptic('medium');
    announce(`התבנית "${clean}" נוצרה`);
  };

  const save = (template: EventTemplate) => {
    if (!isValidTemplate(template)) return;
    patch({ templates: updateTemplate(templates, template) });
    setEditing(null);
    void haptic('medium');
  };

  const destroy = (template: EventTemplate) => {
    patch({ templates: removeTemplate(templates, template.id) });
    setEditing(null);
    void haptic('medium');
    // האירועים ששובצו נשארים: הם כבר אירועים בפני עצמם
    announce(`התבנית "${template.title}" נמחקה. אירועים ששובצו נשארו`);
  };

  return (
    <div className="pb-4" style={{ paddingBottom: bottomInset + 16 }}>
      {/* ------------------------------ יצירה ------------------------------ */}
      <div className="rounded-3xl bg-surface p-2.5 shadow-raised">
        <div className="flex items-center gap-2 rounded-2xl bg-well ps-4 pe-1.5 transition-shadow focus-within:ring-2 focus-within:ring-brand/35">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder={full ? 'הגעתם לתקרת התבניות' : 'תבנית חדשה, למשל "חופש מהעבודה"'}
            disabled={full}
            className="field-reset min-w-0 flex-1 bg-transparent py-3.5 text-body text-ink placeholder:text-faint focus-visible:outline-none"
          />
          <AnimatePresence initial={false}>
            {composing && !full && (
              <motion.button
                type="button"
                onClick={create}
                initial={{ opacity: 0, scale: 0.6, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 36 }}
                exit={{ opacity: 0, scale: 0.6, width: 0 }}
                whileTap={{ scale: 0.9 }}
                transition={SNAP}
                aria-label="יצירת תבנית"
                className="focus-ring flex h-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white"
              >
                <Plus size={ICON.md} strokeWidth={2.6} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/*
          הצבע נבחר כבר כאן. הוא מה שיופיע על הלוח בכל שיבוץ של התבנית,
          ולכן הוא חלק מהגדרתה - לא תיקון שעושים אחר כך.
        */}
        <motion.div
          initial={false}
          animate={{ height: composing ? 'auto' : 0, opacity: composing ? 1 : 0 }}
          transition={{ height: GLIDE, opacity: composing ? ENTER : EXIT }}
          className="overflow-hidden"
          aria-hidden={!composing}
        >
          <div className="px-0.5 pt-2">
            <ColorRow value={color} onChange={setColor} label="צבע התבנית" />
          </div>
        </motion.div>
      </div>

      {/* ------------------------------ הרשימה ------------------------------ */}
      {templates.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-hairline px-5 py-8 text-center text-body leading-relaxed text-muted">
          תבנית היא אירוע שמור בלי תאריך. מגדירים פעם אחת - "חופש מהעבודה",
          "מילואים", "יום כביסה" - ואז משבצים אותה לימים שרוצים, שוב ושוב.
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {templates.map((template) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ENTER}
              className={`ev ev-${template.color} flex items-center gap-2 rounded-2xl p-3`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold leading-snug">
                  {template.title}
                </span>
                <span className="mt-0.5 block text-caption opacity-70">
                  {templateHint(template)}
                </span>
              </span>

              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                transition={TAP}
                onClick={() => setEditing(template)}
                aria-label={`עריכת ${template.title}`}
                className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl opacity-70"
              >
                <Pencil size={ICON.sm} strokeWidth={STROKE} />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                transition={TAP}
                onClick={() => {
                  void haptic('light');
                  setPlacing(template);
                }}
                className="focus-ring ev-solid flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-caption font-semibold text-white"
              >
                <CalendarPlus size={ICON.sm} strokeWidth={STROKE} />
                שיבוץ
              </motion.button>
            </motion.div>
          ))}
        </div>
      )}

      <TemplatePlaceSheet
        open={placing !== null}
        onClose={() => setPlacing(null)}
        template={placing}
        onPlace={onPlace}
      />

      <TemplateEditSheet
        template={editing}
        onClose={() => setEditing(null)}
        onSave={save}
        onDelete={destroy}
      />
    </div>
  );
}

/* ==========================================================================
   עריכה
   ========================================================================== */

function TemplateEditSheet({
  template,
  onClose,
  onSave,
  onDelete,
}: {
  template: EventTemplate | null;
  onClose: () => void;
  onSave: (t: EventTemplate) => void;
  onDelete: (t: EventTemplate) => void;
}) {
  const [draft, setDraft] = useState<EventTemplate | null>(template);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // הטופס מתאתחל בכל פתיחה, כדי שעריכה שנזנחה לא תדלוף לתבנית הבאה
  if (template && draft?.id !== template.id) {
    setDraft(template);
    setConfirmDelete(false);
  }

  if (!draft) return null;

  return (
    <Sheet open={template !== null} onClose={onClose} size="tall" title="עריכת תבנית">
      <div className="pb-2">
        <TextField
          label="שם"
          value={draft.title}
          onChange={(title) => setDraft({ ...draft, title })}
          placeholder="חופש מהעבודה"
        />

        <p className="mb-2 mt-5 text-caption font-semibold text-muted">צבע</p>
        <div className="flex flex-wrap gap-2">
          {EVENT_COLORS.map((c) => (
            <motion.button
              key={c.id}
              type="button"
              whileTap={{ scale: 0.9 }}
              transition={TAP}
              onClick={() => {
                void haptic('light');
                setDraft({ ...draft, color: c.id as EventColor });
              }}
              aria-label={c.label}
              aria-pressed={draft.color === c.id}
              className={`ev ev-${c.id} h-11 w-11 rounded-full ${
                draft.color === c.id ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface' : ''
              }`}
            >
              <span className="ev-solid mx-auto block h-3 w-3 rounded-full" />
            </motion.button>
          ))}
        </div>

        <div className="mt-6">
          <PrimaryButton onClick={() => onSave(draft)} disabled={!isValidTemplate(draft)}>
            שמירה
          </PrimaryButton>
        </div>

        <div className="mt-3">
          <PrimaryButton
            tone="danger"
            onClick={() => {
              void haptic('medium');
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              onDelete(draft);
            }}
          >
            {confirmDelete ? 'למחוק את התבנית?' : 'מחיקת התבנית'}
          </PrimaryButton>
          {confirmDelete && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={EXIT}
              className="mt-2 text-center text-caption text-muted"
            >
              אירועים ששובצו ממנה יישארו על הלוח
            </motion.p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
