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
  },
};

export default config;
