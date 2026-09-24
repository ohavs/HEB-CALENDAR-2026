/** מצב ההתחברות. התחברות דרך גוגל, עם נפילה חלקה למצב מקומי. */
import { create } from 'zustand';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase';
import { isNative, nativeGoogleIdToken, nativeGoogleSignOut } from '@/lib/native';

/**
 * מזהה הלקוח של גוגל לאפליקציית web.
 *
 * באנדרואיד זהו ה"קהל" של ה-idToken שמחזיר Credential Manager, ולכן
 * דווקא המזהה של web הוא הנכון כאן - לא זה של אנדרואיד. המזהה של
 * אנדרואיד נרשם בקונסולה של גוגל לפי שם החבילה וטביעת החתימה, ואינו
 * מופיע בקוד. אף אחד משניהם אינו סוד.
 */
const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined;

/** האם התחברות אפשרית בסביבה הנוכחית. באנדרואיד היא דורשת את המזהה. */
export const canSignIn = isFirebaseConfigured && (!isNative() || Boolean(GOOGLE_WEB_CLIENT_ID));

export type AuthUser = {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
};

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'unavailable';

type AuthStore = {
  /** המשתמש כפי ש-Firebase אישר. זה מה שמניע סנכרון וכל מאזין לענן. */
  user: AuthUser | null;
  /**
   * הזהות האחרונה שנראתה, לתצוגה בלבד.
   *
   * בכניסה קרה - למשל מהוידג׳ט - עוברות שניות עד ש-Firebase משחזר את
   * החיבור, ובזמן הזה הכותרת הייתה ריקה ומסך ההגדרות הציע "התחברות".
   * המשתמש כבר מחובר; רק האפליקציה עוד לא יודעת. כאן נשמר מה שהיא ידעה
   * בפעם הקודמת, כדי שהתמונה והשם יופיעו מיד.
   *
   * **אסור שמשהו שמדבר עם הענן יקרא את זה.** סנכרון שמתחיל לפני ש-Firebase
   * מחזיק אסימון נכשל בהרשאות. `user` הוא האמת; `profile` הוא רק מה
   * שמציירים עד שהיא מגיעה.
   */
  profile: AuthUser | null;
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

/** הזהות האחרונה, לתצוגה בכניסה קרה. ראו `profile`. */
const PROFILE_KEY = 'heb-cal:profile';

function readProfile(): AuthUser | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<AuthUser>;
    if (typeof p.uid !== 'string') return null;
    return {
      uid: p.uid,
      name: p.name ?? null,
      email: p.email ?? null,
      photoURL: p.photoURL ?? null,
    };
  } catch {
    return null;
  }
}

function writeProfile(user: AuthUser | null): void {
  try {
    if (user) localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
    else localStorage.removeItem(PROFILE_KEY);
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
  // רק מי שהיה מחובר - אחרת תמונה ישנה הייתה מופיעה אחרי יציאה
  profile: isFirebaseConfigured && wasSignedIn() ? readProfile() : null,
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
      /*
        מסיימים זרימת redirect אם חזרנו ממנה - אבל רק בדפדפן. באנדרואיד
        אין redirect (ההתחברות היא Credential Manager), והקריאה הזו היא
        שמעירה את טעינת ה-iframe מהדומיין של Firebase: שניות של המתנה
        בכל כניסה קרה, בשביל תשובה שידועה מראש.
      */
      if (!isNative()) getRedirectResult(auth).catch(() => undefined);
      onAuthStateChanged(auth, (u) => {
        rememberSignedIn(Boolean(u));
        const user: AuthUser | null = u
          ? { uid: u.uid, name: u.displayName, email: u.email, photoURL: u.photoURL }
          : null;
        writeProfile(user);
        setState({ user, profile: user, status: u ? 'signed-in' : 'signed-out' });
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

      /*
        באנדרואיד גוגל חוסמת OAuth בתוך WebView, ולכן אין כאן חלון קופץ:
        Credential Manager מחזיר idToken, ואותו ממירים לכניסה ל-Firebase.
      */
      if (isNative()) {
        if (!GOOGLE_WEB_CLIENT_ID) {
          setState({ error: 'ההתחברות באפליקציה עדיין לא הוגדרה' });
          return;
        }
        const idToken = await nativeGoogleIdToken(GOOGLE_WEB_CLIENT_ID);
        const { GoogleAuthProvider: Provider, signInWithCredential } = await import('firebase/auth');
        await signInWithCredential(auth, Provider.credential(idToken));
        rememberSignedIn(true);
        return;
      }

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
      const raw = (e as { message?: string }).message?.trim() ?? '';
      /*
        באנדרואיד מציגים גם את הטקסט המקורי. ההתחברות שם תלויה ברישום
        נכון בקונסולה של גוגל, וההודעה של Credential Manager היא הדבר
        היחיד שאומר מה בדיוק חסר - בלעדיה אין שום דרך לאבחן מהמכשיר.
      */
      setState({
        error:
          code === 'auth/unauthorized-domain'
            ? 'הדומיין הזה לא מאושר בהגדרות Firebase Authentication'
            : isNative() && raw
              ? `ההתחברות נכשלה. ${raw}`
              : 'ההתחברות נכשלה, נסו שוב',
      });
    } finally {
      setState({ busy: false });
    }
  },

  signOut: async () => {
    rememberSignedIn(false);
    /*
      הזהות השמורה יורדת מיד, ולא כשהענן יאשר: מי שיצא לא אמור לראות את
      התמונה שלו בכותרת גם שנייה אחרי - ואם היציאה קרתה עוד לפני ש-Firebase
      סיים לעלות, האישור הזה אולי לא יגיע בכלל.
    */
    writeProfile(null);
    setState({ profile: null });
    if (!isFirebaseConfigured) return;
    setState({ busy: true });
    try {
      await nativeGoogleSignOut();
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
