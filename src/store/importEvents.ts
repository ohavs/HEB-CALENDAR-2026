/**
 * הוספת אירועים מקובץ ICS לחנות.
 *
 * שני מסלולים מגיעים לכאן: ייבוא גיבוי מההגדרות, וקובץ הזמנה שנפתח
 * באפליקציה מבחוץ. מקור אחד, כדי שהכלל נגד כפילויות לא יתפצל.
 *
 * הייבוא לא דורס: כל אירוע נוסף כחדש. אירוע שכבר קיים עם אותה כותרת
 * ואותו תאריך מדולג, כדי שייבוא חוזר של אותו קובץ לא ייצור כפילויות -
 * וזו טעות קלה מאוד לעשות.
 */
import type { ImportResult } from '@/lib/ics';
import { useEventsStore, type EventDraft } from './events';

export type ImportOutcome = {
  /** המזהים שנוצרו, לביטול */
  ids: string[];
  duplicates: number;
};

export function importEvents(events: ImportResult['events']): ImportOutcome {
  const store = useEventsStore.getState();
  // חתימה של כותרת ותאריך, כדי שייבוא חוזר לא ייצור כפילויות
  const existing = new Set(
    Object.values(store.byId)
      .filter((e) => !e.deleted)
      .map((e) => `${e.title}|${e.date}`),
  );

  const ids: string[] = [];
  let duplicates = 0;
  for (const draft of events) {
    const signature = `${draft.title}|${draft.date}`;
    if (existing.has(signature)) {
      duplicates += 1;
      continue;
    }
    existing.add(signature);
    const created = store.add(draft as EventDraft);
    // add אינה יודעת על חריגים; מצרפים אותם אחרי היצירה
    if (draft.exceptions) {
      for (const [key, exception] of Object.entries(draft.exceptions)) {
        store.updateOccurrence(created.id, key, exception);
      }
    }
    ids.push(created.id);
  }
  return { ids, duplicates };
}
