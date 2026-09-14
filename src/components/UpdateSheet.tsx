/**
 * הודעה על גרסה חדשה, ועדכון בלחיצה אחת.
 *
 * שני המסלולים נראים כאן אותו דבר למשתמש: לוחצים "עדכון", רואים
 * התקדמות, ונגמר. מה שמשתנה מתחת הוא מה מוחלף - חבילת ה-web לבדה, או
 * החבילה המותקנת כולה.
 *
 * בהתקנת APK יש שני אישורים שאנדרואיד מחייב ואי אפשר לעקוף: הרשאה
 * חד-פעמית "התקנת אפליקציות לא מוכרות", ואחריה חלון ההתקנה עצמו. שניהם
 * מכוונים בדיוק למקרה הזה - אפליקציה שמתקינה קוד.
 */
import { useState } from 'react';
import { Check, Download, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import type { UpdateInfo } from '@/lib/appUpdate';
import {
  applyWebUpdate,
  canInstallUpdates,
  installNativeUpdate,
  openInstallSettings,
} from '@/lib/appUpdate';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE } from '@/lib/motion';

type Stage = 'idle' | 'working' | 'permission' | 'installing';

export function UpdateSheet({
  update,
  onClose,
}: {
  update: UpdateInfo | null;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const busy = stage === 'working' || stage === 'installing';
  const live = update?.kind === 'web';

  const run = async () => {
    if (!update) return;
    setError(null);
    setPercent(0);
    setStage('working');

    if (live) {
      // בהצלחה האפליקציה נטענת מחדש, ולכן אין כאן המשך
      const failure = await applyWebUpdate(update);
      setStage('idle');
      if (failure) setError(failure);
      return;
    }

    const blocked = await installNativeUpdate(update, setPercent);
    if (blocked === 'permission') {
      setStage('permission');
      return;
    }
    if (blocked === 'failed') {
      setStage('idle');
      setError('ההורדה נכשלה. נסו שוב, או הורידו ידנית מדף השחרורים.');
      return;
    }
    // חלון ההתקנה נפתח. מכאן זה כבר בידי המערכת.
    setStage('installing');
  };

  /** אחרי שהמשתמש חוזר ממסך ההרשאה, מנסים שוב באותה לחיצה. */
  const retryAfterPermission = async () => {
    if (await canInstallUpdates()) await run();
    else await openInstallSettings();
  };

  const label = () => {
    if (stage === 'installing') return 'ממתין לאישור ההתקנה…';
    if (stage === 'working') {
      if (live) return 'מעדכן…';
      return percent > 0 ? `מוריד… ${percent}%` : 'מתחיל…';
    }
    return 'עדכון עכשיו';
  };

  return (
    <Sheet
      open={Boolean(update)}
      onClose={busy ? () => undefined : onClose}
      title={stage === 'permission' ? 'צריך אישור חד-פעמי' : 'יש גרסה חדשה'}
      subtitle={
        update ? `גרסה ${update.versionName} · מותקנת ${update.currentVersionName}` : undefined
      }
      footer={
        update ? (
          <div className="space-y-2">
            {stage === 'permission' ? (
              <button
                type="button"
                onClick={() => void retryAfterPermission()}
                className="focus-ring flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand py-4 text-label font-semibold text-white shadow-raised"
              >
                <ShieldCheck size={ICON.md} strokeWidth={STROKE} />
                פתיחת ההגדרה
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy}
                className="focus-ring flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand py-4 text-label font-semibold text-white shadow-raised disabled:opacity-70"
              >
                {stage === 'installing' ? (
                  <Check size={ICON.md} strokeWidth={STROKE} />
                ) : live ? (
                  <RefreshCw
                    size={ICON.md}
                    strokeWidth={STROKE}
                    className={busy ? 'animate-spin' : ''}
                  />
                ) : (
                  <Download size={ICON.md} strokeWidth={STROKE} />
                )}
                {label()}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={stage === 'working'}
              className="focus-ring w-full rounded-2xl py-3 text-label font-medium text-muted disabled:opacity-50"
            >
              {stage === 'installing' ? 'סגירה' : 'לא עכשיו'}
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="pb-2">
        {stage === 'permission' ? (
          <p className="rounded-2xl bg-well px-4 py-4 text-body leading-relaxed text-ink">
            אנדרואיד מבקש אישור חד-פעמי לפני שאפליקציה מתקינה עדכון של עצמה.
            הכפתור למטה פותח את המסך הזה - מפעילים שם את המתג, חוזרים, והעדכון
            ימשיך מעצמו. בפעמים הבאות לא תישאלו.
          </p>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-well px-4 py-4">
              <Sparkles
                size={ICON.md}
                strokeWidth={STROKE}
                className="mt-0.5 shrink-0 text-brand-ink"
              />
              <p className="text-body leading-relaxed text-ink">
                {update?.notes?.trim() || 'שיפורים ותיקונים.'}
              </p>
            </div>

            {stage === 'working' && !live && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-well">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-200"
                  style={{ width: `${Math.max(4, percent)}%` }}
                />
              </div>
            )}

            <p className="mt-3 px-1 text-caption leading-relaxed text-muted">
              {stage === 'installing'
                ? 'חלון ההתקנה נפתח. אשרו אותו, והאפליקציה תיסגר ותיפתח מעודכנת.'
                : live
                  ? 'העדכון מוחל בתוך האפליקציה, והיא תיטען מחדש. האירועים וההגדרות נשמרים.'
                  : 'בגרסה הזו השתנה גם החלק המותקן. ההורדה מתבצעת כאן, ואנדרואיד יבקש אישור אחד להתקנה. האירועים וההגדרות נשמרים.'}
            </p>
          </>
        )}

        {error && (
          <p className="mt-3 break-words rounded-xl bg-[rgb(253_231_236)] px-3 py-2 text-caption leading-relaxed text-[rgb(194_60_90)]">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
