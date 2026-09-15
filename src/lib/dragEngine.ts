/**
 * גרירת אירועים בין ימים - בסגנון אנדרואיד/סמסונג:
 * לחיצה ארוכה על אירוע בתא היום → רטט קצר → גרירה מעל הלוח → שחרור ליום אחר.
 *
 * המצב מפוצל לשניים בכוונה:
 * - חלק תגובתי (zustand) עם שדות שמשתנים לעיתים רחוקות (מי נגרר, מעל איזה יום),
 *   כדי שתאי הלוח יתרנדרו רק כשצריך.
 * - מיקום המצביע מוחזק ב-motion values, כך שהצל הנגרר זז ב-60fps בלי רינדור.
 *
 * למה גם אירועי מגע ולא רק Pointer Events: במסך גליל הדפדפן מחליט בעצמו
 * שהתנועה היא גלילה, שולח `pointercancel` ומפסיק לשלוח `pointermove`.
 * בלוח זה לא הופיע כי הרשת אינה נגללת, ובמסך התזכורות הגרירה מתה מיד
 * אחרי הלחיצה הארוכה. `preventDefault` על `pointermove` אינו עוצר גלילת
 * מגע - רק על `touchmove`, ורק כשהמאזין אינו passive.
 *
 * לכן: מאזין `touchmove` לא-passive שמונע את הגלילה וגם מזין את המיקום,
 * ו-`pointercancel` מתעלם מגרירה שכבר התחילה.
 */
import { motionValue } from 'framer-motion';
import { haptic } from './native';
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
/**
 * אזור בקצה רשימה נגללת שמפעיל גלילה אוטומטית בזמן גרירה.
 *
 * רחב בכוונה: הגולל נמתח עד תחתית המסך, אבל סרגל הלשוניות יושב עליו
 * ומכסה את 68 הפיקסלים האחרונים. אזור צר יותר היה מתחיל מתחת לסרגל,
 * כלומר במקום שאי אפשר לגרור אליו.
 */
const SCROLL_ZONE = 100;
/** מהירות הגלילה האוטומטית, פיקסלים לפריים */
const SCROLL_SPEED = 11;

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

function buzz() {
  void haptic('medium');
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
    buzz();
    callbacks?.onEdge(edge);
    session.edgeTimer = null;
    session.edge = null;
    // מאפשר מעבר חודש נוסף אם ממשיכים להחזיק בקצה
    handleEdges(ghostX.get());
  }, EDGE_HOLD_MS);
}

/* --------------------------- גלילה אוטומטית --------------------------- */

/*
  בלי זה אפשר להפיל רק על מה שגלוי: הגלילה חסומה בזמן גרירה, ורשימת
  התזכורות ארוכה בהרבה מהמסך. המסך שרוצה בזה מסמן את הגולל שלו
  ב-data-drag-scroll.
*/
let scroller: HTMLElement | null = null;
let scrollDelta = 0;
let scrollFrame: number | null = null;

function stepScroll() {
  if (!scroller || !scrollDelta) {
    scrollFrame = null;
    return;
  }
  scroller.scrollTop += scrollDelta;
  scrollFrame = requestAnimationFrame(stepScroll);
}

function updateAutoScroll(y: number) {
  const el = document.querySelector<HTMLElement>('[data-drag-scroll]');
  scroller = el;
  if (!el) {
    scrollDelta = 0;
    return;
  }
  const box = el.getBoundingClientRect();
  if (y < box.top + SCROLL_ZONE) scrollDelta = -SCROLL_SPEED;
  else if (y > box.bottom - SCROLL_ZONE) scrollDelta = SCROLL_SPEED;
  else scrollDelta = 0;
  if (scrollDelta && scrollFrame === null) scrollFrame = requestAnimationFrame(stepScroll);
}

function stopAutoScroll() {
  scrollDelta = 0;
  scroller = null;
  if (scrollFrame !== null) {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
  }
}

/* ------------------------------ תנועה ------------------------------ */

/** מקור אחד לתנועה, בין אם היא הגיעה מ-pointer ובין אם מ-touch. */
function moveTo(x: number, y: number) {
  if (!session?.started) return;
  ghostX.set(x);
  ghostY.set(y);
  const over = dayKeyAtPoint(x, y);
  if (over !== useDragStore.getState().overKey) {
    if (over) buzz();
    useDragStore.setState({ overKey: over });
  }
  handleEdges(x);
  updateAutoScroll(y);
}

/** סיום הגרירה - נקרא גם מ-pointerup וגם מ-touchend, ובטוח לקריאה כפולה. */
function finish() {
  if (!session) return;
  const { occurrence, started } = session;
  const { overKey, fromKey } = useDragStore.getState();

  teardown();

  if (started && overKey && overKey !== fromKey) {
    buzz();
    callbacks?.onDrop(occurrence.baseId, overKey, occurrence);
  }
}

function onPointerMove(e: PointerEvent) {
  if (!session || e.pointerId !== session.pointerId) return;

  if (!session.started) {
    const dist = Math.hypot(e.clientX - session.startX, e.clientY - session.startY);
    if (dist > CANCEL_DISTANCE) cancelSession();
    return;
  }

  e.preventDefault();
  moveTo(e.clientX, e.clientY);
}

/**
 * מגע. המאזין אינו passive, וזה מה שמאפשר לעצור את הגלילה בזמן גרירה.
 * הוא גם מזין את המיקום, כדי שהגרירה תשרוד גם אם הדפדפן כבר ביטל את
 * אירועי ה-pointer.
 */
function onTouchMove(e: TouchEvent) {
  if (!session) return;
  const touch = e.touches[0];
  if (!touch) return;

  if (!session.started) {
    const dist = Math.hypot(touch.clientX - session.startX, touch.clientY - session.startY);
    if (dist > CANCEL_DISTANCE) cancelSession();
    return;
  }

  e.preventDefault();
  moveTo(touch.clientX, touch.clientY);
}

function onTouchEnd() {
  finish();
}

function onPointerUp(e: PointerEvent) {
  if (!session || e.pointerId !== session.pointerId) return;
  finish();
}

/*
  גרירה שכבר התחילה שורדת ביטול של אירועי ה-pointer: הדפדפן שולח
  pointercancel ברגע שהוא מחליט שהתנועה היא גלילה, ובלי ההתעלמות הזו
  הגרירה מתה מיד אחרי הלחיצה הארוכה בכל מסך נגלל. מכאן והלאה אירועי
  המגע נושאים אותה.
*/
function onPointerCancel(e: PointerEvent) {
  if (!session || e.pointerId !== session.pointerId) return;
  if (!session.started) teardown();
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
  stopAutoScroll();
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
  window.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('touchend', onTouchEnd);
  window.removeEventListener('touchcancel', onTouchEnd);
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
  // passive: false הוא כל העניין - בלעדיו preventDefault לא יעצור גלילה
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchcancel', onTouchEnd);

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
    buzz();
    /*
      לפריט בלי תאריך יש עדיין `date` שמור - זה מה שמאפשר לו לחזור ליום
      שממנו הגיע - אבל מבחינת הגרירה הוא יושב בקבוצת `undated`. בלי
      התרגום הזה הכיתוב הראשון היה מציע "העברה ל-14 בספטמבר" בזמן
      שהאצבע עדיין על הקבוצה חסרת התאריך.
    */
    const from = (occurrence.undated ? 'undated' : occurrence.date) as DateKey;
    useDragStore.setState({
      active: true,
      occurrence,
      fromKey: from,
      overKey: from,
      pressing: null,
    });
  }, LONG_PRESS_MS);
}

/** ביטול מעקב הלחיצה (למשל כשמתחילה גלילה) */
export function abortLongPress(): void {
  if (session && !session.started) teardown();
}

export const LONG_PRESS_DURATION_MS = LONG_PRESS_MS;
