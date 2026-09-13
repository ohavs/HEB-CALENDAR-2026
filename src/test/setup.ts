/**
 * אחסון מקומי בזיכרון לכל הבדיקות.
 *
 * בלעדיו zustand/persist מרעיש בכל שינוי מצב, ו-evaluatePosition לא
 * יכולה לזכור אם היינו בתוך הרדיוס. הקבצים עצמם נשארים נקיים מהעניין.
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

const store = memoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: store, writable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), writable: true });

// zustand/persist בודק `typeof window` לפני שהוא נוגע ב-localStorage.
// בלי החלון המדומה הוא מוותר, ומרעיש על כך בכל שינוי מצב.
if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: globalThis, writable: true });
}
