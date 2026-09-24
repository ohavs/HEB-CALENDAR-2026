/**
 * שורת טקסט אחת שנגללת כשהיא לא נכנסת. ראו `MARQUEE` ב-`motion.ts`.
 *
 * כשהטקסט נכנס זה span רגיל, בלי מדידה נוספת בציור. כשאינו נכנס, הקצוות
 * דוהים ולא נחתכים, והטקסט נע רק כשהוא על המסך - רשימה ארוכה של
 * כרטיסים לא צריכה לגלול עשרים כותרות שאיש אינו רואה.
 *
 * ב-RTL הטקסט גולש שמאלה, ולכן החשיפה היא הזזה ימינה.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { MARQUEE, marqueeTimeline } from '@/lib/motion';

export function MarqueeText({ text, className = '' }: { text: string; className?: string }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return;
    const measure = () => setOverflow(Math.max(0, Math.ceil(content.scrollWidth - box.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text]);

  const moving = overflow > 0 && !reduceMotion;

  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!moving || !box || !content || typeof content.animate !== 'function') return;

    const { duration, keyframes } = marqueeTimeline(overflow);
    const animation = content.animate(
      keyframes.map((k) => ({ offset: k.offset, transform: `translateX(${k.shift}px)` })),
      { duration, iterations: Infinity, easing: 'ease-in-out' },
    );
    animation.pause();

    const visibility = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) animation.play();
      else animation.pause();
    });
    visibility.observe(box);
    return () => {
      visibility.disconnect();
      animation.cancel();
    };
  }, [moving, overflow]);

  const fade = MARQUEE.fade;
  return (
    <span
      ref={outer}
      className={`block overflow-hidden whitespace-nowrap ${
        overflow > 0 && reduceMotion ? 'text-ellipsis' : ''
      } ${className}`}
      style={
        moving
          ? {
              // דהייה בשני הקצוות; הקצה של ההתחלה מרופד, כך שבמנוחה האות
              // הראשונה לא נבלעת בה
              maskImage: `linear-gradient(to left, transparent, #000 ${fade}px, #000 calc(100% - ${fade}px), transparent)`,
              WebkitMaskImage: `linear-gradient(to left, transparent, #000 ${fade}px, #000 calc(100% - ${fade}px), transparent)`,
              marginInlineStart: -fade,
            }
          : undefined
      }
    >
      <span
        ref={inner}
        className={reduceMotion ? '' : 'inline-block will-change-transform'}
        style={moving ? { paddingInline: fade } : undefined}
      >
        {text}
      </span>
    </span>
  );
}
