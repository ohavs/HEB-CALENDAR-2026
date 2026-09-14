/**
 * הודעה על גרסה חדשה.
 *
 * שני מסלולים, ושניהם נראים כאן אותו דבר למשתמש חוץ מהכיתוב: עדכון חי
 * מוחלף בתוך האפליקציה ונטען מחדש מיד, והתקנת APK עוברת לדפדפן של
 * המערכת - הוא זה שיודע להוריד APK ולהגיש אותו להתקנה, ואילו הורדה
 * בתוך ה-WebView הייתה נתקעת בלי שום חיווי.
 */
import { useState } from 'react';
import { Download, RefreshCw, Sparkles } from 'lucide-react';
import type { UpdateInfo } from '@/lib/appUpdate';
import { applyWebUpdate } from '@/lib/appUpdate';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE } from '@/lib/motion';

export function UpdateSheet({
  update,
  onClose,
}: {
  update: UpdateInfo | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    if (!update) return;
    setBusy(true);
    setError(null);
    // בהצלחה האפליקציה נטענת מחדש, ולכן אין כאן המשך
    const failure = await applyWebUpdate(update);
    setBusy(false);
    if (failure) setError(failure);
  };

  const live = update?.kind === 'web';

  return (
    <Sheet
      open={Boolean(update)}
      onClose={busy ? () => undefined : onClose}
      title="יש גרסה חדשה"
      subtitle={
        update ? `גרסה ${update.versionName} · מותקנת ${update.currentVersionName}` : undefined
      }
      footer={
        update ? (
          <div className="space-y-2">
            {live ? (
              <button
                type="button"
                onClick={() => void apply()}
                disabled={busy}
                className="focus-ring flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand py-4 text-label font-semibold text-white shadow-raised disabled:opacity-60"
              >
                <RefreshCw size={ICON.md} strokeWidth={STROKE} className={busy ? 'animate-spin' : ''} />
                {busy ? 'מעדכן…' : 'עדכון עכשיו'}
              </button>
            ) : (
              <a
                href={update.url}
                target="_blank"
                rel="noreferrer"
                onClick={onClose}
                className="focus-ring flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand py-4 text-label font-semibold text-white shadow-raised"
              >
                <Download size={ICON.md} strokeWidth={STROKE} />
                הורדה והתקנה
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="focus-ring w-full rounded-2xl py-3 text-label font-medium text-muted disabled:opacity-50"
            >
              לא עכשיו
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="pb-2">
        <div className="flex items-start gap-3 rounded-2xl bg-well px-4 py-4">
          <Sparkles size={ICON.md} strokeWidth={STROKE} className="mt-0.5 shrink-0 text-brand-ink" />
          <p className="text-body leading-relaxed text-ink">
            {update?.notes?.trim() || 'שיפורים ותיקונים.'}
          </p>
        </div>

        <p className="mt-3 px-1 text-caption leading-relaxed text-muted">
          {live
            ? 'העדכון מוחל בתוך האפליקציה, והיא תיטען מחדש. אין מה להתקין, והאירועים וההגדרות נשמרים.'
            : 'בגרסה הזו השתנה גם החלק המותקן, ולכן צריך להתקין אותה. הקובץ יירד בדפדפן, ואנדרואיד יבקש אישור. האירועים וההגדרות נשמרים.'}
        </p>

        {error && (
          <p className="mt-3 break-words rounded-xl bg-[rgb(253_231_236)] px-3 py-2 text-caption leading-relaxed text-[rgb(194_60_90)]">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
