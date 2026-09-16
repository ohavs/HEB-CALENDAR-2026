/**
 * פעולות על מופע, בלי לדעת מאיפה הוא הגיע.
 *
 * מאז שפריטים מרשימה משותפת מופיעים בלוח, אותו כרטיס יכול לשאת שני
 * דברים שונים לגמרי: אירוע אישי שחי בחנות המקומית, ופריט משותף שחי
 * בענן. הם נראים אותו דבר ומתנהגים אותו דבר - אבל הכתיבה עליהם הולכת
 * לשני מקומות.
 *
 * בלי ההפרדה הזו הקריאה לחנות המקומית פשוט *לא עושה כלום* על פריט
 * משותף: המזהה אינו נמצא ב-`byId`, הפונקציה מחזירה את המצב כמות שהוא,
 * ומבחינת המשתמש ההקשה נבלעה. זה הסוג הגרוע של באג - בלי שגיאה ובלי
 * רמז.
 *
 * לכן יש כאן מקור אחד לכל מסך שמצייר כרטיסים.
 */
import { useCallback } from 'react';
import type { Occurrence } from '@/lib/recurrence';
import type { SharedItem, SharedList } from '@/lib/sharedLists';
import { setItemDone } from '@/lib/sharedSync';
import { useEventsStore } from '@/store/events';
import { useSharedStore } from '@/store/shared';

export type SharedTarget = { list: SharedList; item: SharedItem };

/** מאיתור מופע משותף לרשימה ולפריט שמאחוריו, או null אם הוא אישי. */
export function useFindShared(): (occurrence: Occurrence) => SharedTarget | null {
  const lists = useSharedStore((s) => s.lists);
  const items = useSharedStore((s) => s.items);

  return useCallback(
    (occurrence) => {
      const tag = occurrence.shared;
      if (!tag) return null;
      const list = lists.find((l) => l.id === tag.listId);
      const item = (items[tag.listId] ?? []).find((i) => i.id === occurrence.baseId);
      return list && item ? { list, item } : null;
    },
    [lists, items],
  );
}

/** סימון "בוצע", לכל סוג מופע. */
export function useToggleDone(): (occurrence: Occurrence, done: boolean) => void {
  const setLocalDone = useEventsStore((s) => s.setOccurrenceDone);
  const findShared = useFindShared();

  return useCallback(
    (occurrence, done) => {
      const target = findShared(occurrence);
      if (target) {
        void setItemDone(target.list.id, target.item, occurrence.sourceKey, done);
        return;
      }
      setLocalDone(occurrence.baseId, occurrence.sourceKey, done);
    },
    [findShared, setLocalDone],
  );
}
