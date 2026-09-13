/**
 * ייצוא וייבוא של קובץ ICS (RFC 5545).
 *
 * שתי סיבות: גיבוי שלא תלוי בחשבון ובענן, ודרך להכניס לוח קיים מגוגל
 * בלי להקליד מחדש.
 *
 * מה נתמך ומה לא
 * --------------
 * הייצוא כותב את מה שהאפליקציה יודעת: כותרת, תאריך ושעה, מיקום, הערות,
 * חזרה בסיסית וחריגים למופע יחיד. חזרה שנתית לפי התאריך *העברי* אין לה
 * ייצוג ב-RFC 5545, ולכן היא נכתבת כ-YEARLY לועזי עם הערה בתיאור -
 * וברור שהייבוא חזרה יאבד את התכונה העברית. זה עדיף על לא לייצא בכלל.
 *
 * הייבוא סלחני בכוונה: קובץ מגוגל או מאאוטלוק מכיל שדות שאין להם כאן
 * מקום, והם פשוט מדולגים. אירוע בלי כותרת או בלי תאריך תקין מדולג גם
 * הוא, במקום להפיל את הייבוא כולו.
 */
import type { DateKey, EventColor, UserEvent } from '@/types';
import { addDays, dateKey, keyToDate } from './dates';

const PRODID = '-//לוח שנה עברי//heb-calendar//HE';
/** שורה ב-ICS לא אמורה לעבור 75 אוקטטים */
const FOLD_AT = 73;

/* ==========================================================================
   ייצוא
   ========================================================================== */

/** מסמן תווים שיש להם משמעות תחבירית ב-ICS. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** שובר שורה ארוכה לפי הכלל של RFC 5545: המשך מתחיל ברווח. */
function fold(line: string): string {
  if (line.length <= FOLD_AT) return line;
  const parts: string[] = [line.slice(0, FOLD_AT)];
  let rest = line.slice(FOLD_AT);
  while (rest.length > FOLD_AT - 1) {
    parts.push(' ' + rest.slice(0, FOLD_AT - 1));
    rest = rest.slice(FOLD_AT - 1);
  }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}

/** YYYYMMDD - לאירוע של כל היום */
function icsDate(key: DateKey): string {
  return key.replace(/-/g, '');
}

/** YYYYMMDDTHHMMSS בשעון מקומי (בלי Z), כי האירוע שייך לשעון המקום */
function icsDateTime(key: DateKey, time: string): string {
  return `${icsDate(key)}T${time.replace(':', '')}00`;
}

function icsStamp(at: number): string {
  return new Date(at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const RRULE: Record<UserEvent['repeat'], string | null> = {
  none: null,
  weekly: 'FREQ=WEEKLY',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
  // אין ייצוג ללוח העברי ב-RFC 5545; ההערה בתיאור מסבירה מה אבד
  'hebrew-yearly': 'FREQ=YEARLY',
};

function eventLines(ev: UserEvent): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${ev.id}@heb-calendar`];
  lines.push(`DTSTAMP:${icsStamp(ev.updatedAt)}`);

  if (ev.allDay) {
    // ב-ICS סוף אירוע של כל היום הוא בלעדי, ולכן יום אחרי האחרון
    const last = ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date;
    lines.push(`DTSTART;VALUE=DATE:${icsDate(ev.date)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(dateKey(addDays(keyToDate(last), 1)))}`);
  } else {
    const start = ev.startTime ?? '09:00';
    const endKey = ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date;
    lines.push(`DTSTART:${icsDateTime(ev.date, start)}`);
    lines.push(`DTEND:${icsDateTime(endKey, ev.endTime ?? start)}`);
  }

  lines.push(`SUMMARY:${escapeText(ev.title)}`);
  if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);

  const notes: string[] = [];
  if (ev.notes) notes.push(ev.notes);
  if (ev.repeat === 'hebrew-yearly') {
    notes.push('חזרה שנתית לפי התאריך העברי (לא ניתנת לייצוג בתקן ICS)');
  }
  if (notes.length) lines.push(`DESCRIPTION:${escapeText(notes.join('\n'))}`);

  const rule = RRULE[ev.repeat];
  if (rule) lines.push(`RRULE:${rule}`);

  // מופעים שבוטלו מיוצאים כ-EXDATE, שזו בדיוק המשמעות בתקן
  const cancelled = Object.entries(ev.exceptions ?? {})
    .filter(([, ex]) => ex.cancelled)
    .map(([key]) => (ev.allDay ? icsDate(key) : icsDateTime(key, ev.startTime ?? '09:00')));
  if (cancelled.length) {
    lines.push(
      ev.allDay
        ? `EXDATE;VALUE=DATE:${cancelled.join(',')}`
        : `EXDATE:${cancelled.join(',')}`,
    );
  }

  lines.push('END:VEVENT');
  return lines;
}

/** בונה את תוכן הקובץ. */
export function toICS(events: UserEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:לוח שנה עברי',
  ];
  for (const ev of events) {
    if (ev.deleted) continue;
    lines.push(...eventLines(ev));
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** שם קובץ עם תאריך, כדי ששני גיבויים לא ידרסו זה את זה. */
export function icsFileName(now = new Date()): string {
  return `heb-calendar-${dateKey(now)}.ics`;
}

/* ==========================================================================
   ייבוא
   ========================================================================== */

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** מחזיר שורות מאוחות, אחרי ביטול הקיפול. */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** "DTSTART;TZID=Asia/Jerusalem" → { name, params } */
function parseKey(key: string): { name: string; params: Record<string, string> } {
  const [name, ...rest] = key.split(';');
  const params: Record<string, string> = {};
  for (const part of rest) {
    const eq = part.indexOf('=');
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params };
}

type ParsedDate = { key: DateKey; time: string | null };

/** מקבל DATE או DATE-TIME ומחזיר מפתח לוקאלי ושעה. */
function parseIcsDate(value: string): ParsedDate | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mm, , z] = m;

  // זמן ב-UTC מומר לשעון המקומי; זמן בלי Z כבר מקומי מבחינת המשתמש
  if (hh && z) {
    const at = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm));
    return {
      key: dateKey(at),
      time: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
    };
  }
  return { key: `${y}-${mo}-${d}`, time: hh ? `${hh}:${mm}` : null };
}

const FROM_RRULE: { test: RegExp; repeat: UserEvent['repeat'] }[] = [
  { test: /FREQ=WEEKLY/i, repeat: 'weekly' },
  { test: /FREQ=MONTHLY/i, repeat: 'monthly' },
  { test: /FREQ=YEARLY/i, repeat: 'yearly' },
];

const COLORS: EventColor[] = ['violet', 'mint', 'rose', 'peach', 'sky', 'slate'];

/** צבע יציב לפי הכותרת, כדי שייבוא חוזר ייתן את אותם צבעים. */
function colorFor(title: string): EventColor {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash = (hash * 31 + title.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export type ImportResult = {
  events: Omit<UserEvent, 'id' | 'createdAt' | 'updatedAt'>[];
  /** כמה רשומות דולגו כי לא היה בהן מספיק מידע */
  skipped: number;
};

/**
 * קורא קובץ ICS. סלחני בכוונה - שדות שאין להם מקום כאן מדולגים, ורשומה
 * פגומה לא מפילה את הייבוא כולו.
 */
export function fromICS(text: string): ImportResult {
  const events: ImportResult['events'] = [];
  let skipped = 0;

  let current: Record<string, { value: string; params: Record<string, string> }> | null = null;
  let exdates: string[] = [];

  for (const line of unfold(text)) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      current = {};
      exdates = [];
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      if (!current) continue;
      const built = buildEvent(current, exdates);
      if (built) events.push(built);
      else skipped += 1;
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = trimmed.indexOf(':');
    if (colon < 0) continue;
    const { name, params } = parseKey(trimmed.slice(0, colon));
    const value = trimmed.slice(colon + 1);
    if (name === 'EXDATE') exdates.push(...value.split(','));
    else current[name] = { value, params };
  }

  return { events, skipped };
}

function buildEvent(
  fields: Record<string, { value: string; params: Record<string, string> }>,
  exdates: string[],
): ImportResult['events'][number] | null {
  const title = fields.SUMMARY ? unescapeText(fields.SUMMARY.value).trim() : '';
  const startRaw = fields.DTSTART?.value;
  if (!title || !startRaw) return null;

  const start = parseIcsDate(startRaw);
  if (!start) return null;

  const allDay = start.time === null || fields.DTSTART?.params.VALUE === 'DATE';
  const end = fields.DTEND ? parseIcsDate(fields.DTEND.value) : null;

  // באירוע של כל היום סוף הטווח ב-ICS הוא בלעדי, ולכן חוזרים יום אחורה
  let endDate: DateKey | undefined;
  if (end && end.key > start.key) {
    endDate = allDay ? dateKey(addDays(keyToDate(end.key), -1)) : end.key;
    if (endDate <= start.key) endDate = undefined;
  }

  const rrule = fields.RRULE?.value ?? '';
  const repeat = FROM_RRULE.find((r) => r.test.test(rrule))?.repeat ?? 'none';

  const exceptions: UserEvent['exceptions'] = {};
  for (const raw of exdates) {
    const parsed = parseIcsDate(raw);
    if (parsed) exceptions[parsed.key] = { cancelled: true };
  }

  return {
    title,
    date: start.key,
    endDate,
    startTime: allDay ? null : start.time,
    endTime: allDay ? null : (end?.time ?? null),
    allDay,
    location: fields.LOCATION ? unescapeText(fields.LOCATION.value).trim() || undefined : undefined,
    notes: fields.DESCRIPTION
      ? unescapeText(fields.DESCRIPTION.value).trim() || undefined
      : undefined,
    color: colorFor(title),
    reminderMinutes: null,
    repeat,
    ...(Object.keys(exceptions).length ? { exceptions } : {}),
  };
}
