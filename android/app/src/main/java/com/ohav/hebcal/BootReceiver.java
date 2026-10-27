package com.ohav.hebcal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * אנדרואיד מוחק את כל הגדרות באתחול המכשיר.
 *
 * בלי הרישום מחדש כאן, התראה מבוססת מקום הייתה מפסיקה לעבוד בשקט אחרי
 * כל הפעלה מחדש - עד שהמשתמש היה פותח את האפליקציה מסיבה אחרת.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();

        /*
          גם התראת החצות של הוידג׳טים נמחקת באתחול, ושינוי שעון או אזור
          זמן מזיז אותה. ציור מחדש קובע אותה מחדש (WidgetStore.refreshAll).
        */
        if (Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            WidgetStore.refreshAll(context);
            return;
        }

        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
            && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        GeofenceSync.apply(context, GeofenceStore.read(context), true);
        WidgetStore.refreshAll(context);
    }
}
