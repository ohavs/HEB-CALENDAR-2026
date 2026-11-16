/**
 * סרגל הלשוניות: גלולת זכוכית שצפה מעל התוכן, ועדשה שעוברת בין הלשוניות.
 *
 * המנגנון - מדידה, מתיחה, גרירה ומקלדת - ב-`useLens`, משותף עם
 * `Segmented`. כאן רק המראה: זכוכית, ואייקון שמתמלא כשהעדשה מעליו.
 */
import { motion, type MotionValue } from 'framer-motion';
import { forwardRef, useRef, useState } from 'react';
import { CalendarDays, ListChecks, Settings, Sunset, type Icon } from './ui/icons';
import { announce } from '@/lib/announce';
import { ICON } from '@/lib/motion';
import { useLens, useLensLight, type LensSlot } from '@/hooks/useLens';

export type TabId = 'calendar' | 'reminders' | 'shabbat' | 'settings';

const TABS: { id: TabId; label: string; Icon: Icon }[] = [
  { id: 'calendar', label: 'לוח שנה', Icon: CalendarDays },
  { id: 'reminders', label: 'תזכורות', Icon: ListChecks },
  { id: 'shabbat', label: 'שבת וחגים', Icon: Sunset },
  { id: 'settings', label: 'הגדרות', Icon: Settings },
];

/** גובה הגלולה עצמה. המקור היחיד - App מחבר אליו את המרווחים. */
export const TAB_BAR_HEIGHT = 64;

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
  /*
    הבחירה נשמרת כאן, ולא רק ב-App: App מקבל אותה ב-transition (ראו `setTab`),
    והעדשה לא מחכה לו. כשהלשונית מתחלפת מבחוץ - כפתור החזרה, וידג׳ט - היא
    מתיישרת לפיה.
  */
  const requested = useRef<TabId | null>(null);
  const [picked, setPicked] = useState(active);
  const [seen, setSeen] = useState(active);
  if (active !== seen) {
    setSeen(active);
    /*
      שתי הקשות מהירות: הראשונה עלולה להגיע ל-App לפני השנייה, והעדשה
      הייתה קופצת אליה לרגע בדרך. מתיישרים רק כשאין בחירה שעוד בדרך, או
      כשהיא זו שהגיעה.
    */
    if (requested.current === null || requested.current === active) {
      requested.current = null;
      setPicked(active);
    }
  }
  const index = TABS.findIndex((t) => t.id === picked);
  const lens = useLens({
    count: TABS.length,
    index,
    onSelect: (i) => {
      const tab = TABS[i];
      // הקשה על הלשונית שכבר מוצגת אינה מגיעה ל-App כשינוי, ואין לה למה לחכות
      requested.current = tab.id === active ? null : tab.id;
      setPicked(tab.id);
      onChange(tab.id);
      // המסך מתחלף כולו והמיקוד נשאר על הלשונית. החלפה היא ניווט, ולכן בלי רטט.
      announce(tab.label);
    },
  });

  return (
    <nav
      aria-label="ניווט ראשי"
      className="glass absolute inset-x-3 z-40 rounded-full p-1 lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2"
      style={{ bottom, height: TAB_BAR_HEIGHT }}
    >
      <div
        {...lens.rowProps}
        role="tablist"
        aria-orientation="horizontal"
        className="relative flex h-full items-stretch lg:gap-1"
      >
        {lens.ready && (
          <motion.span
            aria-hidden
            className="glass-lens pointer-events-none absolute inset-y-0 left-0 rounded-full"
            style={lens.lensStyle}
          />
        )}

        {TABS.map(({ id, label, Icon }, i) => (
          <TabButton
            key={id}
            ref={lens.itemRef(i)}
            label={label}
            Icon={Icon}
            selected={i === index}
            slot={lens.slots[i]}
            lensCenter={lens.center}
            onClick={lens.click(i)}
          />
        ))}
      </div>
    </nav>
  );
}

type TabButtonProps = {
  label: string;
  Icon: Icon;
  selected: boolean;
  slot: LensSlot | undefined;
  lensCenter: MotionValue<number>;
  onClick: () => void;
};

const TabButton = forwardRef<HTMLButtonElement, TabButtonProps>(function TabButton(
  { label, Icon, selected, slot, lensCenter, onClick },
  ref,
) {
  const { lit, dim } = useLensLight(lensCenter, slot, selected);

  /*
    שתי שכבות זו על זו: עמומה בקו, ודיו במילוי. העדשה מעבירה ביניהן
    בשקיפות, ולכן לשונית שהיא חולפת מעליה מתמלאת לרגע ומתרוקנת.
  */
  const layer = (on: boolean) => (
    <>
      <Icon size={ICON.xl} weight={on ? 'fill' : 'regular'} />
      <span className={`text-tiny leading-none lg:text-label ${on ? 'font-semibold' : 'font-medium'}`}>
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
        {layer(false)}
      </motion.span>
      <motion.span
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink lg:flex-row lg:gap-2.5"
        style={{ opacity: lit }}
      >
        {layer(true)}
      </motion.span>
    </button>
  );
});
