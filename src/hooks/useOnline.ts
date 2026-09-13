/**
 * מצב החיבור לרשת.
 *
 * האפליקציה עובדת מקומית ולכן ניתוק אינו שובר כלום - אבל בלי חיווי,
 * משתמש שיצר אירוע במטוס לא יודע אם הוא נשמר. השורה שמופיעה אומרת
 * בדיוק את זה: הכול נשמר, הסנכרון ימשיך כשתחזור רשת.
 */
import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}
