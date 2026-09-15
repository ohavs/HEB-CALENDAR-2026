/**
 * תמונת הפרופיל, עם שלד טעינה.
 *
 * התמונה מגיעה משרתי גוגל, ולכן יש רגע - לפעמים שנייה שלמה ברשת איטית -
 * שבו יש מסגרת ריקה. אפור סטטי באותו רגע נראה כמו תקלה; שלד שמהבהב
 * אומר "התמונה בדרך".
 *
 * המפתח כאן הוא ש**השלד והתמונה חולקים את אותה מסגרת בדיוק**: הוא אינו
 * אלמנט שנעלם ומפנה מקום, אלא רובד שמתחת. לכן המעבר לתמונה האמיתית אינו
 * מזיז דבר על המסך.
 *
 * `onError` מטופל כמו `onLoad`: תמונה שנכשלה תיתקע אחרת בשלד לנצח, וזה
 * גרוע מלראות את ראשי התיבות.
 */
import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { ICON, STROKE } from '@/lib/motion';

export function Avatar({
  photoURL,
  name,
  size = 'md',
}: {
  photoURL: string | null;
  /** ממנו נגזרת האות כשאין תמונה */
  name?: string | null;
  size?: 'md' | 'lg';
}) {
  const [settled, setSettled] = useState(false);

  // כתובת חדשה מתחילה טעינה חדשה, ולכן השלד חוזר
  useEffect(() => setSettled(false), [photoURL]);

  if (!photoURL) {
    const initial = (name ?? '').trim().slice(0, 1);
    return (
      <span className="flex h-full w-full items-center justify-center text-muted">
        {initial ? (
          <span className={size === 'lg' ? 'text-title font-semibold' : 'text-label font-semibold'}>
            {initial}
          </span>
        ) : (
          <User size={size === 'lg' ? ICON.xl : ICON.lg} strokeWidth={STROKE} />
        )}
      </span>
    );
  }

  return (
    <span className="relative block h-full w-full">
      {!settled && <span className="skeleton absolute inset-0 block" aria-hidden />}
      <img
        src={photoURL}
        alt=""
        onLoad={() => setSettled(true)}
        onError={() => setSettled(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          settled ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </span>
  );
}
