/**
 * התאמת טקסט בעברית.
 *
 * החיפוש הקודם היה `includes` על המחרוזת הגולמית, ולכן "ראש השנה" לא
 * מצא את "ראש השנה תשפ״ז", "יום כפור" לא מצא את "יום כיפור", וכל גרש
 * או גרשיים שהמשתמש לא הקליד בדיוק הכשילו את החיפוש.
 *
 * הנרמול כאן מטפל בארבעה דברים שעושים את רוב ההבדל בעברית:
 *   ניקוד וטעמים    - מוסרים לגמרי
 *   גרש וגרשיים     - גם בגרסה העברית וגם ב-ASCII
 *   אותיות סופיות   - ך ם ן ף ץ מקופלות לצורה הרגילה
 *   מקף ורווחים     - מאוחדים לרווח יחיד
 *
 * מה שלא נעשה כאן בכוונה: חיפוש מטושטש אמיתי (מרחק עריכה). הוא מביא
 * תוצאות שגויות בשמות חגים, שהם קצרים ודומים זה לזה.
 */

/** ניקוד, טעמים וסימני קריאה עבריים */
const NIKUD = /[֑-ׇ]/g;
/** גרש וגרשיים, עבריים ולועזיים, כולל מרכאות מסולסלות */
const MARKS = /['"׳״‘’“”]/g;
/** מקף עברי ולועזי */
const DASHES = /[-־‐-―]/g;

const FINAL_LETTERS: Record<string, string> = {
  'ך': 'כ',
  'ם': 'מ',
  'ן': 'נ',
  'ף': 'פ',
  'ץ': 'צ',
};

/** מביא טקסט לצורה שאפשר להשוות בה. */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(DASHES, ' ')
    .replace(NIKUD, '')
    .replace(MARKS, '')
    .replace(/[\s\u00A0]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c]);
}

/**
 * ניקוד התאמה: גבוה יותר = מתאים יותר. 0 פירושו שאין התאמה.
 *
 * הדירוג נועד לענות על מה שמשתמש מצפה לראות ראשון: מה שהוא הקליד
 * במלואו, אחר כך משהו שמתחיל במה שהקליד, אחר כך מילה בתוך הביטוי,
 * ורק בסוף התאמה באמצע מילה.
 */
export function matchScore(haystack: string, needle: string): number {
  if (!needle) return 0;
  const text = normalize(haystack);
  const term = normalize(needle);
  if (!term) return 0;

  if (text === term) return 100;
  if (text.startsWith(term)) return 80;
  // תחילת מילה כלשהי בתוך הביטוי
  if (text.includes(` ${term}`)) return 60;
  if (text.includes(term)) return 40;

  // כל מילה בשאילתה נמצאת איפשהו - "שנה ראש" ימצא את "ראש השנה"
  const words = term.split(' ').filter(Boolean);
  if (words.length > 1 && words.every((w) => text.includes(w))) return 30;

  return 0;
}

/** האם יש התאמה כלשהי. */
export function matches(haystack: string, needle: string): boolean {
  return matchScore(haystack, needle) > 0;
}

/** הניקוד הגבוה ביותר מבין כמה שדות, כך שהתאמה בכותרת גוברת על הערה. */
export function bestScore(fields: (string | undefined | null)[], needle: string): number {
  let best = 0;
  for (const f of fields) {
    if (!f) continue;
    best = Math.max(best, matchScore(f, needle));
  }
  return best;
}

/* ==========================================================================
   חיפושים אחרונים
   ========================================================================== */

const RECENT_KEY = 'heb-cal:recent-searches';
const MAX_RECENT = 6;

export function recentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberSearch(term: string): void {
  const clean = term.trim();
  if (clean.length < 2) return;
  try {
    const next = [clean, ...recentSearches().filter((t) => normalize(t) !== normalize(clean))];
    localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, MAX_RECENT)));
  } catch {
    /* מצב פרטי */
  }
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* מצב פרטי */
  }
}
