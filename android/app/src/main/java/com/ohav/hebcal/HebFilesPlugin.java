package com.ohav.hebcal;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

/**
 * שמירת קובץ ושיתופו.
 *
 * למה זה קיים: ייצוא בדפדפן הוא `<a download>` על Blob. ב-WebView של
 * אנדרואיד אין מי שיקלוט את ההורדה - אין DownloadListener רשום - ולכן
 * הלחיצה לא עושה כלום, בלי שגיאה ובלי רמז. המשתמש רואה "יוצאו 12
 * אירועים" ואין קובץ.
 *
 * כאן הקובץ נכתב למטמון הפנימי ונמסר דרך FileProvider לגיליון השיתוף של
 * המערכת. משם המשתמש בוחר לאן - דרייב, מייל, קבצים - וזו גם התנהגות
 * מוכרת יותר מהורדה שנוחתת בתיקייה.
 */
@CapacitorPlugin(name = "HebFiles")
public class HebFilesPlugin extends Plugin {

    @PluginMethod
    public void shareText(PluginCall call) {
        String filename = call.getString("filename");
        String text = call.getString("text");
        String mimeType = call.getString("mimeType", "text/plain");
        String title = call.getString("title", "");
        if (filename == null || text == null) {
            call.reject("missing-arguments");
            return;
        }

        try {
            File dir = new File(getContext().getCacheDir(), "share");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("no-cache-dir");
            // הקובץ הקודם נמחק: המטמון אינו ארכיון, והשם חוזר על עצמו
            File[] stale = dir.listFiles();
            if (stale != null) for (File f : stale) f.delete();

            File target = new File(dir, filename);
            try (OutputStreamWriter writer = new OutputStreamWriter(
                new FileOutputStream(target),
                StandardCharsets.UTF_8
            )) {
                writer.write(text);
            }

            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                target
            );
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mimeType);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, filename);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(send, title.isEmpty() ? filename : title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("share-failed: " + e.getMessage());
        }
    }

    /** קובץ הזמנה שנפתח מבחוץ. נלקח פעם אחת - ראו ExternalIntents. */
    @PluginMethod
    public void takeIncoming(PluginCall call) {
        JSObject out = new JSObject();
        String text = ExternalIntents.takeIncoming(getContext());
        if (text != null) out.put("text", text);
        call.resolve(out);
    }
}
