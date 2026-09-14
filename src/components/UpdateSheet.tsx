/**
 * הודעה על גרסה חדשה של אפליקציית האנדרואיד.
 *
 * ההורדה היא קישור רגיל ולא פעולה בקוד: הדפדפן של המערכת יודע להוריד
 * APK ולהגיש אותו להתקנה, ואילו ניסיון להוריד בתוך ה-WebView היה נתקע
 * בלי שום חיווי למשתמש.
 */
import { Download, Sparkles } from 'lucide-react';
import type { UpdateInfo } from '@/lib/appUpdate';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE } from '@/lib/motion';

export function UpdateSheet({
  update,
  onClose,
}: {
  update: UpdateInfo | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={Boolean(update)}
      onClose={onClose}
      title="יש גרסה חדשה"
      subtitle={update ? `גרסה ${update.versionName} · מותקנת ${update.currentVersionName}` : undefined}
      footer={
        update ? (
          <div className="space-y-2">
            <a
              href={update.apk}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className="focus-ring flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand py-4 text-label font-semibold text-white shadow-raised"
            >
              <Download size={ICON.md} strokeWidth={STROKE} />
              הורדה והתקנה
            </a>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring w-full rounded-2xl py-3 text-label font-medium text-muted"
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
          הקובץ יירד בדפדפן, ואנדרואיד יבקש אישור להתקנה. האירועים וההגדרות
          נשמרים - ההתקנה מעדכנת את האפליקציה במקום.
        </p>
      </div>
    </Sheet>
  );
}
