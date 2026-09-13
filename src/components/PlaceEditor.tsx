/**
 * הוספה ועריכה של מקום שמור, עם רדיוס זיהוי והתראות הגעה ויציאה.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  ClipboardPaste,
  Crosshair,
  ExternalLink,
  MapPin,
  Search,
  Trash2,
} from 'lucide-react';
import type { SavedPlace } from '@/types';
import { radiusLabel, readCurrentPosition } from '@/lib/geofence';
import { formatCoordinates, isShortLink, parseCoordinates } from '@/lib/coordinates';
import { mapsUrl } from '@/lib/eventLocations';
import { CITIES } from '@/lib/locations';
import { bestScore } from '@/lib/search';
import { Sheet } from './ui/Sheet';
import { PrimaryButton, Toggle } from './ui/controls';
import { NumberField, TextField } from './ui/fields';
import { ICON, STROKE } from '@/lib/motion';

/**
 * בחירת עיר כנקודת פתיחה.
 *
 * זו לא נקודה מדויקת - היא מרכז העיר - אבל היא חוסכת את החיפוש הידני
 * של הקואורדינטות כשהרדיוס גדול ממילא, והיא נקודת התחלה טובה לכוונון.
 */
function CityStartSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (city: { name: string; latitude: number; longitude: number }) => void;
}) {
  const [query, setQuery] = useState('');
  const term = query.trim();
  const list = term
    ? CITIES.map((c) => ({ c, score: bestScore([c.name, c.region], term) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 40)
        .map((x) => x.c)
    : CITIES.slice(0, 40);

  return (
    <Sheet open={open} onClose={onClose} size="tall" title="בחירת עיר">
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-well px-4 py-3.5">
        <Search size={ICON.lg} strokeWidth={STROKE} className="shrink-0 text-faint" />
        <input
          id="place-city-query"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="שם עיר"
          autoFocus
          className="field-reset bg-transparent p-0 text-body text-ink placeholder:text-faint"
        />
      </div>

      <p className="mb-3 px-1 text-caption leading-relaxed text-muted">
        העיר נותנת נקודת פתיחה במרכזה. אפשר לדייק אותה אחר כך בהדבקת נקודה
        ממפות.
      </p>

      <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-well">
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              onPick(c);
              onClose();
            }}
            className="focus-ring-inset flex w-full items-center gap-3.5 px-4 py-4 text-right"
          >
            <Building2 size={ICON.md} strokeWidth={STROKE} className="shrink-0 text-faint" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-medium text-ink">{c.name}</span>
              <span className="mt-0.5 block truncate text-caption text-muted">{c.region}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

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
  const [paste, setPaste] = useState('');
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [cityOpen, setCityOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmDelete(false);
    setPaste('');
    setPasteNote(null);
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

  /**
   * מפענח כל הדבקה מיד. אין כפתור "החל": אם הטקסט מכיל נקודת ציון,
   * אין שום סיבה לבקש אישור נוסף.
   */
  const onPaste = (text: string) => {
    setPaste(text);
    setError(null);
    if (!text.trim()) {
      setPasteNote(null);
      return;
    }
    const coords = parseCoordinates(text);
    if (coords) {
      patch(coords);
      setPasteNote(`נקבעה הנקודה ${formatCoordinates(coords)}`);
      return;
    }
    setPasteNote(
      isShortLink(text)
        ? 'זה קישור מקוצר. פתחו אותו במפות והעתיקו משם את הקישור המלא או את נקודת הציון.'
        : 'לא זוהתה נקודת ציון בטקסט הזה.',
    );
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
          <span className="flex items-center justify-between gap-3">
            <span className="text-caption font-medium text-muted">נקודת הציון</span>
            {hasCoords && (
              <a
                href={mapsUrl(draft.latitude, draft.longitude, draft.name || undefined)}
                target="_blank"
                rel="noreferrer"
                className="focus-ring flex shrink-0 items-center gap-1.5 rounded-lg text-caption font-medium text-brand-ink"
              >
                <ExternalLink size={ICON.xs} strokeWidth={STROKE} />
                פתיחה במפות
              </a>
            )}
          </span>
          <span className="tnum mt-1.5 block text-body font-semibold text-ink">
            {hasCoords ? formatCoordinates(draft) : 'עדיין לא נקבעה'}
          </span>

          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => void readMyLocation()}
            disabled={locating}
            className="focus-ring mt-3.5 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand-soft py-3.5 text-label font-semibold text-brand-ink disabled:opacity-60"
          >
            <Crosshair size={ICON.md} strokeWidth={STROKE} />
            {locating ? 'מאתר…' : hasCoords ? 'עדכון למיקום הנוכחי' : 'קביעה לפי המיקום שלי'}
          </motion.button>

          {/*
            המסלול להגדיר מקום בלי לעמוד בו: פותחים מפות, לוחצים לחיצה
            ארוכה על הנקודה, ומעתיקים. כל מה שיוצא משם מתפענח כאן.
          */}
          <div className="mt-3.5 flex items-center gap-2.5 rounded-2xl bg-surface px-3.5 py-3">
            <ClipboardPaste size={ICON.sm} strokeWidth={STROKE} className="shrink-0 text-faint" />
            <input
              id="place-paste"
              type="text"
              value={paste}
              onChange={(e) => onPaste(e.target.value)}
              placeholder="הדבקת קישור ממפות, או 31.7683, 35.2137"
              inputMode="text"
              className="field-reset bg-transparent p-0 text-caption text-ink placeholder:text-faint"
            />
          </div>

          <button
            type="button"
            onClick={() => setCityOpen(true)}
            className="focus-ring mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-caption font-medium text-muted"
          >
            <Building2 size={ICON.xs} strokeWidth={STROKE} />
            או בחירת עיר כנקודת פתיחה
          </button>

          {error && <p className="mt-2.5 text-caption text-[rgb(194_60_90)]">{error}</p>}
          {pasteNote && <p className="mt-2.5 text-caption text-brand-ink">{pasteNote}</p>}
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

      <CityStartSheet
        open={cityOpen}
        onClose={() => setCityOpen(false)}
        onPick={(city) => {
          patch({ latitude: city.latitude, longitude: city.longitude });
          setPasteNote(`נקבעה נקודת פתיחה במרכז ${city.name}`);
          // רדיוס עירוני, כי מרכז עיר אינו נקודה מדויקת
          if (draft.radius < 500) patch({ radius: 1000 });
        }}
      />
    </Sheet>
  );
}
