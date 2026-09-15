/**
 * פריסות הוידג׳טים.
 *
 * RemoteViews מנפח את הפריסה עם מסנן שדוחה כל מחלקה שאינה מסומנת
 * ב-@RemoteView. `android.view.View` אינה מסומנת, ולכן תג <View> בפריסת
 * וידג׳ט מפיל את הניפוח אצל המשגר - והמשתמש רואה "בעיה בטעינת הוידג׳ט"
 * בלי שום רמז למה. זה מה שהשבית את וידג׳ט הלוח: שלושה <View> בתא היום
 * ואחד ברשימת הקרוב, בעוד שני הוידג׳טים האחרים לא השתמשו באף אחד.
 *
 * הבדיקה כאן זולה והיא הדרך היחידה לתפוס את זה בלי מכשיר.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYOUT_DIR = 'android/app/src/main/res/layout';

/** מה ש-RemoteViews יודע לנפח. אין טעם לרשום את הכול - רק מה שבשימוש. */
const ALLOWED = new Set([
  'LinearLayout',
  'FrameLayout',
  'RelativeLayout',
  'GridLayout',
  'TextView',
  'ImageView',
  'Button',
  'ImageButton',
  'ProgressBar',
  'ListView',
  'GridView',
  'ViewFlipper',
  'StackView',
  'AdapterViewFlipper',
  'AnalogClock',
  'Chronometer',
  'ViewStub',
]);

function layouts(): string[] {
  return readdirSync(LAYOUT_DIR).filter((f) => f.startsWith('widget_') && f.endsWith('.xml'));
}

/** שמות התגים בקובץ, בלי הערות ובלי תגי סגירה. */
function tags(xml: string): string[] {
  const withoutComments = xml.replace(/<!--[\s\S]*?-->/g, '');
  return [...withoutComments.matchAll(/<([A-Za-z][\w.]*)/g)].map((m) => m[1]);
}

describe('פריסות וידג׳ט', () => {
  it('יש פריסות לבדוק', () => {
    expect(layouts().length).toBeGreaterThan(5);
  });

  it.each(layouts())('%s מכילה רק מחלקות ש-RemoteViews יודע לנפח', (file) => {
    const found = tags(readFileSync(join(LAYOUT_DIR, file), 'utf8'));
    const bad = [...new Set(found)].filter((t) => !ALLOWED.has(t));
    expect(bad).toEqual([]);
  });
});
