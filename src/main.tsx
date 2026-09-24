import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { isNative } from './lib/native';
import { getFirebase } from './lib/firebase';
import { wasSignedIn } from './store/auth';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

/*
  service worker הוא מנגנון של אתר. באפליקציה המותקנת הוא מיותר - חבילת
  ה-web מוחלפת דרך מנגנון העדכון החי - ושני מנגנוני מטמון שפותרים את אותה
  בעיה הם דרך טובה להחזיק גרסה ישנה בלי לדעת.
*/
if (!isNative()) registerSW({ immediate: true });

/*
  מי שהיה מחובר - Firebase מתחיל להיטען כאן, במקביל לציור הראשון, ולא
  אחריו. קודם הטעינה חיכתה ל-useEffect ב-App, כלומר לסוף הציור של כל הלוח
  וחישובי hebcal שבו; בכניסה קרה מהוידג׳ט זה היה חלק מהשניות שעברו עד
  שהחשבון "התחבר". `getFirebase` שומר את ההבטחה, ולכן `init` שיבוא אחר כך
  פשוט מקבל אותה מוכנה.
*/
if (wasSignedIn()) void getFirebase().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
