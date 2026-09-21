package com.ohav.hebcal;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;

/**
 * הגשר בין האפליקציה לגדרות הגאוגרפיות של מערכת ההפעלה.
 *
 * למה פלאגין ולא `watchPosition` כמו קודם: `watchPosition` רץ בתוך
 * ה-WebView, ולכן הוא מת ברגע שהמשתמש עוזב את האפליקציה - בדיוק הרגע
 * שבו הוא יוצא לדרך. גדר שנרשמה כאן מנוטרת על ידי מערכת ההפעלה, והיא
 * מעירה את `GeofenceReceiver` גם כשהאפליקציה סגורה לגמרי.
 */
@CapacitorPlugin(
    name = "HebGeofence",
    permissions = {
        @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION}),
        @Permission(
            alias = "background",
            strings = {Manifest.permission.ACCESS_BACKGROUND_LOCATION})
    })
public class HebGeofencePlugin extends Plugin {

    /** מחליף את כל הגדרות הרשומות במה שנשלח. */
    @PluginMethod
    public void sync(PluginCall call) {
        JSONArray fences = call.getArray("fences");
        if (fences == null) fences = new JSONArray();
        boolean registered = GeofenceSync.apply(getContext(), fences);

        JSObject result = new JSObject();
        result.put("registered", registered);
        result.put("count", fences.length());
        call.resolve(result);
    }

    /**
     * מה מצב ההרשאות.
     *
     * שתי שאלות ולא אחת: הרשאת מיקום רגילה מספיקה כדי *לשמור* מקום,
     * אבל בלי "לאפשר תמיד" הגדרות פשוט לא יירו - וזה כשל שקט לחלוטין.
     * המסך צריך להבחין ביניהן כדי שיוכל להסביר.
     */
    @PluginMethod
    public void check(PluginCall call) {
        JSObject result = new JSObject();
        result.put("foreground", hasForeground());
        result.put("background", GeofenceSync.hasPermission(getContext()));
        // מ-API 30 אי אפשר לבקש "תמיד" מתוך דיאלוג; רק דרך ההגדרות
        result.put("needsSettings", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R);
        call.resolve(result);
    }

    /** מבקש את הרשאת המיקום הרגילה. */
    @PluginMethod
    public void requestForeground(PluginCall call) {
        requestPermissionForAlias("location", call, "afterForeground");
    }

    @PermissionCallback
    private void afterForeground(PluginCall call) {
        check(call);
    }

    /**
     * פותח את מסך ההרשאות של האפליקציה.
     *
     * מ-API 30 אנדרואיד אינו מרשה לבקש "לאפשר תמיד" בדיאלוג - המשתמש
     * חייב לבחור בה בעצמו במסך ההגדרות. לכן אין כאן בקשה אלא הפניה,
     * ובמסך יש הסבר מה לחפש שם.
     */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private boolean hasForeground() {
        return getPermissionState("location") == com.getcapacitor.PermissionState.GRANTED;
    }
}
