/**
 * בדיקת כללי ה-Firestore מול האמולטור.
 *
 * הנתיב `lists/` הוא היחיד במסד שחוצה משתמשים, ולכן הוא היחיד שבו טעות
 * מדליפה נתונים בין חשבונות. כללים נכשלים בשקט - הכתיבה פשוט נדחית -
 * ואי אפשר לבדוק אותם מהאפליקציה, ולכן הם נבדקים כאן.
 *
 * הבדיקה אינה חלק מ-`npm test`: היא דורשת את אמולטור Firestore (64MB,
 * הורדה חד־פעמית) ו-JDK, ואין טעם לשלם על זה בכל ריצה. מריצים אותה
 * כשנוגעים ב-firestore.rules.
 *
 *   npm i -g firebase-tools
 *   firebase setup:emulators:firestore
 *   npm i --no-save @firebase/rules-unit-testing
 *   firebase emulators:start --only firestore --project rules-check &
 *   node scripts/rules-check.mjs
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where, arrayUnion } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const RULES = readFileSync(fileURLToPath(new URL('../firestore.rules', import.meta.url)), 'utf8');
const A = { sub: 'uidA', email: 'a@example.com', email_verified: true };
const B = { sub: 'uidB', email: 'b@example.com', email_verified: true };
const C = { sub: 'uidC', email: 'c@example.com', email_verified: true };

let pass = 0, fail = 0;
const check = async (name, fn) => {
  try { await fn(); console.log('  ✓', name); pass++; }
  catch (e) { console.log('  ✗', name, '\n      ', String(e.message).slice(0, 160)); fail++; }
};

const env = await initializeTestEnvironment({
  projectId: 'rules-check',
  firestore: { rules: RULES, host: '127.0.0.1', port: 8080 },
});

const listDoc = (name = 'קניות', owner = 'uidA', members = ['uidA']) => ({
  name, color: 'violet', ownerUid: owner, memberUids: members,
  members: Object.fromEntries(members.map((u) => [u, { uid: u, name: u, email: u + '@example.com', role: u === owner ? 'owner' : 'member', joinedAt: 1 }])),
  categories: [], createdAt: 1, updatedAt: 1,
});

await env.clearFirestore();
const a = env.authenticatedContext('uidA', A).firestore();
const b = env.authenticatedContext('uidB', B).firestore();
const c = env.authenticatedContext('uidC', C).firestore();
const anon = env.unauthenticatedContext().firestore();

console.log('\nיצירת רשימה');
await check('הבעלים יוצר רשימה', () => assertSucceeds(setDoc(doc(a, 'lists/L1'), listDoc())));
await check('אי אפשר ליצור רשימה בשם מישהו אחר', () =>
  assertFails(setDoc(doc(b, 'lists/L2'), listDoc('x', 'uidA', ['uidA']))));
await check('אי אפשר ליצור רשימה עם חברים נוספים מראש', () =>
  assertFails(setDoc(doc(a, 'lists/L3'), listDoc('x', 'uidA', ['uidA', 'uidB']))));
await check('אנונימי לא יוצר כלום', () =>
  assertFails(setDoc(doc(anon, 'lists/L4'), listDoc())));

console.log('\nקריאה');
await check('הבעלים קורא', () => assertSucceeds(getDoc(doc(a, 'lists/L1'))));
await check('זר לא קורא', () => assertFails(getDoc(doc(b, 'lists/L1'))));
await check('זר לא קורא פריטים', () => assertFails(getDoc(doc(b, 'lists/L1/items/i1'))));

console.log('\nפריטים');
await check('הבעלים כותב פריט', () =>
  assertSucceeds(setDoc(doc(a, 'lists/L1/items/i1'), { title: 'חלב', date: '2026-09-15', createdBy: 'uidA', createdAt: 1, updatedAt: 1 })));
await check('זר לא כותב פריט', () =>
  assertFails(setDoc(doc(b, 'lists/L1/items/i2'), { title: 'פריצה', date: '2026-09-15', createdBy: 'uidB', createdAt: 1, updatedAt: 1 })));

console.log('\nהזמנות');
const inv = { listId: 'L1', listName: 'קניות', fromUid: 'uidA', fromName: 'A', toEmail: 'b@example.com', createdAt: 1 };
await check('חבר מזמין', () => assertSucceeds(setDoc(doc(a, 'invites/L1__b@example.com'), inv)));
await check('מזהה שאינו תואם לאימייל נדחה', () =>
  assertFails(setDoc(doc(a, 'invites/WRONG'), inv)));
await check('זר לא מזמין לרשימה שאינו בה', () =>
  assertFails(setDoc(doc(c, 'invites/L1__c@example.com'), { ...inv, fromUid: 'uidC', toEmail: 'c@example.com' })));
await check('אי אפשר להזמין את עצמי', () =>
  assertFails(setDoc(doc(a, 'invites/L1__a@example.com'), { ...inv, toEmail: 'a@example.com' })));
await check('הנמען קורא את ההזמנה שלו', () => assertSucceeds(getDoc(doc(b, 'invites/L1__b@example.com'))));
await check('אחר לא קורא הזמנה של מישהו', () => assertFails(getDoc(doc(c, 'invites/L1__b@example.com'))));
await check('שאילתה מסוננת לאימייל שלי עוברת', () =>
  assertSucceeds(getDocs(query(collection(b, 'invites'), where('toEmail', '==', 'b@example.com')))));
await check('שאילתה לא מסוננת נדחית', () =>
  assertFails(getDocs(collection(b, 'invites'))));

console.log('\nהצטרפות');
const join = (db, uid) => updateDoc(doc(db, 'lists/L1'), {
  memberUids: arrayUnion(uid),
  [`members.${uid}`]: { uid, name: uid, email: uid + '@example.com', role: 'member', joinedAt: 2 },
  updatedAt: 2,
});
await check('מי שאין לו הזמנה לא מצטרף', () => assertFails(join(c, 'uidC')));
await check('המוזמן מצטרף', () => assertSucceeds(join(b, 'uidB')));
await check('אחרי ההצטרפות הוא קורא', () => assertSucceeds(getDoc(doc(b, 'lists/L1'))));
await check('ועכשיו גם כותב פריטים', () =>
  assertSucceeds(setDoc(doc(b, 'lists/L1/items/i3'), { title: 'לחם', date: '2026-09-15', createdBy: 'uidB', createdAt: 1, updatedAt: 1 })));

console.log('\nהסלמת הרשאות');
await check('חבר לא הופך את עצמו לבעלים', () =>
  assertFails(updateDoc(doc(b, 'lists/L1'), { ownerUid: 'uidB', updatedAt: 3 })));
await check('חבר לא מוסיף אדם שלישי', () =>
  assertFails(updateDoc(doc(b, 'lists/L1'), { memberUids: ['uidA', 'uidB', 'uidC'], updatedAt: 3 })));
await check('חבר לא מוחק את הרשימה', () => assertFails(deleteDoc(doc(b, 'lists/L1'))));
await check('חבר כן משנה קטגוריות', () =>
  assertSucceeds(updateDoc(doc(b, 'lists/L1'), { categories: [{ id: 'c1', name: 'בית', color: 'mint' }], updatedAt: 3 })));

console.log('\nעזיבה ומחיקה');
await check('חבר עוזב את עצמו', () =>
  assertSucceeds(updateDoc(doc(b, 'lists/L1'), { memberUids: ['uidA'], [`members.uidB`]: null, updatedAt: 4 })));
await check('הבעלים מוחק את הרשימה', () => assertSucceeds(deleteDoc(doc(a, 'lists/L1'))));

console.log('\nנתיבים אישיים לא נפגעו');
await check('משתמש כותב לעצמו', () =>
  assertSucceeds(setDoc(doc(a, 'users/uidA/events/e1'), { title: 't', date: '2026-09-15', createdAt: 1, updatedAt: 1 })));
await check('ולא לאחר', () =>
  assertFails(setDoc(doc(b, 'users/uidA/events/e2'), { title: 't', date: '2026-09-15', createdAt: 1, updatedAt: 1 })));

/*
  אלה נכשלו בשקט עד שהוסר `match /{rest=**}` תחת users/: תבנית רקורסיבית
  שמתירה מבטלת כל כלל מחמיר יותר על אותו נתיב, ולכן validEvent וחסמי
  הגודל היו קוד מת. הבדיקות כאן קיימות כדי שלא יחזור.
*/
console.log('\nהוולידציה תחת users/ באמת פועלת');
const ev = { title: 't', date: '2026-09-15', createdAt: 1, updatedAt: 1 };
await check('אירוע בלי כותרת נדחה', () =>
  assertFails(setDoc(doc(a, 'users/uidA/events/x1'), { date: '2026-09-15', createdAt: 1, updatedAt: 1 })));
await check('אירוע עם שדה זר נדחה', () =>
  assertFails(setDoc(doc(a, 'users/uidA/events/x2'), { ...ev, admin: true })));
await check('כותרת ענקית נדחית', () =>
  assertFails(setDoc(doc(a, 'users/uidA/events/x3'), { ...ev, title: 'x'.repeat(5000) })));
await check('meta מנופח נדחה', () =>
  assertFails(setDoc(doc(a, 'users/uidA/meta/m1'),
    Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i])))));
await check('אירוע תקין עדיין נכתב', () =>
  assertSucceeds(setDoc(doc(a, 'users/uidA/events/x4'), ev)));
/*
  `hasOnly` הוא whitelist, ולכן שדה שלא נמנה בו נדחה. הדגל הזה לא היה
  ברשימה - וגם לא נכתב בקוד - ולכן תזכורת בלי תאריך איבדה אותו ברגע
  שהיא עברה דרך הענן, וצצה בלוח ביום שנשמר לה רק כדי שתדע לאן לחזור.
*/
await check('תזכורת בלי תאריך נכתבת עם הדגל', () =>
  assertSucceeds(setDoc(doc(a, 'users/uidA/events/x5'), { ...ev, undated: true })));
await check('הדגל חייב להיות בוליאני', () =>
  assertFails(setDoc(doc(a, 'users/uidA/events/x6'), { ...ev, undated: 'yes' })));

console.log('\nטוקני push');
const TOKEN = { token: 'fcm-token', platform: 'android', updatedAt: 1 };
await check('הבעלים כותב טוקן של עצמו', () =>
  assertSucceeds(setDoc(doc(a, 'users/uidA/push/t1'), TOKEN)));
await check('הבעלים קורא את הטוקנים של עצמו', () =>
  assertSucceeds(getDoc(doc(a, 'users/uidA/push/t1'))));
await check('אחר אינו קורא טוקן של מישהו', () =>
  assertFails(getDoc(doc(b, 'users/uidA/push/t1'))));
await check('אחר אינו כותב טוקן אצל מישהו', () =>
  assertFails(setDoc(doc(b, 'users/uidA/push/t2'), TOKEN)));
await check('טוקן ענק נדחה', () =>
  assertFails(setDoc(doc(a, 'users/uidA/push/t3'), { ...TOKEN, token: 'x'.repeat(5000) })));
await check('שדה זר נדחה', () =>
  assertFails(setDoc(doc(a, 'users/uidA/push/t4'), { ...TOKEN, admin: true })));
await check('טוקן שאינו מחרוזת נדחה', () =>
  assertFails(setDoc(doc(a, 'users/uidA/push/t5'), { ...TOKEN, token: 42 })));
await check('הבעלים מוחק טוקן שלו', () =>
  assertSucceeds(deleteDoc(doc(a, 'users/uidA/push/t1'))));

await env.cleanup();
console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
