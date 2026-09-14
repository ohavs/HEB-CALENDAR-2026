/**
 * שכבת הגישה למערכת ההפעלה, כשהאפליקציה רצה כאפליקציית אנדרואיד.
 *
 * הכלל שמנחה את הקובץ: `src/lib` נשאר טהור. לכן אין כאן שום ייבוא סטטי
 * של פלאגין - `isNative()` בודק את הגשר שקפסיטור מזריק ל-window, וכל
 * פלאגין נטען ב-import דינמי רק אחרי שהתשובה חיובית. בדפדפן ובבדיקות אף
 * אחד מהם לא נטען, והקוד הקיים ממשיך לרוץ כמו קודם.
 *
 * מה באמת משתנה באנדרואיד:
 * - תזכורות נקבעות כהתראות מקומיות של המערכת, ולכן הן מגיעות גם
 *   כשהאפליקציה סגורה. זו המגבלה היחידה שלא הצלחנו לפתור ב-PWA.
 * - המיקום נקרא דרך הפלאגין, שמבקש את ההרשאה בעצמו.
 * - התחברות גוגל עוברת דרך Credential Manager, כי חלון קופץ של OAuth
 *   חסום בתוך WebView.
 */

type Bridge = { isNativePlatform?: () => boolean; getPlatform?: () => string };

/** האם אנחנו רצים בתוך העטיפה הנייטיבית. בטוח לקריאה גם ב-node. */
export function isNative(): boolean {
  const bridge = (globalThis as { Capacitor?: Bridge }).Capacitor;
  return Boolean(bridge?.isNativePlatform?.());
}

/* ==========================================================================
   התראות
   ========================================================================== */

/**
 * מזהה מספרי יציב לכל תזכורת.
 * אנדרואיד מזהה התראה במספר 32 ביט, והמזהים שלנו הם מחרוזות - אז
 * מגבּבים. יציבות חשובה: אותה תזכורת חייבת לקבל אותו מספר בכל חישוב
 * מחדש, אחרת כל סנכרון היה יוצר כפילות במקום להחליף.
 */
export function notificationId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  // חיובי בלבד, ומתחת ל-2^31
  return Math.abs(hash) || 1;
}

/**
 * כמה תזכורות נקבעות בפועל.
 * לאנדרואיד יש תקרה על מספר ההתראות הממתינות, ותזכורת שבעוד שלושה
 * שבועות ממילא תיקבע מחדש בפתיחה הבאה של האפליקציה.
 */
const MAX_SCHEDULED = 60;

export type NativeReminder = { id: string; at: number; title: string; body: string };

export async function nativeNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (!isNative()) return 'default';
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
  } catch {
    return 'default';
  }
}

export async function requestNativeNotificationPermission(): Promise<
  'granted' | 'denied' | 'default'
> {
  if (!isNative()) return 'default';
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
  } catch {
    return 'default';
  }
}

/** התראה מיידית - למשל בהגעה למקום שמור. */
export async function showNativeNotification(
  title: string,
  body: string,
  tag: string,
): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{ id: notificationId(tag), title, body, smallIcon: 'ic_stat_notify' }],
    });
  } catch {
    /* התראה שלא נשלחה אינה סיבה להפיל מסך */
  }
}

/**
 * קובע מחדש את כל התזכורות.
 *
 * מבטלים תמיד את כל מה שנקבע קודם: התזכורות מחושבות מחדש בכל שינוי,
 * וביטול סלקטיבי היה מצריך לנהל מצב נוסף שיכול להיסתר מהאמת.
 */
export async function scheduleNativeReminders(reminders: NativeReminder[]): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
    const now = Date.now();
    const upcoming = reminders
      .filter((r) => r.at > now)
      .sort((a, b) => a.at - b.at)
      .slice(0, MAX_SCHEDULED);
    if (!upcoming.length) return;
    await LocalNotifications.schedule({
      notifications: upcoming.map((r) => ({
        id: notificationId(r.id),
        title: r.title,
        body: r.body,
        smallIcon: 'ic_stat_notify',
        // התראה מדויקת גם כשהמכשיר נם: תזכורת שמגיעה באיחור של שעה
        // לכניסת שבת היא תזכורת מיותרת
        schedule: { at: new Date(r.at), allowWhileIdle: true },
      })),
    });
  } catch {
    /* אין הרשאה או שהתזמון נכשל - האפליקציה ממשיכה לעבוד */
  }
}

export async function clearNativeReminders(): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch {
    /* אין מה לנקות */
  }
}

/* ==========================================================================
   מיקום
   ========================================================================== */

export type NativeCoords = { latitude: number; longitude: number; accuracy?: number };

/** קריאת מיקום חד-פעמית. הפלאגין מבקש את ההרשאה בעצמו במידת הצורך. */
export async function readNativePosition(): Promise<NativeCoords> {
  const { Geolocation } = await import('@capacitor/geolocation');
  const status = await Geolocation.checkPermissions();
  if (status.location !== 'granted') {
    const asked = await Geolocation.requestPermissions({ permissions: ['location'] });
    if (asked.location !== 'granted') throw new Error('location-denied');
  }
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10_000 });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  };
}

/** מעקב רציף. מחזיר פונקציית עצירה. */
export async function watchNativePosition(
  onCoords: (coords: NativeCoords) => void,
): Promise<() => void> {
  const { Geolocation } = await import('@capacitor/geolocation');
  const status = await Geolocation.checkPermissions();
  if (status.location !== 'granted') {
    const asked = await Geolocation.requestPermissions({ permissions: ['location'] });
    if (asked.location !== 'granted') return () => undefined;
  }
  const id = await Geolocation.watchPosition(
    { enableHighAccuracy: false, timeout: 60_000 },
    (pos) => {
      if (!pos) return;
      onCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    },
  );
  return () => void Geolocation.clearWatch({ id });
}

/* ==========================================================================
   התחברות גוגל
   ========================================================================== */

let socialReady: Promise<void> | null = null;

/**
 * מחזיר idToken של גוגל, שאותו ממירים לכניסה ל-Firebase.
 *
 * למה לא signInWithPopup: גוגל חוסמת OAuth בתוך WebView, וזו בדיוק
 * הסביבה שבה האפליקציה רצה. Credential Manager הוא המסלול הנייטיבי,
 * והוא גם מציג את החשבונות שכבר קיימים במכשיר.
 */
export async function nativeGoogleIdToken(webClientId: string): Promise<string> {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  socialReady ??= SocialLogin.initialize({ google: { webClientId } });
  await socialReady;
  const res = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
  const result = res.result as { idToken?: string | null };
  if (!result?.idToken) throw new Error('google-no-id-token');
  return result.idToken;
}

export async function nativeGoogleSignOut(): Promise<void> {
  if (!isNative()) return;
  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login');
    await SocialLogin.logout({ provider: 'google' });
  } catch {
    /* יציאה מקומית הצליחה ממילא */
  }
}

/* ==========================================================================
   אתחול
   ========================================================================== */

/**
 * מה שצריך לקרות פעם אחת בהפעלה: צביעת שורת הסטטוס לפי ערכת הנושא
 * והסתרת מסך הפתיחה ברגע שהאפליקציה באמת מוכנה.
 */
export async function initNative(dark: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
    ]);
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? '#09090F' : '#F6F6FA' });
    await SplashScreen.hide();
  } catch {
    /* אין שורת סטטוס בכל מכשיר */
  }
}

/** עדכון שורת הסטטוס כשהמשתמש מחליף ערכת נושא. */
export async function paintNativeChrome(dark: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? '#09090F' : '#F6F6FA' });
  } catch {
    /* לא קריטי */
  }
}
