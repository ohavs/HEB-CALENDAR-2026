/**
 * תזכורות והתראות.
 *
 * איך זה עובד:
 * 1. מחשבים מראש את כל התזכורות ל-30 הימים הקרובים (כניסת שבת, יציאת שבת,
 *    ערב מועד, ואירועים אישיים) ושומרים אותן ב-IndexedDB.
 * 2. כשהאפליקציה פתוחה - טיימרים בדף מציגים כל תזכורת בזמנה.
 * 3. כשהאפליקציה סגורה - ה-service worker מציג תזכורות שהגיע זמנן, דרך
 *    Periodic Background Sync (נתמך בכרום באנדרואיד לאפליקציה מותקנת).
 *
 * זו המגבלה של PWA: אין דרך מובטחת להעיר דפדפן סגור בלי push server.
 * לכן באפליקציית האנדרואיד העתידית נחליף את השכבה הזו בהתראות מקומיות
 * של המערכת - כל הלוגיקה כאן מרוכזת מאחורי buildReminders() כדי שההחלפה
 * תהיה נקודתית.
 */
import type { Settings, UserEvent } from '@/types';
import { addDays, combineDateTime, dateKey, formatTime, startOfDay } from './dates';
import { buildDays, upcomingShabbatot } from './hebrew';
import { findCity } from './locations';
import { expandEvents } from './recurrence';
import { toFilters } from '@/store/settings';
import {
  deleteReminders,
  getReminders,
  idbAvailable,
  replaceReminders,
  type StoredReminder,
} from './idb';

/** כמה ימים קדימה מחשבים */
const HORIZON_DAYS = 30;
/** טיימרים בדף נקבעים רק לתזכורות בטווח הזה (מעבר לכך הדף כנראה ייסגר) */
const TIMER_WINDOW_MS = 6 * 60 * 60 * 1000;
/** תזכורת שאיחרנו בה יותר מכך לא תוצג */
const LATE_WINDOW_MS = 3 * 60 * 60 * 1000;
const PERIODIC_SYNC_TAG = 'heb-cal-reminders';

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export function notificationState(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission as PermissionState;
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') void registerPeriodicSync();
    return result as PermissionState;
  } catch {
    return Notification.permission as PermissionState;
  }
}

/** רישום ל-Periodic Background Sync, כדי שתזכורות יעבדו גם כשהאפליקציה סגורה. */
async function registerPeriodicSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: {
        register: (tag: string, opts: { minInterval: number }) => Promise<void>;
        getTags: () => Promise<string[]>;
      };
    };
    if (!reg.periodicSync) return;
    const tags = await reg.periodicSync.getTags();
    if (!tags.includes(PERIODIC_SYNC_TAG)) {
      // המרווח המינימלי בפועל נקבע על ידי הדפדפן
      await reg.periodicSync.register(PERIODIC_SYNC_TAG, { minInterval: 6 * 60 * 60 * 1000 });
    }
  } catch {
    /* לא נתמך - נסתמך על טיימרים בדף */
  }
}

async function show(title: string, body: string, tag: string): Promise<void> {
  if (notificationState() !== 'granted') return;
  const options: NotificationOptions = {
    body,
    tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-64.png',
    lang: 'he',
    dir: 'rtl',
    data: { url: '/' },
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    /* נפילה להתראה בדף */
  }
  try {
    new Notification(title, options);
  } catch {
    /* אין מה לעשות */
  }
}

export async function showTestNotification(): Promise<void> {
  await show('לוח שנה עברי', 'ההתראות פעילות. כאן תופיע התזכורת שלך.', 'heb-cal-test');
}

/* ==========================================================================
   חישוב התזכורות
   ========================================================================== */

function reminderTitle(mins: number, subject: string): string {
  if (mins <= 0) return subject;
  if (mins === 60) return `שעה ל${subject}`;
  if (mins === 120) return `שעתיים ל${subject}`;
  if (mins % 60 === 0) return `${mins / 60} שעות ל${subject}`;
  return `${mins} דקות ל${subject}`;
}

/**
 * בונה את רשימת התזכורות העתידיות. פונקציה טהורה - קל לבדוק אותה ולהחליף
 * את שכבת התצוגה מתחתיה (למשל בהתראות מקומיות באנדרואיד).
 */
export function buildReminders(
  settings: Settings,
  events: UserEvent[],
  now = new Date(),
): StoredReminder[] {
  const out: StoredReminder[] = [];
  const city = findCity(settings.cityId);
  const filters = toFilters(settings);
  const horizonEnd = addDays(now, HORIZON_DAYS);

  /* ---------- כניסת ויציאת שבת וחג ---------- */
  if (settings.notifyCandleLighting || settings.notifyHavdalah) {
    const entries = upcomingShabbatot(startOfDay(now), Math.ceil(HORIZON_DAYS / 7), {
      ...filters,
      city,
      showCandleTimes: true,
    });
    for (const entry of entries) {
      if (settings.notifyCandleLighting && entry.candles) {
        const at = entry.candles.at - settings.notifyCandleLightingMins * 60_000;
        const subject = entry.isHoliday ? `כניסת ${entry.title}` : 'כניסת שבת';
        out.push({
          id: `candles-${entry.startKey}`,
          at,
          title: reminderTitle(settings.notifyCandleLightingMins, subject),
          body: `הדלקת נרות ב-${entry.candles.time} · ${city.name}${entry.parsha ? ` · פרשת ${entry.parsha}` : ''}`,
        });
      }
      if (settings.notifyHavdalah && entry.havdalah) {
        const at = entry.havdalah.at - settings.notifyHavdalahMins * 60_000;
        const subject = entry.isHoliday ? `יציאת ${entry.title}` : 'יציאת שבת';
        out.push({
          id: `havdalah-${entry.endKey}`,
          at,
          title: reminderTitle(settings.notifyHavdalahMins, subject),
          body: `הבדלה ב-${entry.havdalah.time} · ${city.name}`,
        });
      }
    }
  }

  /* ---------- ערב מועד / צום ---------- */
  if (settings.notifyHolidayEve) {
    const days = buildDays(startOfDay(now), horizonEnd, {
      ...filters,
      city,
      showParsha: false,
      showOmer: false,
      showCandleTimes: false,
    });
    for (const day of days.values()) {
      const notable = day.holidays.filter(
        (h) =>
          h.kind === 'yomtov' ||
          h.kind === 'majorfast' ||
          h.kind === 'minorfast' ||
          h.kind === 'minor' ||
          h.kind === 'modern',
      );
      if (!notable.length) continue;
      const eve = addDays(day.date, -1);
      const [evH, evM] = settings.notifyHolidayEveTime.split(':').map(Number);
      const at = new Date(eve);
      at.setHours(evH, evM, 0, 0);
      out.push({
        id: `holiday-${day.key}`,
        at: at.getTime(),
        title: `מחר: ${notable[0].title}`,
        body: notable.length > 1 ? notable.map((h) => h.title).join(' · ') : day.hebrewFull,
      });
    }
  }

  /* ---------- אירועים אישיים ---------- */
  if (settings.notifyEvents) {
    const withReminder = events.filter((e) => !e.deleted && e.reminderMinutes !== null);
    if (withReminder.length) {
      const occurrences = expandEvents(withReminder, startOfDay(now), horizonEnd);
      for (const [key, list] of occurrences) {
        for (const occ of list) {
          const mins = occ.reminderMinutes ?? 0;
          const base = occ.allDay
            ? (() => {
                const d = combineDateTime(key, null);
                d.setHours(9, 0, 0, 0); // אירוע של כל היום - תזכורת בבוקר
                return d;
              })()
            : combineDateTime(key, occ.startTime ?? '09:00');
          const at = base.getTime() - mins * 60_000;
          out.push({
            id: `event-${occ.occurrenceId}`,
            at,
            title: occ.title,
            body: occ.allDay
              ? 'אירוע של כל היום'
              : `${reminderTitle(mins, 'האירוע')} · ${formatTime(base)}${occ.location ? ` · ${occ.location}` : ''}`,
          });
        }
      }
    }
  }

  const cutoff = now.getTime() - LATE_WINDOW_MS;
  return out
    .filter((r) => r.at > cutoff)
    .sort((a, b) => a.at - b.at)
    .slice(0, 250);
}

/* ==========================================================================
   תזמון בדף
   ========================================================================== */

let timers: ReturnType<typeof setTimeout>[] = [];

function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

/** מציג תזכורות שהגיע זמנן ומוחק אותן מהאחסון. */
async function flushDue(): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const all = await getReminders();
    const now = Date.now();
    const due = all.filter((r) => r.at <= now && r.at > now - LATE_WINDOW_MS);
    const stale = all.filter((r) => r.at <= now - LATE_WINDOW_MS);
    for (const r of due) await show(r.title, r.body, r.id);
    await deleteReminders([...due, ...stale].map((r) => r.id));
  } catch {
    /* לא קריטי */
  }
}

/**
 * מחשב מחדש את כל התזכורות, שומר אותן, וקובע טיימרים לקרובות.
 * יש לקרוא לזה בכל שינוי בהגדרות או באירועים.
 */
export async function syncReminders(settings: Settings, events: UserEvent[]): Promise<void> {
  clearTimers();
  if (notificationState() !== 'granted' || !idbAvailable()) return;

  const reminders = buildReminders(settings, events);
  try {
    await replaceReminders(reminders);
  } catch {
    /* אם האחסון נכשל עדיין נקבע טיימרים לפעולה בדף */
  }

  await flushDue();
  void registerPeriodicSync();

  const now = Date.now();
  for (const r of reminders) {
    const delay = r.at - now;
    if (delay <= 0 || delay > TIMER_WINDOW_MS) continue;
    timers.push(
      setTimeout(() => {
        void show(r.title, r.body, r.id);
        void deleteReminders([r.id]);
      }, delay),
    );
  }
}

/** מבקש מה-service worker לבדוק תזכורות שאיחרנו בהן (אחרי חזרה לאפליקציה). */
export function askServiceWorkerToFlush(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage({ type: 'flush-reminders' }))
    .catch(() => undefined);
}

export function stopReminders(): void {
  clearTimers();
}

/** תיאור קצר של מצב ההתראות, לתצוגה בהגדרות. */
export function permissionLabel(state: PermissionState): string {
  switch (state) {
    case 'granted':
      return 'ההתראות מאושרות';
    case 'denied':
      return 'ההתראות חסומות בדפדפן';
    case 'unsupported':
      return 'הדפדפן הזה לא תומך בהתראות';
    default:
      return 'נדרש אישור להתראות';
  }
}

/** מפתח תאריך של היום - לשימוש בתזכורות שמתעדכנות בחצות. */
export const todayKey = (): string => dateKey(new Date());
