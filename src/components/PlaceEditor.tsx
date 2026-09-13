/**
 * הוספה ועריכה של מקום שמור, עם רדיוס זיהוי והתראות הגעה ויציאה.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, MapPin, Trash2 } from 'lucide-react';
import type { SavedPlace } from '@/types';
import { radiusLabel, readCurrentPosition } from '@/lib/geofence';
import { Sheet } from './ui/Sheet';
import { PrimaryButton, Toggle } from './ui/controls';
import { NumberField, TextField } from './ui/fields';
import { ICON, STROKE } from '@/lib/motion';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type Draft = Omit<SavedPlace, 'id' | 'createdAt'>;

const EMPTY: Draft = {
  name: '',
  latitude: 0,
  longitude: 0,
  radius: 150,
  notifyOnArrive: true,
  notifyOnLeave: false,
  message: '',
};

export function PlaceEditor({
  open,
  onClose,
  editing,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  /** מקום קיים לעריכה, או null להוספה */
  editing: SavedPlace | null;
  onSave: (place: SavedPlace) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmDelete(false);
    setDraft(
      editing
        ? {
            name: editing.name,
            latitude: editing.latitude,
            longitude: editing.longitude,
            radius: editing.radius,
            notifyOnArrive: editing.notifyOnArrive,
            notifyOnLeave: editing.notifyOnLeave,
            message: editing.message ?? '',
          }
        : EMPTY,
    );
  }, [open, editing]);

  const patch = (values: Partial<Draft>) => setDraft((d) => ({ ...d, ...values }));

  const readMyLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const coords = await readCurrentPosition();
      patch({
        latitude: Math.round(coords.latitude * 1e6) / 1e6,
        longitude: Math.round(coords.longitude * 1e6) / 1e6,
      });
    } catch {
      setError('לא הצלחנו לקרוא את המיקום. ודאו שאישרתם גישה למיקום.');
    } finally {
      setLocating(false);
    }
  };

  const hasCoords = draft.latitude !== 0 || draft.longitude !== 0;
  const canSave = draft.name.trim().length > 0 && hasCoords;

  const save = () => {
    if (!canSave) return;
    onSave({
      id: editing?.id ?? newId(),
      createdAt: editing?.createdAt ?? Date.now(),
      ...draft,
      name: draft.name.trim(),
      message: draft.message?.trim() || undefined,
    });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="tall"
      title={editing ? 'עריכת מקום' : 'מקום חדש'}
      subtitle="קבלו התראה כשאתם מגיעים או יוצאים"
      headerAction={
        editing ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              onDelete(editing.id);
              onClose();
            }}
            className={`flex h-11 items-center gap-2 rounded-2xl px-4 text-caption font-semibold transition-colors ${
              confirmDelete ? 'bg-[rgb(240_118_149)] text-white' : 'bg-well text-[rgb(194_60_90)]'
            }`}
          >
            <Trash2 size={ICON.md} strokeWidth={STROKE} />
            {confirmDelete ? 'למחוק?' : 'מחיקה'}
          </motion.button>
        ) : undefined
      }
      footer={
        <PrimaryButton onClick={save} disabled={!canSave}>
          {editing ? 'שמירת שינויים' : 'שמירת המקום'}
        </PrimaryButton>
      }
    >
      <div className="space-y-3 pb-2">
        <TextField
          label="שם המקום"
          value={draft.name}
          onChange={(name) => patch({ name })}
          placeholder="לדוגמה: בית"
          icon={<MapPin size={ICON.sm} strokeWidth={STROKE} />}
          size="lg"
        />

        {/* נקודת הציון */}
        <div className="rounded-2xl bg-well px-4 py-4">
          <span className="block text-caption font-medium text-muted">נקודת הציון</span>
          <span className="mt-1.5 block text-body font-semibold text-ink">
            {hasCoords
              ? `${draft.latitude.toFixed(5)}, ${draft.longitude.toFixed(5)}`
              : 'עדיין לא נקבעה'}
          </span>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => void readMyLocation()}
            disabled={locating}
            className="mt-3.5 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand-soft py-3.5 text-label font-semibold text-brand-ink disabled:opacity-60"
          >
            <Crosshair size={ICON.md} strokeWidth={STROKE} />
            {locating ? 'מאתר…' : hasCoords ? 'עדכון למיקום הנוכחי' : 'קביעה לפי המיקום שלי'}
          </motion.button>
          {error && <p className="mt-2.5 text-caption text-[rgb(194_60_90)]">{error}</p>}
        </div>

        <NumberField
          label="רדיוס הזיהוי"
          value={draft.radius}
          onChange={(radius) => patch({ radius })}
          min={50}
          max={2000}
          step={50}
          suffix="מ׳"
          hint={`התראה תישלח כשתהיו בטווח ${radiusLabel(draft.radius)} מהנקודה`}
        />

        <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-body font-medium text-ink">התראה בהגעה</span>
            <Toggle
              label="התראה בהגעה"
              checked={draft.notifyOnArrive}
              onChange={(notifyOnArrive) => patch({ notifyOnArrive })}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-body font-medium text-ink">התראה ביציאה</span>
            <Toggle
              label="התראה ביציאה"
              checked={draft.notifyOnLeave}
              onChange={(notifyOnLeave) => patch({ notifyOnLeave })}
            />
          </div>
        </div>

        <TextField
          label="טקסט ההתראה"
          value={draft.message ?? ''}
          onChange={(message) => patch({ message })}
          placeholder="ברירת מחדל"
        />
      </div>
    </Sheet>
  );
}
