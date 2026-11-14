/**
 * סרגל הלשוניות: גלולת זכוכית שצפה מעל התוכן, ועדשה שעוברת בין הלשוניות.
 *
 * העדשה היא כל העניין כאן. היא לא מחליפה מקום - היא *נוסעת*: נמתחת
 * לכיוון התנועה לפי המהירות ונאספת כשהיא נוחתת, והאייקונים נדלקים לפי
 * המרחק שלהם ממנה ולא לפי "מי פעיל". כך לשונית באמצע הדרך נדלקת לרגע
 * ונכבית, והמעבר נקרא כתנועה אחת ולא ככבוי-ואז-דלוק.
 */
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  useVelocity,
  type MotionValue,
  type Transition,
  type ValueAnimationTransition,
} from 'framer-motion';
import { CalendarDays, ListChecks, Settings, Sunset } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { announce } from '@/lib/announce';
import { ICON, LENS, SNAP } from '@/lib/motion';
import { haptic } from '@/lib/native';

export type TabId = 'calendar' | 'reminders' | 'shabbat' | 'settings';

const TABS: { id: TabId; label: string; Icon: typeof CalendarDays }[] = [
  { id: 'calendar', label: 'לוח שנה', Icon: CalendarDays },
  { id: 'reminders', label: 'תזכורות', Icon: ListChecks },
  { id: 'shabbat', label: 'שבת וחגים', Icon: Sunset },
  { id: 'settings', label: 'הגדרות', Icon: Settings },
];

/** גובה הגלולה עצמה. המקור היחיד - App מחבר אליו את המרווחים. */
export const TAB_BAR_HEIGHT = 64;

/** מתיחה מקסימלית של העדשה בתנועה, והמהירות (px/s) שבה היא מגיעה אליה. */
const MAX_STRETCH = 0.28;
const STRETCH_VELOCITY = 2400;
/** כשהעדשה נמתחת לרוחב היא נאספת לגובה, עד 0.9 - כמו טיפה ולא כמו גומי. */
const SQUASH = 0.1;
/** הרמה בגרירה */
const LIFT = 1.08;
/** לחיצה ארוכה על לשונית שאינה העדשה מרימה את העדשה אליה */
const LONG_PRESS_MS = 280;
/** תנועה שמתחת לזה היא עדיין הקשה */
const DRAG_SLOP = 6;

type Slot = { x: number; width: number };

/** הטוקנים מוגדרים כ-Transition כללי, ו-animate על ערך בודד מצפה לצר יותר */
const glide = (value: MotionValue<number>, to: number, transition: Transition) =>
  animate(value, to, transition as ValueAnimationTransition<number>);

export function TabBar({
  active,
  onChange,
  bottom,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
  /** המרחק מתחתית המסך, כולל סרגל המערכת */
  bottom: number;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const rowRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const index = TABS.findIndex((t) => t.id === active);

  /*
    מיקום נמדד ולא layoutId: צריך ערך תנועה ששולטים בו, כדי לגזור ממנו
    מהירות, מתיחה וגרירה. offsetLeft פיזי, ולכן נכון גם ב-RTL.
  */
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
      const next = buttonsRef.current.map((b) => ({
        x: b?.offsetLeft ?? 0,
        width: b?.offsetWidth ?? 0,
      }));
      setSlots((prev) =>
        prev.length === next.length &&
        prev.every((p, i) => p.x === next[i].x && p.width === next[i].width)
          ? prev
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  // נסיעה ללשונית הפעילה. הפעם הראשונה (ושינוי גודל) קופצת - אין מאיפה לבוא.
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
      const tab = TABS[i];
      if (!tab || tab.id === active) return;
      onChange(tab.id);
      // המסך מתחלף כולו והמיקוד נשאר על הלשונית
      announce(tab.label);
    },
    [active, onChange],
  );

  /* ------------------------------ גרירת העדשה ------------------------------ */

  const gesture = useRef<{
    id: number;
    startX: number;
    /** איפה בתוך העדשה האצבע תפסה, כדי שהעדשה לא תקפוץ למרכז האצבע */
    grab: number;
    onLens: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  /** גרירה שהסתיימה בולעת את ה-click שהדפדפן שולח אחריה */
  const swallowClick = useRef(false);

  const localX = (clientX: number) => {
    const row = rowRef.current;
    if (!row) return 0;
    return clientX - row.getBoundingClientRect().left;
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
    const w = width.get();
    const max = row.clientWidth - w;
    x.set(Math.min(Math.max(localX(clientX) - g.grab, 0), Math.max(max, 0)));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || slots.length === 0) return;
    swallowClick.current = false;
    const px = localX(e.clientX);
    const lensX = x.get();
    const onLens = px >= lensX && px <= lensX + width.get();
    const g = {
      id: e.pointerId,
      startX: e.clientX,
      grab: onLens ? px - lensX : width.get() / 2,
      onLens,
      timer: null as ReturnType<typeof setTimeout> | null,
    };
    if (!onLens) {
      // לחיצה ארוכה מרימה את העדשה אל מתחת לאצבע
      g.timer = setTimeout(() => {
        if (gesture.current !== g) return;
        g.timer = null;
        beginDrag(g.id);
        const target = localX(g.startX) - g.grab;
        glide(x, target, reduceMotion ? { duration: 0 } : SNAP);
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
    const moved = Math.abs(e.clientX - g.startX);
    if (moved <= DRAG_SLOP) return;
    if (g.onLens) {
      beginDrag(g.id);
      followFinger(e.clientX);
    } else if (g.timer) {
      // תזוזה לפני הלחיצה הארוכה - זו לא הרמה
      clearTimeout(g.timer);
      g.timer = null;
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

    // נוחתת על הלשונית הקרובה, עם המהירות שנשארה באצבע
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
      const v = velocity.get();
      glide(x, slot.x, reduceMotion ? { duration: 0 } : { ...LENS, velocity: v });
      glide(width, slot.width, reduceMotion ? { duration: 0 } : LENS);
    }
    select(nearest);
  };

  /* ------------------------------ מקלדת ------------------------------ */

  // ב-RTL הלשונית הבאה משמאל, ולכן חץ שמאלה מתקדם
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowLeft: index + 1,
      ArrowRight: index - 1,
      Home: 0,
      End: TABS.length - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const next = (keys[e.key] + TABS.length) % TABS.length;
    buttonsRef.current[next]?.focus();
    select(next);
  };

  return (
    <nav
      aria-label="ניווט ראשי"
      className="glass absolute inset-x-3 z-40 rounded-full p-1 lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2"
      style={{ bottom, height: TAB_BAR_HEIGHT }}
    >
      {/*
        touch-action: none ולא מאזין touchmove: הסרגל אינו נגלל, ולכן אין
        כאן גלילה שצריך להכריע מולה. בלעדיו הדפדפן היה לוקח תנועה אופקית
        לעצמו, שולח pointercancel, והעדשה הייתה נתקעת באמצע.
      */}
      <div
        ref={rowRef}
        role="tablist"
        aria-orientation="horizontal"
        className="relative flex h-full items-stretch lg:gap-1"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endGesture(e, false)}
        onPointerCancel={(e) => endGesture(e, true)}
        onKeyDown={onKeyDown}
      >
        {slots.length > 0 && (
          <motion.span
            aria-hidden
            className="glass-lens pointer-events-none absolute inset-y-0 left-0 rounded-full"
            style={{ x, width, scaleX, scaleY }}
          />
        )}

        {TABS.map(({ id, label, Icon }, i) => (
          <TabButton
            key={id}
            ref={(node) => {
              buttonsRef.current[i] = node;
            }}
            label={label}
            Icon={Icon}
            selected={i === index}
            slot={slots[i]}
            lensCenter={center}
            onClick={() => {
              if (swallowClick.current) {
                swallowClick.current = false;
                return;
              }
              select(i);
            }}
          />
        ))}
      </div>
    </nav>
  );
}

/* ========================================================================== */

type TabButtonProps = {
  label: string;
  Icon: typeof CalendarDays;
  selected: boolean;
  slot: Slot | undefined;
  lensCenter: MotionValue<number>;
  onClick: () => void;
};

const TabButton = forwardRef<HTMLButtonElement, TabButtonProps>(function TabButton(
  { label, Icon, selected, slot, lensCenter, onClick },
  ref,
) {
  /*
    כמה העדשה מעל הלשונית: 1 במרכזה, 0 כשהיא רחוקה ברוחב לשונית שלם.
    שכבת הדיו נצבעת מעל השכבה העמומה בשקיפות הזו - כך אין צורך לערבב
    צבעים ב-JS, וזה נשאר נכון גם במצב לילה.
    לפני המדידה הראשונה הלשונית הנבחרת פשוט דלוקה.
  */
  const lit = useTransform(lensCenter, (c) => {
    if (!slot || slot.width === 0) return selected ? 1 : 0;
    const d = Math.abs(c - (slot.x + slot.width / 2));
    return Math.min(1, Math.max(0, 1 - d / slot.width));
  });
  // התווית המודגשת רחבה מהעמומה, ושוליים עמומים היו מציצים מסביבה
  const dim = useTransform(lit, (v) => 1 - v);

  const content = (strong: boolean) => (
    <>
      <Icon size={ICON.xl} strokeWidth={strong ? 2.4 : 2} />
      <span
        className={`text-tiny leading-none lg:text-label ${strong ? 'font-semibold' : 'font-medium'}`}
      >
        {label}
      </span>
    </>
  );

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
      className="focus-ring-inset relative flex flex-1 flex-col items-center justify-center rounded-full lg:flex-none lg:px-6"
    >
      <motion.span
        className="flex flex-col items-center gap-1 text-muted lg:flex-row lg:gap-2.5"
        style={{ opacity: dim }}
      >
        {content(false)}
      </motion.span>
      <motion.span
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink lg:flex-row lg:gap-2.5"
        style={{ opacity: lit }}
      >
        {content(true)}
      </motion.span>
    </button>
  );
});
