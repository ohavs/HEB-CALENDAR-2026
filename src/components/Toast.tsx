/** הודעה קצרה בתחתית המסך, עם אפשרות ביטול פעולה. */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { create } from 'zustand';

type ToastState = {
  message: string | null;
  actionLabel?: string;
  onAction?: () => void;
  /** מזהה שמתחלף בכל הודעה, כדי לאפס את הטיימר */
  seq: number;
  show: (message: string, action?: { label: string; run: () => void }) => void;
  hide: () => void;
};

export const useToastStore = create<ToastState>()((set) => ({
  message: null,
  seq: 0,
  show: (message, action) =>
    set((s) => ({
      message,
      actionLabel: action?.label,
      onAction: action?.run,
      seq: s.seq + 1,
    })),
  hide: () => set({ message: null, actionLabel: undefined, onAction: undefined }),
}));

export const toast = (message: string, action?: { label: string; run: () => void }): void =>
  useToastStore.getState().show(message, action);

export function Toaster({ bottomInset }: { bottomInset: number }) {
  const { message, actionLabel, onAction, seq, hide } = useToastStore();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, 4200);
    return () => clearTimeout(timer);
  }, [message, seq, hide]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={seq}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 480, damping: 34 }}
          className="pointer-events-none absolute inset-x-4 z-[55] flex justify-center"
          style={{ bottom: bottomInset + 80 }}
        >
          <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl bg-ink px-5 py-3.5 shadow-lift">
            <span className="truncate text-label font-medium text-canvas">{message}</span>
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={() => {
                  onAction();
                  hide();
                }}
                className="shrink-0 text-label font-semibold text-[rgb(var(--c-brand))]"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
