/**
 * מה שגרם לגמגום ותוקן. כל אחד מאלה נראה תקין לגמרי במחשב, ונתפס רק
 * במכשיר חלש - ולכן הבדיקות סורקות את הקוד ולא מודדות.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounceIdle, whenIdle } from './idle';
import { formatTime, formatTimeInZone } from './dates';
import { installCheapAbort } from './cheapAbort';

const SRC = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

const offenders = (pattern: RegExp) =>
  sources(SRC)
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => file.slice(SRC.length + 1));

describe('performance guards', () => {
  it('has no shared layout animations', () => {
    /*
      `layoutId` או `layout` על רכיב של framer מדליקים את מערכת ההטלה:
      מאותו רגע כל commit בכל מקום באפליקציה מודד מחדש את הפריסה, גם
      כשהרכיב עצמו לא זז. טבעת הבחירה בלוח הייתה כזו, וזה היה כמעט חצי
      מזמן החלפת לשונית. מה שנוסע בין מקומות נמדד ונע ב-x/y
      (`SelectionRing`, `useLens`).
    */
    expect(offenders(/\blayoutId\s*=|\slayout(?:=\{|="|\s*\/?>|\s*$)/m)).toEqual([]);
  });

  it('does not animate blur filters', () => {
    // טשטוש מונפש מצויר מחדש בכל פריים. כניסת מסך מתקרבת ודוהה, בלי blur.
    expect(offenders(/filter:\s*['"`]blur\(/)).toEqual([]);
  });

  it('keeps the tab tap out of App', () => {
    /*
      כל עדכון רגיל של App מצייר מחדש את המסך שמוצג. הקשה על לשונית
      מעדכנת רק את הסרגל, ו-App מקבל אותה ב-transition; ההכרזה שבאה איתה
      נכתבת ל-LiveRegion ולא ל-state של App.
    */
    const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');
    expect(app).not.toMatch(/setAnnouncer/);
    expect(app).toMatch(/startTransition\(\(\) => setTabState\(next\)\)/);
    const bar = readFileSync(join(SRC, 'components/TabBar.tsx'), 'utf8');
    expect(bar).toMatch(/setPicked\(tab\.id\)/);
  });

  it('keeps framer drag off the screens', () => {
    /*
      `drag` ו-`dragControls` מצרפים את מערכת ההטלה כמו `layout`: כל ציור
      של הרכיב מודד את הפריסה של העץ כולו. בלוח זה היה בכל הקשה על יום
      ובכל מעבר לשונית. גרירה במסך עוברת ב-`useAxisDrag`; בגיליון, שקיים
      רק כשהוא פתוח, framer נשאר.
    */
    expect(
      offenders(/\sdrag(?:=["{]|\s*$)|dragControls=/m).filter((f) => f !== 'components/ui/Sheet.tsx'),
    ).toEqual([]);
  });

  it('keeps repeated rows out of framer', () => {
    /*
      `whileTap` הופך כל כפתור לרכיב של framer. בשורה שחוזרת ברשימה זה היה
      כמעט חצי מבניית מסך התזכורות; שורות כאלה נושאות `data-press`
      (lib/press.ts), עם אותו קפיץ.
    */
    const rows = ['components/ui/ReminderParts.tsx', 'components/EventChip.tsx', 'components/WeekView.tsx', 'components/TemplateStrip.tsx'];
    for (const file of rows) {
      expect(readFileSync(join(SRC, file), 'utf8'), file).not.toMatch(/whileTap/);
    }
    const controls = readFileSync(join(SRC, 'components/ui/controls.tsx'), 'utf8');
    expect(controls).not.toMatch(/onClick \? motion\.button/);
  });

  it('installs the cheap abort and the shared press before rendering', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');
    const render = main.indexOf('createRoot(');
    expect(main.indexOf('installCheapAbort()')).toBeGreaterThan(-1);
    expect(main.indexOf('installCheapAbort()')).toBeLessThan(render);
    expect(main.indexOf('installPress()')).toBeGreaterThan(-1);
    expect(main.indexOf('installPress()')).toBeLessThan(render);
  });

  it('promotes the marquee to a layer only while it moves', () => {
    // will-change על כל כותרת החזיק עשרות שכבות בכל רשימה
    const marquee = readFileSync(join(SRC, 'components/ui/MarqueeText.tsx'), 'utf8');
    expect(marquee).not.toMatch(/inline-block will-change-transform/);
    expect(marquee).toMatch(/moving \? 'will-change-transform'/);
  });
});

describe('idle scheduling', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('falls back to a timer without requestIdleCallback', () => {
    vi.useFakeTimers();
    const task = vi.fn();
    whenIdle(task);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5);
    expect(task).toHaveBeenCalledOnce();
  });

  it('waits for an idle moment, with a ceiling', () => {
    const calls: { timeout?: number }[] = [];
    // בבדיקות `window` הוא globalThis (ראו test/setup.ts)
    vi.stubGlobal('requestIdleCallback', (cb: () => void, opts: { timeout?: number }) => {
      calls.push(opts);
      cb();
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', () => undefined);
    const task = vi.fn();
    whenIdle(task, 1234);
    expect(task).toHaveBeenCalledOnce();
    expect(calls).toEqual([{ timeout: 1234 }]);
  });

  it('debounces, and a cancel stops both stages', () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const first = debounceIdle(task, 400);
    vi.advanceTimersByTime(300);
    first();
    debounceIdle(task, 400);
    vi.advanceTimersByTime(399);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5);
    expect(task).toHaveBeenCalledOnce();

    const late = debounceIdle(task, 400);
    vi.advanceTimersByTime(400);
    late(); // בוטל אחרי ההשהיה, לפני הרגע השקט
    vi.advanceTimersByTime(10);
    expect(task).toHaveBeenCalledOnce();
  });
});

describe('cached time formatting', () => {
  it('formats the same across zones after caching', () => {
    // 18:00 UTC בקיץ: 21:00 בירושלים, 14:00 בניו יורק
    const at = Date.UTC(2026, 6, 1, 18, 0);
    expect(formatTimeInZone(at, 'Asia/Jerusalem')).toBe('21:00');
    expect(formatTimeInZone(at, 'America/New_York')).toBe('14:00');
    expect(formatTimeInZone(at, 'Asia/Jerusalem')).toBe('21:00');
  });
});

describe('cheap abort', () => {
  it('still aborts with an AbortError, and keeps an explicit reason', () => {
    installCheapAbort();
    const a = new AbortController();
    a.abort();
    expect(a.signal.aborted).toBe(true);
    expect((a.signal.reason as DOMException).name).toBe('AbortError');

    const b = new AbortController();
    b.abort('mine');
    expect(b.signal.reason).toBe('mine');

    // שני ביטולים בלי סיבה חולקים את אותה שגיאה - זה כל החיסכון
    const c = new AbortController();
    c.abort();
    expect(c.signal.reason).toBe(a.signal.reason);
  });
});

describe('local time formatting', () => {
  it('formats repeatedly from one cached formatter', () => {
    const at = new Date(2026, 10, 16, 8, 5);
    expect(formatTime(at)).toBe('08:05');
    expect(formatTime(new Date(2026, 10, 16, 23, 30))).toBe('23:30');
  });
});
