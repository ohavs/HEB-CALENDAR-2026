/**
 * תבניות אירוע.
 *
 * **תבנית היא אירוע בלי תאריך** - אותו רעיון שכבר עובד בתזכורות ("תזכורת
 * היא אירוע"), ומאותה סיבה: מה שאינו תאריך - שם, צבע, שעות, מקום, הערות -
 * זהה לחלוטין באירוע ובתבנית, ולכן אין סיבה לשני מודלים.
 *
 * מה שתבנית *אינה*: היא אינה יושבת על הלוח, אינה מתפשטת ואינה חוזרת.
 * `expandEvents` לא יודע עליה דבר. היא רק מחכה שישבצו אותה.
 *
 * למה בהגדרות ולא בחנות משלה: תבנית היא העדפה של המשתמש בדיוק כמו מקום
 * שמור - היא מתוארת פעם אחת ומשמשת שוב ושוב, היא קטנה, והיא צריכה
 * להסתנכרן בין מכשירים. חנות נפרדת הייתה מוסיפה מסלול סנכרון שלישי
 * בשביל רשימה של עשרה פריטים.
 */
import type { EventColor, EventTemplate, UserEvent } from '@/types';
import type { DateKey } from '@/types';

/**
 * תקרה על מספר התבניות.
 *
 * הן נוסעות בתוך מסמך ההגדרות, ולמסמך הזה יש חסם בכללי האבטחה. תקרה
 * כאן נותנת הודעה מובנת במקום כתיבה שנדחית בשקט.
 */
export const MAX_TEMPLATES = 30;

/** אורך שם מרבי. אותו חסם של כותרת אירוע, כי זה מה שהיא תהפוך להיות. */
export const MAX_TEMPLATE_TITLE = 300;

export function newTemplateId(): string {
  return 't' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** תבנית ריקה, לטופס יצירה. */
export function emptyTemplate(color: EventColor): EventTemplate {
  return {
    id: newTemplateId(),
    title: '',
    color,
    allDay: true,
    startTime: null,
    endTime: null,
    reminderMinutes: null,
    createdAt: Date.now(),
  };
}

/**
 * האם התבנית ראויה לשמירה. שם ריק הוא הפסילה היחידה: כל השאר אופציונלי,
 * וגם תבנית של שם וצבע בלבד היא שימושית לגמרי ("חופש מהעבודה").
 */
export function isValidTemplate(template: EventTemplate): boolean {
  return template.title.trim().length > 0;
}

/** מנקה לפני שמירה: חותך רווחים, אוכף אורך, ומאפס שעות בתבנית של כל היום. */
export function normalizeTemplate(template: EventTemplate): EventTemplate {
  const allDay = template.allDay;
  const location = template.location?.trim();
  const notes = template.notes?.trim();
  const next: EventTemplate = {
    ...template,
    title: template.title.trim().slice(0, MAX_TEMPLATE_TITLE),
    // שעות בתבנית של כל היום היו נשמרות ולא מוצגות, וחוזרות להפתיע
    // ברגע שמישהו מכבה את "כל היום"
    startTime: allDay ? null : (template.startTime ?? '09:00'),
    endTime: allDay ? null : (template.endTime ?? '10:00'),
  };

  /*
    שדה ריק *נמחק*, ולא נשמר כ-undefined.

    זה נראה כמו אותו דבר - `JSON.stringify` מוריד את שניהם - אבל
    Firestore דוחה מסמך שיש בו ערך undefined, והתבניות נוסעות בתוך
    מסמך ההגדרות. התוצאה הייתה "הסנכרון לענן נכשל" אצל כל מי שיצר
    תבנית בלי מקום או בלי הערות, כלומר כמעט כל תבנית.
  */
  if (location) next.location = location;
  else delete next.location;
  if (notes) next.notes = notes;
  else delete next.notes;

  return next;
}

/**
 * הופך תבנית לאירוע אמיתי ביום נתון.
 *
 * מה שנוצר הוא אירוע רגיל לכל דבר, ומרגע זה הוא מנותק מהתבנית: עריכה
 * שלו לא תיגע בה, ומחיקת התבנית לא תיגע בו. זו החלטה ולא קיצור דרך -
 * קשר חי היה אומר שמחיקת "חופש מהעבודה" מוחקת חופשות שכבר נלקחו.
 */
export function templateToEvent(
  template: EventTemplate,
  date: DateKey,
): Omit<UserEvent, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: template.title,
    date,
    startTime: template.allDay ? null : template.startTime,
    endTime: template.allDay ? null : template.endTime,
    allDay: template.allDay,
    color: template.color,
    location: template.location,
    placeId: template.placeId,
    notes: template.notes,
    reminderMinutes: template.reminderMinutes,
    repeat: 'none',
  };
}

/** הוספה לרשימה, עם אכיפת התקרה. מחזיר null כשאין מקום. */
export function addTemplate(
  list: EventTemplate[],
  template: EventTemplate,
): EventTemplate[] | null {
  if (list.length >= MAX_TEMPLATES) return null;
  return [...list, normalizeTemplate(template)];
}

/** עדכון לפי מזהה. תבנית שאינה ברשימה מוחזרת כמות שהיא, בלי להוסיף. */
export function updateTemplate(
  list: EventTemplate[],
  template: EventTemplate,
): EventTemplate[] {
  return list.map((t) => (t.id === template.id ? normalizeTemplate(template) : t));
}

export function removeTemplate(list: EventTemplate[], id: string): EventTemplate[] {
  return list.filter((t) => t.id !== id);
}

/** תיאור קצר לצ׳יפ: השעה, או "כל היום" כשאין. */
export function templateHint(template: EventTemplate): string {
  if (template.allDay) return 'כל היום';
  return template.startTime ?? '';
}
