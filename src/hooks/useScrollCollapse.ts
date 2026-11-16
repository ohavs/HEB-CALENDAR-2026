import { useCallback, useEffect, useRef, useState } from 'react';
import { foldStep, type FoldTrack } from '@/lib/scrollCollapse';

/**
 * האם סרגל הלשוניות מקופל, לפי הגלילה בכל המסכים.
 *
 * מאזין אחד ל-`scroll` בשלב הלכידה על המסמך, ולא הוק בכל מסך: אירוע
 * גלילה אינו מבעבע, אבל נלכד בדרך למטה - וכך כל רשימה נגללת, גם עתידית,
 * מקפלת את הסרגל בלי לדעת עליו. גלילה בתוך גיליון אינה נספרת: הסרגל
 * ממילא מוסתר מאחוריו.
 *
 * המצב חי כאן, בסרגל, ולא ב-App - עדכון של App מצייר מחדש את המסך
 * כולו, ובאמצע גלילה זה גמגום.
 *
 * `resetKey` פותח את הסרגל כשהוא משתנה: מסך חדש מתחיל בראשו.
 */
export function useScrollCollapse(resetKey: unknown, enabled: boolean) {
  const [collapsed, setCollapsed] = useState(false);
  const current = useRef(false);

  const set = useCallback((next: boolean) => {
    if (current.current === next) return;
    current.current = next;
    setCollapsed(next);
  }, []);

  useEffect(() => {
    if (!enabled) {
      set(false);
      return;
    }
    const tracks = new WeakMap<Element, FoldTrack>();
    const onScroll = (e: Event) => {
      const el = e.target;
      if (!(el instanceof Element) || el.closest('[role="dialog"]')) return;
      const step = foldStep(tracks.get(el), el.scrollTop, el.scrollHeight - el.clientHeight, current.current);
      tracks.set(el, step.track);
      set(step.collapsed);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [enabled, set]);

  useEffect(() => set(false), [resetKey, set]);

  const expand = useCallback(() => set(false), [set]);
  return { collapsed, expand };
}
