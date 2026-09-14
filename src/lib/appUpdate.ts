/**
 * עדכון האפליקציה, בשני מסלולים.
 *
 * האפליקציה לא מופצת בחנות, ולכן אין מי שיודיע שיש גרסה חדשה. במקום זה
 * היא קוראת את השחרור הקבוע `android-latest` שאליו כל בנייה דוחפת את
 * התוצרים שלה, ומחליטה מה נדרש:
 *
 * - **עדכון חי** כשהשתנה רק הקוד של הדפדפן. חבילת ה-web מוחלפת בתוך
 *   האפליקציה, בלי APK ובלי אישור התקנה. זה הרוב המוחלט של השינויים.
 * - **התקנת APK** כשהשתנה משהו נייטיבי - פלאגין, הרשאה, אייקון. אלה
 *   חיים בתוך החבילה המותקנת, ואי אפשר להחליף אותם מבחוץ.
 *
 * איך יודעים במה מדובר: כל בנייה חותמת את חבילת ה-web בטביעה של הקוד
 * הנייטיבי - הקומיט האחרון שנגע ב-`android/`, ב-`package-lock.json` או
 * ב-`capacitor.config.ts`. טביעה זהה לזו שרצה כאן פירושה שהמעטפת לא
 * השתנתה, והחלפת ה-web לבדה מספיקה.
 *
 * למה דרך ה-API ולא הורדה ישירה של קובץ מניפסט: כתובת ההורדה של נכס
 * בשחרור מפנה לאחסון חיצוני בלי כותרות CORS, ו-fetch מתוך ה-WebView היה
 * נכשל שם בשקט. תשובת ה-API מגיעה עם `Access-Control-Allow-Origin`.
 * ההורדה עצמה של החבילה נעשית בצד הנייטיבי, ולכן שם CORS אינו רלוונטי.
 *
 * החוזה מול הבנייה הוא שמות הנכסים, ב-`.github/workflows/android.yml`:
 * `heb-calendar-<versionName>.apk` ו-`bundle-<מספר בנייה>-<טביעה>.zip`.
 */

import { isNative } from './native';

const RELEASE_API =
  (import.meta.env.VITE_UPDATE_RELEASE_API as string | undefined) ??
  'https://api.github.com/repos/ohavs/HEB-CALENDAR-2026/releases/tags/android-latest';

/** מספר הבנייה של הקוד שרץ כרגע. אחרי עדכון חי זה כבר לא מספר ה-APK. */
const BUILD_NUMBER = Number(import.meta.env.VITE_BUILD_NUMBER ?? 0);

/** טביעת הקוד הנייטיבי שהקוד הזה נבנה מולה. */
const NATIVE_REV = (import.meta.env.VITE_NATIVE_REV as string | undefined) ?? '';

/** לא בודקים בכל פתיחה. מרווח של שש שעות מספיק לאפליקציה שמתעדכנת בימים. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const LAST_CHECK_KEY = 'heb-cal:update-checked';
const DISMISSED_KEY = 'heb-cal:update-dismissed';

/** `heb-calendar-1.0.7.apk` → versionName 1.0.7, versionCode 7 */
const APK_NAME = /^heb-calendar-((?:\d+\.)+(\d+))\.apk$/;
/** `bundle-7-a1b2c3d.zip` → מספר בנייה 7, טביעה a1b2c3d */
const BUNDLE_NAME = /^bundle-(\d+)-([0-9a-f]+)\.zip$/;

export type ReleaseAsset = { name: string; browser_download_url: string };
export type ReleasePayload = { body?: string | null; assets?: ReleaseAsset[] };

export type ReleaseInfo = {
  apk?: { versionCode: number; versionName: string; url: string };
  bundle?: { build: number; nativeRev: string; url: string };
  notes?: string;
};

export type UpdateInfo = {
  /** 'web' = עדכון חי בתוך האפליקציה, 'native' = צריך להתקין APK */
  kind: 'web' | 'native';
  versionName: string;
  versionCode: number;
  url: string;
  notes?: string;
  currentVersionName: string;
};

/**
 * מוציא את תוצרי השחרור מתשובת ה-API.
 *
 * בוחר את המספר הגבוה ביותר ולא את הראשון ברשימה: בשחרור יכולים להישאר
 * קבצים של בניות קודמות, והסדר שה-API מחזיר אינו מובטח.
 */
export function parseRelease(payload: ReleasePayload): ReleaseInfo {
  const info: ReleaseInfo = { notes: payload.body?.trim() || undefined };

  for (const asset of payload.assets ?? []) {
    const apk = APK_NAME.exec(asset.name);
    if (apk) {
      const versionCode = Number(apk[2]);
      if (Number.isFinite(versionCode) && !(info.apk && versionCode <= info.apk.versionCode)) {
        info.apk = { versionCode, versionName: apk[1], url: asset.browser_download_url };
      }
      continue;
    }
    const bundle = BUNDLE_NAME.exec(asset.name);
    if (bundle) {
      const build = Number(bundle[1]);
      if (Number.isFinite(build) && !(info.bundle && build <= info.bundle.build)) {
        info.bundle = { build, nativeRev: bundle[2], url: asset.browser_download_url };
      }
    }
  }
  return info;
}

/**
 * מחליט איזה עדכון נדרש, אם בכלל.
 *
 * @param installedNativeCode ה-versionCode של ה-APK המותקן
 * @param runningBuild מספר הבנייה של הקוד שרץ כרגע
 * @param runningNativeRev טביעת הקוד הנייטיבי של הקוד שרץ כרגע
 */
export function decideUpdate(
  release: ReleaseInfo,
  installedNativeCode: number,
  runningBuild: number,
  runningNativeRev: string,
): Omit<UpdateInfo, 'currentVersionName'> | null {
  const { bundle, apk, notes } = release;

  // המעטפת לא השתנתה - מספיק להחליף את הקוד של הדפדפן
  if (bundle && runningNativeRev && bundle.nativeRev === runningNativeRev) {
    if (bundle.build > runningBuild) {
      return {
        kind: 'web',
        versionCode: bundle.build,
        versionName: `1.0.${bundle.build}`,
        url: bundle.url,
        notes,
      };
    }
    return null;
  }

  // המעטפת השתנתה, או שאין לנו טביעה להשוות אליה
  if (apk && apk.versionCode > installedNativeCode) {
    return {
      kind: 'native',
      versionCode: apk.versionCode,
      versionName: apk.versionName,
      url: apk.url,
      notes,
    };
  }
  return null;
}

/** האם המשתמש כבר סגר את ההודעה על הגרסה הזו. */
export function isDismissed(versionCode: number): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === String(versionCode);
  } catch {
    return false;
  }
}

export function dismissUpdate(versionCode: number): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(versionCode));
  } catch {
    /* מצב פרטי */
  }
}

function dueForCheck(now: number): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY) ?? 0);
    return !Number.isFinite(last) || now - last > CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

function markChecked(now: number): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(now));
  } catch {
    /* מצב פרטי */
  }
}

/** מספר הגרסה של ה-APK המותקן, כפי שאנדרואיד מכיר אותו. */
async function installedVersion(): Promise<{ code: number; name: string } | null> {
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return { code: Number(info.build), name: info.version };
  } catch {
    return null;
  }
}

/**
 * בודק אם יש גרסה חדשה.
 *
 * @param force מדלג על מרווח הבדיקה - לכפתור "בדיקת עדכון" בהגדרות
 */
export async function checkForUpdate(force = false): Promise<UpdateInfo | null> {
  if (!isNative()) return null;
  const now = Date.now();
  if (!force && !dueForCheck(now)) return null;

  const installed = await installedVersion();
  if (!installed || !Number.isFinite(installed.code)) return null;

  try {
    const res = await fetch(RELEASE_API, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    markChecked(now);
    const release = parseRelease((await res.json()) as ReleasePayload);
    const update = decideUpdate(
      release,
      installed.code,
      BUILD_NUMBER || installed.code,
      NATIVE_REV,
    );
    return update && { ...update, currentVersionName: `1.0.${BUILD_NUMBER || installed.code}` };
  } catch {
    // אין רשת, או שהשחרור לא זמין. בדיקת עדכון שנכשלה אינה אירוע.
    return null;
  }
}

/* ==========================================================================
   עדכון חי
   ========================================================================== */

/**
 * מאשר שהגרסה הנוכחית עלתה בהצלחה.
 *
 * זו רשת הביטחון של העדכון החי: חבילה שלא מדווחת שהיא מוכנה בתוך הזמן
 * הקצוב נחשבת שבורה, והפלאגין חוזר לבד לחבילה הקודמת. בלי הקריאה הזו כל
 * עדכון היה מתגלגל אחורה.
 */
export async function notifyBundleReady(): Promise<void> {
  if (!isNative()) return;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.notifyAppReady();
  } catch {
    /* לא נייטיב, או שהפלאגין אינו זמין */
  }
}

/**
 * מוריד ומחיל חבילת web חדשה. האפליקציה נטענת מחדש בסיום.
 * @returns הודעת שגיאה, או null בהצלחה (ואז ממילא הכול נטען מחדש)
 */
export async function applyWebUpdate(update: UpdateInfo): Promise<string | null> {
  if (!isNative() || update.kind !== 'web') return 'העדכון הזה דורש התקנה';
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const bundle = await CapacitorUpdater.download({
      url: update.url,
      version: update.versionName,
    });
    // set מחליף את ההקשר כולו, ולכן אין טעם בקוד אחריו
    await CapacitorUpdater.set({ id: bundle.id });
    return null;
  } catch (e) {
    return (e as { message?: string }).message?.trim() || 'העדכון נכשל';
  }
}

/** מחרוזת הגרסה שרצה כרגע, לתצוגה בהגדרות. */
export async function currentVersionLabel(): Promise<string | null> {
  const installed = await installedVersion();
  if (!installed) return null;
  const build = BUILD_NUMBER || installed.code;
  // אחרי עדכון חי הקוד חדש מה-APK, ואז מראים את שניהם
  return build === installed.code
    ? `${installed.name} (${installed.code})`
    : `1.0.${build} · מעטפת ${installed.name}`;
}
