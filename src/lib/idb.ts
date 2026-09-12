/**
 * עטיפה דקה ל-IndexedDB לאחסון התזכורות.
 * ה-service worker קורא מאותו מקום (public/sw-reminders.js), ולכן שם המסד
 * וגרסתו חייבים להישאר מסונכרנים בין שני הקבצים.
 */

const DB_NAME = 'heb-cal';
const DB_VERSION = 1;
const STORE = 'reminders';

export type StoredReminder = {
  id: string;
  at: number;
  title: string;
  body: string;
  url?: string;
};

function openDb(): Promise<IDBDatabase> {
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

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const idbAvailable = (): boolean => typeof indexedDB !== 'undefined';

/** מחליף את כל התזכורות המאוחסנות ברשימה חדשה. */
export async function replaceReminders(items: StoredReminder[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  store.clear();
  for (const item of items) store.put(item);
  await done(tx);
  db.close();
}

export async function getReminders(): Promise<StoredReminder[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const items = await new Promise<StoredReminder[]>((resolve, reject) => {
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as StoredReminder[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function deleteReminders(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  for (const id of ids) store.delete(id);
  await done(tx);
  db.close();
}
