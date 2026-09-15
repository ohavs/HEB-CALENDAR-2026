/**
 * החיבור של הרשימות המשותפות ל-Firestore.
 *
 * כל מה שנוגע לרשת יושב כאן, והמודל ב-`sharedLists.ts` נשאר טהור.
 *
 * שלושה מאזינים, ולא אחד גדול:
 *   - הרשימות שאני חבר בהן (`array-contains` על `memberUids`)
 *   - ההזמנות שממתינות לי (`toEmail == האימייל שלי`)
 *   - הפריטים של הרשימה שנבחרה בלבד
 *
 * הפריטים נטענים רק לרשימה הפתוחה כי מאזין לכל רשימה היה קריאה מתמשכת
 * לכל אחת מהן, גם לאלה שאיש לא מסתכל עליהן.
 */
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { EventColor, UserEvent } from '@/types';
import {
  inviteId,
  newId,
  normalizeEmail,
  type ListCategory,
  type ListInvite,
  type SharedItem,
  type SharedList,
} from './sharedLists';
import { getFirebase, isFirebaseConfigured } from './firebase';
import { useAuthStore } from '@/store/auth';
import { useSharedStore } from '@/store/shared';

type Unsub = () => void;

let db: Firestore | null = null;
let activeUid: string | null = null;
let stopLists: Unsub | null = null;
let stopInvites: Unsub | null = null;
let stopItems: Unsub | null = null;
let itemsListId: string | null = null;

/* ==========================================================================
   המרה
   ========================================================================== */

function toList(id: string, d: Record<string, unknown>): SharedList | null {
  if (typeof d.name !== 'string' || typeof d.ownerUid !== 'string') return null;
  return {
    id,
    name: d.name,
    color: (d.color as EventColor) ?? 'violet',
    ownerUid: d.ownerUid,
    memberUids: Array.isArray(d.memberUids) ? (d.memberUids as string[]) : [],
    members: (d.members as SharedList['members']) ?? {},
    categories: Array.isArray(d.categories) ? (d.categories as ListCategory[]) : [],
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
  };
}

function toItem(id: string, d: Record<string, unknown>): SharedItem | null {
  if (typeof d.title !== 'string' || typeof d.date !== 'string') return null;
  return {
    id,
    title: d.title,
    date: d.date,
    endDate: (d.endDate as string | undefined) || undefined,
    startTime: (d.startTime as string | null) ?? null,
    endTime: (d.endTime as string | null) ?? null,
    allDay: Boolean(d.allDay),
    location: (d.location as string | undefined) || undefined,
    notes: (d.notes as string | undefined) || undefined,
    color: (d.color as EventColor) ?? 'violet',
    reminderMinutes: typeof d.reminderMinutes === 'number' ? d.reminderMinutes : null,
    repeat: (d.repeat as UserEvent['repeat']) ?? 'none',
    exceptions:
      d.exceptions && typeof d.exceptions === 'object'
        ? (d.exceptions as UserEvent['exceptions'])
        : undefined,
    undated: d.undated === true ? true : undefined,
    categoryId: (d.categoryId as string | undefined) || undefined,
    createdBy: (d.createdBy as string) ?? '',
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
    deleted: d.deleted === true,
  };
}

/** Firestore דוחה `undefined`, ולכן כל שדה ריק נכתב כ-null או מושמט. */
function itemDoc(item: SharedItem): Record<string, unknown> {
  const out: Record<string, unknown> = {
    title: item.title,
    date: item.date,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    allDay: Boolean(item.allDay),
    color: item.color,
    reminderMinutes: item.reminderMinutes ?? null,
    repeat: item.repeat,
    createdBy: item.createdBy,
    createdAt: item.createdAt,
    updatedAt: Date.now(),
  };
  if (item.endDate) out.endDate = item.endDate;
  if (item.location) out.location = item.location;
  if (item.notes) out.notes = item.notes;
  if (item.exceptions) out.exceptions = item.exceptions;
  if (item.undated) out.undated = true;
  if (item.categoryId) out.categoryId = item.categoryId;
  if (item.deleted) out.deleted = true;
  return out;
}

/* ==========================================================================
   מאזינים
   ========================================================================== */

function fail(e: unknown) {
  const message = (e as Error)?.message ?? 'שגיאה';
  useSharedStore.setState({ error: message, live: false });
}

export async function startShared(): Promise<void> {
  if (!isFirebaseConfigured) return;
  const user = useAuthStore.getState().user;
  if (!user) {
    stopShared();
    return;
  }
  if (activeUid === user.uid) return;
  stopShared();
  activeUid = user.uid;

  try {
    ({ db } = await getFirebase());
  } catch {
    return;
  }
  if (activeUid !== user.uid || !db) return;

  stopLists = onSnapshot(
    query(collection(db, 'lists'), where('memberUids', 'array-contains', user.uid)),
    (snap) => {
      const lists: SharedList[] = [];
      snap.forEach((d) => {
        const list = toList(d.id, d.data() as Record<string, unknown>);
        if (list) lists.push(list);
      });
      lists.sort((a, b) => a.createdAt - b.createdAt);
      useSharedStore.setState({ lists, live: true, loaded: true, error: null });
      // הרשימה שנבחרה אולי נמחקה או נעזבה
      const { selectedId } = useSharedStore.getState();
      if (selectedId && !lists.some((l) => l.id === selectedId)) {
        useSharedStore.getState().select(lists[0]?.id ?? null);
      }
      watchItems();
    },
    fail,
  );

  /*
    שאילתת ההזמנות חייבת להיות מסוננת לאימייל שלי: הכלל מתיר קריאה רק
    למי שההזמנה בשמו, ושאילתה רחבה יותר נדחית כולה ולא רק בשורות
    החורגות.
  */
  const email = normalizeEmail(user.email ?? '');
  if (email) {
    stopInvites = onSnapshot(
      query(collection(db, 'invites'), where('toEmail', '==', email)),
      (snap) => {
        const invites: ListInvite[] = [];
        snap.forEach((d) => {
          const v = d.data() as Record<string, unknown>;
          if (typeof v.listId !== 'string') return;
          invites.push({
            id: d.id,
            listId: v.listId,
            listName: (v.listName as string) ?? 'רשימה',
            fromUid: (v.fromUid as string) ?? '',
            fromName: (v.fromName as string) ?? '',
            toEmail: (v.toEmail as string) ?? email,
            createdAt: typeof v.createdAt === 'number' ? v.createdAt : Date.now(),
          });
        });
        useSharedStore.setState({ invites });
      },
      fail,
    );
  }
}

/** מחליף את מאזין הפריטים לרשימה שנבחרה, אם היא השתנתה. */
export function watchItems(): void {
  if (!db) return;
  const state = useSharedStore.getState();
  const listId = state.lists.find((l) => l.id === state.selectedId)?.id ?? state.lists[0]?.id ?? null;
  if (listId === itemsListId) return;

  stopItems?.();
  stopItems = null;
  itemsListId = listId;
  if (!listId) return;

  stopItems = onSnapshot(
    collection(db, 'lists', listId, 'items'),
    (snap) => {
      const items: SharedItem[] = [];
      snap.forEach((d) => {
        const item = toItem(d.id, d.data() as Record<string, unknown>);
        if (item && !item.deleted) items.push(item);
      });
      useSharedStore.setState((s) => ({ items: { ...s.items, [listId]: items } }));
    },
    fail,
  );
}

export function stopShared(): void {
  stopLists?.();
  stopInvites?.();
  stopItems?.();
  stopLists = stopInvites = stopItems = null;
  itemsListId = null;
  activeUid = null;
  useSharedStore.getState().reset();
}

/* ==========================================================================
   כתיבה
   ========================================================================== */

function requireUser() {
  const user = useAuthStore.getState().user;
  if (!user || !db) throw new Error('צריך להתחבר');
  return { user, db };
}

export async function createList(name: string, color: EventColor): Promise<string> {
  const { user, db: store } = requireUser();
  const id = newId();
  const now = Date.now();
  await setDoc(doc(store, 'lists', id), {
    name: name.trim().slice(0, 80),
    color,
    ownerUid: user.uid,
    memberUids: [user.uid],
    members: {
      [user.uid]: {
        uid: user.uid,
        name: user.name ?? '',
        email: normalizeEmail(user.email ?? ''),
        role: 'owner',
        joinedAt: now,
      },
    },
    categories: [],
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function renameList(listId: string, name: string): Promise<void> {
  const { db: store } = requireUser();
  await updateDoc(doc(store, 'lists', listId), {
    name: name.trim().slice(0, 80),
    updatedAt: Date.now(),
  });
}

export async function deleteList(listId: string): Promise<void> {
  const { db: store } = requireUser();
  await deleteDoc(doc(store, 'lists', listId));
}

export async function setCategories(listId: string, categories: ListCategory[]): Promise<void> {
  const { db: store } = requireUser();
  await updateDoc(doc(store, 'lists', listId), {
    categories: categories.slice(0, 30),
    updatedAt: Date.now(),
  });
}

export async function invite(list: SharedList, email: string): Promise<void> {
  const { user, db: store } = requireUser();
  const to = normalizeEmail(email);
  await setDoc(doc(store, 'invites', inviteId(list.id, to)), {
    listId: list.id,
    listName: list.name,
    fromUid: user.uid,
    fromName: user.name ?? normalizeEmail(user.email ?? ''),
    toEmail: to,
    createdAt: Date.now(),
  });
}

/**
 * קבלת הזמנה.
 *
 * הסדר חשוב: קודם מצטרפים ורק אז מוחקים את ההזמנה. ההזמנה היא מה שמאשר
 * את ההצטרפות מבחינת הכלל, ומחיקה מוקדמת הייתה משאירה אותנו בחוץ בלי
 * דרך לחזור.
 */
export async function acceptInvite(inv: ListInvite): Promise<void> {
  const { user, db: store } = requireUser();
  await updateDoc(doc(store, 'lists', inv.listId), {
    memberUids: arrayUnion(user.uid),
    [`members.${user.uid}`]: {
      uid: user.uid,
      name: user.name ?? '',
      email: normalizeEmail(user.email ?? ''),
      role: 'member',
      joinedAt: Date.now(),
    },
    updatedAt: Date.now(),
  });
  await deleteDoc(doc(store, 'invites', inv.id));
}

export async function declineInvite(inv: ListInvite): Promise<void> {
  const { db: store } = requireUser();
  await deleteDoc(doc(store, 'invites', inv.id));
}

export async function leaveList(listId: string): Promise<void> {
  const { user, db: store } = requireUser();
  await updateDoc(doc(store, 'lists', listId), {
    memberUids: arrayRemove(user.uid),
    [`members.${user.uid}`]: deleteField(),
    updatedAt: Date.now(),
  });
}

export async function saveItem(listId: string, item: SharedItem): Promise<void> {
  const { db: store } = requireUser();
  await setDoc(doc(store, 'lists', listId, 'items', item.id), itemDoc(item));
}

export async function removeItem(listId: string, itemId: string): Promise<void> {
  const { db: store } = requireUser();
  await deleteDoc(doc(store, 'lists', listId, 'items', itemId));
}

/** סימון "בוצע" נשמר כחריג לפי התאריך המקורי, בדיוק כמו באירוע אישי. */
export async function setItemDone(
  listId: string,
  item: SharedItem,
  sourceKey: string,
  done: boolean,
): Promise<void> {
  const { db: store } = requireUser();
  const exceptions = { ...(item.exceptions ?? {}) };
  if (done) exceptions[sourceKey] = { ...(exceptions[sourceKey] ?? {}), done: true };
  else {
    const rest = { ...(exceptions[sourceKey] ?? {}) };
    delete rest.done;
    if (Object.keys(rest).length) exceptions[sourceKey] = rest;
    else delete exceptions[sourceKey];
  }
  await updateDoc(doc(store, 'lists', listId, 'items', item.id), {
    exceptions,
    updatedAt: Date.now(),
  });
}
