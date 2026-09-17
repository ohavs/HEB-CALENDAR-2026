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
    static final String KEY_SHABBAT = "shabbat";
    static final String KEY_SHARED = "shared";
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

    /* ------------------------ הגדרת וידג׳ט משותף ------------------------ */

    /*
      לכל מופע של וידג׳ט הרשימות המשותפות יש רשימה וקטגוריה משלו,
      ולכן ההגדרה נשמרת לפי מזהה המופע ולא כהעדפה אחת. מחרוזת ריקה
      בקטגוריה פירושה "הכול".
    */

    static void putSharedConfig(Context context, int widgetId, String listId, String categoryId) {
        prefs(context).edit()
            .putString("shared_list_" + widgetId, listId)
            .putString("shared_cat_" + widgetId, categoryId == null ? "" : categoryId)
            .apply();
    }

    static String sharedListId(Context context, int widgetId) {
        return prefs(context).getString("shared_list_" + widgetId, null);
    }

    static String sharedCategoryId(Context context, int widgetId) {
        return prefs(context).getString("shared_cat_" + widgetId, "");
    }

    /*
      וידג׳ט התזכורות מכוון למקור אחד: "me", "list:<id>" או
      "list:<id>/cat:<id>". ברירת המחדל היא האישי, ולכן וידג׳ט שהונח
      לפני שההגדרה קיימת ממשיך להראות בדיוק את מה שהראה.
    */
    static final String SOURCE_ME = "me";

    static void putRemindersSource(Context context, int widgetId, String sourceId) {
        prefs(context).edit()
            .putString("reminders_src_" + widgetId, sourceId == null ? SOURCE_ME : sourceId)
            .apply();
    }

    static String remindersSource(Context context, int widgetId) {
        return prefs(context).getString("reminders_src_" + widgetId, SOURCE_ME);
    }

    static void clearRemindersSource(Context context, int widgetId) {
        prefs(context).edit().remove("reminders_src_" + widgetId).apply();
    }

    /** נמחק כשהמשתמש מסיר את הוידג׳ט, אחרת ההגדרה נשארת לנצח. */
    static void clearSharedConfig(Context context, int widgetId) {
        prefs(context).edit()
            .remove("shared_list_" + widgetId)
            .remove("shared_cat_" + widgetId)
            .apply();
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
     * מבקש מהמערכת לצייר מחדש את כל הוידג׳טים.
     * רשימה נגללת דורשת הודעה נפרדת: שינוי הנתונים לבדו לא מרענן אותה.
     */
    static void refreshAll(Context context) {
        Context app = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(app);

        int[] calendarIds = manager.getAppWidgetIds(new ComponentName(app, CalendarWidgetProvider.class));
        if (calendarIds.length > 0) {
            CalendarWidgetProvider.renderAll(app, manager, calendarIds);
        }

        int[] shabbatIds = manager.getAppWidgetIds(new ComponentName(app, ShabbatWidgetProvider.class));
        if (shabbatIds.length > 0) {
            ShabbatWidgetProvider.renderAll(app, manager, shabbatIds);
        }

        int[] reminderIds = manager.getAppWidgetIds(new ComponentName(app, RemindersWidgetProvider.class));
        if (reminderIds.length > 0) {
            manager.notifyAppWidgetViewDataChanged(reminderIds, R.id.reminders_list);
            RemindersWidgetProvider.renderAll(app, manager, reminderIds);
        }

        int[] sharedIds = manager.getAppWidgetIds(new ComponentName(app, SharedWidgetProvider.class));
        if (sharedIds.length > 0) {
            manager.notifyAppWidgetViewDataChanged(sharedIds, R.id.shared_list);
            SharedWidgetProvider.renderAll(app, manager, sharedIds);
        }
    }
}
