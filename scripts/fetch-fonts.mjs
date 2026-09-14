/**
 * מוריד את הפונט מגוגל ואורז אותו בתוך האפליקציה.
 * הרצה: npm run fonts
 *
 * למה: אפליקציה מותקנת שנפתחת בלי רשת הציגה את פונט ברירת המחדל של
 * המערכת ואז קפצה, וגם שלחה בקשה לגוגל בכל פתיחה קרה. הפונט הוא חלק
 * מהאפליקציה, לא משאב חיצוני.
 *
 * מורידים רק את התת-קבוצות שבאמת מוצגות - עברית ולטינית - ולא את כל
 * חמש שגוגל מגישה. השאר הן קירילית, יוונית וסמלים, ואין להן שימוש כאן.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/fonts');

const FAMILY = 'Heebo';
const WEIGHTS = [300, 400, 500, 600, 700];
const SUBSETS = ['hebrew', 'latin'];
/** גוגל מגישה woff2 רק לדפדפן שמצהיר שהוא תומך בו */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const url = `https://fonts.googleapis.com/css2?family=${FAMILY}:wght@${WEIGHTS.join(';')}&display=swap`;
const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();

/* הקובץ של גוגל מחולק לגושים, וכל גוש פותח בהערה עם שם התת-קבוצה */
const blocks = css.split('/*').slice(1);
const faces = [];

for (const block of blocks) {
  const subset = block.slice(0, block.indexOf('*/')).trim();
  if (!SUBSETS.includes(subset)) continue;

  const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
  const src = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
  const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
  if (!weight || !src || !range) continue;

  const name = `heebo-${subset}-${weight}.woff2`;
  const bytes = new Uint8Array(await (await fetch(src)).arrayBuffer());
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, name), bytes);
  faces.push({ name, weight, range, size: bytes.length });
  console.log('✓', name, `${Math.round(bytes.length / 1024)}KB`);
}

if (!faces.length) throw new Error('לא נמצאה אף תת-קבוצה - האם המבנה של גוגל השתנה?');

const sheet = `/* נוצר על ידי scripts/fetch-fonts.mjs. אין לערוך ידנית. */
${faces
  .map(
    (f) => `@font-face {
  font-family: '${FAMILY}';
  font-style: normal;
  font-weight: ${f.weight};
  font-display: swap;
  src: url('/fonts/${f.name}') format('woff2');
  unicode-range: ${f.range};
}`,
  )
  .join('\n')}
`;

await writeFile(resolve(outDir, 'heebo.css'), sheet, 'utf8');
const total = faces.reduce((sum, f) => sum + f.size, 0);
console.log(`✓ heebo.css · ${faces.length} גופנים · ${Math.round(total / 1024)}KB`);
