package com.ohav.hebcal;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.database.Cursor;
import android.os.Bundle;
import android.provider.CalendarContract;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * כוונות שמגיעות מאפליקציות אחרות, מתורגמות לקישור שלנו.
 *
 * הדף יודע לקרוא דבר אחד - `hebcal://open?...` - ולכן כל מה שבא מבחוץ
 * הופך לקישור כזה ועובר באותו מסלול של הוידג׳טים. אין כאן שום החלטה על
 * האירוע עצמו: השדות נוסעים כמות שהם, והפענוח ב-`externalEvent.ts`.
 */
final class ExternalIntents {

    /** קובץ ההזמנה האחרון שנפתח, עד שהדף לוקח אותו */
    static final String INCOMING_FILE = "incoming.ics";

    /** מעבר לזה זה כבר לא קובץ הזמנה, וה-WebView לא צריך לשאת אותו */
    private static final int MAX_BYTES = 2 * 1024 * 1024;

    private ExternalIntents() {}

    static boolean isExternal(Intent intent) {
        if (intent == null) return false;
        if (Intent.ACTION_INSERT.equals(intent.getAction())) return true;
        return isCalendarFile(intent) || isDeviceCalendar(intent);
    }

    /**
     * לחיצה על אירוע או על יום ביומן של המכשיר - מה שוידג׳טים של אפליקציות
     * אחרות שולחים. נבדק לפני קובץ הזמנה, כי גם זה `content://`.
     */
    private static boolean isDeviceCalendar(Intent intent) {
        if (!Intent.ACTION_VIEW.equals(intent.getAction())) return false;
        Uri data = intent.getData();
        return data != null
            && "content".equals(data.getScheme())
            && CalendarContract.AUTHORITY.equals(data.getAuthority());
    }

    private static boolean isCalendarFile(Intent intent) {
        if (!Intent.ACTION_VIEW.equals(intent.getAction())) return false;
        if (isDeviceCalendar(intent)) return false;
        Uri data = intent.getData();
        if (data == null) return false;
        String scheme = data.getScheme();
        return "content".equals(scheme) || "file".equals(scheme);
    }

    /** מחזיר את הכוונה כמות שהיא כשאינה מבחוץ. */
    static Intent translate(Context context, Intent intent) {
        if (intent == null) return null;
        if (Intent.ACTION_INSERT.equals(intent.getAction())) return link(insertQuery(intent));
        if (isDeviceCalendar(intent)) return link(dayQuery(context, intent));
        if (isCalendarFile(intent)) {
            // ההרשאה לקרוא את content:// ניתנה ל-Activity הזו בלבד ולזמן
            // קצר, ולכן הקובץ נקרא עכשיו ולא כשהדף יבקש אותו
            // כשהקריאה נכשלה לא נשאר קובץ, והדף אומר שלא הצליח לקרוא
            if (!saveIncoming(context, intent.getData())) {
                //noinspection ResultOfMethodCallIgnored
                new File(context.getCacheDir(), INCOMING_FILE).delete();
            }
            return link(new Uri.Builder().appendQueryParameter("ext", "ics"));
        }
        return intent;
    }

    private static Intent link(Uri.Builder query) {
        Uri uri = query.scheme("hebcal").authority("open").build();
        Intent out = new Intent(Intent.ACTION_VIEW, uri);
        out.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return out;
    }

    /**
     * היום שנלחץ. אירוע של לוח אחר אינו קיים אצלנו, ולכן אין "לפתוח אותו" -
     * פותחים את היום שלו, ושם רואים גם את מה שלנו באותו יום.
     *
     * `/time/<ms>` הוא יום. `/events/<id>` הוא אירוע, והזמן שלו מגיע כמעט
     * תמיד כ-`beginTime` - המופע שנלחץ, ולא הראשון בסדרה. רק כשהוא חסר
     * שואלים את ספק היומן, וזה דורש את הרשאת היומן.
     */
    private static Uri.Builder dayQuery(Context context, Intent intent) {
        Uri.Builder b = new Uri.Builder().appendQueryParameter("tab", "calendar");
        List<String> path = intent.getData().getPathSegments();
        long at = 0;
        boolean allDay = false;
        if (path.size() >= 2 && "time".equals(path.get(0))) {
            at = parseLong(path.get(1));
        } else if (path.size() >= 2 && "events".equals(path.get(0))) {
            Bundle extras = intent.getExtras();
            if (extras != null) {
                at = toMillis(extras.get(CalendarContract.EXTRA_EVENT_BEGIN_TIME));
                allDay = Boolean.TRUE.equals(extras.get(CalendarContract.EXTRA_EVENT_ALL_DAY));
            }
            if (at <= 0) {
                long[] stored = readEvent(context, parseLong(path.get(1)));
                at = stored[0];
                allDay = stored[1] == 1;
            }
        }
        if (at <= 0) return b.appendQueryParameter("go", "today");
        b.appendQueryParameter("at", Long.toString(at));
        if (allDay) b.appendQueryParameter("allDay", "1");
        return b;
    }

    /** { DTSTART, ALL_DAY }, או אפסים כשאין הרשאה או אירוע. */
    private static long[] readEvent(Context context, long id) {
        if (id <= 0) return new long[] {0, 0};
        try (Cursor c = context.getContentResolver().query(
            CalendarContract.Events.CONTENT_URI,
            new String[] {CalendarContract.Events.DTSTART, CalendarContract.Events.ALL_DAY},
            CalendarContract.Events._ID + "=?",
            new String[] {Long.toString(id)},
            null)) {
            if (c != null && c.moveToFirst()) return new long[] {c.getLong(0), c.getInt(1)};
        } catch (Exception e) {
            // בלי הרשאת יומן - היום של היום עדיף על כלום
        }
        return new long[] {0, 0};
    }

    private static long parseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static long toMillis(Object value) {
        if (value instanceof Number) return ((Number) value).longValue();
        if (value instanceof String) return parseLong(((String) value).trim());
        return 0;
    }

    /** השמות הם של `CalendarContract`, שכל שולח משתמש בהם. */
    private static Uri.Builder insertQuery(Intent intent) {
        Uri.Builder b = new Uri.Builder().appendQueryParameter("ext", "insert");
        Bundle extras = intent.getExtras();
        if (extras == null) return b;
        putText(b, "title", extras.get("title"));
        putText(b, "loc", extras.get("eventLocation"));
        putText(b, "notes", extras.get("description"));
        putMillis(b, "begin", extras.get("beginTime"));
        putMillis(b, "end", extras.get("endTime"));
        Object allDay = extras.get("allDay");
        if (Boolean.TRUE.equals(allDay) || "true".equals(String.valueOf(allDay))) {
            b.appendQueryParameter("allDay", "1");
        }
        return b;
    }

    private static void putText(Uri.Builder b, String key, Object value) {
        if (value == null) return;
        String text = value.toString().trim();
        if (!text.isEmpty()) b.appendQueryParameter(key, text);
    }

    /** רוב השולחים מעבירים long, אבל יש כאלה שמעבירים מחרוזת. */
    private static void putMillis(Uri.Builder b, String key, Object value) {
        long ms;
        if (value instanceof Number) {
            ms = ((Number) value).longValue();
        } else if (value instanceof String) {
            try {
                ms = Long.parseLong(((String) value).trim());
            } catch (NumberFormatException e) {
                return;
            }
        } else {
            return;
        }
        if (ms > 0) b.appendQueryParameter(key, Long.toString(ms));
    }

    private static boolean saveIncoming(Context context, Uri uri) {
        try (InputStream in = context.getContentResolver().openInputStream(uri)) {
            if (in == null) return false;
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int total = 0;
            int n;
            while ((n = in.read(chunk)) != -1) {
                total += n;
                if (total > MAX_BYTES) return false;
                buffer.write(chunk, 0, n);
            }
            File target = new File(context.getCacheDir(), INCOMING_FILE);
            try (FileOutputStream out = new FileOutputStream(target)) {
                out.write(buffer.toByteArray());
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** התוכן של הקובץ שנשמר, ומחיקתו. `null` כשאין. */
    static String takeIncoming(Context context) {
        File file = new File(context.getCacheDir(), INCOMING_FILE);
        if (!file.exists()) return null;
        try (InputStream in = new java.io.FileInputStream(file)) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buffer.write(chunk, 0, n);
            return new String(buffer.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        } finally {
            //noinspection ResultOfMethodCallIgnored
            file.delete();
        }
    }
}
