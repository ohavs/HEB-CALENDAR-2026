/**
 * האירועים כפי שהם נכתבים ללוח השנה של המכשיר.
 *
 * אפליקציות וידג׳טים ולוחות אחרים אינם מכירים אותנו - הם קוראים רק את
 * `CalendarContract`, ספק היומן של אנדרואיד. לכן הלוח שלנו מתפרסם שם
 * כלוח מקומי לקריאה בלבד: **כיוון אחד, מאיתנו החוצה.** סנכרון דו־כיווני
 * היה מנוע סנכרון שני, עם התנגשויות משלו.
 *
 * הרשימה שטוחה: כל מופע הוא אירוע בפני עצמו, בלי RRULE. `expandEvents`
 * כבר יודע אדר ב׳, חריגים ומופעים שהוזזו - ו-RRULE לא היה יודע אף אחד
 * מהם. המחיר הוא חלון זמן מוגבל, שזז קדימה בכל פתיחה.
 */
import type { DateKey } from '@/types';
import { addDays, combineDateTime, dateKey, keyToDate } from './dates';
import type { Occurrence } from './recurrence';

export type SystemEvent = {
  title: string;
  /** מילישניות. ב"כל היום" - חצות UTC, כמו ש-CalendarContract מחייב */
  begin: number;
  end: number;
  allDay: boolean;
  location?: string;
  notes?: string;
};

export const SYSTEM_PAST_DAYS = 30;
export const SYSTEM_AHEAD_DAYS = 365;
/** אירוע יומי לשנה הוא 365 שורות; מעבר לזה זו כבר הצפה של ספק היומן */
export const MAX_SYSTEM_EVENTS = 3000;
const DEFAULT_LENGTH_MS = 60 * 60 * 1000;

function utcMidnight(key: DateKey): number {
  const d = keyToDate(key);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * מופע אחד לכל אירוע, גם כשהוא פרוש על כמה ימים: `expandEvents` מחזיר
 * שורה לכל יום בפרישה, ובלוח של המכשיר זה היה מופיע כאירועים נפרדים.
 */
export function buildSystemEvents(occurrences: Occurrence[]): SystemEvent[] {
  const out: SystemEvent[] = [];
  for (const occ of occurrences) {
    if (occ.spanIndex !== 0) continue;
    const first = occ.spanStart;
    const last = occ.spanLength > 1 ? addDays(keyToDate(first), occ.spanLength - 1) : keyToDate(first);

    const text = {
      title: occ.shared ? `${occ.title} · ${occ.shared.listName}` : occ.title,
      ...(occ.location ? { location: occ.location } : {}),
      ...(occ.notes ? { notes: occ.notes } : {}),
    };

    if (occ.allDay || !occ.startTime) {
      out.push({
        ...text,
        begin: utcMidnight(first),
        // הסיום בלעדי: חצות שאחרי היום האחרון
        end: Date.UTC(last.getFullYear(), last.getMonth(), last.getDate() + 1),
        allDay: true,
      });
      continue;
    }

    const begin = combineDateTime(first, occ.startTime).getTime();
    let end = occ.endTime ? combineDateTime(dateKey(last), occ.endTime).getTime() : 0;
    if (end <= begin) end = begin + DEFAULT_LENGTH_MS;
    out.push({ ...text, begin, end, allDay: false });
  }

  out.sort((a, b) => a.begin - b.begin);
  return out.slice(0, MAX_SYSTEM_EVENTS);
}
