package com.ohav.hebcal;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * היום, כפי שהוא נראה בזמן הציור ולא בזמן הכתיבה.
 *
 * תמונת המצב נכתבת כשהאפליקציה פתוחה, והוידג׳ט מצייר אותה גם ימים אחר
 * כך. כיתוב ערוך אחד היה קופא: תזכורת של מחרתיים נשארה "מחרתיים" גם
 * למחרת, ועיגול "היום" נשאר על אתמול - עד שהאפליקציה נפתחה.
 *
 * לכן כל יום נוסע עם שני כיתובים ערוכים: `near` במסמך ("היום", "מחר",
 * "מחרתיים") ו-`far` על היום עצמו. כאן רק סופרים ימים ובוחרים ביניהם -
 * הניסוח כולו נשאר ב-widgetData.ts, כמו כל מחרוזת אחרת בוידג׳ט.
 *
 * ובחצות מציירים מחדש (`scheduleMidnight`): `updatePeriodMillis` רץ
 * לכל היותר פעם בחצי שעה, ולרשימות הנגללות הוא אינו מודיע בכלל.
 */
final class WidgetDays {

    static final String ACTION_MIDNIGHT = "com.ohav.hebcal.WIDGETS_MIDNIGHT";

    /** לא נמצא מרחק: המפתח אינו תאריך ("undated") או שהוא פגום */
    static final int NO_DATE = Integer.MIN_VALUE;

    private WidgetDays() {}

    /** YYYY-MM-DD בשעון המקומי - אותו פורמט של `dateKey()` באפליקציה. */
    static String todayKey() {
        Calendar now = Calendar.getInstance();
        return String.format(
            Locale.ROOT,
            "%04d-%02d-%02d",
            now.get(Calendar.YEAR),
            now.get(Calendar.MONTH) + 1,
            now.get(Calendar.DAY_OF_MONTH)
        );
    }

    /** כמה ימים מהיום עד המפתח. שלילי לעבר, NO_DATE למה שאינו תאריך. */
    static int offset(String key) {
        if (key == null || key.length() != 10 || key.charAt(4) != '-') return NO_DATE;
        try {
            int year = Integer.parseInt(key.substring(0, 4));
            int month = Integer.parseInt(key.substring(5, 7));
            int day = Integer.parseInt(key.substring(8, 10));
            // בצהריים, כדי ששעון קיץ לא יזיז את החלוקה ליום שלם
            Calendar target = Calendar.getInstance();
            target.clear();
            target.set(year, month - 1, day, 12, 0);
            Calendar today = Calendar.getInstance();
            today.set(Calendar.HOUR_OF_DAY, 12);
            today.set(Calendar.MINUTE, 0);
            today.set(Calendar.SECOND, 0);
            today.set(Calendar.MILLISECOND, 0);
            return Math.round(
                (target.getTimeInMillis() - today.getTimeInMillis()) / 86_400_000f
            );
        } catch (NumberFormatException e) {
            return NO_DATE;
        }
    }

    /** יום שכבר עבר. "undated" ומפתח פגום אינם עבר. */
    static boolean isPast(String key) {
        int days = offset(key);
        return days != NO_DATE && days < 0;
    }

    /** היום קרוב מספיק לכיתוב יחסי ("היום", "מחר", "מחרתיים"). */
    static boolean isNear(JSONObject doc, String key) {
        JSONArray near = doc == null ? null : doc.optJSONArray("near");
        int days = offset(key);
        return near != null && days != NO_DATE && days >= 0 && days < near.length();
    }

    /**
     * הכיתוב של יום כפי שהוא נכון עכשיו.
     *
     * `fallback` הוא מה שנכתב בזמן הפרסום, ונשאר כשהמסמך ישן ואינו נושא
     * `near` ו-`far` - חבילת web מתעדכנת בנפרד מהמעטפת.
     */
    static String label(JSONObject doc, String key, String far, String fallback) {
        JSONArray near = doc == null ? null : doc.optJSONArray("near");
        if (near == null || far == null || far.isEmpty()) return fallback;
        if (isNear(doc, key)) return near.optString(offset(key), fallback);
        return far;
    }

    /** כותרת של קבוצת יום בוידג׳טי הרשימות. */
    static String groupLabel(JSONObject doc, JSONObject group) {
        return label(doc, group.optString("k"), group.optString("far"), group.optString("label"));
    }

    /**
     * השורה המשנית של קבוצת יום.
     *
     * בתזכורות זה התאריך הלועזי, ורק ליד הכיתובים הקרובים - מעבר להם
     * הכיתוב כבר נושא אותו. ברשימה המשותפת זה התאריך העברי, שאינו תלוי
     * בהיום ולכן אינו נושא `date`.
     */
    static String groupLine(JSONObject doc, JSONObject group) {
        if (doc == null || !doc.has("near") || !group.has("date")) {
            return group.optString("hebrew");
        }
        return isNear(doc, group.optString("k")) ? group.optString("date") : "";
    }

    /** כמה פריטים פתוחים בקבוצות שעוד לא עברו. */
    static int openIn(JSONArray groups) {
        int open = 0;
        for (int g = 0; groups != null && g < groups.length(); g++) {
            JSONObject group = groups.optJSONObject(g);
            if (group == null || isPast(group.optString("k"))) continue;
            JSONArray items = group.optJSONArray("items");
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item != null && !item.optBoolean("done", false)) open++;
            }
        }
        return open;
    }

    /* ------------------------------ חצות ------------------------------ */

    /**
     * קובע ציור מחדש בחצות הבאה. קריאה חוזרת מחליפה את הקודמת.
     *
     * לא מדויק בכוונה (`setAndAllowWhileIdle`): כמה דקות אחרי חצות אינן
     * משנות, והרשאת שעון מדויק אינה שווה את זה. אבל הוא נורה גם במצב
     * שינה, אחרת הבוקר היה מתחיל עם "מחר" של אתמול.
     */
    static void scheduleMidnight(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;

        Calendar next = Calendar.getInstance();
        next.add(Calendar.DAY_OF_MONTH, 1);
        next.set(Calendar.HOUR_OF_DAY, 0);
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 5);
        next.set(Calendar.MILLISECOND, 0);

        try {
            alarms.setAndAllowWhileIdle(
                AlarmManager.RTC,
                next.getTimeInMillis(),
                midnightIntent(context)
            );
        } catch (SecurityException ignored) {
            // מגבלת התראות של היצרן; הרענון של חצי שעה עדיין יגיע
        }
    }

    private static PendingIntent midnightIntent(Context context) {
        Intent intent = new Intent(context, WidgetActionReceiver.class);
        intent.setAction(ACTION_MIDNIGHT);
        return PendingIntent.getBroadcast(
            context,
            7,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
