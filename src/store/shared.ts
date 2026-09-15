/**
 * מצב הרשימות המשותפות.
 *
 * בלי `persist`, ובכוונה: רשימה משותפת אינה שייכת למכשיר הזה. היא
 * נקראת ב-`onSnapshot` וכל כתיבה נשלחת לענן. המטמון של Firestore הוא
 * שמחזיק אותה לקריאה בלי רשת, וכתיבות ממתינות בתור עד שהרשת חוזרת -
 * זה בדיוק מה שאנחנו רוצים, ושכפול שלו ל-localStorage רק היה יוצר
 * מקור אמת שני שמתנגש עם עצמו.
 *
 * מה כן נשמר מקומית: איזו רשימה נבחרה ואיזה סינון קטגוריה פעיל. אלה
 * העדפות תצוגה של המכשיר, לא נתונים.
 */
import { create } from 'zustand';
import type { CategoryFilter, ListInvite, SharedItem, SharedList } from '@/lib/sharedLists';

const VIEW_KEY = 'heb-cal:shared-view';

type View = { listId: string | null; category: CategoryFilter };

function loadView(): View {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      const v = parsed as Partial<View>;
      return {
        listId: typeof v.listId === 'string' ? v.listId : null,
        category: typeof v.category === 'string' || v.category === null ? v.category : null,
      };
    }
  } catch {
    /* מצב פרטי, או ערך פגום */
  }
  return { listId: null, category: null };
}

function saveView(view: View): void {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(view));
  } catch {
    /* מצב פרטי */
  }
}

type SharedStore = {
  /** האם המאזין פעיל. `false` כשאין חיבור או אין חשבון. */
  live: boolean;
  /** נטען לפחות פעם אחת - כדי להבדיל בין "אין רשימות" ל"עוד לא יודעים" */
  loaded: boolean;
  lists: SharedList[];
  /** פריטים לפי מזהה רשימה. נטענים רק לרשימה שנבחרה. */
  items: Record<string, SharedItem[]>;
  invites: ListInvite[];
  error: string | null;

  selectedId: string | null;
  category: CategoryFilter;

  select: (listId: string | null) => void;
  setCategory: (category: CategoryFilter) => void;
  reset: () => void;
};

const initialView = loadView();

export const useSharedStore = create<SharedStore>()((set) => ({
  live: false,
  loaded: false,
  lists: [],
  items: {},
  invites: [],
  error: null,
  selectedId: initialView.listId,
  category: initialView.category,

  select: (listId) =>
    set((s) => {
      // סינון קטגוריה שייך לרשימה מסוימת, ולכן מתאפס במעבר ביניהן
      saveView({ listId, category: null });
      return { ...s, selectedId: listId, category: null };
    }),

  setCategory: (category) =>
    set((s) => {
      saveView({ listId: s.selectedId, category });
      return { ...s, category };
    }),

  reset: () =>
    set((s) => ({ ...s, live: false, loaded: false, lists: [], items: {}, invites: [], error: null })),
}));

/** הרשימה שנבחרה, או הראשונה אם הבחירה כבר לא קיימת. */
export function useSelectedList(): SharedList | null {
  const lists = useSharedStore((s) => s.lists);
  const selectedId = useSharedStore((s) => s.selectedId);
  if (!lists.length) return null;
  return lists.find((l) => l.id === selectedId) ?? lists[0];
}
