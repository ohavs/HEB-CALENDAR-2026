/**
 * סרגל הלשוניות: גלולת זכוכית שצפה מעל התוכן, ועדשה שעוברת בין הלשוניות.
 *
 * המנגנון - מדידה, מתיחה, גרירה ומקלדת - ב-`useLens`, משותף עם
 * `Segmented`. כאן רק המראה: זכוכית, ואייקון שמתמלא כשהעדשה מעליו.
 */
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type ValueAnimationTransition,
} from 'framer-motion';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { CalendarDays, ListChecks, Settings, Sunset, type Icon } from './ui/icons';
import { announce } from '@/lib/announce';
import { ICON, SNAP } from '@/lib/motion';
import { useLens, useLensLight, type LensSlot } from '@/hooks/useLens';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useScrollCollapse } from '@/hooks/useScrollCollapse';

export type TabId = 'calendar' | 'reminders' | 'shabbat' | 'settings';

const TABS: { id: TabId; label: string; Icon: Icon }[] = [
  { id: 'calendar', label: 'לוח שנה', Icon: CalendarDays },
  { id: 'reminders', label: 'תזכורות', Icon: ListChecks },
  { id: 'shabbat', label: 'שבת וחגים', Icon: Sunset },
  { id: 'settings', label: 'הגדרות', Icon: Settings },
];

/** גובה הגלולה עצמה. המקור היחיד - App מחבר אליו את המרווחים. */
export const TAB_BAR_HEIGHT = 64;

/*
  הסרגל המקופל: אותה גלולה בקנה מידה קטן, בלי תוויות, והאייקונים יורדים
  למרכז. קנה מידה ולא גובה - שינוי גובה היה מודד מחדש את העדשה ואת
  הפריסה בכל פריים, וטרנספורם עובר במעבד הגרפי. הריפוד בתחתית המסכים
  (`bottomInset`) נשאר לפי הגובה המלא, כדי שהתוכן לא יקפוץ.
*/
const FOLD_SCALE = 0.8;
/** חצי מהתווית והרווח שמעליה: כמה האייקון יורד כדי לשבת במרכז */
const ICON_DROP = 7;

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

  /*
    מתקפל בגלילה למטה וחוזר בגלילה למעלה, במעבר לשונית או בנגיעה בו
    (`useScrollCollapse`). לא במחשב: שם התוויות בשורה אחת עם האייקון, ויש
    מקום.
  */
  const desktop = useIsDesktop();
  const reduceMotion = useReducedMotion();
  const { collapsed, expand } = useScrollCollapse(picked, !desktop);
  const fold = useMotionValue(0);
  useEffect(() => {
    const to = collapsed ? 1 : 0;
    if (reduceMotion) {
      fold.set(to);
      return;
    }
    const controls = animate(fold, to, SNAP as ValueAnimationTransition<number>);
    return () => controls.stop();
  }, [collapsed, reduceMotion, fold]);
  const scale = useTransform(fold, [0, 1], [1, FOLD_SCALE]);

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
    <motion.nav
      aria-label="ניווט ראשי"
      className="glass absolute inset-x-3 z-40 rounded-full p-1 lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2"
      /*
        במחשב בלי טרנספורם בכלל: framer כותב `transform` מוטמע, והוא היה
        דורס את `-translate-x-1/2` שממרכז את הסרגל.
      */
      style={desktop ? { bottom, height: TAB_BAR_HEIGHT } : { bottom, height: TAB_BAR_HEIGHT, scale, originY: 1 }}
      // נגיעה בסרגל המקופל פותחת אותו, לפני שהעדשה מחשבת מאיפה התחילה הגרירה
      onPointerDownCapture={collapsed ? expand : undefined}
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
            fold={fold}
            onClick={lens.click(i)}
          />
        ))}
      </div>
    </motion.nav>
  );
}

type TabButtonProps = {
  label: string;
  Icon: Icon;
  selected: boolean;
  slot: LensSlot | undefined;
  lensCenter: MotionValue<number>;
  /** 0 פתוח, 1 מקופל */
  fold: MotionValue<number>;
  onClick: () => void;
};

const TabButton = forwardRef<HTMLButtonElement, TabButtonProps>(function TabButton(
  { label, Icon, selected, slot, lensCenter, fold, onClick },
  ref,
) {
  const { lit, dim } = useLensLight(lensCenter, slot, selected);
  // התווית נעלמת בתחילת הקיפול, לפני שהגלולה קטנה מספיק כדי לדחוס אותה
  const labelOpacity = useTransform(fold, [0, 0.6], [1, 0]);
  const drop = useTransform(fold, [0, 1], [0, ICON_DROP]);

  /*
    שתי שכבות זו על זו: עמומה בקו, ודיו במילוי. העדשה מעבירה ביניהן
    בשקיפות, ולכן לשונית שהיא חולפת מעליה מתמלאת לרגע ומתרוקנת.
  */
  const layer = (on: boolean) => (
    <>
      <Icon size={ICON.xl} weight={on ? 'fill' : 'regular'} />
      <motion.span
        className={`text-tiny leading-none lg:text-label ${on ? 'font-semibold' : 'font-medium'}`}
        style={{ opacity: labelOpacity }}
      >
        {label}
      </motion.span>
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
        style={{ opacity: dim, y: drop }}
      >
        {layer(false)}
      </motion.span>
      <motion.span
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink lg:flex-row lg:gap-2.5"
        style={{ opacity: lit, y: drop }}
      >
        {layer(true)}
      </motion.span>
    </button>
  );
});
