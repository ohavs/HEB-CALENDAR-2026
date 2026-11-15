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
 * שלוש סיבות שהתמונה "לפעמים לא עלתה", וכל אחת מטופלת כאן:
 *
 * 1. **`referrerPolicy="no-referrer"`.** שרתי התמונות של גוגל דוחים בקשה
 *    שנושאת Referer ממקור שהם לא מכירים - וה-WebView שולח `localhost`.
 *    זה כשל שמופיע ונעלם לפי מטמון ולפי השרת שענה, ולכן נראה אקראי.
 * 2. **ניסיון חוזר אחד.** השרתים האלה מגבילים קצב, והתשובה לבקשה שנייה
 *    דקה אחרי הראשונה היא לעתים קרובות תמונה. גם חזרה לרשת מנסה שוב.
 * 3. **כישלון נגמר באות, לא בריק.** קודם `onError` רק הסיר את השלד,
 *    ומה שנשאר היה עיגול ריק - גרוע יותר מראשי התיבות.
 */
import { useEffect, useState } from 'react';
import { User } from './icons';
import { ICON } from '@/lib/motion';
import type { SharedList } from '@/lib/sharedLists';

/** אחרי כמה זמן ניסיון שני, אם הראשון נכשל */
const RETRY_MS = 1500;

type Load = 'loading' | 'ready' | 'failed';

export function Avatar({
  photoURL,
  name,
  size = 'md',
}: {
  photoURL: string | null;
  /** ממנו נגזרת האות כשאין תמונה */
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [load, setLoad] = useState<Load>('loading');
  /** מספר הניסיון. שינוי שלו מרכיב את התמונה מחדש, כלומר בקשה חדשה */
  const [attempt, setAttempt] = useState(0);

  // כתובת חדשה מתחילה טעינה חדשה, ולכן השלד חוזר והספירה מתאפסת
  useEffect(() => {
    setLoad('loading');
    setAttempt(0);
  }, [photoURL]);

  /*
    תמונה שנכשלה בלי רשת תעלה ברגע שהרשת חוזרת. בלי זה הכותרת הייתה
    נשארת עם האות עד הפעלה מחדש של האפליקציה.
  */
  useEffect(() => {
    if (load !== 'failed') return;
    const retry = () => {
      setLoad('loading');
      setAttempt((n) => n + 1);
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [load]);

  const onError = () => {
    if (attempt === 0) {
      setTimeout(() => setAttempt(1), RETRY_MS);
      return;
    }
    setLoad('failed');
  };

  if (!photoURL || load === 'failed') return <Initial name={name} size={size} />;

  return (
    <span className="relative block h-full w-full">
      {load === 'loading' && <span className="skeleton absolute inset-0 block" aria-hidden />}
      <img
        key={attempt}
        src={photoURL}
        alt=""
        referrerPolicy="no-referrer"
        decoding="async"
        onLoad={() => setLoad('ready')}
        onError={onError}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          load === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </span>
  );
}

/** האות הראשונה של השם, או צללית כשאין שם. */
function Initial({ name, size }: { name?: string | null; size: 'sm' | 'md' | 'lg' }) {
  const initial = (name ?? '').trim().slice(0, 1);
  const text = { sm: 'text-micro', md: 'text-label', lg: 'text-title' }[size];
  const icon = { sm: ICON.xs, md: ICON.lg, lg: ICON.xl }[size];
  return (
    <span className="flex h-full w-full items-center justify-center text-muted">
      {initial ? (
        <span className={`${text} font-semibold`}>{initial}</span>
      ) : (
        <User size={icon} />
      )}
    </span>
  );
}

/**
 * פני החברים ברשימה משותפת, בערימה.
 *
 * כל פנים חופפות את הקודמות ומוקפות בטבעת בגוון המשטח, כך שהערימה
 * נקראת כקבוצה ולא כשורה של עיגולים. מעבר לתקרה - מונה, כי שש פנים
 * בגודל כזה כבר אינן מזוהות.
 */
export function MemberStack({
  list,
  max = 4,
  ring = 'ring-surface',
}: {
  list: SharedList;
  max?: number;
  /** בגוון המשטח שמתחת - הטבעת היא מה שמפריד בין פנים חופפות */
  ring?: string;
}) {
  const shown = list.memberUids.slice(0, max);
  const rest = list.memberUids.length - shown.length;
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      {shown.map((uid, i) => {
        const member = list.members[uid];
        return (
          <span
            key={uid}
            className={`block h-6 w-6 overflow-hidden rounded-full bg-well ring-2 ${ring} ${
              i > 0 ? '-ms-2' : ''
            }`}
          >
            <Avatar
              photoURL={member?.photo ?? null}
              name={member?.name || member?.email}
              size="sm"
            />
          </span>
        );
      })}
      {rest > 0 && (
        <span className={`tnum -ms-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-well px-1 text-micro font-semibold text-ink ring-2 ${ring}`}>
          +{rest}
        </span>
      )}
    </span>
  );
}
