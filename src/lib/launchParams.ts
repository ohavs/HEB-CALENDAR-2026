/**
 * פרמטרים של פתיחה: קיצורי דרך של האפליקציה וקישורים עמוקים.
 *
 * ה-manifest הכריז על שני קיצורי דרך - "זמני שבת" ו"היום" - אבל שום דבר
 * בקוד לא קרא את הכתובת, ולכן שניהם פתחו את האפליקציה על הלשונית
 * הרגילה. כאן זה נקרא.
 *
 * אותו פענוח ישרת את אנדרואיד: Capacitor טוען את אותו `index.html` עם
 * אותה שאילתה, ולכן קיצור דרך במסך הבית או כוונה חיצונית יגיעו לכאן
 * בלי שינוי.
 */
import type { TabId } from '@/components/TabBar';
import type { DateKey } from '@/types';
import type { RemindersView } from './remindersView';
import { dateKey, keyToDate, startOfDay } from './dates';

export type LaunchIntent = {
  /** לשונית לפתוח בה */
  tab?: TabId;
  /** תאריך לקפוץ אליו */
  date?: Date;
  /** לפתוח מיד את עורך האירוע על התאריך הזה */
  compose?: DateKey;
  /** איזו לשונית פנימית במסך התזכורות. רק `tab=reminders` מתייחס אליה */
  view?: RemindersView;
};

const TABS: TabId[] = ['calendar', 'reminders', 'shabbat', 'settings'];

/** YYYY-MM-DD תקין ואמיתי (לא 2026-02-31). */
function validKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return dateKey(keyToDate(value)) === value;
}

/**
 * מפענח את השאילתה. מתעלם בשקט מכל מה שלא מוכר - קישור ישן או מקוצץ
 * צריך לפתוח את האפליקציה, לא להכשיל אותה.
 */
export function parseLaunch(search: string): LaunchIntent {
  const out: LaunchIntent = {};
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return out;
  }

  const tab = params.get('tab');
  if (tab && (TABS as string[]).includes(tab)) out.tab = tab as TabId;

  // ?view=shared - וידג׳ט הרשימה המשותפת מוביל ללשונית שלו, לא לשלי
  const view = params.get('view');
  if (view === 'shared' || view === 'mine' || view === 'templates') out.view = view;

  // ?go=today או ?date=YYYY-MM-DD
  if (params.get('go') === 'today') out.date = startOfDay(new Date());
  const date = params.get('date');
  if (date && validKey(date)) out.date = keyToDate(date);

  // ?compose=YYYY-MM-DD, או ?compose=1 להיום
  const compose = params.get('compose');
  if (compose === '1' || compose === 'today') {
    out.compose = dateKey(out.date ?? startOfDay(new Date()));
  } else if (compose && validKey(compose)) {
    out.compose = compose;
  }

  return out;
}

/** קורא את הכתובת הנוכחית ומנקה אותה, כדי שרענון לא יחזור על הפעולה. */
export function consumeLaunch(): LaunchIntent {
  if (typeof window === 'undefined') return {};
  const intent = parseLaunch(window.location.search);
  if (Object.keys(intent).length && window.history.replaceState) {
    window.history.replaceState({}, '', window.location.pathname);
  }
  return intent;
}

/**
 * מפענח קישור שהגיע מבחוץ, למשל לחיצה על יום בוידג׳ט.
 *
 * הסכמה שלנו (`hebcal://open?date=...`) אינה כתובת http, ולכן היא לא
 * עוברת דרך `window.location` בכלל - היא מגיעה כאירוע מהמערכת. מה
 * שמשותף הוא השאילתה, וזו בדיוק הנקודה: אותו פענוח משרת את שניהם.
 */
export function parseExternalUrl(url: string): LaunchIntent {
  const at = url.indexOf('?');
  return at < 0 ? {} : parseLaunch(url.slice(at));
}
