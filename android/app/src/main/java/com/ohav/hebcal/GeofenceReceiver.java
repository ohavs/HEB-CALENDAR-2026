package com.ohav.hebcal;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;
import com.google.android.gms.location.LocationServices;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collections;
import java.util.List;

/**
 * מה שקורה כשחוצים גדר.
 *
 * זה הלב של ההתראות מבוססות המקום, והמקום שבו הן נשברו קודם: עד עכשיו
 * המעקב היה `watchPosition` בתוך ה-WebView, כלומר הוא פעל רק כשהאפליקציה
 * פתוחה בחזית - בדיוק הזמן שבו המשתמש *אינו* בדרך לשום מקום. עכשיו
 * מערכת ההפעלה היא שמנטרת, והמקלט הזה מופעל גם כשהאפליקציה מתה.
 *
 * מכאן שני אילוצים שקבעו את המבנה:
 *
 * 1. **אין כאן שום קוד שלנו.** אין React, אין hebcal ואין דרך לגזור
 *    כותרת ממזהה. הכל מגיע ערוך מ-`GeofenceStore`, שנכתב בזמן הרישום.
 * 2. **היום נבדק בהשוואת מחרוזות.** הגדר נרשמת לשבוע קדימה, ולכן היא
 *    עלולה להיחצות ביום הלא נכון. `date` נוסע איתה בדיוק בשביל זה.
 */
public class GeofenceReceiver extends BroadcastReceiver {

    static final String ACTION = "com.ohav.hebcal.GEOFENCE";
    /** דיוק מינימלי שמתחתיו חציה נחשבת אמיתית, גם בגדר קטנה */
    private static final double MIN_ACCURACY_M = 200;

    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent event = GeofencingEvent.fromIntent(intent);
        if (event == null || event.hasError()) return;

        int transition = event.getGeofenceTransition();
        Location where = event.getTriggeringLocation();

        List<Geofence> crossedAll = event.getTriggeringGeofences();
        if (crossedAll == null) return;
        /*
          הטבעות החיצוניות אינן מצלצלות: יציאה מהן רק דורכת את ההגעה. גם
          כאן מיקום גס אינו נחשב - "יצאת" על סמך דיוק של קילומטר הוא אותה
          קפיצה של הלילה, רק בכיוון ההפוך.
        */
        for (Geofence geofence : crossedAll) {
            String rid = geofence.getRequestId();
            if (!rid.endsWith(GeofenceSync.OUTER_SUFFIX)) continue;
            if (transition != Geofence.GEOFENCE_TRANSITION_EXIT) continue;
            String baseId = rid.substring(0, rid.length() - GeofenceSync.OUTER_SUFFIX.length());
            JSONObject fence = GeofenceStore.find(context, baseId);
            if (fence == null) continue;
            // הסף הוא רוחב הטבעת עצמה: מיקום שמדויק פחות ממנה אינו יודע אם יצא
            double ring = fence.optDouble("radius", 150) + GeofenceSync.ARM_MARGIN_M;
            if (where != null && where.hasAccuracy() && where.getAccuracy() > ring) continue;
            GeofenceStore.setArmed(context, baseId, true);
        }

        String kind =
            transition == Geofence.GEOFENCE_TRANSITION_ENTER
                ? "arrive"
                : transition == Geofence.GEOFENCE_TRANSITION_EXIT ? "leave" : null;
        if (kind == null) return;

        List<Geofence> crossed = crossedAll;

        String today = GeofenceSync.todayKey();
        for (Geofence geofence : crossed) {
            if (geofence.getRequestId().endsWith(GeofenceSync.OUTER_SUFFIX)) continue;
            JSONObject fence = GeofenceStore.find(context, geofence.getRequestId());
            if (fence == null) continue;
            if (GeofenceStore.isFired(context, GeofenceStore.firedKey(fence))) {
                drop(context, geofence.getRequestId());
                continue;
            }

            /*
              הגדר נרשמת לשבוע קדימה, ולכן חציה שלה אינה בהכרח ביום
              שהמשתמש ביקש. בלי הבדיקה הזו "תזכיר לי כשאגיע הביתה
              ביום חמישי" היה מצלצל כבר ביום ראשון.
            */
            if (!kind.equals(fence.optString("kind"))) continue;
            boolean armedToday = fence.optBoolean("anyDay") || today.equals(fence.optString("date"));

            /*
              מיקום גס אינו חציה. מכשיר שישן בלילה מקבל מיקום מ-Wi-Fi ומאנטנות,
              בדיוק של מאות מטרים, והנקודה קופצת החוצה וחוזרת - ומבחינת מערכת
              ההפעלה זו יציאה והגעה. כשהדיוק גרוע מהרדיוס עצמו אי אפשר לדעת אם
              המשתמש באמת חצה, והגדר נשארת דרוכה לחציה אמיתית.
            */
            if (where != null && where.hasAccuracy()
                && where.getAccuracy() > Math.max(fence.optDouble("radius", 150), MIN_ACCURACY_M)) {
                remember(context, fence, kind, armedToday, true, false);
                continue;
            }

            /*
              הגעה בלי יציאה קודמת אינה הגעה. זה מה שצלצל "הגעת הביתה"
              למשתמש שישב בבית: הגדר נרשמה כשהוא כבר בפנים, והמיקום נכנס
              אליה שוב בלי שהוא זז. הגדר נשארת דרוכה, ותצלצל אחרי יציאה אמיתית.
            */
            if ("arrive".equals(kind)) {
                boolean wasAway = GeofenceStore.isArmed(context, fence.optString("id"));
                // כניסה מדויקת היא הגעה בכל מקרה, גם ביום אחר: היציאה נוצלה,
                // והקפיצה הבאה בבית לא תיחשב חזרה
                GeofenceStore.setArmed(context, fence.optString("id"), false);
                if (!wasAway) {
                    remember(context, fence, kind, armedToday, false, true);
                    continue;
                }
            }

            remember(context, fence, kind, armedToday, false, false);
            /*
              תזכורת בלי תאריך (`anyDay`) דרוכה בכל יום. היא עדיין חד־פעמית
              כאן - והאפליקציה רושמת אותה מחדש בפתיחה הבאה, כל עוד היא פתוחה.
            */
            if (!armedToday) continue;

            notify(context, fence);

            /*
              חד־פעמי: התזכורת נעשתה. הגדר מוסרת, ו"צלצלה" נרשם - הסרה לבדה לא
              הספיקה, כי האפליקציה רשמה אותה מחדש בפתיחה הבאה.
            */
            GeofenceStore.markFired(context, GeofenceStore.firedKey(fence));
            drop(context, geofence.getRequestId());
        }
    }

    private static void drop(Context context, String id) {
        LocationServices.getGeofencingClient(context)
            .removeGeofences(java.util.Arrays.asList(id, id + GeofenceSync.OUTER_SUFFIX));
        GeofenceStore.forget(context, id);
    }

    /**
     * החציה האחרונה, בשביל מסך ההגדרות.
     *
     * בלי זה אי אפשר להבחין בין "מערכת ההפעלה לא זיהתה הגעה" לבין "זיהתה,
     * וההתראה נחסמה" - ומבחוץ שניהם נראים אותו דבר: שום דבר לא קרה.
     */
    private void remember(
        Context context,
        JSONObject fence,
        String kind,
        boolean armed,
        boolean imprecise,
        boolean notAway) {
        try {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            JSONObject trigger = new JSONObject();
            trigger.put("at", System.currentTimeMillis());
            trigger.put("title", fence.optString("title"));
            trigger.put("kind", kind);
            trigger.put("armed", armed);
            trigger.put("imprecise", imprecise);
            trigger.put("notAway", notAway);
            trigger.put(
                "shown",
                armed && !imprecise && !notAway && manager != null
                    && manager.areNotificationsEnabled());
            GeofenceStore.putLastTrigger(context, trigger);
        } catch (JSONException ignored) {
            // לתצוגה בלבד
        }
    }

    private void notify(Context context, JSONObject fence) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;

        /*
          אותו ערוץ שבו יושבות התראות המקום שנשלחות מתוך האפליקציה, כדי
          שהמשתמש יוכל להשתיק את הסוג הזה בלי להשתיק תזכורות רגילות.
        */
        GeofenceSync.ensureChannel(context);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;

        Notification notification =
            new NotificationCompat.Builder(context, GeofenceSync.CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle(fence.optString("title"))
                .setContentText(fence.optString("body"))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(
                    PendingIntent.getActivity(context, fence.optString("id").hashCode(), open, flags))
                .build();

        manager.notify(fence.optString("id").hashCode(), notification);
    }
}
