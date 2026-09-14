import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * PREVIEW_BUILD=1 בונה גרסת תצוגה בלבד: בלי service worker ובלי manifest,
 * לשימוש בסביבות שאין בהן תמיכה ב-PWA (למשל קישור תצוגה מוטמע).
 */
const previewBuild = process.env.PREVIEW_BUILD === '1';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      disable: previewBuild,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'לוח שנה עברי',
        short_name: 'לוח עברי',
        description: 'לוח שנה עברי עם כל החגים והמועדים, זמני כניסת ויציאת שבת, תזכורות ואירועים אישיים.',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'portrait',
        background_color: '#F6F6FA',
        theme_color: '#6366F1',
        categories: ['productivity', 'lifestyle', 'utilities'],
        icons: [
          { src: 'icons/icon-64.png', sizes: '64x64', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // הפרמטרים נקראים ב-src/lib/launchParams.ts
        shortcuts: [
          { name: 'זמני שבת', short_name: 'שבת', url: '/?tab=shabbat' },
          { name: 'היום', short_name: 'היום', url: '/?tab=calendar&go=today' },
          { name: 'אירוע חדש', short_name: 'אירוע', url: '/?tab=calendar&compose=today' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // מרחיב את ה-service worker בטיפול בתזכורות ובלחיצה על התראה
        importScripts: ['/sw-reminders.js'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          hebcal: ['@hebcal/core'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
