/**
 * מחוות "משוך למטה כדי לסגור" לחלוניות.
 *
 * הגרירה מתחילה מכל מקום בחלונית, ולא רק מהידית: מידית האחיזה ומהכותרת
 * תמיד, ומגוף התוכן כשאין לאן לגלול עוד למעלה. כך משיכה למטה תמיד סוגרת,
 * בלי לגזול את הגלילה הפנימית כשיש תוכן ארוך.
 */
import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { DragControls } from 'framer-motion';

/** כמה צריך למשוך כדי שזו תיחשב גרירה ולא נגיעה */
const START_THRESHOLD = 6;

export function useSheetDrag(controls: DragControls) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; started: boolean } | null>(null);

  /** גרירה מיידית - לידית ולכותרת */
  const startDrag = useCallback(
    (e: ReactPointerEvent) => {
      controls.start(e);
    },
    [controls],
  );

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    start.current = { y: e.clientY, started: false };
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const s = start.current;
      const el = scrollRef.current;
      if (!s || s.started || !el) return;

      const delta = e.clientY - s.y;
      if (delta <= START_THRESHOLD) {
        // תנועה כלפי מעלה, או קטנה מדי - נשארים בגלילה רגילה
        if (delta < -START_THRESHOLD) start.current = null;
        return;
      }

      // מושכים למטה: גוררים רק אם אין לאן לגלול למעלה
      const scrollable = el.scrollHeight > el.clientHeight + 1;
      if (scrollable && el.scrollTop > 0) {
        start.current = null;
        return;
      }

      s.started = true;
      controls.start(e);
    },
    [controls],
  );

  const onPointerEnd = useCallback(() => {
    start.current = null;
  }, []);

  return {
    scrollRef,
    /** להצמדה לידית ולכותרת */
    handleProps: { onPointerDown: startDrag },
    /** להצמדה לאזור התוכן הנגלל */
    contentProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}
