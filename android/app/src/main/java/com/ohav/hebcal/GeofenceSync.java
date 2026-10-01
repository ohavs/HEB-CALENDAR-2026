package com.ohav.hebcal;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * רישום הגדרות במערכת ההפעלה.
 *
 * מקום אחד לשתי הכניסות: הפלאגין, כשהאפליקציה מסנכרנת, ו-`BootReceiver`,
 * כי אנדרואיד מוחק את כל הגדרות באתחול.
 */
final class GeofenceSync {

    static final String CHANNEL_ID = "places";
    /** אחרי כמה זמן גדר פגה מעצמה. שבוע קדימה, כמו האופק שנשלח. */
    private static final long EXPIRY_MS = 8L * 24 * 60 * 60 * 1000;
    /**
     * אותה רשימה בדיוק אינה נרשמת שוב בתוך זמן זה. האפליקציה מסנכרנת בכל
     * חזרה לחזית, ו-Play Services דוחה רישום תכוף מדי (1005) - כלומר רישום
     * חוזר היה עלול להפיל גדרות שכבר עבדו.
     */
    private static final long SAME_FENCES_MS = 30L * 60 * 1000;
    private GeofenceSync() {}

    /** מפתח היום בשעון המקומי, בדיוק כמו `dateKey()` בצד ה-web. */
    static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    static boolean hasPermission(Context context) {
        boolean fine =
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        if (!fine) return false;
        // ברקע נדרשת הרשאה נפרדת מ-API 29, והיא מה שמבדיל בין "עובד
        // כשהאפליקציה פתוחה" לבין "עובד"
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true;
        return ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    private static PendingIntent pendingIntent(Context context) {
        Intent intent = new Intent(context, GeofenceReceiver.class);
        intent.setAction(GeofenceReceiver.ACTION);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getBroadcast(context, 0, intent, flags);
    }

    /**
     * מחליף את כל הגדרות במה שנשלח.
     *
     * החלפה מלאה ולא עדכון סלקטיבי, מאותו שיקול של `scheduleNativeReminders`:
     * הרשימה מחושבת מחדש בכל שינוי, וניהול הפרשים היה מצב נוסף שיכול
     * להיפרד מהאמת.
     */
    @SuppressLint("MissingPermission")
    static boolean apply(Context context, JSONArray fences) {
        return apply(context, fences, false);
    }

    /** `force` - לרשום גם כשבדיוק אותה רשימה נרשמה לא מזמן (אתחול, עדכון) */
    static boolean apply(Context context, JSONArray fences, boolean force) {
        GeofenceStore.write(context, fences);
        GeofencingClient client = LocationServices.getGeofencingClient(context);
        if (fences.length() == 0) {
            client.removeGeofences(pendingIntent(context));
            GeofenceStore.clearRegistered(context);
            putStatus(context, true, 0, null);
            return true;
        }
        if (!hasPermission(context)) {
            GeofenceStore.clearRegistered(context);
            putStatus(context, false, fences.length(), "permission");
            return false;
        }
        String signature = fences.toString();
        if (!force && GeofenceStore.recentlyRegistered(context, signature, SAME_FENCES_MS)) {
            return true;
        }

        List<Geofence> list = new ArrayList<>();
        for (int i = 0; i < fences.length(); i++) {
            JSONObject fence = fences.optJSONObject(i);
            if (fence == null) continue;
            // מה שכבר צלצל אינו נרשם שוב, גם כשהאפליקציה עדיין שולחת אותו
            if (GeofenceStore.isFired(context, GeofenceStore.firedKey(fence))) continue;
            int transition =
                "leave".equals(fence.optString("kind"))
                    ? Geofence.GEOFENCE_TRANSITION_EXIT
                    : Geofence.GEOFENCE_TRANSITION_ENTER;
            /*
              בלי `setLoiteringDelay`: הוא תקף רק יחד עם מעבר DWELL,
              ו-`build()` זורק בלעדיו - כשל בזמן ריצה שהקומפילציה אינה
              תופסת. ENTER נקי הוא גם מה שהמשתמש מצפה לו מ"כשאגיע".
            */
            list.add(
                new Geofence.Builder()
                    .setRequestId(fence.optString("id"))
                    .setCircularRegion(
                        fence.optDouble("latitude"),
                        fence.optDouble("longitude"),
                        (float) fence.optDouble("radius", 150))
                    .setExpirationDuration(EXPIRY_MS)
                    .setTransitionTypes(transition)
                    .build());
        }
        if (list.isEmpty()) return true;

        GeofencingRequest request =
            new GeofencingRequest.Builder()
                /*
                  בלי INITIAL_TRIGGER: רישום גדר בזמן שהמשתמש כבר בתוך
                  הרדיוס היה יורה מיד, והתזכורת "כשאגיע הביתה" הייתה
                  מצלצלת ברגע שהוגדרה - בבית.
                */
                .setInitialTrigger(0)
                .addGeofences(list)
                .build();

        /*
          ההסרה וההוספה שתיהן אסינכרוניות, ושתיהן על אותו PendingIntent.
          בלי השרשור ההסרה הייתה עלולה להסתיים *אחרי* ההוספה ולמחוק את
          מה שזה עתה נרשם - כשל שמופיע רק לפעמים, וזה הגרוע ביותר.
        */
        PendingIntent pending = pendingIntent(context);
        int count = list.size();
        client
            .removeGeofences(pending)
            .addOnCompleteListener(
                removed ->
                    client
                        .addGeofences(request, pending)
                        .addOnSuccessListener(
                            ok -> {
                                GeofenceStore.markRegistered(context, signature);
                                putStatus(context, true, count, null);
                            })
                        .addOnFailureListener(
                            e -> {
                                GeofenceStore.clearRegistered(context);
                                String code =
                                    e instanceof ApiException
                                        ? String.valueOf(((ApiException) e).getStatusCode())
                                        : "error";
                                putStatus(context, false, count, code);
                            }));
        return true;
    }

    private static void putStatus(Context context, boolean ok, int count, String error) {
        try {
            JSONObject status = new JSONObject();
            status.put("ok", ok);
            status.put("count", count);
            status.put("at", System.currentTimeMillis());
            if (error != null) status.put("error", error);
            GeofenceStore.putStatus(context, status);
        } catch (JSONException ignored) {
            // מצב לתצוגה בלבד; כשל כאן אינו נוגע ברישום עצמו
        }
    }

    /**
     * הערוץ שבו יושבות התראות המקום.
     *
     * נוצר גם כאן ולא רק ב-web: המקלט עלול לרוץ אחרי שהמכשיר אותחל
     * והאפליקציה עוד לא נפתחה אפילו פעם אחת, ואז הערוץ לא היה קיים -
     * ההתראה הייתה נופלת לערוץ ברירת המחדל, או נבלעת.
     */
    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel =
            new NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.channel_places),
                NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(context.getString(R.string.channel_places_desc));
        manager.createNotificationChannel(channel);
    }
}
