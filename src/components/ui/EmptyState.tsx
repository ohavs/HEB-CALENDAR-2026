/**
 * מצב ריק: אייקון גדול בעיגול שקוע, כותרת ב-Karantina, ומשפט שאומר מה
 * יקרה כשיהיה כאן משהו.
 *
 * קודם כל מסך כתב את שלו - פסקה במסגרת מקווקוות בתזכורות, טקסט חשוף
 * בחיפוש, קופסה בהתנגשויות - ושלושה מסכים ריקים נראו כשלוש אפליקציות.
 * המסגרת המקווקוות גם אמרה "גררו לכאן", ואין לאן לגרור.
 */
import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className = '',
}: {
  icon: ReactNode;
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center px-6 py-10 text-center ${className}`}>
      <span
        aria-hidden
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-well text-muted [&_svg]:h-7 [&_svg]:w-7"
      >
        {icon}
      </span>
      <p className="font-display text-k-title font-bold text-ink">{title}</p>
      {hint && <p className="mt-2 max-w-xs text-caption leading-relaxed text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
