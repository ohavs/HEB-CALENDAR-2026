/**
 * הנתונים שהוידג׳טים במסך הבית קוראים.
 *
 * וידג׳ט באנדרואיד אינו מריץ את קוד האפליקציה - הוא מצויר על ידי מערכת
 * ההפעלה מתוך RemoteViews, בתהליך אחר, גם כשהאפליקציה סגורה. לכן אין לו
 * שום דרך לקרוא ל-hebcal או להרחיב אירועים חוזרים. במקום זה האפליקציה
 * מחשבת הכול מראש וכותבת JSON שטוח, והוידג׳ט רק מצייר אותו.
 *
 * מכאן שתי מגבלות שמעצבות את המבנה:
 *
 * 1. **הכול מחרוזות מוכנות להצגה.** אין בצד השני מי שיעצב תאריך עברי או
 *    יחשב "היום". גם `label` וגם `time` מגיעים ערוכים.
 * 2. **גודל.** ה-JSON נשמר ב-SharedPreferences ונקרא בכל ציור מחדש, ולכן
 *    יש תקרות מפורשות על מספר הפריטים.
 *
 * המזהה של פריט תזכורת הוא `baseId|sourceKey`, כי סימון "בוצע" שייך
 * למופע ולא לאירוע. הצד הנייטיבי מחזיר אותו כמות שהוא.
 */
import type { DateKey, DayInfo, HolidayKind, UserEvent } from '@/types';
import type { Occurrence } from './recurrence';
import {
  addDays,
  dateKey,
  monthLabel,
  relativeDayLabel,
  startOfDay,
  GREG_MONTHS_HE,
  WEEKDAYS_HE,
} from './dates';
import { hebrewDateParts, hebrewMonthSpanLabel, type ShabbatEntry } from './hebrew';
import { buildReminderGroups } from './reminders';

/** כמה ימים קדימה נאספות תזכורות */
export const REMINDER_HORIZON_DAYS = 21;
/** תקרת פריטים בוידג׳ט התזכורות */
const MAX_REMINDERS = 40;
/** תקרת שורות ברשימת "הקרוב" של וידג׳ט הלוח */
const MAX_UPCOMING = 12;
/** כמה כניסות ויציאות נשמרות לוידג׳ט השבת */
const MAX_SHABBATOT = 8;
/** תקרת פריטים לכל רשימה משותפת */
const MAX_SHARED_ITEMS = 30;
/** כמה רשימות משותפות נשמרות. יותר מזה - איש לא בוחר מהן בוידג׳ט */
const MAX_SHARED_LISTS = 8;

/** תא אחד ברשת החודש. שמות קצרים בכוונה - הקובץ נקרא בכל ציור. */
export type WidgetCell = {
  /** מפתח התאריך, לפתיחת היום מהוידג׳ט */
  k: DateKey;
  /** מספר היום הלועזי */
  n: number;
  /** מספר היום העברי, גימטריה */
  h: string;
  /** מחוץ לחודש המוצג */
  out?: true;
  today?: true;
  shabbat?: true;
  /** סוג המועד, לנקודה הצבעונית */
  kind?: 'yomtov' | 'holiday' | 'fast' | 'roshchodesh';
  /** כמה אירועים של המשתמש יש ביום */
  ev?: number;
};

export type WidgetUpcoming = {
  k: DateKey;
  /** "היום", "מחר", או "14 בספטמבר" */
  day: string;
  title: string;
  /** שעה, או ריק לאירוע של כל היום ולמועד */
  time: string;
  holiday?: true;
};

export type CalendarWidgetData = {
  updatedAt: number;
  today: DateKey;
  /** "ספטמבר 2026" */
  month: string;
  /** "אלול תשפ״ו – תשרי תשפ״ז" */
  hebrewMonth: string;
  weekdays: string[];
  cells: WidgetCell[];
  upcoming: WidgetUpcoming[];
};

export type WidgetReminder = {
  /** `baseId|sourceKey` - המזהה שחוזר מהוידג׳ט בסימון */
  id: string;
  title: string;
  /** שעה, או ריק לאירוע של כל היום */
  time: string;
  done?: true;
  /** שם צבע האירוע, לנקודה בצד */
  color: string;
};

export type ReminderGroup = {
  k: DateKey;
  /** "היום", "מחר", "יום שני, 21 בספטמבר" */
  label: string;
  /** התאריך העברי, שורה משנית */
  hebrew: string;
  items: WidgetReminder[];
};

export type RemindersWidgetData = {
  updatedAt: number;
  groups: ReminderGroup[];
  /** כמה פתוחות בסך הכול, לכותרת */
  open: number;
};

/** מזהה מופע כפי שהוא עובר לצד הנייטיבי וחוזר ממנו. */
export function occurrenceRef(occurrence: Occurrence): string {
  return `${occurrence.baseId}|${occurrence.sourceKey}`;
}

/** מפרק מזהה שחזר מהוידג׳ט. מחזיר null למזהה פגום. */
export function parseOccurrenceRef(ref: string): { baseId: string; sourceKey: DateKey } | null {
  const at = ref.lastIndexOf('|');
  if (at <= 0 || at === ref.length - 1) return null;
  return { baseId: ref.slice(0, at), sourceKey: ref.slice(at + 1) as DateKey };
}

/** הקטגוריה הגסה של מועד, לנקודה בתא. null למה שאינו מסומן בלוח. */
function cellKind(kind: HolidayKind): WidgetCell['kind'] | undefined {
  switch (kind) {
    case 'yomtov':
      return 'yomtov';
    case 'cholhamoed':
    case 'erev':
    case 'minor':
    case 'specialshabbat':
      return 'holiday';
    case 'majorfast':
    case 'minorfast':
      return 'fast';
    case 'roshchodesh':
      return 'roshchodesh';
    default:
      return undefined;
  }
}

/** המועד החשוב ביותר ביום, אם יש. הרשימה כבר ממוינת לפי חשיבות. */
function leadHoliday(day: DayInfo) {
  return day.holidays[0];
}

/**
 * בונה את נתוני וידג׳ט הלוח.
 *
 * @param gridDays 42 ימי רשת החודש, כפי שהאפליקציה מחשבת אותם
 * @param days מפת המידע לכל יום
 * @param occurrences מפת מופעי האירועים לפי תאריך
 */
export function buildCalendarWidget(
  month: Date,
  gridDays: Date[],
  days: Map<DateKey, DayInfo>,
  occurrences: Map<DateKey, Occurrence[]>,
  now = new Date(),
): CalendarWidgetData {
  const todayKey = dateKey(now);

  const cells: WidgetCell[] = gridDays.map((date) => {
    const k = dateKey(date);
    const info = days.get(k);
    const cell: WidgetCell = { k, n: date.getDate(), h: info?.hebrewDay ?? '' };
    if (date.getMonth() !== month.getMonth()) cell.out = true;
    if (k === todayKey) cell.today = true;
    if (date.getDay() === 6) cell.shabbat = true;
    const holiday = info && leadHoliday(info);
    const kind = holiday && cellKind(holiday.kind);
    if (kind) cell.kind = kind;
    const count = occurrences.get(k)?.filter((o) => !o.done).length ?? 0;
    if (count) cell.ev = count;
    return cell;
  });

  return {
    updatedAt: Date.now(),
    today: todayKey,
    month: monthLabel(month),
    hebrewMonth: hebrewMonthSpanLabel(month),
    weekdays: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
    cells,
    upcoming: buildUpcoming(days, occurrences, now),
  };
}

/** השורות הקרובות: אירועים ומועדים מהיום והלאה, מעורבבים לפי תאריך. */
function buildUpcoming(
  days: Map<DateKey, DayInfo>,
  occurrences: Map<DateKey, Occurrence[]>,
  now: Date,
): WidgetUpcoming[] {
  const from = startOfDay(now);
  const out: WidgetUpcoming[] = [];

  for (let i = 0; out.length < MAX_UPCOMING && i < 45; i += 1) {
    const date = addDays(from, i);
    const k = dateKey(date);
    const day = days.get(k);
    if (!day) continue;
    const label = relativeDayLabel(date);

    for (const holiday of day.holidays) {
      if (!cellKind(holiday.kind)) continue;
      out.push({ k, day: label, title: holiday.title, time: '', holiday: true });
      if (out.length >= MAX_UPCOMING) return out;
    }
    for (const occ of occurrences.get(k) ?? []) {
      if (occ.done) continue;
      out.push({ k, day: label, title: occ.title, time: occ.allDay ? '' : (occ.startTime ?? '') });
      if (out.length >= MAX_UPCOMING) return out;
    }
  }
  return out;
}

/**
 * בונה את נתוני וידג׳ט התזכורות.
 *
 * אותו מודל בדיוק של מסך התזכורות, ובכוונה: הוידג׳ט הוא חלון אל אותה
 * רשימה, כולל הפריטים שאין להם תאריך. שני חישובים נפרדים היו נפרדים גם
 * בתוצאה, וזה בדיוק מה שהופך וידג׳ט למשהו שאי אפשר לסמוך עליו.
 */
export function buildRemindersWidget(
  events: UserEvent[],
  days: Map<DateKey, DayInfo>,
  occurrences: Map<DateKey, Occurrence[]>,
  now = new Date(),
): RemindersWidgetData {
  const groups: ReminderGroup[] = [];
  let count = 0;
  let open = 0;

  for (const group of buildReminderGroups(events, occurrences, days, now, REMINDER_HORIZON_DAYS)) {
    if (count >= MAX_REMINDERS) break;
    if (!group.items.length) continue;

    const items: WidgetReminder[] = [];
    for (const source of group.items) {
      if (count >= MAX_REMINDERS) break;
      const item: WidgetReminder = {
        id: source.occurrence ? occurrenceRef(source.occurrence) : `${source.baseId}|${source.sourceKey}`,
        title: source.title,
        time: source.time,
        color: source.color,
      };
      if (source.done) item.done = true;
      else open += 1;
      items.push(item);
      count += 1;
    }
    if (!items.length) continue;

    groups.push({ k: group.key as DateKey, label: group.label, hebrew: group.hebrew, items });
  }

  return { updatedAt: Date.now(), groups, open };
}

/* ==========================================================================
   וידג׳ט זמני השבת
   ========================================================================== */

export type ShabbatWidgetEntry = {
  /** "שבת פרשת נח" / "ראש השנה" */
  title: string;
  /** "היום", "מחר", "יום שישי, 18 בספטמבר" */
  day: string;
  /**
   * התאריך העברי של ערב הכניסה.
   *
   * נשאר בפני עצמו כדי שגרסה מותקנת ישנה של המעטפת, שקוראת רק אותו,
   * תמשיך להראות משהו. חדשה מעדיפה את `sub`.
   */
  hebrew: string;
  /**
   * שורת המשנה המוכנה: לועזי ואחריו עברי.
   *
   * הלועזי קודם כי הוא זה שאפשר להצליב מולו פגישה או טיסה. העברי
   * נשאר, כי בוידג׳ט שבת הוא חלק מהעניין - אבל אחריו.
   *
   * זו מחרוזת ערוכה ולא שני שדות שהמעטפת מרכיבה: הרכבה בצד הנייטיבי
   * פירושה שכל שינוי בניסוח מחייב התקנה.
   */
  sub: string;
  /** שעת הדלקת הנרות */
  candles: string;
  /** שעת ההבדלה */
  havdalah: string;
  /** יום היציאה, לכיתוב "מוצאי" */
  endDay: string;
  /** מפתח יום הכניסה, לפתיחת האפליקציה עליו */
  k: DateKey;
  /** יום טוב ולא שבת רגילה */
  yomtov?: true;
};

export type ShabbatWidgetData = {
  updatedAt: number;
  /** העיר שלפיה חושבו הזמנים */
  city: string;
  entries: ShabbatWidgetEntry[];
};

/** "י״ז באלול" - התאריך העברי של ערב הכניסה */
function hebrewLabel(date: Date): string {
  const parts = hebrewDateParts(date);
  return `${parts.day} ב${parts.month}`;
}

/** "18 בספטמבר" - לועזי, בלי שם היום */
function gregorianLabel(date: Date): string {
  return `${date.getDate()} ב${GREG_MONTHS_HE[date.getMonth()]}`;
}

/**
 * "היום" / "מחר" / "יום שישי" - שם בלבד, בלי תאריך.
 *
 * `relativeDayLabel` נופל לתאריך מלא אחרי מחרתיים, וכאן זה היה מכפיל
 * אותו: המעטפת מחברת את השדה הזה לשורת המשנה, ויצא "יום שישי,
 * 25 בספטמבר · 25 בספטמבר · כ״ג בתשרי". התאריך שייך לשורת המשנה, וכאן
 * נשאר רק השם.
 */
function dayName(date: Date, now: Date): string {
  const diff = Math.round(
    (startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === 2) return 'מחרתיים';
  return `יום ${WEEKDAYS_HE[date.getDay()]}`;
}

/**
 * בונה את נתוני וידג׳ט השבת.
 *
 * הרשומה הראשונה היא הקרובה ביותר שעוד לא יצאה: שבת שנכנסה כבר אבל טרם
 * הסתיימה נשארת ראשונה, כי בשבת עצמה הזמן המעניין הוא ההבדלה ולא
 * ההדלקה הבאה.
 */
export function buildShabbatWidget(
  entries: ShabbatEntry[],
  cityName: string,
  now = new Date(),
): ShabbatWidgetData {
  const out: ShabbatWidgetEntry[] = [];

  for (const entry of entries) {
    if (out.length >= MAX_SHABBATOT) break;
    // כבר הסתיימה: ההבדלה מאחורינו
    if (entry.havdalah && entry.havdalah.at < now.getTime()) continue;

    const item: ShabbatWidgetEntry = {
      title: entry.title,
      day: dayName(entry.startDate, now),
      hebrew: hebrewLabel(entry.startDate),
      sub: `${gregorianLabel(entry.startDate)} · ${hebrewLabel(entry.startDate)}`,
      candles: entry.candles?.time ?? '',
      havdalah: entry.havdalah?.time ?? '',
      endDay: relativeDayLabel(entry.endDate, now),
      k: entry.startKey,
    };
    if (entry.isHoliday) item.yomtov = true;
    out.push(item);
  }

  return { updatedAt: Date.now(), city: cityName, entries: out };
}

/** הסוג היחיד שהצד הנייטיבי מכיר. קיים כדי שהחוזה יישאר במקום אחד. */
/* ==========================================================================
   וידג׳ט הרשימות המשותפות
   ========================================================================== */

/**
 * פריט ברשימה משותפת, כפי שהוידג׳ט מצייר אותו.
 *
 * `cat` הוא היחיד שהצד הנייטיבי *משווה* ולא רק מצייר, כדי לכבד את
 * הקטגוריה שנבחרה בהגדרת הוידג׳ט. זו השוואת מחרוזות ולא לוגיקה שלנו:
 * שם הקטגוריה להצגה מגיע מוכן ב-`SharedWidgetList.categories`, ולא נגזר
 * שם מהמזהה.
 */
export type SharedWidgetItem = {
  /** `listId|itemId|sourceKey` - מה שחוזר מהוידג׳ט בסימון */
  id: string;
  title: string;
  time: string;
  done?: true;
  color: string;
  /** מזהה הקטגוריה, או ריק לפריט בלי קטגוריה */
  cat: string;
  /** מי הוסיף, ריק כשזה אני */
  who: string;
};

export type SharedWidgetGroup = {
  k: DateKey | 'undated';
  label: string;
  hebrew: string;
  items: SharedWidgetItem[];
};

export type SharedWidgetList = {
  id: string;
  name: string;
  /** לבחירה במסך ההגדרה של הוידג׳ט. השמות מוכנים להצגה */
  categories: { id: string; name: string }[];
  groups: SharedWidgetGroup[];
};

export type SharedWidgetData = {
  updatedAt: number;
  lists: SharedWidgetList[];
  /** כבוי כשאין חשבון: הוידג׳ט מציג "התחברו" במקום "אין פריטים" */
  signedIn: boolean;
};

/** מזהה פריט משותף כפי שהוא עובר לצד הנייטיבי וחוזר ממנו. */
export function sharedRef(listId: string, baseId: string, sourceKey: string): string {
  return `${listId}|${baseId}|${sourceKey}`;
}

/**
 * מפרק מזהה שחזר מהוידג׳ט המשותף.
 *
 * הפירוק הוא משמאל ומימין ולא `split`: `sourceKey` הוא תאריך בלי `|`,
 * ו-`listId` נוצר על ידינו - אבל `baseId` עלול להכיל כל תו, ופיצול
 * נאיבי היה שובר אותו.
 */
export function parseSharedRef(
  ref: string,
): { listId: string; baseId: string; sourceKey: DateKey } | null {
  const first = ref.indexOf('|');
  const last = ref.lastIndexOf('|');
  if (first <= 0 || last <= first || last === ref.length - 1) return null;
  return {
    listId: ref.slice(0, first),
    baseId: ref.slice(first + 1, last),
    sourceKey: ref.slice(last + 1) as DateKey,
  };
}

/**
 * תמונת המצב של הרשימות המשותפות.
 *
 * הקבוצות נבנות ב-`buildReminderGroups` בדיוק כמו במסך, ולכן "היום",
 * "מחר" והתאריך העברי זהים בשני המקומות. שני חישובים נפרדים היו נפרדים
 * גם בתוצאה.
 */
export function buildSharedWidget(
  lists: {
    id: string;
    name: string;
    categories: { id: string; name: string }[];
    items: (UserEvent & { categoryId?: string; createdBy: string })[];
    /** שם להצגה של כל חבר, ריק למי שזה אני */
    who: (uid: string) => string;
  }[],
  days: Map<DateKey, DayInfo>,
  expand: (items: UserEvent[]) => Map<DateKey, Occurrence[]>,
  signedIn: boolean,
  now = new Date(),
): SharedWidgetData {
  const out: SharedWidgetList[] = [];

  for (const list of lists.slice(0, MAX_SHARED_LISTS)) {
    const byId = new Map(list.items.map((it) => [it.id, it]));
    const groups: SharedWidgetGroup[] = [];
    let count = 0;

    for (const group of buildReminderGroups(
      list.items,
      expand(list.items),
      days,
      now,
      REMINDER_HORIZON_DAYS,
    )) {
      if (count >= MAX_SHARED_ITEMS) break;
      if (!group.items.length) continue;

      const items: SharedWidgetItem[] = [];
      for (const source of group.items) {
        if (count >= MAX_SHARED_ITEMS) break;
        const origin = byId.get(source.baseId);
        const item: SharedWidgetItem = {
          id: sharedRef(list.id, source.baseId, source.sourceKey),
          title: source.title,
          time: source.time,
          color: source.color,
          cat: origin?.categoryId ?? '',
          who: origin ? list.who(origin.createdBy) : '',
        };
        if (source.done) item.done = true;
        items.push(item);
        count += 1;
      }
      if (!items.length) continue;

      groups.push({ k: group.key, label: group.label, hebrew: group.hebrew, items });
    }

    out.push({ id: list.id, name: list.name, categories: list.categories, groups });
  }

  return { updatedAt: Date.now(), lists: out, signedIn };
}

export type WidgetPayload = {
  calendar: CalendarWidgetData;
  reminders: RemindersWidgetData;
};

export const WIDGET_KEYS = {
  calendar: 'widget:calendar',
  reminders: 'widget:reminders',
  shabbat: 'widget:shabbat',
  shared: 'widget:shared',
  /** תור הפעולות שהוידג׳ט כתב וממתינות לאפליקציה */
  inbox: 'widget:inbox',
} as const;

/** פעולה שהוידג׳ט ביצע וממתינה שהאפליקציה תחיל אותה. */
export type WidgetAction =
  | { type: 'done'; ref: string; done: boolean; at: number }
  | { type: 'add'; title: string; date: DateKey; at: number }
  /* ברשימה משותפת אין הוספה מהוידג׳ט: כתיבה לרשימה של מישהו אחר דורשת
     חיבור חי, והתור מיועד בדיוק למצב שבו הוא אינו קיים. סימון "בוצע"
     כן - הוא מתיישב גם כשהוא מאחר, כי הוא מצב ולא פעולה מצטברת. */
  | { type: 'shared-done'; ref: string; done: boolean; at: number };

/** קורא תור פעולות שנכתב בצד הנייטיבי. סובל קלט פגום בשקט. */
export function parseInbox(raw: string | null | undefined): WidgetAction[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a): a is WidgetAction => {
      if (!a || typeof a !== 'object') return false;
      const action = a as Partial<WidgetAction> & { type?: string };
      if (action.type === 'done' || action.type === 'shared-done') {
        return typeof (a as { ref?: unknown }).ref === 'string';
      }
      if (action.type === 'add') {
        const add = a as { title?: unknown; date?: unknown };
        return typeof add.title === 'string' && typeof add.date === 'string';
      }
      return false;
    });
  } catch {
    return [];
  }
}
