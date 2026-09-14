/**
 * הגדרות Capacitor - העטיפה הנייטיבית לאנדרואיד.
 *
 * ה-WebView טוען את אותו `dist` שהאתר טוען, ולכן כל מה שנבדק בדפדפן
 * תקף גם כאן. מה שמשתנה הוא רק שכבת ההצגה: תזכורות, מיקום והתחברות
 * עוברים לפלאגינים נייטיביים דרך `src/lib/native.ts`.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ohav.hebcal',
  appName: 'לוח שנה עברי',
  webDir: 'dist',
  android: {
    // הרקע שמאחורי ה-WebView, כדי שלא יבליח לבן לפני הצביעה הראשונה
    backgroundColor: '#F6F6FA',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#F6F6FA',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#6366F1',
    },
    /*
      עדכון חי, במצב ידני בלבד: האפליקציה בודקת בעצמה מול השחרור ב-GitHub
      ומורידה רק כשהמשתמש מאשר. autoUpdate היה מצריך שרת של הספק.
    */
    CapacitorUpdater: {
      autoUpdate: false,
      // כמה זמן יש לחבילה חדשה להוכיח שהיא עולה, לפני גלגול אחורה
      appReadyTimeout: 20000,
      // התקנת APK חדש מוחקת חבילות web ישנות, אחרת הן היו מסתירות אותו
      resetWhenUpdate: true,
    },
  },
};

export default config;
