/* eslint-disable no-undef */
/**
 * הרחבה ל-service worker: הצגת תזכורות שהגיע זמנן.
 * הקובץ מיובא אל תוך ה-service worker שנוצר אוטומטית (workbox.importScripts),
 * ולכן הוא JavaScript רגיל בלי מודולים.
 *
 * התזכורות נכתבות על ידי האפליקציה ל-IndexedDB. כאן אנחנו רק קוראים מה שהגיע
 * זמנו ומציגים. זה מאפשר לתזכורות לעבוד גם כשהאפליקציה סגורה, בדפדפנים
 * שתומכים ב-Periodic Background Sync (כרום באנדרואיד, לאפליקציה מותקנת).
 */

const DB_NAME = 'heb-cal';
const DB_VERSION = 1;
const STORE = 'reminders';
/** חלון "איחור" - תזכורת שאיחרנו בה יותר מכך לא תוצג, כדי לא להציק */
const LATE_WINDOW_MS = 3 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function dueReminders() {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const all = await new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  const now = Date.now();
  return all.filter((r) => r.at <= now && r.at > now - LATE_WINDOW_MS);
}

async function removeReminders(ids) {
  if (!ids.length) return;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  for (const id of ids) store.delete(id);
  await txDone(tx);
}

async function flushDueReminders() {
  let due = [];
  try {
    due = await dueReminders();
  } catch (e) {
    return;
  }
  for (const r of due) {
    try {
      await self.registration.showNotification(r.title, {
        body: r.body,
        tag: r.id,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-64.png',
        lang: 'he',
        dir: 'rtl',
        requireInteraction: false,
        data: { url: r.url || '/' },
      });
    } catch (e) {
      /* אם ההצגה נכשלה נשאיר את התזכורת לניסיון הבא */
      continue;
    }
  }
  await removeReminders(due.map((r) => r.id)).catch(() => undefined);
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'heb-cal-reminders') {
    event.waitUntil(flushDueReminders());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'heb-cal-reminders') {
    event.waitUntil(flushDueReminders());
  }
});

/** האפליקציה יכולה לבקש בדיקה מיידית */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'flush-reminders') {
    event.waitUntil(flushDueReminders());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && target !== '/') {
            try {
              await client.navigate(target);
            } catch (e) {
              /* לא קריטי */
            }
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
