/**
 * הטוקן של המכשיר, בדרך לענן.
 *
 * ההפרדה כאן מכוונת: `native.ts` יודע לבקש טוקן ממערכת ההפעלה, וזה כל
 * מה שהוא יודע. הכתיבה ל-Firestore היא עניין של רשת, והיא שייכת לכאן -
 * אותה הפרדה שמאפשרת ל-`src/lib` להישאר נבדק ב-node.
 *
 * הטוקנים יושבים תחת `users/{uid}/push`, מסמך לכל מכשיר. אף לקוח אחר לא
 * יכול לקרוא אותם, ורק הפונקציה - שרצה כ-admin - ניגשת אליהם. טוקן
 * דלוף מאפשר לשלוח התראות למכשיר של מישהו אחר.
 *
 * מזהה המסמך הוא גיבוב של הטוקן ולא מזהה אקראי: אותו מכשיר שנרשם שוב
 * דורס את עצמו במקום להוסיף שורה. בלי זה הרשימה הייתה תופחת בכל
 * פתיחה, ובכל הזמנה היינו שולחים לאותו מכשיר עשר פעמים.
 */
import { doc, setDoc } from 'firebase/firestore';
import { getFirebase, isFirebaseConfigured } from './firebase';
import { registerPush } from './native';
import { useAuthStore } from '@/store/auth';

/**
 * גיבוב קצר ויציב, רק כדי לגזור מזהה מסמך.
 *
 * אינו קריפטוגרפי ואינו צריך להיות: הטוקן עצמו נשמר בשדה, והגיבוב
 * משמש לזיהוי בלבד. FNV-1a כי הוא שורה אחת ואין לו תלות.
 */
function tokenId(token: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

/** מונע רישום כפול באותה הפעלה. */
let registered: string | null = null;

/**
 * רושם את המכשיר, אם יש למי. נכשל בשקט: היעדר push אינו שובר דבר -
 * הבאנר בתוך מסך התזכורות עדיין מציג את ההזמנה.
 */
export async function syncPushToken(): Promise<void> {
  if (!isFirebaseConfigured) return;
  const user = useAuthStore.getState().user;
  if (!user) return;

  try {
    const token = await registerPush();
    if (!token || registered === token) return;

    const { db } = await getFirebase();
    await setDoc(
      doc(db, 'users', user.uid, 'push', tokenId(token)),
      { token, platform: 'android', updatedAt: Date.now() },
      { merge: true },
    );
    registered = token;
  } catch {
    /* אין רשת, אין הרשאה, או אין שירותי גוגל - אין התראה חיצונית */
  }
}

/** לבדיקות בלבד. */
export const __tokenId = tokenId;
