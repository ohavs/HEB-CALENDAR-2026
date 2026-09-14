/**
 * אתחול Firebase.
 *
 * הקונפיג נקרא ממשתני סביבה בזמן build (import.meta.env.VITE_*) ולא מקודד
 * בקוד. מפתחות של אפליקציית web הם מזהים ציבוריים - ההגנה על הנתונים היא
 * ב-Firestore Security Rules וב-Authorized domains, ראו firestore.rules.
 *
 * הייבוא של firebase נעשה דינמית, כדי שהאפליקציה תיטען מהר ותעבוד במלואה
 * גם בלי חיבור לענן (מצב מקומי בלבד).
 */
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { isNative } from './native';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

/** האם יש קונפיג תקין. אם לא - האפליקציה עובדת מקומית בלבד. */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

type Services = { app: FirebaseApp; auth: Auth; db: Firestore };

let servicesPromise: Promise<Services> | null = null;

export function getFirebase(): Promise<Services> {
  if (!isFirebaseConfigured) {
    return Promise.reject(new Error('firebase-not-configured'));
  }
  servicesPromise ??= (async () => {
    const [{ initializeApp, getApps, getApp }, { getAuth }, { getFirestore }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const app = getApps().length ? getApp() : initializeApp(config as Required<typeof config>);
    return { app, auth: getAuth(app), db: getFirestore(app) };
  })();
  return servicesPromise;
}

/** אנליטיקס - רק בפרודקשן וכשיש measurementId. נכשל בשקט. */
export async function initAnalytics(): Promise<void> {
  // אנליטיקס של web מודד ביקורי דפים. באפליקציה אין דפים, והמדידה לא
  // הייתה מתארת שום דבר אמיתי - בתמורה לחבילה שנטענת ולבקשות רשת.
  if (isNative()) return;
  if (!isFirebaseConfigured || !config.measurementId || !import.meta.env.PROD) return;
  try {
    const { app } = await getFirebase();
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (await isSupported()) getAnalytics(app);
  } catch {
    /* אנליטיקס אינו קריטי */
  }
}
