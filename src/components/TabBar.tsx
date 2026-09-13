/** סרגל לשוניות - שורה תחתונה בטלפון, גלולה צפה וממורכזת במסך רחב. */
import { motion } from 'framer-motion';
import { CalendarDays, Settings, Sunset } from 'lucide-react';

export type TabId = 'calendar' | 'shabbat' | 'settings';

const TABS: { id: TabId; label: string; Icon: typeof CalendarDays }[] = [
  { id: 'calendar', label: 'לוח שנה', Icon: CalendarDays },
  { id: 'shabbat', label: 'שבת וחגים', Icon: Sunset },
  { id: 'settings', label: 'הגדרות', Icon: Settings },
];

export const TAB_BAR_HEIGHT = 68;

export function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav
      className="safe-b absolute inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface lg:inset-x-auto lg:bottom-6 lg:left-1/2 lg:w-auto lg:-translate-x-1/2 lg:rounded-full lg:border lg:p-1.5 lg:shadow-lift"
      style={{ minHeight: TAB_BAR_HEIGHT }}
    >
      <div className="flex items-stretch lg:gap-1">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="relative flex flex-1 flex-col items-center gap-1 pb-2.5 pt-3 lg:flex-none lg:flex-row lg:gap-2.5 lg:rounded-full lg:px-6 lg:py-3"
              aria-current={isActive ? 'page' : undefined}
            >
              {/* בטלפון: פס דק מעל הלשונית. במסך רחב: גלולה מלאה מאחורי התוכן. */}
              {isActive && (
                <motion.span
                  layoutId="tab-indicator"
                  className="absolute -top-px h-[3px] w-10 rounded-full bg-brand lg:inset-0 lg:h-auto lg:w-auto lg:rounded-full lg:bg-brand-soft"
                  transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                />
              )}

              {/* התוכן חייב להיות ממוקם כדי להיצבע מעל האינדיקטור */}
              <motion.span
                animate={{ scale: isActive ? 1.06 : 1, y: isActive ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                className={`relative ${isActive ? 'text-brand' : 'text-faint'} lg:y-0`}
              >
                <Icon size={23} strokeWidth={isActive ? 2.4 : 2} />
              </motion.span>
              <span
                className={`relative text-tiny font-medium leading-none lg:text-label ${
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
