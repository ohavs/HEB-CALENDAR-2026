import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { isNative } from './lib/native';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

/*
  service worker הוא מנגנון של אתר. באפליקציה המותקנת הוא מיותר - חבילת
  ה-web מוחלפת דרך מנגנון העדכון החי - ושני מנגנוני מטמון שפותרים את אותה
  בעיה הם דרך טובה להחזיק גרסה ישנה בלי לדעת.
*/
if (!isNative()) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
