package com.ohav.hebcal;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * הגדרות כפי שהאפליקציה רשמה אותן.
 *
 * **למה בכלל לשמור אותן אצלנו.** מערכת ההפעלה זוכרת את הגדר, אבל לא את
 * הכותרת ואת הגוף - היא מחזירה רק `requestId`. המקלט רץ כשהאפליקציה
 * מתה לגמרי, בלי WebView ובלי שום קוד שלנו, ולכן כל מה שיוצג חייב
 * להיות כאן מראש.
 *
 * ובנוסף: אנדרואיד מוחק את כל הגדרות באתחול המכשיר. `BootReceiver`
 * קורא מכאן ורושם מחדש.
 */
final class GeofenceStore {

    private static final String PREFS = "heb_geofences";
    private static final String KEY = "fences";

    private GeofenceStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void write(Context context, JSONArray fences) {
        prefs(context).edit().putString(KEY, fences.toString()).apply();
    }

    static JSONArray read(Context context) {
        String raw = prefs(context).getString(KEY, null);
        if (raw == null) return new JSONArray();
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** הגדר לפי המזהה שמערכת ההפעלה מחזירה, או null אם אינה מוכרת עוד. */
    static JSONObject find(Context context, String id) {
        JSONArray fences = read(context);
        for (int i = 0; i < fences.length(); i++) {
            JSONObject fence = fences.optJSONObject(i);
            if (fence != null && id.equals(fence.optString("id"))) return fence;
        }
        return null;
    }

    /**
     * מסיר גדר שכבר ירתה.
     *
     * התראת מקום היא חד־פעמית מבחינת המשתמש: "תזכיר לי כשאגיע הביתה"
     * אינו אמור לצלצל שוב בכל כניסה. הגדר מוסרת גם ממערכת ההפעלה
     * ב-`GeofenceReceiver`, וכאן מוסר מה שמתאר אותה.
     */
    static void forget(Context context, String id) {
        JSONArray fences = read(context);
        JSONArray kept = new JSONArray();
        for (int i = 0; i < fences.length(); i++) {
            JSONObject fence = fences.optJSONObject(i);
            if (fence != null && !id.equals(fence.optString("id"))) kept.put(fence);
        }
        write(context, kept);
    }
}
