/**
 * סנכרון לענן (Firestore) כשהמשתמש מחובר.
 *
 * העיקרון: האפליקציה היא local-first. כל הנתונים נשמרים תמיד מקומית,
 * והענן הוא רק שכבת גיבוי וסנכרון בין מכשירים. פתרון ההתנגשויות הוא
 * last-write-wins לפי updatedAt, עם סימני מחיקה (tombstones) כדי שמחיקה
 * במכשיר אחד תתפשט לשאר.
 */
import type { Settings, UserEvent } from '@/types';
import { getFirebase, isFirebaseConfigured } from './firebase';
import { useAuthStore } from '@/store/auth';
import { useEventsStore } from '@/store/events';
import { useSettingsStore } from '@/store/settings';

const PUSH_DEBOUNCE_MS = 900;

type Unsub = () => void;

let activeUid: string | null = null;
let teardown: Unsub[] = [];
let pushTimer: ReturnType<typeof setTimeout> | null = null;
/** updatedAt של כל אירוע כפי שנדחף/נקרא מהענן, כדי לא לכתוב שוב לחינם */
const syncedAt = new Map<string, number>();
let syncedSettingsAt = 0;
let applyingRemote = false;

function stopSession() {
  for (const fn of teardown) {
    try {
      fn();
    } catch {
      /* ניקוי בלבד */
    }
  }
  teardown = [];
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  syncedAt.clear();
  syncedSettingsAt = 0;
  activeUid = null;
}

/** ממיר מסמך מהענן לאירוע מקומי, עם ולידציה מינימלית. */
function toUserEvent(id: string, data: Record<string, unknown>): UserEvent | null {
  if (typeof data.title !== 'string' || typeof data.date !== 'string') return null;
  return {
    id,
    title: data.title,
    date: data.date,
    endDate: (data.endDate as string | undefined) || undefined,
    startTime: (data.startTime as string | null) ?? null,
    endTime: (data.endTime as string | null) ?? null,
    allDay: Boolean(data.allDay),
    location: (data.location as string | undefined) || undefined,
    notes: (data.notes as string | undefined) || undefined,
    color: (data.color as UserEvent['color']) ?? 'violet',
    reminderMinutes:
      typeof data.reminderMinutes === 'number' ? data.reminderMinutes : null,
    repeat: (data.repeat as UserEvent['repeat']) ?? 'none',
    exceptions:
      data.exceptions && typeof data.exceptions === 'object'
        ? (data.exceptions as UserEvent['exceptions'])
        : undefined,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    deleted: data.deleted === true,
  };
}

/** שדות האירוע כפי שהם נכתבים לענן (בלי undefined, ש-Firestore דוחה). */
function toDoc(ev: UserEvent): Record<string, unknown> {
  return {
    title: ev.title,
    date: ev.date,
    endDate: ev.endDate ?? null,
    startTime: ev.startTime ?? null,
    endTime: ev.endTime ?? null,
    allDay: ev.allDay,
    location: ev.location ?? null,
    notes: ev.notes ?? null,
    color: ev.color,
    reminderMinutes: ev.reminderMinutes,
    repeat: ev.repeat,
    exceptions: ev.exceptions ?? null,
    createdAt: ev.createdAt,
    updatedAt: ev.updatedAt,
    deleted: ev.deleted === true,
  };
}

async function startSession(uid: string) {
  const { db } = await getFirebase();
  const {
    collection,
    doc,
    onSnapshot,
    setDoc,
    writeBatch,
    getDoc,
  } = await import('firebase/firestore');

  if (activeUid !== uid) return; // התחלפה התחברות בזמן הטעינה

  const eventsCol = collection(db, 'users', uid, 'events');
  const settingsDoc = doc(db, 'users', uid, 'meta', 'settings');

  /* ---------- משיכה: אירועים ---------- */
  const unsubEvents = onSnapshot(
    eventsCol,
    (snap) => {
      const remote: UserEvent[] = [];
      for (const d of snap.docs) {
        const ev = toUserEvent(d.id, d.data() as Record<string, unknown>);
        if (!ev) continue;
        remote.push(ev);
        syncedAt.set(ev.id, ev.updatedAt);
      }
      // מה שיש לו שינוי מקומי שטרם נדחף - בדיוק אותו סינון שהדחיפה עושה.
      // אירוע כזה שנדרס על ידי הענן הוא התנגשות אמיתית.
      const unpushed = new Set<string>();
      for (const ev of Object.values(useEventsStore.getState().byId)) {
        if ((syncedAt.get(ev.id) ?? -1) < ev.updatedAt) unpushed.add(ev.id);
      }
      applyingRemote = true;
      useEventsStore.getState().mergeRemote(remote, unpushed);
      applyingRemote = false;
    },
    () => {
      /* שגיאת הרשאות או נתק - נשארים עם הנתונים המקומיים */
    },
  );
  teardown.push(unsubEvents);

  /* ---------- משיכה: הגדרות ---------- */
  try {
    const snap = await getDoc(settingsDoc);
    const data = snap.data() as { settings?: Settings; updatedAt?: number } | undefined;
    const local = useSettingsStore.getState();
    if (data?.settings && (data.updatedAt ?? 0) > local.updatedAt) {
      applyingRemote = true;
      useSettingsStore.setState({
        settings: { ...local.settings, ...data.settings },
        updatedAt: data.updatedAt ?? Date.now(),
        revision: local.revision + 1,
      });
      applyingRemote = false;
      syncedSettingsAt = data.updatedAt ?? 0;
    }
  } catch {
    /* לא קריטי */
  }

  /* ---------- דחיפה ---------- */
  const push = async () => {
    pushTimer = null;
    if (activeUid !== uid) return;
    try {
      const all = Object.values(useEventsStore.getState().byId);
      const dirty = all.filter((ev) => (syncedAt.get(ev.id) ?? -1) < ev.updatedAt);
      if (dirty.length) {
        // כתיבה באצווה, בקבוצות של עד 400 מסמכים
        for (let i = 0; i < dirty.length; i += 400) {
          const batch = writeBatch(db);
          for (const ev of dirty.slice(i, i + 400)) {
            batch.set(doc(eventsCol, ev.id), toDoc(ev));
          }
          await batch.commit();
        }
        for (const ev of dirty) syncedAt.set(ev.id, ev.updatedAt);
      }

      const s = useSettingsStore.getState();
      if (s.updatedAt > syncedSettingsAt) {
        await setDoc(settingsDoc, { settings: s.settings, updatedAt: s.updatedAt });
        syncedSettingsAt = s.updatedAt;
      }
    } catch {
      /* ננסה שוב בשינוי הבא */
    }
  };

  const schedulePush = () => {
    if (applyingRemote) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(push, PUSH_DEBOUNCE_MS);
  };

  teardown.push(useEventsStore.subscribe(schedulePush));
  teardown.push(useSettingsStore.subscribe(schedulePush));

  // דחיפה ראשונה: מעלה לענן מה שנוצר לפני ההתחברות
  schedulePush();
}

/**
 * מתחיל להאזין למצב ההתחברות ומפעיל/מכבה סנכרון בהתאם.
 * מחזיר פונקציית ניקוי.
 */
export function startSync(): Unsub {
  if (!isFirebaseConfigured) return () => undefined;

  const handle = (uid: string | null) => {
    if (uid === activeUid) return;
    stopSession();
    if (uid) {
      activeUid = uid;
      void startSession(uid);
    }
  };

  handle(useAuthStore.getState().user?.uid ?? null);
  const unsub = useAuthStore.subscribe((s) => handle(s.user?.uid ?? null));

  return () => {
    unsub();
    stopSession();
  };
}
