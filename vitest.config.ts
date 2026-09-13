/**
 * הרצת הבדיקות. קונפיגורציה נפרדת מ-vite.config כדי לא לטעון את תוסף ה-PWA
 * ואת חלוקת הצ׳אנקים בכל ריצה.
 *
 * אזור הזמן ננעל ל-Asia/Jerusalem: חלק גדול מהלוגיקה תלוי בשעון מקומי
 * ובשעון קיץ, ובדיקה שרצה באזור זמן אחר תיתן תשובות אחרות.
 */
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

process.env.TZ = 'Asia/Jerusalem';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
