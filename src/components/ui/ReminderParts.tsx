/**
 * החלקים של רשימת תזכורות, לרשימה האישית ולמשותפת כאחד.
 *
 * עד עכשיו לכל רשימה הייתה שורה משלה, והן נפרדו בשקט: באישית השעה ישבה
 * בקצה והאייקונים מתחת לכותרת, במשותפת השעה מתחת לכותרת ובלי אייקונים.
 * אותה תזכורת נראתה אחרת לפי המקום שבו היא חיה. כאן יש שורה אחת, ומה
 * שבאמת שונה - מי הוסיף, גרירה - נמסר כפרמטר.
 */
import { useState, type PointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, MapPin, Repeat, Trash2 } from './icons';
import type { ReminderItem } from '@/lib/reminders';
import { isGroupCollapsed, setGroupCollapsed } from '@/lib/settingsCollapse';
import { ENTER, EXIT, GLIDE, ICON, SNAP, TAP } from '@/lib/motion';
import { haptic } from '@/lib/native';
import { announce } from '@/lib/announce';
import { MarqueeText } from './MarqueeText';
import { CheckMark } from './controls';
import { DisplayText } from './DisplayText';

/* ==========================================================================
   כותרת יום
   ========================================================================== */

/**
 * "היום", "מחר", "יום שלישי 24/11" - ובצד התאריך העברי.
 *
 * רכיב אחד לשתי הרשימות, כי הכותרת הייתה כתובה פעמיים ושתי ההעתקות כבר
 * התחילו להיפרד. ב-Karantina כמו כותרות סדר היום, והספרות ב-Heebo
 * (`DisplayText`) - תאריך בכותרת נקרא במבט.
 */
export function DayGroupHeader({ label, hebrew }: { label: string; hebrew?: string }) {
  return (
    <header className="flex items-baseline gap-2.5 px-1 pb-2.5">
      <h2 className="shrink-0 font-display text-k-title font-bold text-ink">
        <DisplayText text={label} />
      </h2>
      {hebrew && <span className="truncate text-caption text-muted">{hebrew}</span>}
    </header>
  );
}

/* ==========================================================================
   שורה
   ========================================================================== */

export function ReminderRow({
  item,
  onToggle,
  onOpen,
  onDelete,
  who,
  onPointerDown,
  dragging = false,
}: {
  item: ReminderItem;
  onToggle: (done: boolean) => void;
  onOpen: () => void;
  onDelete: () => void;
  /** מי הוסיף - רק ברשימה משותפת, ורק כשזה לא אני */
  who?: string | null;
  /** תחילת לחיצה ארוכה לגרירה, כשהרשימה תומכת בה */
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  /**
   * השורה נשארת במקומה כרפאים חיוורים כל עוד היא נגררת. בלעדיה נראו
   * שתי תזכורות בו־זמנית - המקור והצל מעליו.
   */
  dragging?: boolean;
}) {
  const hasMeta = Boolean(item.time || who || item.hasPlace || item.hasAlarm || item.repeating);

  return (
    /*
      מה שבוצע מאבד את הפסטל ונשאר קו מתאר, בגוון `faint` ועם קו חוצה.
      בשקיפות לבדה הוא נשאר בצבע שלו, ושורה שבוצעה התחרתה בפתוחות על
      תשומת הלב. ומתאר ולא `well`: גרפיט, ברירת המחדל, הוא כמעט `well`,
      ושורה שבוצעה נראתה כמו פתוחה.
    */
    <div
      className={`flex min-h-[60px] w-full items-center gap-2.5 rounded-field p-3 transition-[opacity,background-color,color] ${
        item.done ? 'text-faint ring-1 ring-inset ring-hairline' : `ev ev-${item.color}`
      } ${dragging ? 'opacity-25' : ''}`}
    >
      <motion.button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.done ? 'ביטול סימון כבוצע' : 'סימון כבוצע'}
        onClick={() => {
          void haptic('light');
          onToggle(!item.done);
        }}
        whileTap={{ scale: 0.88 }}
        transition={TAP}
        /*
          התיבה מתמלאת בדיו ולא בצבע האירוע: "בוצע" הוא מצב של הממשק, לא
          מידע על האירוע, ולבן על צבע בהיר כמו חמאה כמעט לא נקרא.
        */
        className={`focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          item.done ? 'border-transparent bg-inverse text-on-inverse' : 'border-current opacity-45'
        }`}
      >
        {item.done && <CheckMark size={ICON.sm} />}
      </motion.button>

      <motion.button
        type="button"
        onClick={onOpen}
        onPointerDown={onPointerDown}
        whileTap={{ scale: 0.99 }}
        transition={TAP}
        className="focus-ring min-w-0 flex-1 rounded-xl text-right"
      >
        <MarqueeText
          text={item.title}
          className={`text-body font-medium leading-snug ${item.done ? 'line-through' : ''}`}
        />
        {/*
          שורת המשנה: מתי, מי, ומה עוד יש בפריט. השעה כאן ולא בקצה, כדי
          שכל הפרטים יהיו במקום אחד ובאותו סדר בשתי הרשימות.
        */}
        {hasMeta && (
          <span className="mt-0.5 flex items-center gap-2 text-caption opacity-75">
            {item.time && <span className="tnum font-semibold">{item.time}</span>}
            {who && <span className="min-w-0 truncate">{who}</span>}
            {item.hasPlace && <MapPin size={ICON.xs} className="shrink-0" />}
            {item.hasAlarm && <Bell size={ICON.xs} className="shrink-0" />}
            {item.repeating && <Repeat size={ICON.xs} className="shrink-0" />}
          </span>
        )}
      </motion.button>

      {/*
        מחיקה מהשורה עצמה. סימון ומחיקה אינם אותו דבר - פריט שבוצע הוא
        רשומה, פריט שנמחק הוא טעות - ולכן שניהם גלויים.
      */}
      <motion.button
        type="button"
        onClick={() => {
          void haptic('medium');
          onDelete();
        }}
        whileTap={{ scale: 0.88 }}
        transition={TAP}
        aria-label={`מחיקת ${item.title}`}
        className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-45 transition-opacity active:opacity-90"
      >
        <Trash2 size={ICON.sm} />
      </motion.button>
    </div>
  );
}

/* ==========================================================================
   צ׳יפ קטגוריה
   ========================================================================== */

export function CategoryChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void haptic('light');
        onClick();
      }}
      aria-pressed={active}
      /*
        רקע שקוע ובלי צל: הצ׳יפים יושבים *בתוך* כרטיס, ולא על רקע המסך.
        צ׳יפ לבן על לבן שמורם בצל נראה כמו רעש ולא כמו בורר.
      */
      className={`focus-ring flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-label font-medium transition-colors ${
        active ? 'bg-inverse text-on-inverse' : 'bg-well text-muted'
      }`}
    >
      {label}
      {count ? <span className="tnum opacity-75">{count}</span> : null}
    </button>
  );
}

/* ==========================================================================
   קטגוריה מתקפלת
   ========================================================================== */

/**
 * כותרת של קטגוריה עם חץ, ומה ששייך לה מתחת.
 *
 * הקיפול נשמר במכשיר (`settingsCollapse`), כך שמי שקיפל את "עבודה"
 * בשישי לא יפגוש אותה פתוחה בכל כניסה. המונה נשאר בכותרת גם מקופל -
 * קטגוריה סגורה עדיין צריכה לומר אם יש בה משהו שמחכה.
 */
export function CategorySection({
  collapseId,
  name,
  open,
  children,
}: {
  /** מפתח הקיפול. ייחודי לרשימה ולקטגוריה */
  collapseId: string;
  name: string;
  /** כמה פתוחות */
  open: number;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => isGroupCollapsed(collapseId));

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    setGroupCollapsed(collapseId, next);
    void haptic('light');
    // התוכן נעלם או מופיע מתחת, והמיקוד נשאר על הכותרת
    announce(`${name} ${next ? 'מקופלת' : 'פתוחה'}`);
  };

  return (
    <section>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="focus-ring flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-right"
      >
        <span className="min-w-0 flex-1 truncate font-display text-k-heading font-bold text-ink">
          <DisplayText text={name} />
        </span>
        {open > 0 && (
          <span className="tnum rounded-full bg-well px-2.5 py-0.5 text-caption font-semibold text-ink">
            {open}
          </span>
        )}
        <motion.span
          animate={{ rotate: collapsed ? 90 : 0 }}
          transition={SNAP}
          className="shrink-0 text-faint"
          aria-hidden
        >
          <ChevronDown size={ICON.md} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: GLIDE, opacity: collapsed ? EXIT : ENTER }}
            className="overflow-hidden"
          >
            <div className="space-y-6 pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
