package com.ohav.hebcal;

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
    static final String EXTRA_REF = "ref";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (ACTION_TOGGLE.equals(action)) {
            toggle(context, intent.getStringExtra(EXTRA_REF));
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

        queueDone(context, ref, nextDone);
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

    /** רושם את הסימון לתור שהאפליקציה תיישם בעלייה הבאה. */
    private void queueDone(Context context, String ref, boolean done) {
        try {
            JSONObject action = new JSONObject();
            action.put("type", "done");
            action.put("at", System.currentTimeMillis());
            action.put("ref", ref);
            action.put("done", done);
            WidgetStore.queue(context, action);
        } catch (JSONException ignored) {
            // פעולה שלא נרשמה לא תיושם, אבל התצוגה כבר עודכנה
        }
    }
}
