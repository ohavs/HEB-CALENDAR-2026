/**
 * התראה על הזמנה לרשימה משותפת.
 *
 * זו הפונקציה היחידה במאגר, והיא קיימת מסיבה אחת: **Firestore אינו דוחף
 * דבר.** מסמך הזמנה חדש מגיע למכשיר של הנמען רק אם הוא מחובר ומאזין
 * ברגע הזה. כשהאפליקציה סגורה אין מאזין, ולכן צריך מי שישלח - וזה
 * חייב להיות צד שסומכים עליו: מפתח השליחה של FCM הוא סוד, ואסור שיהיה
 * באפליקציה.
 *
 * מכאן גם שתי הפעולות שרק צד מהימן יכול לעשות, ושתיהן עוקפות את הכללים
 * בכוונה:
 *
 * 1. **תרגום אימייל ל-uid.** ההזמנה נשלחת לכתובת, כי בשלב ההזמנה אין
 *    לנו דרך לדעת אם יש למי שמולנו חשבון בכלל. `getUserByEmail` הוא
 *    admin בלבד - אין ללקוח דרך לשאול "למי שייכת הכתובת הזו", וטוב שכך.
 * 2. **קריאת הטוקנים של הנמען.** הם יושבים תחת `users/{uid}/push`,
 *    ושום לקוח אחר לא יכול לקרוא אותם. טוקן דלוף מאפשר לשלוח התראות
 *    למכשיר של מישהו אחר.
 *
 * מה שהפונקציה לא עושה: היא לא מאשרת את ההזמנה ולא נוגעת בחברות. מי
 * שמצטרף עושה זאת מהאפליקציה, וכללי האבטחה הם שמאמתים אותו מול מסמך
 * ההזמנה. הפונקציה רק מודיעה.
 */
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

/*
  האזור חייב להתאים למיקום של מסד הנתונים.

  טריגר של Firestore עובר דרך Eventarc, ו-Eventarc דורש שהטריגר יישב
  באותו מיקום של המסד שהוא מאזין לו. מסד ב-eur3 ופונקציה ב-us-central1
  לא ייפרסו יחד, והכשל מגיע רק בסוף הפריסה.

  זה משתנה סביבה ולא קבוע בקוד, כדי שהחלפת מיקום תהיה שינוי בהגדרות
  ולא בקוד. ברירת המחדל מתאימה למסד ב-eur3.
*/
setGlobalOptions({ region: process.env.FUNCTION_REGION || 'europe-west1' });

initializeApp();

/** הערוץ באנדרואיד. חייב להתאים למה שהאפליקציה יוצרת ב-native.ts. */
const CHANNEL = 'invites';

/**
 * טוקן שנדחה סופית - המכשיר נמחק, האפליקציה הוסרה, או הטוקן הוחלף.
 * טוקן כזה נמחק, אחרת הרשימה תופחת לנצח ובכל שליחה נשלם על כישלון.
 */
const DEAD = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export const notifyInvite = onDocumentCreated('invites/{inviteId}', async (event) => {
  const invite = event.data?.data();
  if (!invite) return;

  const toEmail = String(invite.toEmail ?? '').trim().toLowerCase();
  if (!toEmail) return;

  const listName = String(invite.listName ?? 'רשימה משותפת');
  const fromName = String(invite.fromName ?? '').trim();

  /*
    אין חשבון לכתובת הזו - וזה מצב תקין לגמרי, לא שגיאה: אפשר להזמין
    מישהו לפני שנרשם. מסמך ההזמנה ממתין, והוא יראה אותו ברגע שייכנס
    עם אותה כתובת.
  */
  let uid;
  try {
    ({ uid } = await getAuth().getUserByEmail(toEmail));
  } catch (e) {
    if (e?.code === 'auth/user-not-found') {
      logger.info('אין עדיין חשבון לכתובת שהוזמנה; ההזמנה ממתינה');
      return;
    }
    throw e;
  }

  const snap = await getFirestore().collection(`users/${uid}/push`).get();
  const tokens = snap.docs.map((d) => d.get('token')).filter((t) => typeof t === 'string' && t);
  if (!tokens.length) {
    logger.info('לנמען אין מכשיר רשום');
    return;
  }

  const body = fromName
    ? `${fromName} הזמין אתכם ל״${listName}״`
    : `הוזמנתם ל״${listName}״`;

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: 'הזמנה לרשימה משותפת', body },
    // הלחיצה פותחת את הלשונית המשותפת, בדיוק כמו הוידג׳ט
    data: { type: 'invite', listId: String(invite.listId ?? '') },
    android: {
      priority: 'high',
      notification: { channelId: CHANNEL, sound: 'default' },
    },
  });

  /* ניקוי טוקנים מתים, באותה הזדמנות שבה למדנו שהם מתים */
  const dead = [];
  response.responses.forEach((r, i) => {
    if (!r.success && DEAD.has(r.error?.code)) dead.push(snap.docs[i].ref.delete());
  });
  if (dead.length) await Promise.all(dead);

  logger.info(`נשלח ל-${response.successCount} מכשירים, ${dead.length} טוקנים מתים נמחקו`);
});
