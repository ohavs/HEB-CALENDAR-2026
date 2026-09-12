/** סרגל לשוניות תחתון - שקט, עם אינדיקטור שזז בהנפשה. */
import { motion } from 'framer-motion';
import { CalendarDays, Settings, Sunset } from 'lucide-react';

export type TabId = 'calendar' | 'shabbat' | 'settings';

const TABS: { id: TabId; label: string; Icon: typeof CalendarDays }[] = [
  { id: 'calendar', label: 'לוח שנה', Icon: CalendarDays },
  { id: 'shabbat', label: 'שבת וחגים', Icon: Sunset },
  { id: 'settings', label: 'הגדרות', Icon: Settings },
];

export const TAB_BAR_HEIGHT = 62;

export function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav
      className="safe-b absolute inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface"
      style={{ minHeight: TAB_BAR_HEIGHT }}
    >
      <div className="flex items-stretch">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5"
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="tab-indicator"
                  className="absolute -top-px h-[2.5px] w-9 rounded-full bg-brand"
                  transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                />
              )}
              <motion.span
                animate={{ scale: isActive ? 1.06 : 1, y: isActive ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                className={isActive ? 'text-brand' : 'text-faint'}
              >
                <Icon size={21} strokeWidth={isActive ? 2.4 : 2} />
              </motion.span>
              <span
                className={`text-[10.5px] font-medium leading-none ${
                  isActive ? 'text-brand' : 'text-faint'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
