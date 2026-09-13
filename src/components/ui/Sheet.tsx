/**
 * חלונית תחתונה (bottom sheet) עם סגירה בגרירה למטה.
 *
 * הגרירה מופעלת מידית האחיזה ומכותרת החלונית, וגם מגוף התוכן כשהוא גלול
 * עד למעלה - כך ש"משיכה למטה" תמיד סוגרת, בלי להתנגש בגלילה הפנימית.
 */
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from 'framer-motion';
import { useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { GLIDE, ICON, STROKE } from '@/lib/motion';

const CLOSE_OFFSET = 110;
const CLOSE_VELOCITY = 520;

const SPRING = GLIDE;

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** כיתוב קטן מתחת לכותרת */
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** כפתור סגירה עגול בפינה, כמו בעיצוב הייחוס */
  showCloseButton?: boolean;
  /** 'auto' = לפי התוכן, 'tall' = כמעט מסך מלא */
  size?: 'auto' | 'tall';
  /** תוכן נוסף בקו הכותרת (למשל כפתור עריכה) */
  headerAction?: ReactNode;
  className?: string;
};

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  showCloseButton = true,
  size = 'auto',
  headerAction,
  className = '',
}: SheetProps) {
  const controls = useDragControls();
  const { scrollRef, handleProps, contentProps } = useSheetDrag(controls);
  const reduceMotion = useReducedMotion();

  // נעילת גלילת הרקע כל עוד החלונית פתוחה
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Esc סוגר
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // כפתור החזרה של אנדרואיד, והחלקת "חזרה" בדפדפן הנייד, סוגרים את
  // הגיליון במקום לצאת מהאפליקציה. כל גיליון באפליקציה עובר דרך כאן.
  useOverlayHistory(open, onClose);

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.offset.y > CLOSE_OFFSET || info.velocity.y > CLOSE_VELOCITY) onClose();
    },
    [onClose],
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'rgb(var(--sheet-scrim) / var(--sheet-scrim-alpha))',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
          />

          <motion.div
            className={`relative mx-auto flex max-h-[92svh] w-full max-w-[640px] flex-col rounded-t-sheet bg-surface shadow-overlay lg:mb-6 lg:max-w-[720px] lg:rounded-sheet ${
              size === 'tall' ? 'h-[88svh]' : ''
            } ${className}`}
            initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={SPRING}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={onDragEnd}
          >
            {/* ידית אחיזה - אזור הגרירה העיקרי */}
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing"
              {...handleProps}
            >
              <div className="h-1.5 w-10 rounded-full bg-hairline" />
            </div>

            {(title || showCloseButton || headerAction) && (
              <div
                className="flex shrink-0 touch-none items-start gap-3.5 px-6 pb-3 pt-1"
                {...handleProps}
              >
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label="סגירה"
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-well text-muted transition-colors active:bg-hairline"
                  >
                    <X size={ICON.lg} strokeWidth={STROKE} />
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 className="truncate text-title font-semibold leading-tight text-ink">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="mt-1 truncate text-caption text-muted">{subtitle}</p>
                  )}
                </div>
                {headerAction && (
                  <div onPointerDown={(e) => e.stopPropagation()} className="shrink-0">
                    {headerAction}
                  </div>
                )}
              </div>
            )}

            <div
              ref={scrollRef}
              className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-3"
              {...contentProps}
            >
              {children}
            </div>

            {footer && (
              <div className="safe-b shrink-0 border-t border-hairline bg-surface px-6 pb-4 pt-4">
                {footer}
              </div>
            )}
            {!footer && <div className="safe-b shrink-0 pb-2" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
