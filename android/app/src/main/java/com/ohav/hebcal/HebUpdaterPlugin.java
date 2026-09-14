package com.ohav.hebcal;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * התקנת עדכון מתוך האפליקציה עצמה.
 *
 * למה בכלל: הדרך הרגילה - קישור שנפתח בדפדפן - מפזרת פעולה אחת על פני
 * שלוש אפליקציות, ומשאירה את המשתמש מול הורדה שהוא צריך למצוא לבד.
 * כאן ההורדה מתבצעת בתוך האפליקציה עם התקדמות, וההתקנה נפתחת ישירות.
 *
 * מה שלא ניתן לעקוף: אנדרואיד דורש אישור מפורש להתקנה, ולפניו הרשאה
 * חד-פעמית "התקנת אפליקציות לא מוכרות". שניהם מכוונים בדיוק למקרה הזה -
 * אפליקציה שמתקינה קוד - ואין דרך לדלג עליהם בלי הרשאות של מנהל מכשיר.
 */
@CapacitorPlugin(name = "HebUpdater")
public class HebUpdaterPlugin extends Plugin {

    /** גודל שמעליו נפסיק - הגנה מפני כתובת שמחזירה משהו אחר לגמרי */
    private static final long MAX_BYTES = 200L * 1024 * 1024;

    /** האם המשתמש כבר אישר לנו להתקין חבילות. */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject out = new JSObject();
        out.put("granted", allowed());
        call.resolve(out);
    }

    private boolean allowed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    /** פותח את המסך שבו מאשרים את ההרשאה לאפליקציה הזו בלבד. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    /**
     * מוריד את ה-APK ופותח את חלון ההתקנה.
     * הקריאה נפתרת ברגע שההתקנה נפתחה; מה שקורה אחריה כבר בידי המערכת.
     */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String version = call.getString("version", "latest");
        if (url == null || url.isEmpty()) {
            call.reject("missing-url");
            return;
        }
        if (!allowed()) {
            call.reject("install-not-allowed");
            return;
        }
        call.setKeepAlive(true);
        new Thread(() -> run(call, url, version)).start();
    }

    private void run(PluginCall call, String url, String version) {
        File file = null;
        try {
            file = download(call, url, version);
        } catch (Exception e) {
            call.reject("download-failed: " + e.getMessage());
            return;
        }
        try {
            install(file);
            JSObject out = new JSObject();
            out.put("started", true);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("install-failed: " + e.getMessage());
        }
    }

    private File download(PluginCall call, String url, String version) throws Exception {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("no-cache-dir");
        // ניקוי הורדות קודמות, כדי שהמטמון לא יגדל עם כל עדכון
        File[] stale = dir.listFiles();
        if (stale != null) for (File f : stale) f.delete();

        File target = new File(dir, "heb-calendar-" + version + ".apk");

        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(60000);
        connection.connect();

        int code = connection.getResponseCode();
        if (code < 200 || code >= 300) throw new IllegalStateException("http-" + code);
        long total = connection.getContentLengthLong();

        try (InputStream in = connection.getInputStream();
             OutputStream out = new FileOutputStream(target)) {
            byte[] buffer = new byte[16384];
            long written = 0;
            int lastPercent = -1;
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                written += read;
                if (written > MAX_BYTES) throw new IllegalStateException("too-large");
                if (total > 0) {
                    int percent = (int) (written * 100 / total);
                    // מדווחים רק כשהמספר באמת השתנה: אחרת זה אלפי אירועים
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        JSObject progress = new JSObject();
                        progress.put("percent", percent);
                        notifyListeners("updateProgress", progress);
                    }
                }
            }
            out.flush();
        } finally {
            connection.disconnect();
        }

        if (target.length() == 0) throw new IllegalStateException("empty-file");
        return target;
    }

    private void install(File file) {
        Uri uri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            file
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }
}
