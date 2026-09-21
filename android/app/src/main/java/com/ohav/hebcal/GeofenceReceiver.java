package com.ohav.hebcal;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;
import com.google.android.gms.location.LocationServices;

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

    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent event = GeofencingEvent.fromIntent(intent);
        if (event == null || event.hasError()) return;

        int transition = event.getGeofenceTransition();
        String kind =
            transition == Geofence.GEOFENCE_TRANSITION_ENTER
                ? "arrive"
                : transition == Geofence.GEOFENCE_TRANSITION_EXIT ? "leave" : null;
        if (kind == null) return;

        List<Geofence> crossed = event.getTriggeringGeofences();
        if (crossed == null) return;

        String today = GeofenceSync.todayKey();
        for (Geofence geofence : crossed) {
            JSONObject fence = GeofenceStore.find(context, geofence.getRequestId());
            if (fence == null) continue;

            /*
              הגדר נרשמת לשבוע קדימה, ולכן חציה שלה אינה בהכרח ביום
              שהמשתמש ביקש. בלי הבדיקה הזו "תזכיר לי כשאגיע הביתה
              ביום חמישי" היה מצלצל כבר ביום ראשון.
            */
            if (!kind.equals(fence.optString("kind"))) continue;
            if (!today.equals(fence.optString("date"))) continue;

            notify(context, fence);

            /*
              חד־פעמי: התזכורת נעשתה, והגדר מוסרת משני המקומות - מהמערכת
              וממה שמתאר אותה אצלנו. בלעדי זה היא הייתה מצלצלת בכל כניסה
              נוספת באותו יום.
            */
            LocationServices.getGeofencingClient(context)
                .removeGeofences(Collections.singletonList(geofence.getRequestId()));
            GeofenceStore.forget(context, geofence.getRequestId());
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
