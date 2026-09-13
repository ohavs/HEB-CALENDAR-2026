/** טיפוסים משותפים לכל האפליקציה. */

/** מפתח תאריך לוקאלי בפורמט YYYY-MM-DD (לא UTC!). */
export type DateKey = string;

export type EventColor = 'violet' | 'mint' | 'rose' | 'peach' | 'sky' | 'slate';

/** אירוע שהמשתמש יצר. */
export type UserEvent = {
  id: string;
  title: string;
  /** יום האירוע (מפתח לוקאלי) */
  date: DateKey;
  /**
   * יום הסיום של אירוע רב־יומי (חופשה, טיול, אירוח).
   * חסר או שווה ל-date באירוע של יום אחד. באירוע חוזר, אורך הפרישה
   * נשמר וחוזר עם כל מופע.
   */
  endDate?: DateKey;
  /** שעת התחלה HH:mm, או null לאירוע של כל היום */
  startTime: string | null;
  /** שעת סיום HH:mm, אופציונלי */
  endTime: string | null;
  allDay: boolean;
  location?: string;
  notes?: string;
  color: EventColor;
  /** דקות לפני האירוע לתזכורת; null = בלי תזכורת */
  reminderMinutes: number | null;
  /** חזרתיות בסיסית */
  repeat: RepeatRule;
  /**
   * חריגים למופעים בודדים בסדרה, לפי התאריך המקורי של המופע.
   * ריק או חסר ברוב האירועים, ולכן לא נשמר כשאין בו צורך.
   */
  exceptions?: Record<DateKey, EventException>;
  createdAt: number;
  updatedAt: number;
  /** מסומן כמחוק לצורך סנכרון (tombstone) */
  deleted?: boolean;
};

export type RepeatRule = 'none' | 'weekly' | 'monthly' | 'yearly' | 'hebrew-yearly';

/**
 * חריג למופע יחיד בסדרה חוזרת.
 *
 * המפתח במפת החריגים הוא תמיד התאריך שבו המופע *היה אמור* לחול, גם אחרי
 * שהוזז. כך זהות המופע נשמרת: אפשר להזיז אותו שוב, לבטל אותו, או להחזיר
 * אותו למקומו, בלי שהחריג ייווצר מחדש ביום אחר.
 */
export type EventException = {
  /** המופע בוטל - הוא פשוט לא יופיע */
  cancelled?: boolean;
  /** המופע הועבר ליום אחר */
  movedTo?: DateKey;
  /* שינויים נקודתיים שחלים על המופע הזה בלבד */
  title?: string;
  startTime?: string | null;
  endTime?: string | null;
  allDay?: boolean;
  location?: string;
  notes?: string;
  color?: EventColor;
  reminderMinutes?: number | null;
  /** אורך פרישה שונה למופע הזה בלבד */
  endDate?: DateKey;
};

/** סוגי מועדים מהלוח העברי. */
export type HolidayKind =
  | 'yomtov' // חג מהתורה (יו"ט)
  | 'cholhamoed' // חול המועד
  | 'erev' // ערב חג
  | 'majorfast' // צום מרכזי
  | 'minorfast' // צום מדרבנן
  | 'minor' // מועד מדרבנן (חנוכה, פורים, ט"ו בשבט...)
  | 'modern' // מועד ישראלי מודרני
  | 'roshchodesh'
  | 'specialshabbat'
  | 'parsha'
  | 'omer';

export type HolidayItem = {
  /** מזהה יציב (התיאור האנגלי מ-hebcal) */
  id: string;
  /** הכיתוב בעברית */
  title: string;
  /** כיתוב מקוצר לתאי הלוח הצרים */
  shortTitle: string;
  kind: HolidayKind;
  emoji?: string;
  /** האם זהו יום שאסור בו במלאכה (שבת/יו"ט) */
  restWork: boolean;
};

/** זמן ממודד (הדלקת נרות / הבדלה / צום). */
export type TimedItem = {
  id: string;
  title: string;
  /** HH:mm בשעון המקום */
  time: string;
  /** חתימת זמן מוחלטת */
  at: number;
  kind: 'candles' | 'havdalah' | 'fast-begins' | 'fast-ends';
  /** למה הזמן הזה קשור, לדוגמה "שבת" או "יום כיפור" */
  subject?: string;
};

/** כל מה שיש ליום אחד בלוח. */
export type DayInfo = {
  key: DateKey;
  date: Date;
  /** מספר היום העברי כגימטריה, למשל "י״ד" */
  hebrewDay: string;
  /** שם החודש העברי, למשל "תשרי" */
  hebrewMonth: string;
  /** שנה עברית כגימטריה, למשל "תשפ״ו" */
  hebrewYear: string;
  /** תאריך עברי מלא */
  hebrewFull: string;
  holidays: HolidayItem[];
  times: TimedItem[];
  parsha?: string;
  omerDay?: number;
  /** שבת או יום טוב */
  isRestDay: boolean;
  isShabbat: boolean;
  isToday: boolean;
  inCurrentMonth: boolean;
};

export type ThemeMode = 'light' | 'dark' | 'system';

/** איך הלוח מוצג: רשת חודש, ציר שבוע, או רשימה רציפה. */
export type CalendarView = 'month' | 'week' | 'agenda';

/**
 * צפיפות תא הלוח.
 * התא בטלפון הוא כ-55px רוחב, ושם ארוך תמיד ייחתך בו. במקום להילחם על
 * זה בתוך התא, המשתמש בוחר: מרווח מראה כותרת אחת ברורה, קומפקטי מראה
 * נקודות צבע בלבד ומפנה מקום לעוד ימים.
 */
export type Density = 'comfortable' | 'compact';

/**
 * מקום שמור של המשתמש ("בית", "עבודה").
 * אפשר לקבל התראה בהגעה אליו, ביציאה ממנו, או בשניהם.
 */
export type SavedPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** רדיוס הזיהוי במטרים */
  radius: number;
  notifyOnArrive: boolean;
  notifyOnLeave: boolean;
  /** הודעה מותאמת, או ריק לברירת המחדל */
  message?: string;
  createdAt: number;
};

export type GeoCity = {
  id: string;
  /** שם בעברית */
  name: string;
  /** אזור לתצוגה בקיבוץ ברשימה */
  region: string;
  latitude: number;
  longitude: number;
  tzid: string;
  /** האם לוח החגים הישראלי (יום טוב אחד) */
  il: boolean;
  elevation?: number;
};

export type Settings = {
  theme: ThemeMode;
  /** תצוגת הלוח האחרונה שנבחרה */
  view: CalendarView;
  /** צפיפות תאי הלוח */
  density: Density;
  /** הצגת תאריך עברי בתאי הלוח */
  showHebrewDates: boolean;
  /** הצגת שם החודש העברי בכותרת */
  showHebrewMonths: boolean;
  /** הצגת חגים ומועדים יהודיים על הלוח */
  showJewishHolidays: boolean;
  /** הצגת מועדי ישראל המודרניים (יום העצמאות, יום הזיכרון...) */
  showIsraeliHolidays: boolean;
  /** הצגת מועדים מדרבנן קטנים (ט"ו בשבט, ל"ג בעומר...) */
  showMinorHolidays: boolean;
  /** הצגת צומות */
  showFasts: boolean;
  /** הצגת ראש חודש */
  showRoshChodesh: boolean;
  /** הצגת פרשת השבוע */
  showParsha: boolean;
  /** הצגת ספירת העומר */
  showOmer: boolean;
  /** הצגת זמני כניסת/יציאת שבת על הלוח */
  showCandleTimes: boolean;
  /** מזהה עיר לזמנים */
  cityId: string;
  /** דקות לפני השקיעה להדלקת נרות */
  candleLightingMins: number;
  /** מעלות לצאת הכוכבים להבדלה, או מספר דקות אם havdalahMode = minutes */
  havdalahMode: 'degrees' | 'minutes';
  havdalahDegrees: number;
  havdalahMins: number;
  /** תזכורות */
  notifyCandleLighting: boolean;
  /** דקות לפני הדלקת נרות */
  notifyCandleLightingMins: number;
  notifyHavdalah: boolean;
  notifyHavdalahMins: number;
  notifyEvents: boolean;
  /** תזכורת בערב שלפני מועד או צום ("מחר: פורים") */
  notifyHolidayEve: boolean;
  /** השעה שבה תישלח תזכורת המועד, בפורמט HH:mm */
  notifyHolidayEveTime: string;
  /** יום ראשון בשבוע: 0=ראשון (ברירת מחדל בישראל) */
  weekStart: 0 | 1;
  /** ברירת מחדל לצבע אירוע חדש */
  defaultEventColor: EventColor;
  /** מיקום מדויק של המכשיר לחישוב זמנים, במקום עיר מהרשימה */
  customLocation: GeoCity | null;
  /** מקומות שמורים להתראות הגעה ויציאה */
  places: SavedPlace[];
  /** האם לעקוב אחרי המיקום כדי לזהות הגעה ויציאה */
  placeAlertsEnabled: boolean;
};

/** תת-קבוצה מההגדרות שמשמשת את מנוע הלוח העברי. */
export type CalendarFilters = {
  showJewishHolidays: boolean;
  showIsraeliHolidays: boolean;
  showMinorHolidays: boolean;
  showFasts: boolean;
  showRoshChodesh: boolean;
  showParsha: boolean;
  showOmer: boolean;
  showCandleTimes: boolean;
  candleLightingMins: number;
  havdalahMode: 'degrees' | 'minutes';
  havdalahDegrees: number;
  havdalahMins: number;
};
