package com.ohav.hebcal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * מה שנלחץ בוידג׳ט.
 *
 * העיקרון: הפעולה מתבצעת מיד על תמונת המצב המקומית, וגם נרשמת בתור
 * לאפליקציה. בלי העדכון המקומי לחיצה על תיבת סימון לא הייתה עושה כלום
 * עד הפעם הבאה שהאפליקציה נפתחת, וזו הרגשה של וידג׳ט שבור.
 *
 * **אותו פריט יכול להופיע בכמה מקומות בתמונת המצב.** פריט ברשימה
 * משותפת נמצא במסמך המשותף, וגם - מאז שוידג׳ט התזכורות יודע לכוון
 * לרשימה - בתוך `sources` של מסמך התזכורות, פעם למקור הרשימה ופעם
 * למקור הקטגוריה. הסימון נקבע פעם אחת ונכתב לכל המופעים, אחרת הלחיצה
 * הייתה מתהפכת חזרה בציור הבא של וידג׳ט אחר.
 */
public class WidgetActionReceiver extends BroadcastReceiver {

    static final String ACTION_TOGGLE = "com.ohav.hebcal.TOGGLE_DONE";
    static final String ACTION_TOGGLE_SHARED = "com.ohav.hebcal.TOGGLE_SHARED_DONE";
    static final String EXTRA_REF = "ref";
    /**
     * הפריט שייך לרשימה משותפת.
     *
     * תבנית הלחיצה נקבעת פעם אחת לכל הוידג׳ט, ולכן היא אינה יכולה לשאת
     * את ההבחנה הזו בפעולה שלה: אותו וידג׳ט תזכורות מציג פעם פריטים
     * אישיים ופעם משותפים, לפי המקור שאליו כוונו אותו. הדגל נוסע בכוונת
     * המילוי של השורה עצמה.
     */
    static final String EXTRA_SHARED = "shared";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!ACTION_TOGGLE.equals(action) && !ACTION_TOGGLE_SHARED.equals(action)) return;

        String ref = intent.getStringExtra(EXTRA_REF);
        if (ref == null || ref.isEmpty()) return;

        // הוידג׳ט המשותף מודיע דרך הפעולה; וידג׳ט התזכורות דרך הדגל
        boolean shared = ACTION_TOGGLE_SHARED.equals(action)
            || intent.getBooleanExtra(EXTRA_SHARED, false);
        toggle(context, ref, shared);
    }

    /* ----------------------------- סימון בוצע ----------------------------- */

    private void toggle(Context context, String ref, boolean shared) {
        JSONObject reminders = WidgetStore.readJson(context, WidgetStore.KEY_REMINDERS);
        JSONObject sharedDoc = WidgetStore.readJson(context, WidgetStore.KEY_SHARED);

        Boolean done = findDone(reminders, ref);
        if (done == null) done = findDone(sharedDoc, ref);
        // הפריט כבר אינו בתמונת המצב - נמחק, או נדחק מעבר לתקרה
        if (done == null) return;
        boolean next = !done;

        try {
            if (setDone(reminders, ref, next)) {
                recount(reminders);
                WidgetStore.write(context, WidgetStore.KEY_REMINDERS, reminders.toString());
            }
            if (setDone(sharedDoc, ref, next)) {
                WidgetStore.write(context, WidgetStore.KEY_SHARED, sharedDoc.toString());
            }
        } catch (JSONException e) {
            return;
        }

        /*
          סוג הפעולה נקבע לפי מקור הפריט ולא לפי המסמך שנמצא בו: פריט
          משותף חוזר לענן, ואישי לחנות המקומית. שליחה לצד הלא נכון אינה
          נכשלת - היא פשוט אינה עושה דבר, כי המזהה אינו קיים שם.
        */
        queueToggle(context, shared ? "shared-done" : "done", ref, next);
        WidgetStore.refreshAll(context);
    }

    /**
     * כל מערכי הקבוצות במסמך.
     *
     * שלושה מבנים, ואותו פריט בדיוק: `groups` בשורש (התזכורות האישיות),
     * `sources[].groups` (מה שוידג׳ט התזכורות יכול לכוון אליו) ו-
     * `lists[].groups` (המסמך המשותף).
     */
    private static List<JSONArray> groupArrays(JSONObject doc) {
        List<JSONArray> out = new ArrayList<>();
        if (doc == null) return out;

        JSONArray own = doc.optJSONArray("groups");
        if (own != null) out.add(own);

        addNested(out, doc.optJSONArray("sources"));
        addNested(out, doc.optJSONArray("lists"));
        return out;
    }

    private static void addNested(List<JSONArray> out, JSONArray holders) {
        if (holders == null) return;
        for (int i = 0; i < holders.length(); i++) {
            JSONObject holder = holders.optJSONObject(i);
            JSONArray groups = holder == null ? null : holder.optJSONArray("groups");
            if (groups != null) out.add(groups);
        }
    }

    /** מצב הסימון הנוכחי, או null אם הפריט אינו במסמך. */
    private static Boolean findDone(JSONObject doc, String ref) {
        for (JSONArray groups : groupArrays(doc)) {
            for (int g = 0; g < groups.length(); g++) {
                JSONObject group = groups.optJSONObject(g);
                JSONArray items = group == null ? null : group.optJSONArray("items");
                if (items == null) continue;
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.optJSONObject(i);
                    if (item != null && ref.equals(item.optString("id"))) {
                        return item.optBoolean("done", false);
                    }
                }
            }
        }
        return null;
    }

    /** כותב את הסימון לכל מופע של הפריט. מחזיר אם נמצא ולו אחד. */
    private static boolean setDone(JSONObject doc, String ref, boolean done)
        throws JSONException {
        boolean found = false;
        for (JSONArray groups : groupArrays(doc)) {
            for (int g = 0; g < groups.length(); g++) {
                JSONObject group = groups.optJSONObject(g);
                JSONArray items = group == null ? null : group.optJSONArray("items");
                if (items == null) continue;
                boolean hit = false;
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.optJSONObject(i);
                    if (item == null || !ref.equals(item.optString("id"))) continue;
                    if (done) item.put("done", true);
                    else item.remove("done");
                    hit = true;
                }
                if (hit) {
                    found = true;
                    group.put("items", sinkDone(items));
                }
            }
        }
        return found;
    }

    /**
     * מה שסומן "בוצע" יורד לתחתית הקבוצה, בדיוק כמו במסך.
     *
     * הסידור נעשה כאן ולא רק באפליקציה, כי הוידג׳ט מצייר את תמונת המצב
     * שלו מיד - ובלי זה הפריט היה נשאר במקומו עד הפעם הבאה שהאפליקציה
     * עולה, בזמן שבמסך הוא כבר ירד.
     *
     * ביטול סימון מחזיר את הפריט לסוף הפתוחות ולא למקומו המקורי, שכבר
     * אינו ידוע כאן. הפרסום הבא מהאפליקציה מיישר את זה.
     */
    private static JSONArray sinkDone(JSONArray items) {
        JSONArray open = new JSONArray();
        JSONArray done = new JSONArray();
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            if (item.optBoolean("done", false)) done.put(item);
            else open.put(item);
        }
        for (int i = 0; i < done.length(); i++) open.put(done.optJSONObject(i));
        return open;
    }

    /**
     * מעדכן את מוני ה"פתוחות" במסמך התזכורות.
     *
     * לכל מקור מונה משלו, כי הוא זה שמופיע בכותרת של וידג׳ט שמכוון
     * אליו. המונה שבשורש נשאר של האישיות בלבד - שם מעטפת ישנה קוראת.
     */
    private static void recount(JSONObject doc) throws JSONException {
        if (doc == null) return;

        JSONArray own = doc.optJSONArray("groups");
        if (own != null) doc.put("open", countOpen(own));

        JSONArray sources = doc.optJSONArray("sources");
        if (sources == null) return;
        for (int i = 0; i < sources.length(); i++) {
            JSONObject source = sources.optJSONObject(i);
            JSONArray groups = source == null ? null : source.optJSONArray("groups");
            if (groups != null) source.put("open", countOpen(groups));
        }
    }

    private static int countOpen(JSONArray groups) {
        int open = 0;
        for (int g = 0; g < groups.length(); g++) {
            JSONObject group = groups.optJSONObject(g);
            JSONArray items = group == null ? null : group.optJSONArray("items");
            if (items == null) continue;
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item != null && !item.optBoolean("done", false)) open++;
            }
        }
        return open;
    }

    /** רושם את הסימון לתור שהאפליקציה תיישם בעלייה הבאה. */
    private void queueToggle(Context context, String type, String ref, boolean done) {
        try {
            JSONObject action = new JSONObject();
            action.put("type", type);
            action.put("at", System.currentTimeMillis());
            action.put("ref", ref);
            action.put("done", done);
            WidgetStore.queue(context, action);
        } catch (JSONException ignored) {
            // פעולה שלא נרשמה לא תיושם, אבל התצוגה כבר עודכנה
        }
    }
}
