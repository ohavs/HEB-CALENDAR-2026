/**
 * גרירה על ציר אחד, שמזיזה motion value - בלי `drag` של framer.
 *
 * `drag` (וגם `dragControls`) מצרף לרכיב את מערכת ההטלה של framer: בכל
 * פעם שהרכיב מצויר מחדש היא מודדת את הפריסה של העץ כולו, גם כשאיש אינו
 * גורר. בלוח זה קרה בכל הקשה על יום - הדף של החודש והחלונית מצוירים מחדש
 * עם הבחירה - ובכל כניסה ללשונית וביציאה ממנה. כאן אין מדידה בכלל: האצבע
 * מזיזה ערך, וזה כל מה שהגרירה צריכה (CLAUDE.md, "ביצועים").
 *
 * `start` מקבל pointerdown, כמו `DragControls.start`, ולכן `useSheetDrag`
 * יכול להתחיל גרירה כזו באמצע מחווה בדיוק כמו גרירה של framer. היא נעשית
 * גרירה רק אחרי `THRESHOLD` פיקסלים, כך שהקשה נשארת הקשה.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { MotionValue } from 'framer-motion';

/** מכאן זו תנועה ולא הקשה - כמו בגרירה של framer */
const THRESHOLD = 3;
/** המהירות נמדדת על התנועה האחרונה בלבד, כמו ב-framer */
const VELOCITY_WINDOW_MS = 100;

export type AxisDragInfo = {
  /** כמה האצבע זזה על הציר מתחילת הגרירה */
  offset: number;
  /** פיקסלים לשנייה, ברגע העזיבה */
  velocity: number;
};

type PointerLike = { pointerId: number; clientX: number; clientY: number };

export function useAxisDrag({
  axis,
  value,
  min,
  max,
  elastic,
  lock = false,
  enabled = true,
  onEnd,
}: {
  axis: 'x' | 'y';
  value: MotionValue<number>;
  /** הגבולות. מעבר להם הערך נמתח לפי `elastic` */
  min: number;
  max: number;
  elastic: { min: number; max: number };
  /** תנועה שמתחילה בעיקר בציר השני אינה גרירה (גלילה, החלקה אחרת) */
  lock?: boolean;
  /** נבדק כשהתנועה מתחילה: גרירה אחרת שכבר תפסה את האצבע גוברת */
  enabled?: boolean;
  onEnd: (info: AxisDragInfo) => void;
}) {
  // הקריאות מגיעות ממאזינים על window, ולכן קוראות תמיד את הערכים העדכניים
  const latest = useRef({ min, max, elastic, lock, enabled, onEnd });
  latest.current = { min, max, elastic, lock, enabled, onEnd };
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const start = useCallback(
    (down: PointerLike) => {
      stop.current?.();
      const pick = (p: PointerLike) => (axis === 'x' ? p.clientX : p.clientY);
      const other = (p: PointerLike) => (axis === 'x' ? p.clientY : p.clientX);
      const from = pick(down);
      const fromOther = other(down);
      let origin = 0;
      let active = false;
      let samples: { t: number; at: number }[] = [];

      const place = (at: number) => {
        const { min: lo, max: hi, elastic: e } = latest.current;
        if (at < lo) return lo + (at - lo) * e.min;
        if (at > hi) return hi + (at - hi) * e.max;
        return at;
      };

      const move = (e: PointerEvent) => {
        if (e.pointerId !== down.pointerId) return;
        const d = pick(e) - from;
        if (!active) {
          const dOther = other(e) - fromOther;
          if (Math.max(Math.abs(d), Math.abs(dOther)) < THRESHOLD) return;
          if (!latest.current.enabled || (latest.current.lock && Math.abs(dOther) > Math.abs(d))) {
            finish();
            return;
          }
          active = true;
          value.stop();
          // באמצע אנימציה שנכתבה באחוזים אין מאיפה למדוד, ולכן מהאפס
          const current = value.get();
          origin = typeof current === 'number' ? current : 0;
        }
        const now = performance.now();
        samples.push({ t: now, at: pick(e) });
        samples = samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS);
        value.set(place(origin + d));
      };

      const end = (e: PointerEvent) => {
        if (e.pointerId !== down.pointerId) return;
        const wasActive = active;
        finish();
        if (!wasActive) return;
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = last && first ? last.t - first.t : 0;
        const velocity = dt > 0 ? ((last.at - first.at) / dt) * 1000 : 0;
        latest.current.onEnd({ offset: pick(e) - from, velocity });
      };

      const finish = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        stop.current = null;
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      stop.current = finish;
    },
    [axis, value],
  );

  // יציב, כדי שמי שמחזיק אותו (useSheetDrag) לא ייבנה מחדש בכל ציור
  return useMemo(() => ({ start }), [start]);
}
