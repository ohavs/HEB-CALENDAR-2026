/**
 * גרירת אירועים בין ימים - בסגנון אנדרואיד/סמסונג:
 * לחיצה ארוכה על אירוע בתא היום → רטט קצר → גרירה מעל הלוח → שחרור ליום אחר.
 *
 * המצב מפוצל לשניים בכוונה:
 * - חלק תגובתי (zustand) עם שדות שמשתנים לעיתים רחוקות (מי נגרר, מעל איזה יום),
 *   כדי שתאי הלוח יתרנדרו רק כשצריך.
 * - מיקום המצביע מוחזק ב-motion values, כך שהצל הנגרר זז ב-60fps בלי רינדור.
 */
import { motionValue } from 'framer-motion';
import { create } from 'zustand';
import type { DateKey } from '@/types';
import type { Occurrence } from './recurrence';

/** מיקום הצל הנגרר - נקרא ישירות על ידי DragLayer */
export const ghostX = motionValue(0);
export const ghostY = motionValue(0);

/** מרחק שאחריו מבינים שזו גלילה ולא לחיצה ארוכה */
const CANCEL_DISTANCE = 10;
/** זמן הלחיצה הארוכה */
const LONG_PRESS_MS = 330;
/** רוחב אזור הקצה שמפעיל מעבר חודש בזמן גרירה */
const EDGE_WIDTH = 34;
/** כמה זמן להחזיק בקצה לפני מעבר חודש */
const EDGE_HOLD_MS = 620;

export type DragEdge = 'prev' | 'next' | null;

type DragStore = {
  /** האם יש גרירה פעילה */
  active: boolean;
  /** האירוע הנגרר */
  occurrence: Occurrence | null;
  /** היום שממנו התחילה הגרירה */
  fromKey: DateKey | null;
  /** היום שמעליו המצביע נמצא כרגע */
  overKey: DateKey | null;
  /** האם מוצג רמז ללחיצה ארוכה (לפני שהגרירה מתחילה) */
  pressing: string | null;
};

export const useDragStore = create<DragStore>(() => ({
  active: false,
  occurrence: null,
  fromKey: null,
  overKey: null,
  pressing: null,
}));

/** קריאות נוחות לרכיבים - מחזירות ערכים פרימיטיביים כדי למנוע רינדורים */
export const useIsDropTarget = (key: DateKey): boolean =>
  useDragStore((s) => s.active && s.overKey === key);

export const useIsDraggingOccurrence = (occurrenceId: string): boolean =>
  useDragStore((s) => s.active && s.occurrence?.occurrenceId === occurrenceId);

export const useDragActive = (): boolean => useDragStore((s) => s.active);

/* ==========================================================================
   מנוע הגרירה
   ========================================================================== */

type Callbacks = {
  /** הועבר אירוע ליום אחר */
  onDrop: (baseId: string, to: DateKey, occurrence: Occurrence) => void;
  /** בקשה לדפדף חודש בזמן גרירה בקצה המסך */
  onEdge: (edge: Exclude<DragEdge, null>) => void;
};

let callbacks: Callbacks | null = null;

export function setDragCallbacks(next: Callbacks): void {
  callbacks = next;
}

type Session = {
  occurrence: Occurrence;
  startX: number;
  startY: number;
  pointerId: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  edgeTimer: ReturnType<typeof setTimeout> | null;
  edge: DragEdge;
  started: boolean;
  element: HTMLElement;
};

let session: Session | null = null;

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* לא נתמך */
  }
}

function dayKeyAtPoint(x: number, y: number): DateKey | null {
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest<HTMLElement>('[data-day-key]');
  return cell?.dataset.dayKey ?? null;
}

function clearEdgeTimer() {
  if (session?.edgeTimer) {
    clearTimeout(session.edgeTimer);
    session.edgeTimer = null;
  }
  if (session) session.edge = null;
}

function handleEdges(x: number) {
  if (!session) return;
  const width = window.innerWidth;
  // בעברית הימים מתקדמים מימין לשמאל, ולכן הקצה השמאלי הוא "קדימה בזמן"
  const edge: DragEdge = x < EDGE_WIDTH ? 'next' : x > width - EDGE_WIDTH ? 'prev' : null;
  if (edge === session.edge) return;
  clearEdgeTimer();
  session.edge = edge;
  if (!edge) return;
  session.edgeTimer = setTimeout(() => {
    if (!session || !session.started) return;
    buzz(8);
    callbacks?.onEdge(edge);
    session.edgeTimer = null;
    session.edge = null;
    // מאפשר מעבר חודש נוסף אם ממשיכים להחזיק בקצה
    handleEdges(ghostX.get());
  }, EDGE_HOLD_MS);
}

function onPointerMove(e: PointerEvent) {
  if (!session || e.pointerId !== session.pointerId) return;

  if (!session.started) {
    const dist = Math.hypot(e.clientX - session.startX, e.clientY - session.startY);
    if (dist > CANCEL_DISTANCE) cancelSession();
    return;
  }

  e.preventDefault();
  ghostX.set(e.clientX);
  ghostY.set(e.clientY);
  const over = dayKeyAtPoint(e.clientX, e.clientY);
  if (over !== useDragStore.getState().overKey) {
    if (over) buzz(6);
    useDragStore.setState({ overKey: over });
  }
  handleEdges(e.clientX);
}

function onPointerUp(e: PointerEvent) {
  if (!session || e.pointerId !== session.pointerId) return;
  const { occurrence, started } = session;
  const overKey = useDragStore.getState().overKey;
  const fromKey = useDragStore.getState().fromKey;

  teardown();

  if (started && overKey && overKey !== fromKey) {
    buzz([10, 40, 14]);
    callbacks?.onDrop(occurrence.baseId, overKey, occurrence);
  }
}

function onPointerCancel(e: PointerEvent) {
  if (!session || e.pointerId !== session.pointerId) return;
  teardown();
}

function teardown() {
  if (session) {
    if (session.longPressTimer) clearTimeout(session.longPressTimer);
    if (session.edgeTimer) clearTimeout(session.edgeTimer);
    try {
      session.element.releasePointerCapture(session.pointerId);
    } catch {
      /* יכול להיות שהאלמנט הוסר */
    }
  }
  session = null;
  document.documentElement.classList.remove('dragging');
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
  useDragStore.setState({
    active: false,
    occurrence: null,
    fromKey: null,
    overKey: null,
    pressing: null,
  });
}

function cancelSession() {
  teardown();
}

/**
 * מתחיל מעקב לחיצה ארוכה על אירוע.
 * יש לקרוא מ-onPointerDown של צ׳יפ האירוע בתא היום.
 */
export function beginLongPress(
  e: React.PointerEvent<HTMLElement>,
  occurrence: Occurrence,
): void {
  if (session) teardown();
  if (e.button !== 0 && e.pointerType === 'mouse') return;

  const element = e.currentTarget;
  const pointerId = e.pointerId;

  session = {
    occurrence,
    startX: e.clientX,
    startY: e.clientY,
    pointerId,
    longPressTimer: null,
    edgeTimer: null,
    edge: null,
    started: false,
    element,
  };

  ghostX.set(e.clientX);
  ghostY.set(e.clientY);
  useDragStore.setState({ pressing: occurrence.occurrenceId });

  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);

  session.longPressTimer = setTimeout(() => {
    if (!session) return;
    session.started = true;
    session.longPressTimer = null;
    try {
      session.element.setPointerCapture(pointerId);
    } catch {
      /* לא חובה */
    }
    document.documentElement.classList.add('dragging');
    buzz(14);
    useDragStore.setState({
      active: true,
      occurrence,
      fromKey: occurrence.date,
      overKey: occurrence.date,
      pressing: null,
    });
  }, LONG_PRESS_MS);
}

/** ביטול מעקב הלחיצה (למשל כשמתחילה גלילה) */
export function abortLongPress(): void {
  if (session && !session.started) teardown();
}

export const LONG_PRESS_DURATION_MS = LONG_PRESS_MS;
