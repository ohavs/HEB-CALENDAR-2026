package com.ohav.hebcal;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * האחסון המשותף בין האפליקציה לוידג׳טים.
 *
 * הוידג׳ט רץ בתהליך של מערכת ההפעלה ולא בשלנו, ולכן אין בינינו זיכרון
 * משותף - רק קובץ. האפליקציה כותבת לכאן תמונת מצב מוכנה לציור, והוידג׳ט
 * קורא אותה בכל ציור מחדש.
 *
 * הכיוון ההפוך עובר דרך תור: פעולה שנעשתה בוידג׳ט בזמן שהאפליקציה סגורה
 * נשמרת כאן וממתינה. הוידג׳ט מעדכן בינתיים את התצוגה שלו בעצמו, אחרת
 * לחיצה על תיבת סימון לא הייתה עושה כלום עד הפעם הבאה שהאפליקציה נפתחת.
 */
final class WidgetStore {

    private static final String PREFS = "heb_widgets";
    static final String KEY_CALENDAR = "calendar";
    static final String KEY_REMINDERS = "reminders";
    private static final String KEY_INBOX = "inbox";

    /** תקרה לתור, כדי שאפליקציה שלא נפתחה חודש לא תצבור בלי גבול. */
    private static final int MAX_INBOX = 200;

    private WidgetStore() {}

    static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String read(Context context, String key) {
        return prefs(context).getString(key, null);
    }

    static void write(Context context, String key, String value) {
        prefs(context).edit().putString(key, value).apply();
    }

    static JSONObject readJson(Context context, String key) {
        String raw = read(context, key);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException e) {
            return null;
        }
    }

    /* ------------------------------ התור ------------------------------ */

    static synchronized void queue(Context context, JSONObject action) {
        JSONArray inbox = readInboxArray(context);
        if (inbox.length() >= MAX_INBOX) return;
        inbox.put(action);
        write(context, KEY_INBOX, inbox.toString());
    }

    static synchronized String takeInbox(Context context) {
        String raw = read(context, KEY_INBOX);
        prefs(context).edit().remove(KEY_INBOX).apply();
        return raw == null ? "[]" : raw;
    }

    private static JSONArray readInboxArray(Context context) {
        String raw = read(context, KEY_INBOX);
        if (raw == null) return new JSONArray();
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /* ---------------------------- רענון ציור ---------------------------- */

    /**
     * מבקש מהמערכת לצייר מחדש את שני הוידג׳טים.
     * הרשימה הנגללת דורשת הודעה נפרדת: שינוי הנתונים לבדו לא מרענן אותה.
     */
    static void refreshAll(Context context) {
        Context app = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(app);

        int[] calendarIds = manager.getAppWidgetIds(new ComponentName(app, CalendarWidgetProvider.class));
        if (calendarIds.length > 0) {
            CalendarWidgetProvider.renderAll(app, manager, calendarIds);
        }

        int[] reminderIds = manager.getAppWidgetIds(new ComponentName(app, RemindersWidgetProvider.class));
        if (reminderIds.length > 0) {
            manager.notifyAppWidgetViewDataChanged(reminderIds, R.id.reminders_list);
            RemindersWidgetProvider.renderAll(app, manager, reminderIds);
        }
    }
}
