/**
 * המסך הראשון: איפה הנתונים שלך חיים.
 *
 * עד עכשיו ההתחברות הייתה שורה בהגדרות, ומי שלא נכנס לשם החזיק את כל
 * הלוח שלו במקום אחד בלבד - אחסון ה-WebView. אנדרואיד מתייחס אליו
 * כמטמון: "ניקוי מטמון" בהגדרות האפליקציה, או לחץ אחסון במכשיר, מוחקים
 * אותו בלי אזהרה ובלי דרך לשחזר.
 *
 * לכן השאלה נשאלת מראש ובמפורש, פעם אחת. אפשר לדחות אותה - זו לא חומה -
 * אבל לא לפספס אותה בלי לדעת.
 */
import { Cloud, RefreshCw, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Sheet } from './ui/Sheet';
import { ICON, STROKE, TAP } from '@/lib/motion';

const DISMISSED_KEY = 'heb-cal:welcome-seen';

/** האם כבר הראינו את המסך הזה. */
export function welcomeSeen(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return true; // מצב פרטי - לא מציקים
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    /* מצב פרטי */
  }
}

const POINTS = [
  {
    Icon: Cloud,
    title: 'הלוח נשמר בחשבון שלך',
    body: 'האירועים, התזכורות וההגדרות נשמרים בחשבון הגוגל שלך - לא רק במכשיר הזה.',
  },
  {
    Icon: RefreshCw,
    title: 'אותו לוח בכל מכשיר',
    body: 'מה שתוסיפו כאן יופיע גם בטלפון אחר ובדפדפן, ולהפך.',
  },
  {
    Icon: ShieldCheck,
    title: 'ושורד הסרה של האפליקציה',
    body: 'בלי חשבון, הנתונים חיים רק כאן - ואנדרואיד רשאי למחוק אותם כשהוא צריך מקום.',
  },
];

export function WelcomeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { busy, error, signInWithGoogle } = useAuthStore();

  if (!isFirebaseConfigured) return null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="tall"
      showCloseButton={false}
      title="ברוכים הבאים"
      subtitle="לפני שמתחילים, דבר אחד"
      footer={
        <div className="space-y-2">
          <motion.button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={busy}
            whileTap={{ scale: 0.98 }}
            transition={TAP}
            className="focus-ring flex w-full items-center justify-center gap-3 rounded-2xl bg-brand py-4 text-label font-semibold text-white shadow-raised disabled:opacity-60"
          >
            <GoogleMark />
            {busy ? 'מתחבר…' : 'התחברות עם גוגל'}
          </motion.button>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring w-full rounded-2xl py-3 text-label font-medium text-muted"
          >
            להמשיך בלי חשבון
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        {POINTS.map(({ Icon, title, body }) => (
          <div key={title} className="flex items-start gap-3.5 rounded-2xl bg-well px-4 py-4">
            <span className="mt-0.5 shrink-0 text-brand-ink">
              <Icon size={ICON.lg} strokeWidth={STROKE} />
            </span>
            <span className="min-w-0">
              <span className="block text-body font-semibold text-ink">{title}</span>
              <span className="mt-1 block text-caption leading-relaxed text-muted">{body}</span>
            </span>
          </div>
        ))}

        {error && (
          <p className="break-words rounded-xl bg-[rgb(253_231_236)] px-3 py-2 text-caption leading-relaxed text-[rgb(194_60_90)]">
            {error}
          </p>
        )}

        <p className="px-1 pt-1 text-caption leading-relaxed text-muted">
          אפשר להתחבר גם אחר כך, מההגדרות. מה שנוצר עד אז יעלה לחשבון ברגע
          שתתחברו.
        </p>
      </div>
    </Sheet>
  );
}

/** סמל גוגל - וקטור, כדי לא לטעון תמונה חיצונית. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFFFFF"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5zM46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65zM10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.83.92 7.45 2.56 10.78l7.97-6.19zM24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
