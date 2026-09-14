/**
 * מחוות "משוך למטה כדי לסגור" לחלוניות.
 *
 * הגרירה מתחילה מכל מקום בחלונית: מהידית ומהכותרת מיד, ומכל שאר השטח -
 * תוכן, כפתורים, שדות והפוטר - ברגע שהאצבע ירדה מספיק ואין לאן לגלול
 * למעלה.
 *
 * המכשול האמיתי הוא הדפדפן, לא הקוד: כשהאצבע יורדת, הדפדפן מחליט שזו
 * מחוות גלילה, לוקח אותה לעצמו ושולח pointercancel. מאותו רגע אין יותר
 * אירועי מצביע, ולכן זיהוי הגרירה לבדו לעולם לא היה מספיק. זה קורה גם
 * מחוץ לאזור הגלילה, ולכן המאזין יושב על הפאנל כולו.
 *
 * לכן יש כאן מאזין touchmove לא-פסיבי: הוא מכריע מוקדם אם זו סגירה או
 * גלילה, ובסגירה קורא ל-preventDefault. בלי גלילה אין ביטול, אירועי
 * המצביע ממשיכים לזרום, ו-framer-motion מקבל את הגרירה כרגיל.
 *
 * ההכרעה נעשית פעם אחת לכל נגיעה ואינה משתנה באמצע: מחווה שהתחילה
 * כגלילה לא הופכת לסגירה כשמגיעים לראש הרשימה.
 */
import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { DragControls } from 'framer-motion';

/** כמה צריך למשוך כדי שזו תיחשב מחווה ולא נגיעה */
const START_THRESHOLD = 6;

type Decision = 'dismiss' | 'scroll';
type Gesture = { y: number; decision: Decision | null; dragging: boolean };

export function useSheetDrag(controls: DragControls) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const detach = useRef<(() => void) | null>(null);

  /** גרירה מיידית - לידית ולכותרת */
  const startDrag = useCallback(
    (e: ReactPointerEvent) => {
      controls.start(e);
    },
    [controls],
  );

  /** האם יש מתחת לאצבע אזור גלילה שאפשר עוד לגלול בו למעלה */
  const canScrollUp = useCallback((target: EventTarget | null) => {
    const el = scrollRef.current;
    if (!el || !(target instanceof Node)) return false;
    if (!el.contains(target)) return false;
    return el.scrollTop > 0;
  }, []);

  /** מכריע מה המחווה הזו, פעם אחת. מחזיר את ההכרעה. */
  const decide = useCallback(
    (state: Gesture, dy: number, target: EventTarget | null): Decision | null => {
      if (state.decision === null && Math.abs(dy) >= START_THRESHOLD) {
        state.decision = dy > 0 && !canScrollUp(target) ? 'dismiss' : 'scroll';
      }
      return state.decision;
    },
    [canScrollUp],
  );

  /*
    ref של פונקציה ולא אפקט: הגיליון קיים בעץ גם כשהוא סגור, והפאנל עצמו
    נוצר רק בפתיחה. אפקט היה רץ פעם אחת, כשעוד לא היה למה להיתלות, ולא
    היה חוזר כשהגיליון נפתח.
  */
  const panelRef = useCallback(
    (node: HTMLElement | null) => {
      detach.current?.();
      detach.current = null;
      if (!node) return;

      const onTouchStart = (e: TouchEvent) => {
        gesture.current =
          e.touches.length === 1
            ? { y: e.touches[0].clientY, decision: null, dragging: false }
            : null;
      };

      const onTouchMove = (e: TouchEvent) => {
        const state = gesture.current;
        if (!state || e.touches.length !== 1) return;
        // זה מה שמונע מהדפדפן לגנוב את המחווה, ובכך שומר על אירועי המצביע
        if (decide(state, e.touches[0].clientY - state.y, e.target) === 'dismiss') {
          e.preventDefault();
        }
      };

      const onTouchEnd = () => {
        gesture.current = null;
      };

      node.addEventListener('touchstart', onTouchStart, { passive: true });
      node.addEventListener('touchmove', onTouchMove, { passive: false });
      node.addEventListener('touchend', onTouchEnd, { passive: true });
      node.addEventListener('touchcancel', onTouchEnd, { passive: true });
      detach.current = () => {
        node.removeEventListener('touchstart', onTouchStart);
        node.removeEventListener('touchmove', onTouchMove);
        node.removeEventListener('touchend', onTouchEnd);
        node.removeEventListener('touchcancel', onTouchEnd);
      };
    },
    [decide],
  );

  /* אירועי המצביע הם אלה שמתחילים את הגרירה בפועל. במגע הם מגיעים אחרי
     ההכרעה שלמעלה; מחוץ לאזור הגלילה, ובעכבר, הם עומדים בפני עצמם. */

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // touchstart כבר רשם את הנגיעה, ועם אותה נקודת התחלה
    gesture.current ??= { y: e.clientY, decision: null, dragging: false };
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const state = gesture.current;
      if (!state || state.dragging) return;
      if (decide(state, e.clientY - state.y, e.target) !== 'dismiss') return;
      state.dragging = true;
      controls.start(e);
    },
    [controls, decide],
  );

  const onPointerEnd = useCallback(() => {
    gesture.current = null;
  }, []);

  return {
    /** לאזור הנגלל, לקריאת מיקום הגלילה */
    scrollRef,
    /** לפאנל עצמו - שם נתלים מאזיני המגע */
    panelRef,
    /** להצמדה לידית ולכותרת - גרירה מיידית */
    handleProps: { onPointerDown: startDrag },
    /** להצמדה לגוף החלונית כולו */
    panelProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}
