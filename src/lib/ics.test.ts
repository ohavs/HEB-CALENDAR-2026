/**
 * ייצוא וייבוא ICS. הבדיקה החשובה ביותר היא הלוך ושוב: מה שיצא ונכנס
 * חזרה צריך להיות אותו אירוע, חוץ ממה שהתקן לא יודע לבטא.
 */
import { describe, expect, it } from 'vitest';
import { fromICS, icsFileName, toICS } from './ics';
import { event } from '@/test/factories';

const lines = (text: string) => text.split('\r\n');
const has = (text: string, needle: string) => lines(text).some((l) => l.includes(needle));

describe('מעטפת הקובץ', () => {
  it('פותח ונסגר כ-VCALENDAR', () => {
    const out = toICS([]);
    expect(lines(out)[0]).toBe('BEGIN:VCALENDAR');
    expect(out.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('שורות מסתיימות ב-CRLF', () => {
    expect(toICS([event()])).toContain('\r\n');
  });

  it('מכריז על גרסה ועל מזהה מוצר', () => {
    const out = toICS([]);
    expect(has(out, 'VERSION:2.0')).toBe(true);
    expect(has(out, 'PRODID:')).toBe(true);
  });

  it('שם הקובץ כולל תאריך', () => {
    expect(icsFileName(new Date(2026, 8, 13))).toBe('heb-calendar-2026-09-13.ics');
  });
});

describe('ייצוא', () => {
  it('אירוע ממודד מקבל שעת התחלה וסיום', () => {
    const out = toICS([event({ date: '2026-09-13', startTime: '09:30', endTime: '10:45' })]);
    expect(has(out, 'DTSTART:20260913T093000')).toBe(true);
    expect(has(out, 'DTEND:20260913T104500')).toBe(true);
  });

  it('אירוע של כל היום מיוצא כתאריך, וסופו בלעדי', () => {
    const out = toICS([event({ date: '2026-09-13', allDay: true, startTime: null })]);
    expect(has(out, 'DTSTART;VALUE=DATE:20260913')).toBe(true);
    // סוף בלעדי: יום אחרי
    expect(has(out, 'DTEND;VALUE=DATE:20260914')).toBe(true);
  });

  it('אירוע רב־יומי מגיע עד יום אחרי הסוף', () => {
    const out = toICS([
      event({ date: '2026-09-13', endDate: '2026-09-16', allDay: true, startTime: null }),
    ]);
    expect(has(out, 'DTEND;VALUE=DATE:20260917')).toBe(true);
  });

  it('תווים תחביריים מוברחים', () => {
    const title = ['א', '; ב', ', ג', String.fromCharCode(92), ' ד'].join('');
    const out = toICS([event({ title, notes: 'שורה\nשנייה' })]);
    const bs = String.fromCharCode(92);
    expect(has(out, `SUMMARY:א${bs}; ב${bs}, ג${bs}${bs} ד`)).toBe(true);
    expect(has(out, `DESCRIPTION:שורה${bs}nשנייה`)).toBe(true);
  });

  it('חזרה שבועית מיוצאת כ-RRULE', () => {
    expect(has(toICS([event({ repeat: 'weekly' })]), 'RRULE:FREQ=WEEKLY')).toBe(true);
  });

  it('חזרה עברית מיוצאת כשנתית עם הסבר מה אבד', () => {
    const out = toICS([event({ repeat: 'hebrew-yearly' })]);
    expect(has(out, 'RRULE:FREQ=YEARLY')).toBe(true);
    expect(out).toContain('לא ניתנת לייצוג');
  });

  it('מופע שבוטל מיוצא כ-EXDATE', () => {
    const out = toICS([
      event({
        date: '2026-09-07',
        repeat: 'weekly',
        startTime: '20:00',
        exceptions: { '2026-09-14': { cancelled: true } },
      }),
    ]);
    expect(has(out, 'EXDATE:20260914T200000')).toBe(true);
  });

  it('אירוע מחוק לא מיוצא', () => {
    expect(toICS([event({ deleted: true })])).not.toContain('BEGIN:VEVENT');
  });

  it('שורה ארוכה מקופלת ולא חורגת מהמותר', () => {
    const out = toICS([event({ title: 'כותרת ארוכה מאוד '.repeat(12) })]);
    for (const line of lines(out)) {
      expect(line.length).toBeLessThanOrEqual(74);
    }
  });
});

describe('ייבוא', () => {
  const wrap = (body: string) =>
    ['BEGIN:VCALENDAR', 'VERSION:2.0', body, 'END:VCALENDAR'].join('\r\n');

  it('קורא אירוע בסיסי', () => {
    const { events } = fromICS(
      wrap(
        [
          'BEGIN:VEVENT',
          'SUMMARY:ארוחת ערב',
          'DTSTART:20260913T190000',
          'DTEND:20260913T210000',
          'LOCATION:אצל סבתא',
          'END:VEVENT',
        ].join('\r\n'),
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('ארוחת ערב');
    expect(events[0].date).toBe('2026-09-13');
    expect(events[0].startTime).toBe('19:00');
    expect(events[0].endTime).toBe('21:00');
    expect(events[0].location).toBe('אצל סבתא');
    expect(events[0].allDay).toBe(false);
  });

  it('אירוע של כל היום מזוהה, וסופו חוזר יום אחורה', () => {
    const { events } = fromICS(
      wrap(
        [
          'BEGIN:VEVENT',
          'SUMMARY:חופשה',
          'DTSTART;VALUE=DATE:20260913',
          'DTEND;VALUE=DATE:20260917',
          'END:VEVENT',
        ].join('\r\n'),
      ),
    );
    expect(events[0].allDay).toBe(true);
    expect(events[0].date).toBe('2026-09-13');
    expect(events[0].endDate).toBe('2026-09-16');
  });

  it('אירוע של יום אחד לא מקבל יום סיום', () => {
    const { events } = fromICS(
      wrap(
        ['BEGIN:VEVENT', 'SUMMARY:יום', 'DTSTART;VALUE=DATE:20260913',
         'DTEND;VALUE=DATE:20260914', 'END:VEVENT'].join('\r\n'),
      ),
    );
    expect(events[0].endDate).toBeUndefined();
  });

  it('שורה מקופלת מאוחה חזרה בלי רווח', () => {
    // בתקן, הרווח בתחילת שורת ההמשך הוא סימן הקיפול ולא תוכן
    const { events } = fromICS(
      wrap(
        ['BEGIN:VEVENT', 'SUMMARY:כותרת ארוכה ', ' שממשיכה', 'DTSTART:20260913T090000',
         'END:VEVENT'].join('\r\n'),
      ),
    );
    expect(events[0].title).toBe('כותרת ארוכה שממשיכה');
  });

  it('כותרת ארוכה שקופלה בייצוא חוזרת כמות שהיא', () => {
    const title = 'ארוחת שבת משפחתית אצל סבתא בירושלים עם כל הדודים והדודות';
    const [back] = fromICS(toICS([event({ title })])).events;
    expect(back.title).toBe(title);
  });

  it('תווים מוברחים מפוענחים', () => {
    const { events } = fromICS(
      wrap(
        ['BEGIN:VEVENT', 'SUMMARY:א\; ב\\, ג', 'DESCRIPTION:שורה\\nשנייה',
         'DTSTART:20260913T090000', 'END:VEVENT'].join('\r\n'),
      ),
    );
    expect(events[0].title).toBe('א; ב, ג');
    expect(events[0].notes).toBe('שורה\nשנייה');
  });

  it('RRULE מתורגם לחזרה', () => {
    const { events } = fromICS(
      wrap(
        ['BEGIN:VEVENT', 'SUMMARY:שיעור', 'DTSTART:20260907T200000',
         'RRULE:FREQ=WEEKLY;BYDAY=MO', 'END:VEVENT'].join('\r\n'),
      ),
    );
    expect(events[0].repeat).toBe('weekly');
  });

  it('EXDATE הופך לחריג מבוטל', () => {
    const { events } = fromICS(
      wrap(
        ['BEGIN:VEVENT', 'SUMMARY:שיעור', 'DTSTART:20260907T200000', 'RRULE:FREQ=WEEKLY',
         'EXDATE:20260914T200000,20260921T200000', 'END:VEVENT'].join('\r\n'),
      ),
    );
    expect(Object.keys(events[0].exceptions ?? {})).toEqual(['2026-09-14', '2026-09-21']);
    expect(events[0].exceptions!['2026-09-14'].cancelled).toBe(true);
  });

  it('זמן ב-UTC מומר לשעון המקומי', () => {
    const { events } = fromICS(
      wrap(
        ['BEGIN:VEVENT', 'SUMMARY:שיחה', 'DTSTART:20260913T060000Z', 'END:VEVENT'].join('\r\n'),
      ),
    );
    // ישראל בקיץ היא UTC+3
    expect(events[0].startTime).toBe('09:00');
  });

  it('פרמטר TZID לא מפיל את הפענוח', () => {
    const { events } = fromICS(
      wrap(
        ['BEGIN:VEVENT', 'SUMMARY:פגישה', 'DTSTART;TZID=Asia/Jerusalem:20260913T090000',
         'END:VEVENT'].join('\r\n'),
      ),
    );
    expect(events[0].startTime).toBe('09:00');
  });

  it('אירוע בלי כותרת מדולג ונספר', () => {
    const { events, skipped } = fromICS(
      wrap(['BEGIN:VEVENT', 'DTSTART:20260913T090000', 'END:VEVENT'].join('\r\n')),
    );
    expect(events).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('אירוע בלי תאריך מדולג', () => {
    const { events, skipped } = fromICS(
      wrap(['BEGIN:VEVENT', 'SUMMARY:בלי תאריך', 'END:VEVENT'].join('\r\n')),
    );
    expect(events).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('רשומה פגומה לא מפילה את השאר', () => {
    const { events, skipped } = fromICS(
      wrap(
        [
          'BEGIN:VEVENT', 'DTSTART:bad', 'END:VEVENT',
          'BEGIN:VEVENT', 'SUMMARY:תקין', 'DTSTART:20260913T090000', 'END:VEVENT',
        ].join('\r\n'),
      ),
    );
    expect(events).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('שדות שאין להם מקום מדולגים בשקט', () => {
    const { events } = fromICS(
      wrap(
        ['BEGIN:VEVENT', 'SUMMARY:פגישה', 'DTSTART:20260913T090000',
         'ORGANIZER;CN=דוד:mailto:d@example.com', 'ATTENDEE:mailto:a@example.com',
         'SEQUENCE:3', 'STATUS:CONFIRMED', 'END:VEVENT'].join('\r\n'),
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('פגישה');
  });

  it('קובץ ריק מחזיר כלום', () => {
    expect(fromICS('').events).toHaveLength(0);
    expect(fromICS(wrap('')).events).toHaveLength(0);
  });

  it('צבע נגזר מהכותרת ולכן יציב בין ייבואים', () => {
    const body = ['BEGIN:VEVENT', 'SUMMARY:קבוע', 'DTSTART:20260913T090000', 'END:VEVENT'].join('\r\n');
    expect(fromICS(wrap(body)).events[0].color).toBe(fromICS(wrap(body)).events[0].color);
  });
});

describe('הלוך ושוב', () => {
  it('אירוע ממודד שורד', () => {
    const original = event({
      title: 'ארוחת שבת',
      date: '2026-09-18',
      startTime: '19:30',
      endTime: '22:00',
      location: 'אצל סבתא',
      notes: 'להביא יין',
    });
    const [back] = fromICS(toICS([original])).events;
    expect(back.title).toBe(original.title);
    expect(back.date).toBe(original.date);
    expect(back.startTime).toBe(original.startTime);
    expect(back.endTime).toBe(original.endTime);
    expect(back.location).toBe(original.location);
    expect(back.notes).toBe(original.notes);
    expect(back.allDay).toBe(false);
  });

  it('אירוע רב־יומי של כל היום שורד', () => {
    const original = event({
      date: '2026-09-13',
      endDate: '2026-09-16',
      allDay: true,
      startTime: null,
      endTime: null,
    });
    const [back] = fromICS(toICS([original])).events;
    expect(back.allDay).toBe(true);
    expect(back.date).toBe('2026-09-13');
    expect(back.endDate).toBe('2026-09-16');
  });

  it('חזרה שבועית עם ביטול מופע שורדת', () => {
    const original = event({
      date: '2026-09-07',
      startTime: '20:00',
      endTime: '21:00',
      repeat: 'weekly',
      exceptions: { '2026-09-14': { cancelled: true } },
    });
    const [back] = fromICS(toICS([original])).events;
    expect(back.repeat).toBe('weekly');
    expect(back.exceptions?.['2026-09-14'].cancelled).toBe(true);
  });

  it('חזרה עברית יורדת לשנתית לועזית, וזה מתועד', () => {
    const [back] = fromICS(toICS([event({ repeat: 'hebrew-yearly' })])).events;
    expect(back.repeat).toBe('yearly');
    expect(back.notes).toContain('לא ניתנת לייצוג');
  });

  it('כמה אירועים יחד', () => {
    const all = [event({ title: 'א' }), event({ title: 'ב' }), event({ title: 'ג' })];
    expect(fromICS(toICS(all)).events.map((e) => e.title)).toEqual(['א', 'ב', 'ג']);
  });
});
