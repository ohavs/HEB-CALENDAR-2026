import { useEffect, useState } from 'react';

/**
 * גובה סרגל המערכת התחתון, בפיקסלים.
 *
 * הסרגל הצף ממוקם מעליו, והמסכים מתחתיו צריכים לדעת כמה מקום לשמור -
 * כמספר, כי הם מחברים אותו לגבהים אחרים (שורת ההצצה של חלונית היום).
 * `env()` אינו קריא מ-JS, ו-`--inset-bottom` מוזרק מ-MainActivity רק
 * אחרי העלייה ומשתנה בסיבוב. לכן מודדים אלמנט שקוף עם `.safe-b` -
 * אותו כלל בדיוק של ה-CSS, בלי עותק שני שלו.
 */
export function useSafeBottom(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const probe = document.createElement('div');
    probe.className = 'safe-b';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);

    const measure = () => setInset(Math.round(probe.offsetHeight));
    measure();

    // ההזרקה של MainActivity משנה style על html, וזה לא מפעיל resize
    const mutations = new MutationObserver(measure);
    mutations.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', measure);
    return () => {
      mutations.disconnect();
      window.removeEventListener('resize', measure);
      probe.remove();
    };
  }, []);

  return inset;
}
