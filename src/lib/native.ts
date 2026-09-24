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

/**
 * ערוצי ההתראות.
 *
 * מאנדרואיד 8 המשתמש שולט בהתראות לפי ערוץ - צליל, רטט, חשיבות והשתקה,
 * לכל ערוץ בנפרד. בלי ערוצים הכול נוחת בערוץ ברירת המחדל, וכניסת שבת,
 * תזכורת לאירוע והתראת הגעה למקום הן אותו דבר מבחינת המערכת: מי שרצה
 * להשתיק התראות מיקום היה חייב להשתיק את הכול.
 *
 * הסוג נגזר מהמזהה, שממילא נושא אותו - אין צורך בשדה נוסף שאפשר לשכוח
 * למלא.
 */
const CHANNELS = [
  { id: 'shabbat', name: 'זמני שבת ומועדים', description: 'כניסת שבת, יציאתה וערבי חג' },
  { id: 'events', name: 'אירועים', description: 'תזכורות לאירועים שהוספתם' },
  { id: 'places', name: 'מקומות', description: 'התראות בהגעה למקום שמור וביציאה ממנו' },
  /*
    הערוץ היחיד שאינו מתזכורת מקומית אלא מ-push. הוא נוצר כאן בכל זאת,
    כי ערוץ חייב להתקיים לפני שמגיעה אליו הודעה - אחרת אנדרואיד מפיל
    אותה לערוץ ברירת המחדל, והמשתמש לא יוכל להשתיק הזמנות בלבד. השם
    חייב להתאים ל-CHANNEL ב-functions/index.js.
  */
  { id: 'invites', name: 'הזמנות', description: 'הזמנה לרשימה משותפת' },
] as const;

export type ChannelId = (typeof CHANNELS)[number]['id'];

/**
 * לאיזה ערוץ שייכת תזכורת, לפי המזהה שלה.
 * `invites` אינו מוחזר כאן לעולם: הוא מגיע מהשרת ולא מתזכורת מקומית.
 */
export function channelFor(reminderId: string): ChannelId {
  if (reminderId.startsWith('event-')) return 'events';
  if (reminderId.startsWith('place-')) return 'places';
  return 'shabbat';
}

/* ==========================================================================
   התראות push
   ========================================================================== */

/**
 * רישום המכשיר לקבלת push, והחזרת הטוקן.
 *
 * למה בכלל: תזכורת מקומית עובדת רק על מה שהמכשיר כבר יודע. הזמנה
 * נוצרת על מכשיר אחר, ולכן אין דרך לדעת עליה בלי שמישהו ידחוף - ראו
 * `functions/index.js`.
 *
 * מחזיר `null` בדפדפן, כשההרשאה נדחתה, או כשאין שירותי גוגל במכשיר.
 * בכל אחד מהמקרים האלה האפליקציה ממשיכה לעבוד: הבאנר בתוך המסך עדיין
 * מראה את ההזמנה, הוא פשוט לא קופץ מבחוץ.
 *
 * הייבוא דינמי, כמו כל פלאגין כאן. ייבוא סטטי היה שובר את הבדיקות
 * ב-node ואת הטוהר של `src/lib`.
 */
export async function registerPush(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let status = await PushNotifications.checkPermissions();
    if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
      status = await PushNotifications.requestPermissions();
    }
    if (status.receive !== 'granted') return null;

    await ensureChannels();

    /*
      ההרשמה אינה מחזירה את הטוקן - הוא מגיע באירוע. לכן ההמתנה כאן
      מפורשת, ועם תקרה: מכשיר בלי שירותי גוגל לא יירה לעולם, ובלי
      התקרה ההבטחה הזו הייתה תלויה לנצח.
    */
    const token = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 10_000);
      void PushNotifications.addListener('registration', (t) => {
        clearTimeout(timer);
        resolve(t.value);
      });
      void PushNotifications.addListener('registrationError', () => {
        clearTimeout(timer);
        resolve(null);
      });
      void PushNotifications.register();
    });
    return token;
  } catch {
    return null;
  }
}

/**
 * לחיצה על התראת push שהגיעה מבחוץ.
 *
 * ההתראה נושאת `type` ו-`listId`, והיא מובילה ללשונית המשותפת - אותה
 * כתובת שהוידג׳ט משתמש בה, כדי שיהיה מסלול אחד ולא שניים.
 */
export async function onPushOpened(handler: (url: string) => void): Promise<void> {
  if (!isNative()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    void PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification?.data as Record<string, string> | undefined;
      if (data?.type === 'invite') handler('hebcal://open?tab=reminders&view=shared');
    });
  } catch {
    /* אין פלאגין - אין מה להאזין לו */
  }
}

let channelsReady = false;

async function ensureChannels(): Promise<void> {
  if (channelsReady || !isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    for (const channel of CHANNELS) {
      await LocalNotifications.createChannel({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        importance: 4,
        visibility: 1,
        vibration: true,
      });
    }
    channelsReady = true;
  } catch {
    /* גרסאות ישנות בלי ערוצים - ההתראות עדיין עובדות */
  }
}

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
    await ensureChannels();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId(tag),
          title,
          body,
          smallIcon: 'ic_stat_notify',
          channelId: channelFor(tag),
        },
      ],
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
    await ensureChannels();
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
        channelId: channelFor(r.id),
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
   גדרות גאוגרפיות
   ========================================================================== */

/**
 * מצב ההרשאות להתראות מקום.
 *
 * שתי שאלות ולא אחת, כי הן נכשלות אחרת: בלי `foreground` אי אפשר אפילו
 * לשמור מקום לפי המיקום הנוכחי, ובלי `background` הכול נראה תקין -
 * המקום נשמר, המתג דלוק, ההתראה פשוט לא מגיעה לעולם.
 */
export type GeoPermission = {
  foreground: boolean;
  background: boolean;
  /** מ-API 30 "לאפשר תמיד" נבחרת רק במסך ההגדרות, לא בדיאלוג */
  needsSettings: boolean;
};

const DENIED: GeoPermission = { foreground: false, background: false, needsSettings: false };

async function geofencePlugin() {
  const { registerPlugin } = await import('@capacitor/core');
  return registerPlugin<{
    sync(options: { fences: unknown[] }): Promise<{ registered: boolean; count: number }>;
    check(): Promise<GeoPermission>;
    requestForeground(): Promise<GeoPermission>;
    openSettings(): Promise<void>;
  }>('HebGeofence');
}

export async function geoPermission(): Promise<GeoPermission> {
  if (!isNative()) return DENIED;
  try {
    return await (await geofencePlugin()).check();
  } catch {
    return DENIED;
  }
}

export async function requestGeoForeground(): Promise<GeoPermission> {
  if (!isNative()) return DENIED;
  try {
    return await (await geofencePlugin()).requestForeground();
  } catch {
    return DENIED;
  }
}

export async function openAppSettings(): Promise<void> {
  if (!isNative()) return;
  try {
    await (await geofencePlugin()).openSettings();
  } catch {
    /* אין מסך הגדרות - אין מה לעשות מכאן */
  }
}

/**
 * מוסר למערכת ההפעלה את הגדרות שיש לנטר.
 *
 * מחזיר אם הן באמת נרשמו. `false` פירושו שההרשאה חסרה - ואז המסך צריך
 * להגיד את זה, כי שום דבר אחר לא יסגיר את הכשל.
 */
export async function syncNativeGeofences(fences: unknown[]): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const result = await (await geofencePlugin()).sync({ fences });
    return result.registered;
  } catch {
    return false;
  }
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
  // אתחול כושל לא נשמר: אחרת ניסיון אחד שנפל היה נועל את ההתחברות עד
  // הפעלה מחדש של האפליקציה
  socialReady ??= SocialLogin.initialize({ google: { webClientId } }).catch((e: unknown) => {
    socialReady = null;
    throw e;
  });
  await socialReady;
  /*
    בלי scopes במפורש. הפלאגין מבקש ממילא email, profile ו-openid, וכל
    scope מפורש - גם אם הוא אחד מהם - מפעיל בצד אנדרואיד מסלול הרשאות
    אחר שדורש לרשת את MainActivity. זו הייתה השגיאה "You CANNOT use
    scopes without modifying the main activity".
  */
  const res = await SocialLogin.login({ provider: 'google', options: {} });
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

/* ==========================================================================
   קבצים
   ========================================================================== */

/**
 * התוכן של קובץ הזמנה שנפתח באפליקציה מבחוץ, פעם אחת.
 *
 * הקובץ מגיע כ-`content://` שרק ל-Activity שקיבלה אותו יש הרשאה לקרוא,
 * ולכן `MainActivity` קוראת אותו מיד ושומרת עותק; כאן הוא נלקח ונמחק.
 */
export async function takeIncomingCalendar(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { registerPlugin } = await import('@capacitor/core');
    const HebFiles = registerPlugin<{
      takeIncoming(): Promise<{ text?: string }>;
    }>('HebFiles');
    const { text } = await HebFiles.takeIncoming();
    return text || null;
  } catch {
    return null;
  }
}

/**
 * שומר קובץ טקסט ופותח את גיליון השיתוף של המערכת.
 *
 * בדפדפן זו הורדה רגילה. באנדרואיד `<a download>` על Blob לא עושה כלום -
 * אין מי שיקלוט אותו ב-WebView - ולכן שם הקובץ נכתב בצד הנייטיבי ונמסר
 * דרך FileProvider.
 *
 * @returns הודעת שגיאה, או null בהצלחה
 */
export async function shareTextFile(
  filename: string,
  text: string,
  mimeType = 'text/plain',
  title = '',
): Promise<string | null> {
  if (!isNative()) return 'not-native';
  try {
    const { registerPlugin } = await import('@capacitor/core');
    const HebFiles = registerPlugin<{
      shareText(options: {
        filename: string;
        text: string;
        mimeType: string;
        title: string;
      }): Promise<void>;
    }>('HebFiles');
    await HebFiles.shareText({ filename, text, mimeType, title });
    return null;
  } catch (e) {
    return (e as { message?: string }).message?.trim() || 'השיתוף נכשל';
  }
}

/* ==========================================================================
   משוב מישוש
   ========================================================================== */

/**
 * סולם המישוש, בשתי דרגות.
 *
 * באנדרואיד זה משוב המישוש של המערכת - קליק, לא רטט של טלפון שמצלצל.
 * בדפדפן נופלים ל-API הפשוט, שהוא כל מה שיש שם.
 *
 * הכלל מתי לקרוא נמצא ב-CLAUDE.md לצד טוקני התנועה, כי זו אותה מערכת:
 * בחירה שקטה, שינוי מצב `light`, ומה שכותב או מוחק `medium`.
 */
export type HapticWeight = 'light' | 'medium';

/** משך הנפילה בדפדפן, במילישניות */
const FALLBACK_MS: Record<HapticWeight, number> = { light: 10, medium: 20 };

export async function haptic(weight: HapticWeight = 'light'): Promise<void> {
  if (isNative()) {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({
        style: weight === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
      });
      return;
    } catch {
      /* אין רכיב רטט - ממשיכים לנפילה */
    }
  }
  try {
    navigator.vibrate?.(FALLBACK_MS[weight]);
  } catch {
    /* לא נתמך */
  }
}
