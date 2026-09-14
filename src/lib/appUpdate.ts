/**
 * בדיקת עדכון לאפליקציית האנדרואיד.
 *
 * האפליקציה לא מופצת בחנות, ולכן אין מי שיודיע שיש גרסה חדשה. במקום זה
 * היא קוראת את השחרור הקבוע `android-latest` שאליו כל בנייה דוחפת את
 * ה-APK, ומשווה למספר הגרסה שלה עצמה.
 *
 * למה דרך ה-API ולא הורדה ישירה של קובץ מניפסט: כתובת ההורדה של נכס
 * בשחרור מפנה לאחסון חיצוני בלי כותרות CORS, ו-fetch מתוך ה-WebView היה
 * נכשל שם בשקט. תשובת ה-API, לעומת זאת, מגיעה עם `Access-Control-Allow-Origin`.
 *
 * החוזה מול הבנייה: שם קובץ ה-APK הוא `heb-calendar-<versionName>.apk`,
 * והמספר האחרון בו הוא ה-versionCode - שניהם נגזרים מאותו מספר ריצה
 * ב-`.github/workflows/android.yml`. שינוי בשם הקובץ שם מחייב שינוי כאן.
 *
 * ההשוואה היא על המספר ולא על המחרוזת: השוואת מחרוזות הייתה קובעת
 * ש-"1.0.9" גדול מ-"1.0.10".
 */

import { isNative } from './native';

const RELEASE_API =
  (import.meta.env.VITE_UPDATE_RELEASE_API as string | undefined) ??
  'https://api.github.com/repos/ohavs/HEB-CALENDAR-2026/releases/tags/android-latest';

/** לא בודקים בכל פתיחה. מרווח של שש שעות מספיק לאפליקציה שמתעדכנת בימים. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const LAST_CHECK_KEY = 'heb-cal:update-checked';
const DISMISSED_KEY = 'heb-cal:update-dismissed';

/** `heb-calendar-1.0.7.apk` → versionName 1.0.7, versionCode 7 */
const APK_NAME = /^heb-calendar-((?:\d+\.)+(\d+))\.apk$/;

export type ReleaseAsset = { name: string; browser_download_url: string };
export type ReleasePayload = { body?: string | null; assets?: ReleaseAsset[] };

export type UpdateManifest = {
  versionCode: number;
  versionName: string;
  apk: string;
  notes?: string;
};

export type UpdateInfo = UpdateManifest & { currentVersionName: string };

/**
 * מוציא את פרטי הגרסה מתשובת ה-API. מחזיר null לשחרור בלי APK תקין.
 *
 * בוחר את הגרסה הגבוהה ביותר ולא את הראשונה ברשימה: בשחרור יכולים
 * להישאר קבצים של בניות קודמות, והסדר שה-API מחזיר אינו מובטח.
 */
export function parseRelease(payload: ReleasePayload): UpdateManifest | null {
  let best: UpdateManifest | null = null;
  for (const asset of payload.assets ?? []) {
    const match = APK_NAME.exec(asset.name);
    if (!match) continue;
    const versionCode = Number(match[2]);
    if (!Number.isFinite(versionCode)) continue;
    if (best && versionCode <= best.versionCode) continue;
    best = {
      versionCode,
      versionName: match[1],
      apk: asset.browser_download_url,
      notes: payload.body?.trim() || undefined,
    };
  }
  return best;
}

/** האם המניפסט מתאר גרסה חדשה יותר מזו שמותקנת. */
export function isNewer(manifest: UpdateManifest, currentCode: number): boolean {
  return Number.isFinite(manifest.versionCode) && manifest.versionCode > currentCode;
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

/** מספר הגרסה המותקנת, כפי שאנדרואיד מכיר אותו. */
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
 * @returns פרטי הגרסה החדשה, או null כשאין כזו או שאין מה לבדוק
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
    const manifest = parseRelease((await res.json()) as ReleasePayload);
    if (!manifest || !isNewer(manifest, installed.code)) return null;
    return { ...manifest, currentVersionName: installed.name };
  } catch {
    // אין רשת, או שהשחרור לא זמין. בדיקת עדכון שנכשלה אינה אירוע.
    return null;
  }
}

/** מחרוזת הגרסה המותקנת, לתצוגה בהגדרות. */
export async function currentVersionLabel(): Promise<string | null> {
  const installed = await installedVersion();
  return installed ? `${installed.name} (${installed.code})` : null;
}
