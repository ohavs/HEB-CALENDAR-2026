package com.ohav.hebcal;

import android.Manifest;
import android.content.ContentProviderOperation;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.TimeZone;

/**
 * הלוח שלנו כלוח מקומי בספק היומן של המכשיר.
 *
 * וידג׳טים של אפליקציות אחרות, ולוחות כמו של סמסונג וגוגל, קוראים רק את
 * `CalendarContract`. מה שלא רשום שם אינו קיים מבחינתם, ולכן הלוח שלנו
 * לא הופיע בהם גם אחרי שנבחר ל"הוסף ליומן".
 *
 * כיוון אחד בלבד. הלוח נרשם לקריאה בלבד (`CAL_ACCESS_READ`), כדי שעריכה
 * בלוח אחר לא תיראה כאילו נשמרה ואז תיעלם בפרסום הבא. כל פרסום מחליף את
 * כל האירועים: הרשימה מחושבת מחדש ממילא, וניהול הפרשים היה מצב נוסף
 * שיכול להיפרד מהאמת - אותו שיקול של הגדרות ושל התזכורות.
 */
@CapacitorPlugin(
    name = "HebCalendar",
    permissions = {
        @Permission(
            alias = "calendar",
            strings = {Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR})
    })
public class HebCalendarPlugin extends Plugin {

    /** שם החשבון הפנימי. שינוי שלו ייצור לוח שני וישאיר את הישן יתום */
    private static final String ACCOUNT = "com.ohav.hebcal";
    private static final String DISPLAY_NAME = "לוח עברי";
    private static final int COLOR = 0xFF6366F1;
    private static final String PREFS = "heb-system-calendar";
    /** מעבר לזה עסקה אחת עלולה לחרוג ממגבלת ה-Binder */
    private static final int BATCH = 300;
    /** גבול לקריאה: יומן של שנים לא נכנס בשיחה אחת עם ה-WebView */
    private static final int MAX_READ = 5000;

    @PluginMethod
    public void check(PluginCall call) {
        JSObject out = new JSObject();
        out.put("granted", granted());
        call.resolve(out);
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (granted()) {
            check(call);
            return;
        }
        requestPermissionForAlias("calendar", call, "afterRequest");
    }

    @PermissionCallback
    private void afterRequest(PluginCall call) {
        check(call);
    }

    @PluginMethod
    public void sync(PluginCall call) {
        if (!granted()) {
            call.reject("no-permission");
            return;
        }
        JSONArray events = call.getArray("events");
        if (events == null) events = new JSONArray();
        try {
            ContentResolver resolver = getContext().getContentResolver();
            long id = findCalendar(resolver);
            boolean created = false;
            if (id < 0) {
                id = createCalendar(resolver);
                created = true;
            }

            // פתיחה בלי שינוי לא כותבת כלום: ספק היומן מודיע לכל מאזין על כל כתיבה
            String hash = Integer.toHexString(events.toString().hashCode());
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            if (!created && hash.equals(prefs.getString("hash", null))) {
                call.resolve(result(events.length(), false));
                return;
            }

            replaceEvents(resolver, id, events);
            prefs.edit().putString("hash", hash).apply();
            call.resolve(result(events.length(), true));
        } catch (Exception e) {
            call.reject("sync-failed: " + e.getMessage());
        }
    }

    /**
     * האירועים שהמשתמש כתב בלוחות אחרים במכשיר, להעתקה חד־פעמית.
     *
     * רק לוחות שמותר לכתוב אליהם: לוחות לקריאה בלבד הם חגים, ימי הולדת
     * מאנשי הקשר ומנויים - והחגים כבר אצלנו, מדויקים יותר. גם הלוח שלנו
     * לקריאה בלבד, כך שהוא לא חוזר אלינו בסיבוב.
     *
     * שתי רשימות, כי סדרה נשמרת בשתי צורות: `rows` מ-Events, כולל שורות
     * החריגים, ו-`instances` - המופעים שהספק כבר חישב, לסדרות שאין להן
     * מקבילה אצלנו. ההחלטה איזו צורה לקחת היא ב-`deviceImport.ts`.
     */
    @PluginMethod
    public void readDevice(PluginCall call) {
        if (!granted()) {
            call.reject("no-permission");
            return;
        }
        long from = call.getLong("from", System.currentTimeMillis());
        long to = call.getLong("to", from + 400L * 24 * 60 * 60 * 1000);
        // גם הלוח שלנו נרשם לקריאה בלבד, ולכן התנאי הזה מוציא אותו מעצמו
        String writable = CalendarContract.Events.CALENDAR_ACCESS_LEVEL + ">="
            + CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR;
        try {
            ContentResolver resolver = getContext().getContentResolver();
            JSArray rows = new JSArray();
            try (Cursor c = resolver.query(
                CalendarContract.Events.CONTENT_URI,
                new String[] {
                    CalendarContract.Events._ID,
                    CalendarContract.Events.ORIGINAL_ID,
                    CalendarContract.Events.ORIGINAL_INSTANCE_TIME,
                    CalendarContract.Events.STATUS,
                    CalendarContract.Events.TITLE,
                    CalendarContract.Events.DTSTART,
                    CalendarContract.Events.DTEND,
                    CalendarContract.Events.DURATION,
                    CalendarContract.Events.ALL_DAY,
                    CalendarContract.Events.EVENT_LOCATION,
                    CalendarContract.Events.DESCRIPTION,
                    CalendarContract.Events.RRULE,
                },
                CalendarContract.Events.DELETED + "=0 AND " + writable + " AND ("
                    + CalendarContract.Events.LAST_DATE + " IS NULL OR "
                    + CalendarContract.Events.LAST_DATE + ">=?)",
                new String[] {Long.toString(from)},
                null)) {
                while (c != null && c.moveToNext() && rows.length() < MAX_READ) {
                    JSObject r = new JSObject();
                    r.put("id", c.getLong(0));
                    if (!c.isNull(1)) r.put("originalId", c.getLong(1));
                    if (!c.isNull(2)) r.put("originalInstanceTime", c.getLong(2));
                    r.put("cancelled",
                        !c.isNull(3) && c.getInt(3) == CalendarContract.Events.STATUS_CANCELED);
                    r.put("title", text(c, 4));
                    r.put("begin", c.getLong(5));
                    if (!c.isNull(6)) r.put("end", c.getLong(6));
                    putIfPresent(r, "duration", text(c, 7));
                    r.put("allDay", c.getInt(8) == 1);
                    putIfPresent(r, "location", text(c, 9));
                    putIfPresent(r, "notes", text(c, 10));
                    putIfPresent(r, "rrule", text(c, 11));
                    rows.put(r);
                }
            }

            JSArray instances = new JSArray();
            Uri.Builder range = CalendarContract.Instances.CONTENT_URI.buildUpon();
            ContentUris.appendId(range, from);
            ContentUris.appendId(range, to);
            try (Cursor c = resolver.query(
                range.build(),
                new String[] {
                    CalendarContract.Instances.EVENT_ID,
                    CalendarContract.Instances.ORIGINAL_ID,
                    CalendarContract.Instances.TITLE,
                    CalendarContract.Instances.BEGIN,
                    CalendarContract.Instances.END,
                    CalendarContract.Instances.ALL_DAY,
                    CalendarContract.Instances.EVENT_LOCATION,
                    CalendarContract.Instances.DESCRIPTION,
                },
                "(" + CalendarContract.Instances.RRULE + " IS NOT NULL OR "
                    + CalendarContract.Instances.ORIGINAL_ID + " IS NOT NULL) AND " + writable,
                null,
                null)) {
                while (c != null && c.moveToNext() && instances.length() < MAX_READ) {
                    JSObject r = new JSObject();
                    r.put("eventId", c.getLong(0));
                    if (!c.isNull(1)) r.put("originalId", c.getLong(1));
                    r.put("title", text(c, 2));
                    r.put("begin", c.getLong(3));
                    r.put("end", c.getLong(4));
                    r.put("allDay", c.getInt(5) == 1);
                    putIfPresent(r, "location", text(c, 6));
                    putIfPresent(r, "notes", text(c, 7));
                    instances.put(r);
                }
            }

            JSObject out = new JSObject();
            out.put("rows", rows);
            out.put("instances", instances);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("read-failed: " + e.getMessage());
        }
    }

    private static String text(Cursor c, int column) {
        String value = c.isNull(column) ? null : c.getString(column);
        return value == null ? "" : value;
    }

    private static void putIfPresent(JSObject target, String key, String value) {
        if (!value.isEmpty()) target.put(key, value);
    }

    /** מוחק את הלוח ואת כל האירועים שבו. */
    @PluginMethod
    public void clear(PluginCall call) {
        if (!granted()) {
            call.resolve();
            return;
        }
        try {
            ContentResolver resolver = getContext().getContentResolver();
            long id = findCalendar(resolver);
            if (id >= 0) resolver.delete(calendarUri(id), null, null);
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("clear-failed: " + e.getMessage());
        }
    }

    private boolean granted() {
        return getPermissionState("calendar") == PermissionState.GRANTED;
    }

    private static JSObject result(int count, boolean written) {
        JSObject out = new JSObject();
        out.put("count", count);
        out.put("written", written);
        return out;
    }

    /**
     * כתיבה בשם "מתאם סנכרון" של החשבון המקומי. רק כך מותר ליצור לוח,
     * ורק כך מחיקה היא מחיקה ולא סימון `DELETED` שממתין לסנכרון שלא יגיע.
     */
    private static Uri asSyncAdapter(Uri uri) {
        return uri.buildUpon()
            .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
            .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME, ACCOUNT)
            .appendQueryParameter(
                CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
            .build();
    }

    private static Uri calendarUri(long id) {
        return asSyncAdapter(
            ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, id));
    }

    private static long findCalendar(ContentResolver resolver) {
        try (Cursor c = resolver.query(
            CalendarContract.Calendars.CONTENT_URI,
            new String[] {CalendarContract.Calendars._ID},
            CalendarContract.Calendars.ACCOUNT_NAME + "=? AND "
                + CalendarContract.Calendars.ACCOUNT_TYPE + "=?",
            new String[] {ACCOUNT, CalendarContract.ACCOUNT_TYPE_LOCAL},
            null)) {
            if (c != null && c.moveToFirst()) return c.getLong(0);
        }
        return -1;
    }

    private static long createCalendar(ContentResolver resolver) {
        ContentValues v = new ContentValues();
        v.put(CalendarContract.Calendars.ACCOUNT_NAME, ACCOUNT);
        v.put(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL);
        v.put(CalendarContract.Calendars.NAME, DISPLAY_NAME);
        v.put(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, DISPLAY_NAME);
        v.put(CalendarContract.Calendars.CALENDAR_COLOR, COLOR);
        v.put(CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL,
            CalendarContract.Calendars.CAL_ACCESS_READ);
        v.put(CalendarContract.Calendars.OWNER_ACCOUNT, ACCOUNT);
        v.put(CalendarContract.Calendars.VISIBLE, 1);
        v.put(CalendarContract.Calendars.SYNC_EVENTS, 1);
        v.put(CalendarContract.Calendars.CALENDAR_TIME_ZONE, TimeZone.getDefault().getID());
        Uri uri = resolver.insert(asSyncAdapter(CalendarContract.Calendars.CONTENT_URI), v);
        if (uri == null) throw new IllegalStateException("calendar-not-created");
        return Long.parseLong(uri.getLastPathSegment());
    }

    private static void replaceEvents(ContentResolver resolver, long calendarId, JSONArray events)
        throws Exception {
        resolver.delete(
            asSyncAdapter(CalendarContract.Events.CONTENT_URI),
            CalendarContract.Events.CALENDAR_ID + "=?",
            new String[] {Long.toString(calendarId)});

        String zone = TimeZone.getDefault().getID();
        ArrayList<ContentProviderOperation> ops = new ArrayList<>();
        for (int i = 0; i < events.length(); i++) {
            JSONObject e = events.getJSONObject(i);
            boolean allDay = e.optBoolean("allDay", false);
            ContentProviderOperation.Builder op = ContentProviderOperation
                .newInsert(asSyncAdapter(CalendarContract.Events.CONTENT_URI))
                .withValue(CalendarContract.Events.CALENDAR_ID, calendarId)
                .withValue(CalendarContract.Events.TITLE, e.optString("title", ""))
                .withValue(CalendarContract.Events.DTSTART, e.getLong("begin"))
                .withValue(CalendarContract.Events.DTEND, e.getLong("end"))
                .withValue(CalendarContract.Events.ALL_DAY, allDay ? 1 : 0)
                // "כל היום" חייב UTC; אחרת הספק מזיז אותו ביום
                .withValue(CalendarContract.Events.EVENT_TIMEZONE, allDay ? "UTC" : zone)
                // בלי התראה משלו: האפליקציה כבר מתריעה, ושתיים על אותו אירוע הן רעש
                .withValue(CalendarContract.Events.HAS_ALARM, 0);
            String location = e.optString("location", "");
            if (!location.isEmpty()) op.withValue(CalendarContract.Events.EVENT_LOCATION, location);
            String notes = e.optString("notes", "");
            if (!notes.isEmpty()) op.withValue(CalendarContract.Events.DESCRIPTION, notes);
            ops.add(op.build());
            if (ops.size() >= BATCH) {
                resolver.applyBatch(CalendarContract.AUTHORITY, ops);
                ops.clear();
            }
        }
        if (!ops.isEmpty()) resolver.applyBatch(CalendarContract.AUTHORITY, ops);
    }
}
