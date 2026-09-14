/**
 * מייצר את אייקוני ה-PWA מתוך SVG וקטורי (גאומטריה טהורה, בלי תלות בפונטים).
 * הרצה: npm run icons
 */
import sharp from 'sharp';
import { logo } from './logo.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');

const targets = [
  { file: 'icon-64.png', size: 64 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  // maskable: ריפוד של ~10% כדי שמסכת אנדרואיד לא תחתוך את הלוגו
  { file: 'maskable-192.png', size: 192, padding: 52 },
  { file: 'maskable-512.png', size: 512, padding: 52 },
];

await mkdir(outDir, { recursive: true });
for (const { file, size, padding = 0 } of targets) {
  await sharp(Buffer.from(logo({ size, padding })))
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, file));
  console.log('✓', file, `${size}×${size}`);
}
await writeFile(resolve(outDir, 'icon.svg'), logo({ size: 512 }), 'utf8');
await sharp(Buffer.from(logo({ size: 48 }))).png({ compressionLevel: 9 }).toFile(resolve(root, 'public/favicon.png'));
console.log('✓ icon.svg, favicon.png');
