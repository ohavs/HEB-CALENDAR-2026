/** טאב זמני כניסת ויציאת שבת וחג. */
import { useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Moon, Sunset } from '@/components/ui/icons';
import { occasionLabels, upcomingShabbatot, type ShabbatEntry } from '@/lib/hebrew';
import { GREG_MONTHS_HE, startOfDay, weekdayDateLabel } from '@/lib/dates';
import { findCity } from '@/lib/locations';
import { toFilters, useSettings } from '@/store/settings';
import { ENTER, ICON, TAP, TAP_SCALE } from '@/lib/motion';
import type { Settings } from '@/types';
import { DisplayText } from './ui/DisplayText';

/** "מתקיים כעת", "בעוד 4 שעות", "מחר", "בעוד יומיים" */
function countdownLabel(entry: ShabbatEntry, now = Date.now()): string {
  const start = entry.candles?.at;
  const end = entry.havdalah?.at;
  if (start === undefined) return '';
  if (start <= now) return end && end > now ? 'מתקיים כעת' : 'הסתיים';
  const diff = start - now;
  const hours = diff / 3_600_000;
  if (hours < 1) return `בעוד ${Math.max(1, Math.round(diff / 60_000))} דקות`;
  if (hours < 24) return `בעוד ${Math.round(hours)} שעות`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'מחר';
  if (days === 2) return 'בעוד יומיים';
  return `בעוד ${days} ימים`;
}

/**
 * "18-19 בספטמבר", או "30 בספטמבר - 1 באוקטובר" כשהחודש מתחלף.
 *
 * ברשימה של שמונה שורות התאריך הוא מה שמפריד ביניהן, ולכן הוא קצר
 * ומודגש: "יום שישי, 18 בספטמבר - שבת, 19 בספטמבר" נקרא כמשפט ולא
 * כתאריך, וכל השורות נראו אותו דבר.
 */
function rangeLabel(start: Date, end: Date): string {
  const day = (d: Date) => d.getDate();
  const month = (d: Date) => GREG_MONTHS_HE[d.getMonth()];
  if (start.getTime() === end.getTime()) return `${day(start)} ב${month(start)}`;
  if (start.getMonth() === end.getMonth()) {
    return `${day(start)}–${day(end)} ב${month(start)}`;
  }
  return `${day(start)} ב${month(start)} – ${day(end)} ב${month(end)}`;
}

/**
 * השבתות והחגים שהמסך מציג. מיוצא כדי ש-App יחשב אותם מראש ברגע שקט
 * (`whenIdle`) - באותם ארגומנטים בדיוק, ולכן לתוך אותו מפתח במטמון של
 * `upcomingShabbatot`. בלי זה הכניסה הראשונה ללשונית חישבה עשרה שבועות
 * של זמנים בתוך המעבר עצמו.
 */
export function shabbatEntries(settings: Settings) {
  return upcomingShabbatot(startOfDay(new Date()), 10, {
    ...toFilters(settings),
    city: findCity(settings.cityId),
    showCandleTimes: true,
  });
}

export function ShabbatScreen({
  onPickCity,
  bottomInset,
}: {
  onPickCity: () => void;
  bottomInset: number;
}) {
  const settings = useSettings();
  const city = findCity(settings.cityId);

  const entries = useMemo(() => shabbatEntries(settings), [settings]);

  const [next, ...rest] = entries;
  /*
    הניסוח נגזר מהמועד עצמו ולא קבוע: "הדלקת נרות" ו"צאת השבת" נכתבו
    כאן תמיד, גם על יום כיפור. ראו `occasionLabels`.
  */
  const nextLabels = next ? occasionLabels(next) : { entry: '', exit: '' };

  return (
    <div
      className="no-scrollbar app-shell-narrow flex-1 overflow-y-auto overscroll-contain gutter-x"
      style={{ paddingBottom: bottomInset + 24 }}
    >
      <header className="safe-t flex items-center gap-3 pb-5 pt-5 lg:pt-8">
        <div className="min-w-0 flex-1">
          <h1 className="screen-title">שבת וחגים</h1>
          <p className="mt-1.5 text-caption text-muted">
            זמנים מדויקים כולל שעון קיץ וחורף
          </p>
        </div>
        <motion.button
          type="button"
          onClick={onPickCity}
          whileTap={TAP_SCALE}
          transition={TAP}
          className="focus-ring flex h-11 shrink-0 items-center gap-2 rounded-full bg-well px-4 text-label font-semibold text-ink"
        >
          <MapPin size={ICON.sm} className="text-muted" />
          {city.name}
        </motion.button>
      </header>

      {next && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={ENTER}
          className="mb-8 rounded-card bg-surface px-5 pb-6 pt-5 shadow-raised"
        >
          {/*
            שם הפרשה או המועד ב-Karantina, בלי פס דיו מעליו: הפס היה הדבר
            הכהה ביותר במסך, ומשך את העין מהשעות - שבשבילן המסך נפתח ביום
            שישי אחר הצהריים. הספירה לאחור היא תג שקט לצידו.
          */}
          <div className="flex items-start gap-3">
            <h2 className="min-w-0 flex-1 font-display text-k-heading font-bold text-ink">
              <DisplayText text={next.title} />
            </h2>
            {next.candles && (
              <span className="mt-1 shrink-0 rounded-full bg-well px-3 py-1 text-caption font-semibold text-muted">
                {countdownLabel(next)}
              </span>
            )}
          </div>

          {/*
            שתי השעות זו לצד זו, בספרות ענק של Heebo (ספרות Karantina
            נקראות כאותיות). הענבר רק על הנר - צבע שמור למשמעות, והנר
            הוא הדבר היחיד כאן שבאמת יש לו צבע.
          */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <TimeBlock
              icon={<Sunset size={ICON.sm} className="text-shabbat" />}
              label={nextLabels.entry}
              time={next.candles?.time}
              date={weekdayDateLabel(next.startDate)}
            />
            <TimeBlock
              icon={<Moon size={ICON.sm} className="text-muted" />}
              label={nextLabels.exit}
              time={next.havdalah?.time}
              date={weekdayDateLabel(next.endDate)}
            />
          </div>

          {/*
            צ׳יפ הפרשה ירד: הכותרת כבר אומרת "שבת פרשת האזינו", והצ׳יפ
            חזר על אותן מילים בשורה נפרדת. מה שנשאר הוא מה שהכותרת לא
            אומרת - שבת שובה, חול המועד וכדומה.
          */}
          {next.holidays.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {next.holidays.map((h) => (
                <span
                  key={h}
                  className="rounded-full bg-well px-3 py-1.5 text-caption font-medium text-muted"
                >
                  {h}
                </span>
              ))}
            </div>
          )}
        </motion.section>
      )}

      <h3 className="mb-2.5 px-1 font-display text-k-title font-bold text-ink">המועדים הבאים</h3>

      {/*
        הרשימה שקטה בכוונה: בלי צל ובלי כרטיס מורם, על `well`. היא עונה
        על "ובשבוע הבא?", והכרטיס שמעליה הוא התשובה לשאלה שבאמת נשאלת.
      */}
      <div className="mb-4 divide-y divide-hairline overflow-hidden rounded-group bg-well">
        {rest.map((entry, i) => (
          <motion.div
            key={entry.startKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.25), duration: 0.26 }}
            className="flex min-h-[64px] items-center gap-4 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              {/* התאריך קודם ומודגש: ברשימה של שמונה שורות הוא מה שמפריד ביניהן */}
              <p className="truncate text-label font-semibold text-ink">
                {rangeLabel(entry.startDate, entry.endDate)}
              </p>
              <p className="mt-0.5 truncate text-caption text-muted">{entry.title}</p>
            </div>
            {/*
              אותם שני אייקונים של הכרטיס העליון. בלעדיהם שני הזמנים
              מוצגים זה מעל זה בלי תווית, והקורא צריך לנחש מי מהם כניסה.
            */}
            <div className="shrink-0 text-left">
              <p className="flex items-center justify-end gap-1.5">
                <span className="tnum text-title font-bold leading-tight text-ink">
                  {entry.candles?.time ?? '—'}
                </span>
                <Sunset
                  size={ICON.sm}
                  className="text-shabbat"
                  aria-label={occasionLabels(entry).entry}
                />
              </p>
              <p className="mt-1 flex items-center justify-end gap-1.5">
                <span className="tnum text-label font-semibold leading-tight text-muted">
                  {entry.havdalah?.time ?? '—'}
                </span>
                <Moon
                  size={ICON.sm}
                  className="text-muted"
                  aria-label={occasionLabels(entry).exit}
                />
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="px-1 pb-3 text-caption leading-relaxed text-muted">
        הדלקת נרות {settings.candleLightingMins} דקות לפני השקיעה.{' '}
        {settings.havdalahMode === 'degrees'
          ? `הבדלה בצאת הכוכבים (${settings.havdalahDegrees}°).`
          : `הבדלה ${settings.havdalahMins} דקות לאחר השקיעה.`}{' '}
        אפשר לשנות בהגדרות. הזמנים מחושבים לפי אזור הזמן של {city.name}.
      </p>
    </div>
  );
}

/** כניסה או יציאה: תווית קטנה, שעה ענקית, והיום מתחת. */
function TimeBlock({
  icon,
  label,
  time,
  date,
}: {
  icon: ReactNode;
  label: string;
  time: string | undefined;
  date: string;
}) {
  return (
    <div className="rounded-group bg-well px-4 pb-4 pt-3.5">
      <p className="flex items-center gap-1.5 text-caption font-medium text-muted">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p className="tnum mt-2 text-hero font-bold tracking-tight text-ink">{time ?? '—'}</p>
      <p className="mt-2 truncate text-caption text-muted">{date}</p>
    </div>
  );
}
