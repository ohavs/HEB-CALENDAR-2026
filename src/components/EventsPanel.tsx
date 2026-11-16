/**
 * אירועי היום הנבחר.
 *
 * בטלפון זו חלונית תחתונה: מקופלת כברירת מחדל ומציגה רק ידית וסיכום קצר,
 * כך שהלוח נשאר נקי. מושכים למעלה כדי לפתוח וגוררים למטה כדי לסגור.
 * במסך רחב אותו תוכן יושב כעמודה קבועה לצד הלוח, בלי גרירה.
 *
 * ביצועים: החלונית מקודמת לשכבה משלה (will-change), הצל שלה קטן מספיק
 * כדי לא לדרוש רסטור מחדש בכל פריים, ושקיפות התוכן נגזרת ישירות ממיקום
 * הגרירה כ-motion value - בלי רינדור מחדש של React תוך כדי התנועה.
 */
import { animate, motion, useMotionValue, useTransform, type ValueAnimationTransition } from 'framer-motion';
import { useCallback, useRef, type MutableRefObject } from 'react';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { useAxisDrag, type AxisDragInfo } from '@/hooks/useAxisDrag';
import { useToggleDone } from '@/hooks/useOccurrenceActions';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { ChevronLeft, ChevronUp, Plus, Sun } from '@/components/ui/icons';
import type { DateKey, DayInfo, EventTemplate } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { dateKey, dayTitleLabel, relativeDayLabel } from '@/lib/dates';
import { EventCard } from './EventChip';
import { useSettings } from '@/store/settings';
import { TemplateStrip } from './TemplateStrip';
import { useElementSize } from '@/hooks/useElementSize';
import { GLIDE, ICON, SNAP } from '@/lib/motion';
import { haptic } from '@/lib/native';
import { DisplayText } from './ui/DisplayText';

/**
 * כמה מהחלונית נשאר גלוי כשהיא מקופלת.
 *
 * ירד מ-84: שורת הידית נשאה כותרת וסיכום בשתי שורות, ובמסך טלפון
 * הכרום הקבוע (כותרת + חלונית + לשוניות) הגיע לרבע מהמסך. הסיכום
 * עבר לשורה אחת, והגובה שהתפנה חזר לשורות הרשת.
 *
 * ועלה חזרה ל-68: ב-58 כפתור ההוספה (40px) בתוספת הידית שמעליו מילא
 * את הרצועה עד הפיקסל, ונשארו שני פיקסלים בינו לבין הלשוניות - כלומר
 * הוא נראה חתוך. העשרה שנוספו הם בדיוק המרווח שמעל הידית, ולכן הרצועה
 * נקראת מרופדת משני הצדדים במקום דחוקה מלמטה.
 */
const PEEK_HEIGHT = 68;
/**
 * עצירת הביניים: ידית + כשלושה כרטיסי אירוע, בלי לכסות את הרשת.
 *
 * זו העצירה שהקשה על יום מגיעה אליה. קודם היו שתי עצירות בלבד, ולכן
 * "מה יש לי ביום הזה" - המסלול השכיח בלוח - עלה שתי פעולות: הקשה
 * לבחירה, ואז גרירה או הקשה שנייה שיוצאת מהלוח למסך היום.
 *
 * עלה מ-330: ביום שיש בו גם מועד וגם זמני כניסה ויציאה - כלומר כל
 * שבת וכל חג - התוכן שמעל דחף את מצב הריקנות אל מתחת לקצה, ומי שהקיש
 * על היום כדי להוסיף בו משהו היה צריך לגרור עוד. זה עדיין תלוי באורך
 * התוכן, ולכן הכפתור עצמו עבר לשורת הידית שלא זזה לעולם.
 */
const HALF_HEIGHT = 400;
/** כמה מהמהירות נזקפת לכיוון שאליו המשתמש התכוון */
const FLING_PROJECTION = 0.12;
/** מרחק המשיכה שבו התוכן מגיע לשקיפות מלאה */
const FADE_DISTANCE = 90;

/** שלוש העצירות של החלונית, מלמטה למעלה. */
export type PanelDetent = 'peek' | 'half' | 'full';

type ContentProps = {
  day: DayInfo | undefined;
  occurrences: Occurrence[];
  onOpenDay: () => void;
  onAddEvent: () => void;
  onEditEvent: (occurrence: Occurrence) => void;
  /** הזזה במקלדת (Alt+חיצים) - החלופה לגרירה */
  onMoveEvent: (occurrence: Occurrence, days: number) => void;
  /** שיבוץ תבנית ליום הפתוח */
  onPlaceTemplate: (template: EventTemplate, date: DateKey) => void;
  /**
   * האם להציג את רצועת התבניות.
   *
   * בתצוגת שבוע היא יורדת: שם כל משבצת שעה כבר לחיצה ליצירת אירוע,
   * והחלונית קצרה ממילא. רצועה נוספת בראשה דוחקת את האירועים של היום
   * עצמו אל מחוץ למסך.
   */
  showTemplates?: boolean;
};

/* ==========================================================================
   התוכן - משותף לחלונית הנגררת ולעמודה הקבועה
   ========================================================================== */

function DayPanelContent({
  day,
  occurrences,
  onOpenDay,
  onAddEvent,
  onEditEvent,
  onMoveEvent,
  onPlaceTemplate,
  showTemplates = true,
}: ContentProps) {
  const toggleDone = useToggleDone();
  const settings = useSettings();
  if (!day) return null;

  const candles = day.times.find((t) => t.kind === 'candles');
  const havdalah = day.times.find((t) => t.kind === 'havdalah');

  return (
    <div className="space-y-3">
      {/*
        רצועת התבניות ראשונה, ומופרדת בקו: מי שפתח יום כדי לשבץ בו משהו
        לא צריך לגלול מתחת לאירועים שכבר בו. הלשונית "תבניות" בתזכורות
        היא המקום לשבץ לכמה ימים; כאן זה יום אחד, מהיר.
      */}
      {showTemplates && (
        <TemplateStrip
          templates={settings.templates}
          date={dateKey(day.date)}
          onPlace={onPlaceTemplate}
        />
      )}

      {/* מועדים - שורות עם נקודת צבע, לא גלולות */}
      {day.holidays.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-well">
          {day.holidays.map((h, i) => (
            <div
              key={h.id}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                i > 0 ? 'border-t border-hairline' : ''
              }`}
            >
              <span className="text-title leading-none">{h.emoji ?? '✦'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-ink">
                  {h.title}
                </span>
                {h.restWork && (
                  <span className="mt-0.5 block text-caption text-muted">
                    אסור בעשיית מלאכה
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* זמני שבת */}
      {(candles || havdalah) && (
        <div className="flex gap-3">
          {candles && (
            <div className="flex-1 rounded-2xl bg-shabbat/10 px-4 py-3.5">
              <span className="block text-caption font-medium text-shabbat">
                🕯 {candles.title}
              </span>
              <span className="tnum mt-1 block text-heading font-semibold text-ink">
                {candles.time}
              </span>
            </div>
          )}
          {havdalah && (
            <div className="flex-1 rounded-2xl bg-well px-4 py-3.5">
              <span className="block text-caption font-medium text-ink">
                ✦ {havdalah.title}
              </span>
              <span className="tnum mt-1 block text-heading font-semibold text-ink">
                {havdalah.time}
              </span>
            </div>
          )}
        </div>
      )}

      {/* אירועים */}
      {occurrences.length > 0 ? (
        <div className="space-y-2.5">
          {occurrences.map((occ) => (
            <EventCard
              key={occ.occurrenceId}
              occurrence={occ}
              onClick={() => onEditEvent(occ)}
              onMove={(days) => onMoveEvent(occ, days)}
              onToggleDone={(done) => toggleDone(occ, done)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-hairline px-4 py-9 text-center">
          <p className="text-body text-muted">אין אירועים ביום הזה</p>
          <button
            type="button"
            onClick={onAddEvent}
            className="mt-3.5 inline-flex items-center gap-2 rounded-2xl bg-well px-5 py-3 text-label font-semibold text-ink"
          >
            <Plus size={ICON.md} />
            הוספת אירוע
          </button>
        </div>
      )}

      {/*
        כניסה לתצוגת היום המלאה - זמני היום, פרשה ועומר, והאירועים
        בפירוט מלא עם ההערות. היא ישבה בראש החלונית ככרטיס בגובה של
        אירוע, עם "לתצוגת יום מורחבת" שלא אמר מה יש שם, ודחקה את
        האירועים עצמם למטה. עכשיו היא שורה קטנה אחריהם, והשם אומר מה
        מקבלים.
      */}
      <button
        type="button"
        onClick={onOpenDay}
        className="flex w-full items-center gap-2.5 rounded-xl bg-well px-3.5 py-2.5 text-right transition-colors active:bg-hairline"
      >
        <Sun size={ICON.md} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-caption">
          <span className="font-medium text-ink">זמני היום ופרטים מלאים</span>
          <span className="text-muted"> · {day.hebrewFull}</span>
        </span>
        <ChevronLeft size={ICON.md} className="shrink-0 text-faint" />
      </button>
    </div>
  );
}

/** סיכום קצר לשורת הידית. */
function summaryOf(day: DayInfo | undefined, count: number): string {
  if (!day) return '';
  const parts: string[] = [];
  if (count) parts.push(count === 1 ? 'אירוע אחד' : `${count} אירועים`);
  if (day.holidays.length) parts.push(day.holidays[0].title);
  else if (day.parsha) parts.push(`פרשת ${day.parsha}`);
  if (!parts.length) parts.push('אין אירועים');
  return parts.join(' · ');
}

/* ==========================================================================
   עמודה קבועה - מסכים רחבים
   ========================================================================== */

export function DockedDayPanel(props: ContentProps) {
  const { day, onAddEvent } = props;
  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-3xl bg-surface shadow-raised xl:w-[420px]">
      {/*
        ההוספה יושבת בכותרת החלונית ולא בכותרת המסך, בדיוק כמו בטלפון:
        המקום שבו רואים את היום הוא המקום שבו מוסיפים לו.
      */}
      <header className="flex shrink-0 items-center gap-3 border-b border-hairline px-5 py-5">
        <span className="min-w-0 flex-1">
          <h2 className="truncate font-display text-k-heading font-bold leading-none text-ink">
            {day ? <DisplayText text={relativeDayLabel(day.date)} /> : ''}
          </h2>
          {/* הלועזי רק כשהכותרת היא "היום" או "מחר", אחרת הוא כבר שם */}
          <p className="mt-1.5 truncate text-caption text-muted">
            {day
              ? [
                  relativeDayLabel(day.date) !== dayTitleLabel(day.date)
                    ? dayTitleLabel(day.date)
                    : null,
                  day.hebrewFull,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : ''}
          </p>
        </span>
        <motion.button
          type="button"
          onClick={onAddEvent}
          whileTap={{ scale: 0.9 }}
          transition={SNAP}
          aria-label="אירוע חדש ביום הזה"
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-well text-ink"
        >
          <Plus size={ICON.lg} />
        </motion.button>
      </header>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <DayPanelContent {...props} />
      </div>
    </aside>
  );
}

/* ==========================================================================
   חלונית נגררת - טלפון
   ========================================================================== */

export function EventsPanel({
  day,
  occurrences,
  detent,
  onDetentChange,
  onOpenDay,
  onAddEvent,
  onEditEvent,
  onMoveEvent,
  onPlaceTemplate,
  showTemplates,
  bottomInset,
}: ContentProps & {
  detent: PanelDetent;
  onDetentChange: (next: PanelDetent) => void;
  /**
   * גובה סרגל הלשוניות מהתחתית. החלונית יורדת עד קצה המסך והסרגל צף
   * מעליה, ולכן הוא מתווסף לגבהים שלה ולריפוד התוכן - לא למיקום.
   */
  bottomInset: number;
}) {
  const { ref, height } = useElementSize<HTMLDivElement>();
  const open = detent !== 'peek';
  // חלונית פתוחה היא מצב שאפשר לחזור ממנו, בדיוק כמו גיליון
  useOverlayHistory(open, () => onDetentChange('peek'));

  const y = useMotionValue(0);
  const collapsedY = Math.max(0, height - (PEEK_HEIGHT + bottomInset));
  const halfY = Math.max(0, height - Math.min(HALF_HEIGHT + bottomInset, height));
  const targetY = detent === 'full' ? 0 : detent === 'half' ? halfY : collapsedY;

  /*
    בסוף הגרירה נבחרת העצירה הקרובה ביותר למקום שאליו התנועה מכוונת,
    ולא למקום שבו האצבע עזבה: זריקה מהירה כלפי מעלה מתכוונת לפתוח את
    החלונית גם אם היא הספיקה לזוז 20px בלבד.
  */
  const onDragEnd = ({ velocity }: AxisDragInfo) => {
    const projected = y.get() + velocity * FLING_PROJECTION;
    const stops: [PanelDetent, number][] = [
      ['full', 0],
      ['half', halfY],
      ['peek', collapsedY],
    ];
    let best = stops[0];
    for (const stop of stops) {
      if (Math.abs(stop[1] - projected) < Math.abs(best[1] - projected)) best = stop;
    }
    // אותה עצירה אינה משנה את `animate`, ולכן החזרה אליה נעשית כאן
    if (best[0] === detent) {
      animate(y, targetY, { ...(GLIDE as ValueAnimationTransition<number>), velocity });
    } else onDetentChange(best[0]);
  };
  // לא `drag` של framer: ראו useAxisDrag - הוא מודד את המסך בכל הקשה על יום
  const drag = useAxisDrag({
    axis: 'y',
    value: y,
    min: 0,
    max: collapsedY,
    elastic: { min: 0.02, max: 0.06 },
    onEnd: onDragEnd,
  });
  const { scrollRef, panelRef, handleProps, panelProps } = useSheetDrag(drag);

  // שני ref-ים על אותו אלמנט: מדידת הגובה, ומאזיני המגע של המשיכה
  const attachPanel = useCallback(
    (node: HTMLDivElement | null) => {
      (ref as MutableRefObject<HTMLDivElement | null>).current = node;
      panelRef(node);
    },
    [ref, panelRef],
  );

  // שומרים את נקודת הקיפול ב-ref כדי שהטרנספורם יקרא ערך עדכני
  // בלי ליצור את עצמו מחדש בכל מדידה.
  const collapsedRef = useRef(collapsedY);
  collapsedRef.current = collapsedY;

  // שקיפות התוכן נגזרת ממיקום הגרירה בפועל: התוכן מתגלה תוך כדי המשיכה
  // ולא קופץ בסופה. זהו motion value, ולכן אין רינדור מחדש תוך כדי תנועה.
  const contentOpacity = useTransform(y, (v) => {
    const collapsed = collapsedRef.current;
    if (collapsed <= 0) return 1;
    const progress = (collapsed - v) / FADE_DISTANCE;
    return Math.min(1, Math.max(0, progress));
  });

  return (
    <motion.div
      ref={attachPanel}
      className="absolute inset-x-0 bottom-0 z-30 mx-auto flex max-w-[640px] flex-col rounded-t-sheet border-t border-hairline bg-surface shadow-overlay"
      style={{ y, height: `calc(64svh + ${bottomInset}px)`, willChange: 'transform' }}
      animate={{ y: targetY }}
      transition={GLIDE}
      {...panelProps}
    >
      {/*
        שורת הידית, ובה גם ההוספה.

        קודם הכפתור היחיד להוספה ישב בתוך מצב הריקנות, בתחתית התוכן -
        וביום שיש בו גם מועד וגם זמני כניסה ויציאה, כלומר כל שבת וכל
        חג, הוא נדחף אל מתחת לקצה. מי שהקיש על יום כדי להוסיף בו משהו
        היה צריך לגרור עוד.

        כאן הוא אינו תלוי באורך התוכן בכלל: השורה הזו אינה זזה, והיא
        גלויה בכל עצירה - כולל המקופלת. זה גם מכסה יום שכבר יש בו
        אירועים, שבו מצב הריקנות אינו מצויר ולא היה שם כפתור בכלל.

        הוא אחות של הידית ולא בתוכה, כי `handleProps` מתחיל גרירה
        ב-pointerdown - וכפתור שיושב בתוך אזור הגרירה מאבד את ההקשה.
      */}
      {/* הידית עצמה יושבת מעל השורה, כדי שתישאר ממורכזת ברוחב החלונית */}
      <span
        aria-hidden="true"
        className="mx-auto mt-2.5 block h-1.5 w-12 shrink-0 rounded-full bg-hairline"
      />
      <div className="flex shrink-0 items-center">
        <button
        type="button"
        onClick={() => onDetentChange(open ? 'peek' : 'half')}
        aria-label={open ? 'סגירת אירועי היום' : 'פתיחת אירועי היום'}
        aria-expanded={open}
        className="focus-ring-inset min-w-0 flex-1 cursor-grab touch-none ps-5 pb-2.5 pt-2 text-right active:cursor-grabbing"
        {...handleProps}
      >
        <span className="flex items-center gap-3">
          {/* היום והסיכום בשורה אחת: זו שורת הצצה, לא כותרת מסך */}
          <span className="flex min-w-0 flex-1 items-baseline gap-2 truncate">
            <span className="shrink-0 text-body font-semibold leading-tight text-ink">
              {day ? relativeDayLabel(day.date) : ''}
            </span>
            <span className="truncate text-caption leading-tight text-muted">
              {summaryOf(day, occurrences.length)}
            </span>
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={SNAP}
            className="me-1 shrink-0 text-faint"
          >
            <ChevronUp size={ICON.xl} />
          </motion.span>
        </span>
        </button>

        <motion.button
          type="button"
          onClick={() => {
            void haptic('light');
            onAddEvent();
          }}
          whileTap={{ scale: 0.9 }}
          transition={SNAP}
          aria-label="אירוע חדש ביום הזה"
          className="focus-ring me-4 ms-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-well text-ink"
        >
          <Plus size={ICON.lg} />
        </motion.button>
      </div>

      <motion.div
        ref={scrollRef}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5"
        style={{
          opacity: contentOpacity,
          pointerEvents: open ? 'auto' : 'none',
          paddingBottom: bottomInset + 20,
        }}
      >
        <DayPanelContent
          day={day}
          occurrences={occurrences}
          onOpenDay={onOpenDay}
          onAddEvent={onAddEvent}
          onEditEvent={onEditEvent}
          onMoveEvent={onMoveEvent}
          onPlaceTemplate={onPlaceTemplate}
          showTemplates={showTemplates}
        />
      </motion.div>
    </motion.div>
  );
}
