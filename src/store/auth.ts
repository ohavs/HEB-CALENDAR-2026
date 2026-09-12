/** מצב ההתחברות. התחברות דרך גוגל, עם נפילה חלקה למצב מקומי. */
import { create } from 'zustand';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase';

export type AuthUser = {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
};

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'unavailable';

type AuthStore = {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  busy: boolean;
  /** force=true מאלץ טעינת Firebase גם למשתמש שלא התחבר בעבר */
  init: (force?: boolean) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

/**
 * דגל מקומי שמסמן שהמשתמש התחבר בעבר.
 * כך אנחנו טוענים את חבילת Firebase (כ-700KB) רק למי שבאמת צריך אותה,
 * ולא בכל טעינה של האפליקציה.
 */
const SIGNED_IN_FLAG = 'heb-cal:signed-in';

function rememberSignedIn(value: boolean) {
  try {
    if (value) localStorage.setItem(SIGNED_IN_FLAG, '1');
    else localStorage.removeItem(SIGNED_IN_FLAG);
  } catch {
    /* מצב פרטי */
  }
}

export function wasSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_FLAG) === '1';
  } catch {
    return false;
  }
}

let initialized = false;

export const useAuthStore = create<AuthStore>()((setState) => ({
  user: null,
  status: !isFirebaseConfigured ? 'unavailable' : wasSignedIn() ? 'loading' : 'signed-out',
  error: null,
  busy: false,

  init: async (force = false) => {
    if (initialized || !isFirebaseConfigured) return;
    // בטעינה רגילה מאתחלים רק אם המשתמש התחבר בעבר
    if (!force && !wasSignedIn()) {
      setState({ status: 'signed-out' });
      return;
    }
    initialized = true;
    try {
      const { auth } = await getFirebase();
      const { onAuthStateChanged, getRedirectResult } = await import('firebase/auth');
      // מסיימים זרימת redirect אם חזרנו ממנה
      getRedirectResult(auth).catch(() => undefined);
      onAuthStateChanged(auth, (u) => {
        rememberSignedIn(Boolean(u));
        setState({
          user: u
            ? { uid: u.uid, name: u.displayName, email: u.email, photoURL: u.photoURL }
            : null,
          status: u ? 'signed-in' : 'signed-out',
        });
      });
    } catch {
      setState({ status: 'unavailable' });
    }
  },

  signInWithGoogle: async () => {
    if (!isFirebaseConfigured) {
      setState({ error: 'ההתחברות אינה מוגדרת באפליקציה הזו' });
      return;
    }
    setState({ busy: true, error: null });
    try {
      // טוענים את Firebase רק כאן, ברגע שהמשתמש באמת מבקש להתחבר
      await useAuthStore.getState().init(true);
      const { auth } = await getFirebase();
      const { GoogleAuthProvider, signInWithPopup, signInWithRedirect, browserPopupRedirectResolver } =
        await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      } catch (popupError) {
        const code = (popupError as { code?: string }).code ?? '';
        // בדפדפני מובייל ובאפליקציה מותקנת חלון קופץ נחסם - עוברים ל-redirect
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment' ||
          code === 'auth/cancelled-popup-request'
        ) {
          await signInWithRedirect(auth, provider);
          return;
        }
        if (code === 'auth/popup-closed-by-user') {
          setState({ busy: false });
          return;
        }
        throw popupError;
      }
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setState({
        error:
          code === 'auth/unauthorized-domain'
            ? 'הדומיין הזה לא מאושר בהגדרות Firebase Authentication'
            : 'ההתחברות נכשלה, נסו שוב',
      });
    } finally {
      setState({ busy: false });
    }
  },

  signOut: async () => {
    rememberSignedIn(false);
    if (!isFirebaseConfigured) return;
    setState({ busy: true });
    try {
      const { auth } = await getFirebase();
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch {
      setState({ error: 'היציאה נכשלה' });
    } finally {
      setState({ busy: false });
    }
  },

  clearError: () => setState({ error: null }),
}));
