/**
 * מייצר את המשאבים הגרפיים של אנדרואיד מאותו לוגו וקטורי.
 * הרצה: npm run icons:android
 *
 * שלושה סוגים, וכל אחד מהם עובד אחרת:
 * - אייקון מסתגל (adaptive): הרקע צבע אחיד והחזית שקופה, כי המערכת
 *   חותכת אותם בצורה שמשתנה בין יצרנים. לכן החזית מרופדת ב-25%.
 * - אייקון התראה: אנדרואיד צובע אותו בעצמו, ולכן הוא חייב להיות לבן על
 *   שקוף. כל צבע שנשים בו פשוט יימחק.
 * - מסך פתיחה: תמונה אחת לכל צפיפות ולכל כיוון, בגודל שקפסיטור ציפה לו.
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logo } from './logo.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const res = resolve(root, 'android/app/src/main/res');

const DENSITIES = [
  { dir: 'mdpi', launcher: 48, foreground: 108, notify: 24 },
  { dir: 'hdpi', launcher: 72, foreground: 162, notify: 36 },
  { dir: 'xhdpi', launcher: 96, foreground: 216, notify: 48 },
  { dir: 'xxhdpi', launcher: 144, foreground: 324, notify: 72 },
  { dir: 'xxxhdpi', launcher: 192, foreground: 432, notify: 96 },
];

const SPLASH_BG = '#F6F6FA';

async function png(svg, file) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
}

for (const d of DENSITIES) {
  const mip = resolve(res, `mipmap-${d.dir}`);

  await png(logo({ size: d.launcher }), resolve(mip, 'ic_launcher.png'));
  await png(logo({ size: d.launcher }), resolve(mip, 'ic_launcher_round.png'));

  // החזית של האייקון המסתגל: בלי רקע, ומרופדת כדי לשרוד כל חיתוך
  await png(
    logo({ size: d.foreground, padding: Math.round(d.foreground * 0.26), bg: false }),
    resolve(mip, 'ic_launcher_foreground.png'),
  );

  // אייקון ההתראה - לבן על שקוף
  await png(logo({ size: d.notify, bg: false }), resolve(res, `drawable-${d.dir}`, 'ic_stat_notify.png'));

  console.log('✓', d.dir);
}

/** מסך פתיחה בגודל שכבר קיים בתיקייה, עם הלוגו במרכז. */
async function splash(file) {
  const { width, height } = await sharp(file).metadata();
  if (!width || !height) return;
  const size = Math.round(Math.min(width, height) * 0.28);
  const mark = await sharp(Buffer.from(logo({ size }))).png().toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: SPLASH_BG },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(`${file}.tmp`);
  await sharp(`${file}.tmp`).toFile(file);
}

for (const dir of await readdir(res)) {
  if (!dir.startsWith('drawable')) continue;
  const entries = await readdir(resolve(res, dir));
  if (entries.includes('splash.png')) await splash(resolve(res, dir, 'splash.png'));
}
console.log('✓ splash');
