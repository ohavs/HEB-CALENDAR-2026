/**
 * תשובה ללחיצה, לכל האפליקציה, ממאזין אחד.
 *
 * כל מה שנושא `data-press` מתכווץ באותו קפיץ של `whileTap` (`TAP`) כל עוד
 * האצבע עליו. הערך הוא קנה המידה, וריק הוא `TAP_SCALE`.
 *
 * למה לא `whileTap`: הוא הופך כל כפתור לרכיב של framer - אובייקט מצב, צומת
 * הטלה ומחווה עם מאזינים משלה - והמחיר משולם בכל כניסה למסך ובכל יציאה
 * ממנו. בשורה שחוזרת ברשימה זה מצטבר: במסך התזכורות שלושה כפתורים בכל
 * שורה היו כמעט חצי מזמן הבנייה שלו במעבר לשונית. כאן אין עלות לכפתור
 * בכלל, והאנימציה רצה רק על הכפתור שנלחץ.
 *
 * `whileTap` נשאר במה שכבר רכיב של framer מסיבה אחרת (כניסה, יציאה, מתיחה),
 * ובכפתור בודד שאינו חוזר. שורה ברשימה - `data-press`.
 */
import { animate } from 'framer-motion';
import { TAP, TAP_SCALE } from './motion';

// `Transition` הכללי רחב מהאפשרויות של אנימציה על אלמנט, והקפיץ עצמו זהה
const spring = TAP as Parameters<typeof animate>[2] & object;

export function pressScale(el: HTMLElement): number {
  const value = Number(el.dataset.press);
  return value > 0 && value < 1 ? value : TAP_SCALE.scale;
}

let installed = false;

export function installPress(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const reduce =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const pressed = new Map<number, HTMLElement>();

  const release = (pointerId: number) => {
    const el = pressed.get(pointerId);
    if (!el) return;
    pressed.delete(pointerId);
    animate(el, { scale: 1 }, spring);
  };

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!e.isPrimary || e.button !== 0 || reduce?.matches) return;
      const target = e.target instanceof Element ? e.target : null;
      const el = target?.closest<HTMLElement>('[data-press]');
      if (!el || el.matches(':disabled, [aria-disabled="true"]')) return;
      release(e.pointerId);
      pressed.set(e.pointerId, el);
      animate(el, { scale: pressScale(el) }, spring);
    },
    { capture: true, passive: true },
  );
  /*
    על window ובשלב הלכידה: עזיבה מחוץ לכפתור, או גלילה שהתחילה מעליו
    (הדפדפן שולח אז pointercancel), חייבות לשחרר אותו - אחרת הוא נשאר מכווץ.
  */
  const up = (e: PointerEvent) => release(e.pointerId);
  window.addEventListener('pointerup', up, { capture: true, passive: true });
  window.addEventListener('pointercancel', up, { capture: true, passive: true });
}
