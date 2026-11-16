import { useEffect, useState } from 'react';
import { setAnnouncer } from '@/lib/announce';

/**
 * אזור ה-live היחיד באפליקציה. פעולות שמשנות את המסך בלי להזיז את המיקוד
 * (הזזה בחיצים, מעבר חודש, החלפת לשונית) מדווחות דרכו.
 *
 * רכיב משלו ולא state ב-App: כל הכרזה הייתה מציירת מחדש את App כולו - ואת
 * המסך שמוצג בו - ובהחלפת לשונית זה קרה בתוך ההקשה, לפני הפריים הראשון.
 */
export function LiveRegion() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    setAnnouncer(setMessage);
    return () => setAnnouncer(null);
  }, []);
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}
