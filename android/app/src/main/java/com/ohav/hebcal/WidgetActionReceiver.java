package com.ohav.hebcal;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * מה שנלחץ בוידג׳ט.
 *
 * העיקרון: הפעולה מתבצעת מיד על תמונת המצב המקומית, וגם נרשמת בתור
 * לאפליקציה. בלי העדכון המקומי לחיצה על תיבת סימון לא הייתה עושה כלום
 * עד הפעם הבאה שהאפליקציה נפתחת, וזו הרגשה של וידג׳ט שבור.
 */
public class WidgetActionReceiver extends BroadcastReceiver {

    static final String ACTION_TOGGLE = "com.ohav.hebcal.TOGGLE_DONE";
    static final String ACTION_ADD = "com.ohav.hebcal.ADD_REMINDER";
    static final String EXTRA_REF = "ref";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_DATE = "date";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (ACTION_TOGGLE.equals(action)) {
            toggle(context, intent.getStringExtra(EXTRA_REF));
        } else if (ACTION_ADD.equals(action)) {
            add(context, intent.getStringExtra(EXTRA_TITLE), intent.getStringExtra(EXTRA_DATE));
        }
    }

    /* ----------------------------- סימון בוצע ----------------------------- */

    private void toggle(Context context, String ref) {
        if (ref == null || ref.isEmpty()) return;
        JSONObject data = WidgetStore.readJson(context, WidgetStore.KEY_REMINDERS);
        if (data == null) return;

        boolean nextDone = false;
        boolean found = false;
        try {
            JSONArray groups = data.optJSONArray("groups");
            if (groups == null) return;
            for (int g = 0; g < groups.length() && !found; g++) {
                JSONArray items = groups.getJSONObject(g).optJSONArray("items");
                if (items == null) continue;
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.getJSONObject(i);
                    if (!ref.equals(item.optString("id"))) continue;
                    nextDone = !item.optBoolean("done", false);
                    if (nextDone) item.put("done", true);
                    else item.remove("done");
                    found = true;
                    break;
                }
            }
            if (!found) return;
            data.put("open", countOpen(data));
            WidgetStore.write(context, WidgetStore.KEY_REMINDERS, data.toString());
        } catch (JSONException e) {
            return;
        }

        queueAction(context, "done", ref, nextDone, null, null);
        WidgetStore.refreshAll(context);
    }

    private int countOpen(JSONObject data) throws JSONException {
        int open = 0;
        JSONArray groups = data.optJSONArray("groups");
        if (groups == null) return 0;
        for (int g = 0; g < groups.length(); g++) {
            JSONArray items = groups.getJSONObject(g).optJSONArray("items");
            if (items == null) continue;
            for (int i = 0; i < items.length(); i++) {
                if (!items.getJSONObject(i).optBoolean("done", false)) open++;
            }
        }
        return open;
    }

    /* ---------------------------- הוספת תזכורת ---------------------------- */

    /**
     * מוסיפה את הפריט מיד לתמונת המצב, כדי שהוא ייראה לפני שהאפליקציה
     * בכלל נפתחה. המזהה הזמני מסומן, והאפליקציה מחליפה אותו באמיתי.
     */
    private void add(Context context, String title, String date) {
        if (title == null) return;
        String clean = title.trim();
        if (clean.isEmpty()) return;
        String day = (date == null || date.isEmpty()) ? today() : date;

        JSONObject data = WidgetStore.readJson(context, WidgetStore.KEY_REMINDERS);
        if (data == null) data = new JSONObject();
        try {
            JSONArray groups = data.optJSONArray("groups");
            if (groups == null) groups = new JSONArray();

            JSONObject item = new JSONObject();
            item.put("id", "pending:" + System.currentTimeMillis());
            item.put("title", clean);
            item.put("time", "");
            item.put("color", "violet");

            JSONObject target = null;
            for (int g = 0; g < groups.length(); g++) {
                if (day.equals(groups.getJSONObject(g).optString("k"))) {
                    target = groups.getJSONObject(g);
                    break;
                }
            }
            if (target == null) {
                target = new JSONObject();
                target.put("k", day);
                target.put("label", day.equals(today()) ? "היום" : day);
                target.put("hebrew", "");
                target.put("items", new JSONArray());
                groups.put(target);
            }
            target.getJSONArray("items").put(item);
            data.put("groups", groups);
            data.put("open", countOpen(data));
            WidgetStore.write(context, WidgetStore.KEY_REMINDERS, data.toString());
        } catch (JSONException e) {
            return;
        }

        queueAction(context, "add", null, false, clean, day);
        WidgetStore.refreshAll(context);
    }

    static String today() {
        java.util.Calendar c = java.util.Calendar.getInstance();
        return String.format(
            java.util.Locale.US,
            "%04d-%02d-%02d",
            c.get(java.util.Calendar.YEAR),
            c.get(java.util.Calendar.MONTH) + 1,
            c.get(java.util.Calendar.DAY_OF_MONTH)
        );
    }

    private void queueAction(
        Context context,
        String type,
        String ref,
        boolean done,
        String title,
        String date
    ) {
        try {
            JSONObject action = new JSONObject();
            action.put("type", type);
            action.put("at", System.currentTimeMillis());
            if (ref != null) action.put("ref", ref);
            if (title != null) action.put("title", title);
            if (date != null) action.put("date", date);
            if ("done".equals(type)) action.put("done", done);
            WidgetStore.queue(context, action);
        } catch (JSONException ignored) {
            // פעולה שלא נרשמה לא תיושם, אבל התצוגה כבר עודכנה
        }
    }

    /** רענון יזום אחרי שינוי, לשימוש מקומות אחרים בקוד. */
    static void refresh(Context context, AppWidgetManager manager) {
        WidgetStore.refreshAll(context);
    }
}
