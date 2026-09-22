/**
 * מנוע הלוח העברי - עוטף את @hebcal/core ומחזיר מבנה נתונים נוח לתצוגה.
 *
 * שני דברים חשובים:
 * 1. כל החישובים התלויים בשעה (הדלקת נרות, הבדלה, זמני היום) מתבססים על
 *    מזהה אזור זמן IANA, ולכן שעון קיץ/חורף מטופל אוטומטית ונכון לכל תאריך.
 * 2. מפתחות התאריכים הם לוקאליים (YYYY-MM-DD) ולא UTC, כדי שלא יהיו הזזות יום.
 */
import {
  HDate,
  HebrewCalendar,
  Locale,
  Location,
  Zmanim,
  flags,
  gematriya,
} from '@hebcal/core';
import type { Event } from '@hebcal/core';
import type {
  CalendarFilters,
  DateKey,
  DayInfo,
  GeoCity,
  HolidayKind,
  TimedItem,
} from '@/types';
import { addDays, dateKey, formatTimeInZone, isSameDay, isSameMonth } from './dates';

/** הלוקאל של hebcal שמחזיר עברית בלי ניקוד - נקי יותר לתצוגה. */
const HE = 'he-x-NoNikud';

/** אפשרויות הסינון שמגיעות מההגדרות. */
export type { CalendarFilters };

export function cityToLocation(city: GeoCity): Location {
  return new Location(
    city.latitude,
    city.longitude,
    city.il,
    city.tzid,
    city.name,
    city.il ? 'IL' : undefined,
    undefined,
    city.elevation,
  );
}

/* ==========================================================================
   תאריך עברי
   ========================================================================== */

export type HebrewDateParts = {
  day: string;
  month: string;
  year: string;
  full: string;
  dayNumber: number;
  monthNumber: number;
  yearNumber: number;
};

/** הופך שנה לועזית-נראית בסוף כיתוב ("ראש השנה 5787") לגימטריה. */
function prettifyTitle(title: string): string {
  return title.replace(/\s(\d{4})$/, (_m, y) => ` ${gematriya(Number(y))}`);
}

/**
 * מקצר כיתוב מועד לתא צר בלוח:
 * מסיר שנה עברית בסוף, מוותר על הסימון "(חוה״מ)", ומעדיף את השם שבסוגריים
 * כשהוא השם המשמעותי (למשל "הושענא רבה").
 */
function shortenTitle(title: string): string {
  let t = title.replace(/\s+ת[א-ת]{2}״[א-ת]$/, '');
  const paren = t.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (paren) {
    const [, base, inner] = paren;
    t = inner.includes('חוה') ? base : inner;
  }
  return t.trim();
}

const monthNameCache = new Map<string, string>();

function hebMonthName(hd: HDate): string {
  const raw = hd.getMonthName();
  const cached = monthNameCache.get(raw);
  if (cached) return cached;
  const translated = Locale.gettext(raw, HE) || raw;
  monthNameCache.set(raw, translated);
  return translated;
}

export function hebrewDateParts(date: Date | HDate): HebrewDateParts {
  const hd = date instanceof HDate ? date : new HDate(date);
  const day = gematriya(hd.getDate());
  const month = hebMonthName(hd);
  const year = gematriya(hd.getFullYear());
  return {
    day,
    month,
    year,
    full: `${day} ב${month} ${year}`,
    dayNumber: hd.getDate(),
    monthNumber: hd.getMonth(),
    yearNumber: hd.getFullYear(),
  };
}

/**
 * כיתוב החודשים העבריים שחודש לועזי פרוש עליהם,
 * לדוגמה "אלול–תשרי תשפ״ו" או "כסלו תשפ״ז".
 */
export function hebrewMonthSpanLabel(month: Date): string {
  const first = hebrewDateParts(new Date(month.getFullYear(), month.getMonth(), 1));
  const last = hebrewDateParts(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  if (first.month === last.month) return `${first.month} ${first.year}`;
  if (first.year === last.year) return `${first.month}–${last.month} ${first.year}`;
  return `${first.month} ${first.year} – ${last.month} ${last.year}`;
}

/** התאריך העברי שיתחיל הערב (אחרי השקיעה) - שימושי בתצוגת יום. */
export function hebrewDateAfterSunset(date: Date): HebrewDateParts {
  return hebrewDateParts(new HDate(addDays(date, 1)));
}

/* ==========================================================================
   סיווג מועדים
   ========================================================================== */

function classify(mask: number): HolidayKind {
  if (mask & flags.ROSH_CHODESH) return 'roshchodesh';
  if (mask & flags.PARSHA_HASHAVUA) return 'parsha';
  if (mask & flags.OMER_COUNT) return 'omer';
  // יום כיפור נושא גם את דגל החג וגם את דגל הצום. הוא יום טוב קודם כול:
  // אילו היה מסווג כצום, כיבוי הצומות בהגדרות היה מעלים אותו מהלוח.
  if (mask & flags.CHAG && !(mask & flags.EREV) && !(mask & flags.CHOL_HAMOED)) return 'yomtov';
  if (mask & flags.MAJOR_FAST) return 'majorfast';
  if (mask & flags.MINOR_FAST) return 'minorfast';
  if (mask & flags.SPECIAL_SHABBAT) return 'specialshabbat';
  if (mask & flags.MODERN_HOLIDAY) return 'modern';
  if (mask & flags.EREV) return 'erev';
  if (mask & flags.CHOL_HAMOED) return 'cholhamoed';
  if (mask & flags.CHAG) return 'yomtov';
  return 'minor';
}

/** האם ביום זה אסורה מלאכה (יום טוב; שבת מטופלת בנפרד לפי יום בשבוע). */
function isRestWork(mask: number): boolean {
  return Boolean(mask & flags.CHAG) && !(mask & flags.EREV) && !(mask & flags.CHOL_HAMOED);
}

/** דירוג חשיבות לצורך מה מוצג ראשון בתא צר בלוח. */
const KIND_RANK: Record<HolidayKind, number> = {
  yomtov: 0,
  majorfast: 1,
  cholhamoed: 2,
  minor: 3,
  modern: 4,
  minorfast: 5,
  erev: 6,
  specialshabbat: 7,
  roshchodesh: 8,
  parsha: 9,
  omer: 10,
};

export function holidayRank(kind: HolidayKind): number {
  return KIND_RANK[kind];
}

/**
 * מועדים מדרבנן שתמיד מוצגים כשהחגים היהודיים פעילים, גם אם המשתמש כיבה
 * "מועדים קטנים" (שמסתיר דברים כמו סליחות, פורים קטן, ט״ו באב).
 */
const CORE_MINOR =
  /^(Chanukah|Purim|Shushan Purim|Tu BiShvat|Lag BaOmer|Rosh Chodesh|Chag HaBanot)/;

/* ==========================================================================
   בניית הימים
   ========================================================================== */

type BuildOptions = CalendarFilters & { city: GeoCity };

function calOptions(start: Date, end: Date, o: BuildOptions) {
  const havdalah =
    o.havdalahMode === 'minutes'
      ? { havdalahMins: o.havdalahMins }
      : { havdalahDeg: o.havdalahDegrees };
  return {
    start,
    end,
    il: o.city.il,
    location: cityToLocation(o.city),
    locale: HE,
    candlelighting: o.showCandleTimes,
    candleLightingMins: o.candleLightingMins,
    ...havdalah,
    sedrot: o.showParsha,
    omer: o.showOmer,
    noHolidays: !o.showJewishHolidays,
    noModern: !o.showIsraeliHolidays,
    noMinorFast: !o.showFasts,
    noRoshChodesh: !o.showRoshChodesh,
    noSpecialShabbat: !o.showJewishHolidays,
    useElevation: false,
  };
}

function timedKind(desc: string): TimedItem['kind'] | null {
  switch (desc) {
    case 'Candle lighting':
      return 'candles';
    case 'Havdalah':
      return 'havdalah';
    case 'Fast begins':
      return 'fast-begins';
    case 'Fast ends':
      return 'fast-ends';
    default:
      return null;
  }
}

function isTimed(ev: Event): boolean {
  return typeof (ev as { eventTime?: Date }).eventTime !== 'undefined';
}

/* ==========================================================================
   מטמון
   ========================================================================== */

/**
 * חישוב חודש מול hebcal עולה כמה מילישניות, ועד כה הוא נעשה מחדש בכל
 * שינוי הגדרה ובכל חזרה לחודש שכבר נצפה. המטמון כאן שומר את התוצאה לפי
 * הטווח, חתימת הסינון והעיר.
 *
 * `isToday` תלוי בתאריך הנוכחי, ולכן מפתח היום נכנס לחתימה - אחרת מטמון
 * שנוצר לפני חצות יסמן את היום הלא נכון אחריו. גם קווי האורך והרוחב
 * נכנסים, כדי שעיר מותאמת אישית שהוחלפה תחת אותו מזהה לא תחזיר זמנים
 * של המיקום הקודם.
 *
 * המפה המוחזרת משותפת לכל הקוראים ואסור לשנות אותה במקום.
 */
const CACHE_LIMIT = 24;
const dayCache = new Map<string, Map<DateKey, DayInfo>>();

function cacheKey(start: Date, end: Date, o: BuildOptions, focusMonth?: Date): string {
  return [
    dateKey(start),
    dateKey(end),
    focusMonth ? dateKey(focusMonth) : '',
    dateKey(new Date()),
    o.city.id,
    o.city.latitude,
    o.city.longitude,
    o.city.tzid,
    o.city.il,
    o.showJewishHolidays,
    o.showIsraeliHolidays,
    o.showMinorHolidays,
    o.showFasts,
    o.showRoshChodesh,
    o.showParsha,
    o.showOmer,
    o.showCandleTimes,
    o.candleLightingMins,
    o.havdalahMode,
    o.havdalahDegrees,
    o.havdalahMins,
  ].join('|');
}

/** מרוקן את המטמון. לשימוש בדיקות ובאיפוס ידני. */
export function clearCalendarCache(): void {
  dayCache.clear();
}

/**
 * בונה מפה של DayInfo לכל יום בטווח.
 * הטווח כולל ימי גלישה, ולכן נשלח גם `focusMonth` כדי לסמן מה שייך לחודש.
 */
export function buildDays(
  start: Date,
  end: Date,
  options: BuildOptions,
  focusMonth?: Date,
): Map<DateKey, DayInfo> {
  const key = cacheKey(start, end, options, focusMonth);
  const cached = dayCache.get(key);
  if (cached) {
    // רענון סדר ה-LRU: הנצפה לאחרונה חוזר לסוף
    dayCache.delete(key);
    dayCache.set(key, cached);
    return cached;
  }
  const built = computeDays(start, end, options, focusMonth);
  dayCache.set(key, built);
  if (dayCache.size > CACHE_LIMIT) {
    dayCache.delete(dayCache.keys().next().value!);
  }
  return built;
}

function computeDays(
  start: Date,
  end: Date,
  options: BuildOptions,
  focusMonth?: Date,
): Map<DateKey, DayInfo> {
  const today = new Date();
  const days = new Map<DateKey, DayInfo>();

  // שלב 1: שלד לכל יום בטווח
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const parts = hebrewDateParts(d);
    const key = dateKey(d);
    days.set(key, {
      key,
      date: d,
      hebrewDay: parts.day,
      hebrewMonth: parts.month,
      hebrewYear: parts.year,
      hebrewFull: parts.full,
      holidays: [],
      times: [],
      isRestDay: d.getDay() === 6,
      isShabbat: d.getDay() === 6,
      isToday: isSameDay(d, today),
      inCurrentMonth: focusMonth ? isSameMonth(d, focusMonth) : true,
    });
  }

  // שלב 2: מילוי מועדים וזמנים
  const events = HebrewCalendar.calendar(calOptions(start, end, options));
  for (const ev of events) {
    const greg = ev.getDate().greg();
    const day = days.get(dateKey(greg));
    if (!day) continue;

    const mask = ev.getFlags();
    const kindFromTime = timedKind(ev.getDesc());

    if (kindFromTime && isTimed(ev)) {
      const at = (ev as unknown as { eventTime: Date }).eventTime;
      day.times.push({
        id: `${day.key}-${kindFromTime}`,
        title: ev.renderBrief(HE),
        time: formatTimeInZone(at, options.city.tzid),
        at: at.getTime(),
        kind: kindFromTime,
        subject: (ev as unknown as { linkedEvent?: Event }).linkedEvent?.renderBrief(HE),
      });
      continue;
    }

    const kind = classify(mask);

    if (kind === 'parsha') {
      day.parsha = ev.renderBrief(HE).replace(/^פרשת\s+/, '');
      continue;
    }
    if (kind === 'omer') {
      const omerEv = ev as unknown as { omer?: number };
      day.omerDay = omerEv.omer ?? undefined;
      continue;
    }
    if (kind === 'majorfast' && !options.showFasts) continue;
    if (kind === 'minor' && !options.showMinorHolidays && !CORE_MINOR.test(ev.getDesc()))
      continue;

    const title = prettifyTitle(ev.renderBrief(HE));
    day.holidays.push({
      id: ev.getDesc(),
      title,
      shortTitle: shortenTitle(title),
      kind,
      emoji: ev.getEmoji() ?? undefined,
      restWork: isRestWork(mask),
    });
    if (isRestWork(mask)) day.isRestDay = true;
  }

  // שלב 3: מיון פנימי לפי חשיבות
  for (const day of days.values()) {
    day.holidays.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]);
    day.times.sort((a, b) => a.at - b.at);
  }

  return days;
}

/** DayInfo ליום בודד (לתצוגת יום מורחבת). */
export function buildDay(date: Date, options: BuildOptions): DayInfo {
  const map = buildDays(date, date, options, date);
  return map.get(dateKey(date))!;
}

/* ==========================================================================
   שבת וחגים - טאב הזמנים
   ========================================================================== */

export type ShabbatEntry = {
  /** מפתח היום שבו נכנסת השבת/החג (ערב) */
  startKey: DateKey;
  startDate: Date;
  /** מפתח היום שבו יוצאת השבת/החג */
  endKey: DateKey;
  endDate: Date;
  /** "שבת פרשת ויגש" / "ראש השנה" */
  title: string;
  parsha?: string;
  /** מועדים החלים בטווח */
  holidays: string[];
  candles?: TimedItem;
  havdalah?: TimedItem;
  /** היום הראשון בטווח הוא יום טוב */
  isHoliday: boolean;
  /**
   * היום האחרון בטווח הוא יום טוב.
   *
   * נפרד מ-`isHoliday` כי הטווח יכול להיכנס כחג ולצאת כשבת, או להפך:
   * ראש השנה תשפ״ז נכנס בערב שבת ויוצא במוצאי יום ראשון. בלי ההבחנה
   * הזו "צאת השבת" היה מוצג על יציאה שאינה של שבת.
   */
  endsHoliday: boolean;
};

/** מסנן את מה שאינו יום טוב בפני עצמו: ערבי חג, ראש חודש, שבתות מיוחדות. */
function yomTovOnly(names: string[]): string[] {
  return names.filter(
    (h) => !h.startsWith('ערב ') && !h.includes('ראש חודש') && !h.startsWith('שבת '),
  );
}

/**
 * איך קוראים לכניסה וליציאה של הטווח.
 *
 * עד עכשיו הכרטיס אמר "הדלקת נרות" ו"צאת השבת" תמיד - גם על יום כיפור
 * וגם על סוכות, כלומר על רוב המועדים הוא היה שקר קטן. הניסוח נגזר ממה
 * שבאמת נכנס באותו ערב וממה שבאמת יוצא בערב האחרון, ואלה לא בהכרח
 * אותו דבר.
 *
 * זמן הכניסה נשאר זמן הדלקת הנרות, כי זה גם זמן הכניסה הנהוג, ומה
 * שהשתנה הוא המילים. גם ביום טוב שנכנס במוצאי שבת hebcal נותן זמן
 * הדלקה - ושם הוא זמן הכניסה.
 */
export function occasionLabels(entry: ShabbatEntry): { entry: string; exit: string } {
  // הנרות נדלקים בערב, ולכן היום שנכנס הוא זה שאחרי `startDate`
  const entersShabbat = entry.startDate.getDay() === 5;
  const exitsShabbat = entry.endDate.getDay() === 6;
  return {
    entry: occasionName('כניסת', entersShabbat, entry.isHoliday),
    exit: occasionName('צאת', exitsShabbat, entry.endsHoliday),
  };
}

function occasionName(verb: string, shabbat: boolean, holiday: boolean): string {
  if (shabbat && holiday) return `${verb} השבת והחג`;
  if (holiday) return `${verb} החג`;
  return `${verb} השבת`;
}

/**
 * מחזיר את רשימת "כניסות ויציאות" הקרובות - שבתות וימים טובים גם יחד,
 * בסדר כרונולוגי, החל מהתאריך הנתון.
 */
export function upcomingShabbatot(
  from: Date,
  weeks: number,
  options: BuildOptions,
): ShabbatEntry[] {
  const start = addDays(from, -1);
  const end = addDays(from, weeks * 7 + 8);
  const opts: BuildOptions = { ...options, showCandleTimes: true, showParsha: true };
  const events = HebrewCalendar.calendar(calOptions(start, end, opts));

  const entries: ShabbatEntry[] = [];
  let current: ShabbatEntry | null = null;
  const parshaByKey = new Map<DateKey, string>();
  const holidayByKey = new Map<DateKey, string[]>();

  for (const ev of events) {
    const greg = ev.getDate().greg();
    const key = dateKey(greg);
    const mask = ev.getFlags();
    if (mask & flags.PARSHA_HASHAVUA) {
      parshaByKey.set(key, ev.renderBrief(HE).replace(/^פרשת\s+/, ''));
    } else if (!isTimed(ev)) {
      const kind = classify(mask);
      if (kind === 'omer') continue;
      const arr = holidayByKey.get(key) ?? [];
      arr.push(ev.renderBrief(HE));
      holidayByKey.set(key, arr);
    }
  }

  for (const ev of events) {
    if (!isTimed(ev)) continue;
    const kind = timedKind(ev.getDesc());
    if (kind !== 'candles' && kind !== 'havdalah') continue;
    const greg = ev.getDate().greg();
    const key = dateKey(greg);
    const at = (ev as unknown as { eventTime: Date }).eventTime;
    const item: TimedItem = {
      id: `${key}-${kind}`,
      title: ev.renderBrief(HE),
      time: formatTimeInZone(at, options.city.tzid),
      at: at.getTime(),
      kind,
    };

    if (kind === 'candles') {
      // הדלקת נרות פותחת רשומה חדשה (אלא אם זו הדלקה שנייה של יו"ט רצוף)
      if (current && !current.havdalah) {
        current.holidays.push(...(holidayByKey.get(key) ?? []));
        continue;
      }
      current = {
        startKey: key,
        startDate: greg,
        endKey: key,
        endDate: greg,
        title: '',
        candles: item,
        holidays: [...(holidayByKey.get(key) ?? [])],
        isHoliday: false,
        endsHoliday: false,
      };
      entries.push(current);
    } else if (current) {
      current.havdalah = item;
      current.endKey = key;
      current.endDate = greg;
      current.holidays.push(...(holidayByKey.get(key) ?? []));
      // פרשת השבוע של השבת שבטווח
      for (let d = current.startDate; d <= greg; d = addDays(d, 1)) {
        const p = parshaByKey.get(dateKey(d));
        if (p) current.parsha = p;
      }
      current = null;
    }
  }

  for (const e of entries) {
    // הכותרת נקבעת לפי היום שמתחיל בהדלקת הנרות, כלומר היום שאחרי הערב.
    const openingDayKey = dateKey(addDays(e.startDate, 1));
    const opening = (holidayByKey.get(openingDayKey) ?? []).filter(
      (h) => !h.startsWith('ערב ') && !h.includes('ראש חודש'),
    );
    // היום שבו מבדילים הוא היום האחרון בטווח, וממנו נגזר ניסוח היציאה
    const closing = yomTovOnly(holidayByKey.get(e.endKey) ?? []);

    const all: string[] = [];
    for (let d = addDays(e.startDate, 1); d <= e.endDate; d = addDays(d, 1)) {
      all.push(...(holidayByKey.get(dateKey(d)) ?? []));
    }
    e.holidays = [...new Set(all)]
      .filter((h) => !h.startsWith('ערב '))
      .map(prettifyTitle);

    const yomTov = opening.find((h) => !h.startsWith('שבת '));
    e.isHoliday = Boolean(yomTov);
    e.endsHoliday = closing.length > 0;
    if (yomTov) e.title = prettifyTitle(yomTov);
    else if (e.parsha) e.title = `שבת פרשת ${e.parsha}`;
    else e.title = 'שבת';
  }

  return entries.filter((e) => e.candles && e.endDate >= addDays(from, -1));
}

/* ==========================================================================
   זמני היום
   ========================================================================== */

export type DayZmanim = {
  alotHaShachar: string;
  misheyakir: string;
  sunrise: string;
  sofZmanShma: string;
  sofZmanTfilla: string;
  chatzot: string;
  minchaGedola: string;
  minchaKetana: string;
  plagHaMincha: string;
  sunset: string;
  tzeit: string;
};

export function dayZmanim(date: Date, city: GeoCity): DayZmanim {
  const z = new Zmanim(cityToLocation(city), date, false);
  const f = (d: Date) => formatTimeInZone(d, city.tzid);
  return {
    alotHaShachar: f(z.alotHaShachar()),
    misheyakir: f(z.misheyakir()),
    sunrise: f(z.sunrise()),
    sofZmanShma: f(z.sofZmanShma()),
    sofZmanTfilla: f(z.sofZmanTfilla()),
    chatzot: f(z.chatzot()),
    minchaGedola: f(z.minchaGedola()),
    minchaKetana: f(z.minchaKetana()),
    plagHaMincha: f(z.plagHaMincha()),
    sunset: f(z.sunset()),
    tzeit: f(z.tzeit(8.5)),
  };
}

export const ZMANIM_LABELS: Record<keyof DayZmanim, string> = {
  alotHaShachar: 'עלות השחר',
  misheyakir: 'משיכיר',
  sunrise: 'זריחה',
  sofZmanShma: 'סוף זמן ק״ש',
  sofZmanTfilla: 'סוף זמן תפילה',
  chatzot: 'חצות היום',
  minchaGedola: 'מנחה גדולה',
  minchaKetana: 'מנחה קטנה',
  plagHaMincha: 'פלג המנחה',
  sunset: 'שקיעה',
  tzeit: 'צאת הכוכבים',
};

/* ==========================================================================
   חגים בשנה (לתצוגת שנה / רשימת מועדים)
   ========================================================================== */

export type YearHoliday = {
  key: DateKey;
  date: Date;
  title: string;
  kind: HolidayKind;
  emoji?: string;
  hebrewDate: string;
};

export function yearHolidays(gregYear: number, options: BuildOptions): YearHoliday[] {
  const events = HebrewCalendar.calendar({
    ...calOptions(new Date(gregYear, 0, 1), new Date(gregYear, 11, 31), {
      ...options,
      showCandleTimes: false,
      showParsha: false,
      showOmer: false,
      showRoshChodesh: false,
    }),
  });
  const out: YearHoliday[] = [];
  for (const ev of events) {
    if (isTimed(ev)) continue;
    const mask = ev.getFlags();
    const kind = classify(mask);
    if (kind === 'parsha' || kind === 'omer' || kind === 'specialshabbat') continue;
    const greg = ev.getDate().greg();
    const parts = hebrewDateParts(ev.getDate());
    out.push({
      key: dateKey(greg),
      date: greg,
      title: prettifyTitle(ev.renderBrief(HE)),
      kind,
      emoji: ev.getEmoji() ?? undefined,
      hebrewDate: `${parts.day} ב${parts.month}`,
    });
  }
  return out;
}
