/**
 * העדשה: הסמן שנוסע בין אפשרויות - בסרגל הלשוניות ובכל `Segmented`.
 *
 * אותו מנגנון בשני המקומות בכוונה. כשלסרגל הייתה עדשה ולמתגים בטופס
 * גלולה שמחליקה בקפיץ אחר, האפליקציה נקראה כשתי מערכות. כאן יש התנהגות
 * אחת, ושני מראות (זכוכית בסרגל, דיו בתוכן) שהרכיב בוחר.
 *
 * מה היא עושה:
 * - **נמדדת ולא layoutId.** צריך ערך תנועה ששולטים בו כדי לגזור ממנו
 *   מהירות וגרירה, ו-layoutId בתוך גיליון נתקע (CLAUDE.md). offsetLeft
 *   פיזי, ולכן נכון גם ב-RTL.
 * - **נמתחת לפי מהירות** ונאספת לגובה כשהיא נמתחת לרוחב - טיפה, לא גומי.
 * - **נגררת.** גרירה שמתחילה עליה, או לחיצה ארוכה על אפשרות אחרת,
 *   מרימה אותה; בעזיבה היא נוחתת על הקרובה עם המהירות שנשארה.
 * - **מדליקה לפי מרחק** (`useLensLight`): אפשרות שהעדשה עוברת מעליה
 *   נדלקת לרגע ונכבית, והמעבר נקרא כתנועה אחת.
 */
import {
  animate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  useVelocity,
  type MotionValue,
  type Transition,
  type ValueAnimationTransition,
} from 'framer-motion';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { LENS, SNAP } from '@/lib/motion';
import { haptic } from '@/lib/native';

export type LensSlot = { x: number; width: number };

/** מתיחה מקסימלית בתנועה, והמהירות (px/s) שבה היא מגיעה אליה */
const MAX_STRETCH = 0.28;
const STRETCH_VELOCITY = 2400;
/** כשהעדשה נמתחת לרוחב היא נאספת לגובה, עד 0.9 */
const SQUASH = 0.1;
/** הרמה בגרירה */
const LIFT = 1.08;
/** לחיצה ארוכה על אפשרות שאינה העדשה מרימה את העדשה אליה */
const LONG_PRESS_MS = 280;
/** תנועה שמתחת לזה היא עדיין הקשה */
const DRAG_SLOP = 6;

/** הטוקנים מוגדרים כ-Transition כללי, ו-animate על ערך בודד מצפה לצר יותר */
const glide = (value: MotionValue<number>, to: number, transition: Transition) =>
  animate(value, to, transition as ValueAnimationTransition<number>);

export function useLens({
  count,
  index,
  onSelect,
  disabled = false,
}: {
  count: number;
  /** האפשרות הנבחרת, או -1 */
  index: number;
  /** בחירה מהקשה, מגרירה או ממקלדת. לא נקראת על האפשרות שכבר נבחרה. */
  onSelect: (index: number) => void;
  disabled?: boolean;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const rowRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);
  const [slots, setSlots] = useState<LensSlot[]>([]);

  const x = useMotionValue(0);
  const width = useMotionValue(0);
  const lift = useMotionValue(1);
  const center = useTransform<number, number>([x, width], ([a, b]) => a + b / 2);
  const velocity = useVelocity(x);
  const stretch = useTransform(velocity, (v) =>
    reduceMotion ? 1 : 1 + Math.min(Math.abs(v) / STRETCH_VELOCITY, MAX_STRETCH),
  );
  const scaleX = useTransform<number, number>([stretch, lift], ([s, l]) => s * l);
  const scaleY = useTransform<number, number>(
    [stretch, lift],
    ([s, l]) => (1 - ((s - 1) / MAX_STRETCH) * SQUASH) * l,
  );

  const placed = useRef(false);
  const dragging = useRef(false);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const next = itemsRef.current
        .slice(0, count)
        .map((b) => ({ x: b?.offsetLeft ?? 0, width: b?.offsetWidth ?? 0 }));
      // בלי ההשוואה כל מדידה הייתה מריצה רינדור נוסף
      setSlots((prev) =>
        prev.length === next.length &&
        prev.every((p, i) => p.x === next[i].x && p.width === next[i].width)
          ? prev
          : next,
      );
    };
    /*
      המדידה הראשונה מגיעה מה-ResizeObserver עצמו, שמדווח מיד על כל
      אלמנט שהתחילו לצפות בו - אחרי הפריסה, כשהקריאה זולה. קריאה ישירה
      כאן, באמצע ה-commit, אילצה את הדפדפן לפרוס את המסך החדש כולו פעם
      נוספת לפני הזמן, וכל מסך עם `Segmented` שילם על זה בכניסה.
    */
    if (typeof ResizeObserver === 'undefined') {
      measure();
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    // כיתוב שמשתנה באפשרות אחת משנה את רוחבה בלי לשנות את השורה
    itemsRef.current.slice(0, count).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [count]);

  // נסיעה לנבחרת. הפעם הראשונה קופצת - אין מאיפה לבוא.
  useLayoutEffect(() => {
    const slot = slots[index];
    if (!slot || dragging.current) return;
    if (!placed.current || reduceMotion) {
      x.set(slot.x);
      width.set(slot.width);
      placed.current = true;
      return;
    }
    const a = glide(x, slot.x, LENS);
    const b = glide(width, slot.width, LENS);
    return () => {
      a.stop();
      b.stop();
    };
  }, [index, slots, reduceMotion, x, width]);

  const select = useCallback(
    (i: number) => {
      if (i < 0 || i >= count || i === index) return;
      onSelect(i);
    },
    [count, index, onSelect],
  );

  /* ------------------------------ גרירה ------------------------------ */

  const gesture = useRef<{
    id: number;
    startX: number;
    startY: number;
    /** איפה בתוך העדשה האצבע תפסה, כדי שהעדשה לא תקפוץ למרכז האצבע */
    grab: number;
    onLens: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  /** גרירה שהסתיימה בולעת את ה-click שהדפדפן שולח אחריה */
  const swallowClick = useRef(false);

  const localX = (clientX: number) => {
    const row = rowRef.current;
    return row ? clientX - row.getBoundingClientRect().left : 0;
  };

  const beginDrag = (pointerId: number) => {
    dragging.current = true;
    x.stop();
    width.stop();
    void haptic('light');
    if (!reduceMotion) glide(lift, LIFT, SNAP);
    try {
      rowRef.current?.setPointerCapture(pointerId);
    } catch {
      /* המצביע כבר שוחרר */
    }
  };

  const followFinger = (clientX: number) => {
    const g = gesture.current;
    const row = rowRef.current;
    if (!g || !row) return;
    const max = Math.max(row.clientWidth - width.get(), 0);
    x.set(Math.min(Math.max(localX(clientX) - g.grab, 0), max));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0 || slots.length === 0 || index < 0) return;
    swallowClick.current = false;
    const px = localX(e.clientX);
    const lensX = x.get();
    const onLens = px >= lensX && px <= lensX + width.get();
    const g = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      grab: onLens ? px - lensX : width.get() / 2,
      onLens,
      timer: null as ReturnType<typeof setTimeout> | null,
    };
    if (!onLens) {
      g.timer = setTimeout(() => {
        if (gesture.current !== g) return;
        g.timer = null;
        beginDrag(g.id);
        glide(x, localX(g.startX) - g.grab, reduceMotion ? { duration: 0 } : SNAP);
      }, LONG_PRESS_MS);
    }
    gesture.current = g;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    if (dragging.current) {
      followFinger(e.clientX);
      return;
    }
    const dx = Math.abs(e.clientX - g.startX);
    const dy = Math.abs(e.clientY - g.startY);
    if (dx <= DRAG_SLOP && dy <= DRAG_SLOP) return;
    if (g.onLens && dx > dy) {
      beginDrag(g.id);
      followFinger(e.clientX);
    } else {
      // תזוזה לפני הלחיצה הארוכה, או גלילה - זו לא הרמה
      if (g.timer) clearTimeout(g.timer);
      gesture.current = null;
    }
  };

  const endGesture = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    if (g.timer) clearTimeout(g.timer);
    gesture.current = null;
    if (!dragging.current) return;

    dragging.current = false;
    swallowClick.current = true;
    glide(lift, 1, SNAP);

    const c = x.get() + width.get() / 2;
    let nearest = index;
    if (!cancelled) {
      let best = Infinity;
      slots.forEach((s, i) => {
        const d = Math.abs(s.x + s.width / 2 - c);
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
    }
    const slot = slots[nearest];
    if (slot) {
      glide(x, slot.x, reduceMotion ? { duration: 0 } : { ...LENS, velocity: velocity.get() });
      glide(width, slot.width, reduceMotion ? { duration: 0 } : LENS);
    }
    select(nearest);
  };

  /* ------------------------------ מקלדת ------------------------------ */

  // ב-RTL הבא משמאל, ולכן חץ שמאלה מתקדם
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowLeft: index + 1,
      ArrowRight: index - 1,
      Home: 0,
      End: count - 1,
    };
    if (disabled || !(e.key in keys)) return;
    e.preventDefault();
    const next = (keys[e.key] + count) % count;
    itemsRef.current[next]?.focus();
    select(next);
  };

  return {
    /** על השורה שמכילה את האפשרויות - היא גם מקור המדידה */
    rowProps: {
      ref: rowRef,
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: PointerEvent<HTMLDivElement>) => endGesture(e, false),
      onPointerCancel: (e: PointerEvent<HTMLDivElement>) => endGesture(e, true),
      onKeyDown,
      /*
        pan-y: גלילה אנכית נשארת של הדפדפן, והתנועה האופקית שלנו. בלי זה
        הדפדפן לוקח גם אותה, שולח pointercancel, והעדשה נתקעת באמצע.
        גלילה אנכית שמתחילה כאן מבטלת את המחווה דרך pointercancel.
      */
      style: { touchAction: 'pan-y' as const },
    },
    /** ref לכל אפשרות, לפי הסדר */
    itemRef: (i: number) => (node: HTMLElement | null) => {
      itemsRef.current[i] = node;
    },
    /** onClick של אפשרות: מסנן את ה-click שאחרי גרירה */
    click: (i: number) => () => {
      if (swallowClick.current) {
        swallowClick.current = false;
        return;
      }
      select(i);
    },
    ready: slots.length > 0 && index >= 0,
    lensStyle: { x, width, scaleX, scaleY },
    center,
    slots,
  };
}

/**
 * כמה העדשה מעל אפשרות: 1 במרכזה, 0 כשהיא רחוקה ברוחב אפשרות שלם.
 * השכבה הנבחרת נצבעת מעל העמומה בשקיפות הזו - בלי לערבב צבעים ב-JS,
 * ולכן נכון גם במצב לילה. לפני המדידה הראשונה הנבחרת פשוט דלוקה.
 */
export function useLensLight(
  center: MotionValue<number>,
  slot: LensSlot | undefined,
  selected: boolean,
) {
  const lit = useTransform(center, (c) => {
    if (!slot || slot.width === 0) return selected ? 1 : 0;
    const d = Math.abs(c - (slot.x + slot.width / 2));
    return Math.min(1, Math.max(0, 1 - d / slot.width));
  });
  const dim = useTransform(lit, (v) => 1 - v);
  return { lit, dim };
}
