package com.ohav.hebcal;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * וידג׳ט זמני השבת: הכניסה והיציאה הקרובות, ומה שבא אחריהן.
 *
 * בגודל הקטן מוצגת רק הכניסה הקרובה - זה מה שרוצים לדעת ביום שישי.
 * ככל שהוידג׳ט גדל נוספות השורות הבאות, אחת לאחת, לפי המקום שיש בפועל.
 * הרשומה הראשונה נשארת גם בשבת עצמה, כי אז הזמן המעניין הוא ההבדלה.
 */
public class ShabbatWidgetProvider extends AppWidgetProvider {

    /** גובה שורה ברשימת המועדים הבאים */
    private static final int ROW_HEIGHT = 44;
    /** הגובה שתופסות שתי השעות לבדן, כולל הריפוד של הוידג׳ט */
    private static final int TIMES_HEIGHT = 78;

    /*
      סדר הוויתור, מלמטה למעלה: קודם העיר, אחר כך שם הפרשה, ואחרון
      התאריך. שתי השעות לא יורדות אף פעם - בלעדיהן אין לוידג׳ט סיבה
      קיום. הסדר הזה מגובה גם בפריסה עצמה: השעות ראשונות, וכך אפילו אם
      המדידה מחטיאה, מה שנחתך מלמטה הוא מה שפחות חשוב.
    */
    private static final int MIN_HEIGHT_FOR_DAY = 102;
    private static final int MIN_HEIGHT_FOR_TITLE = 122;
    private static final int MIN_HEIGHT_FOR_CITY = 142;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        renderAll(context, manager, ids);
    }

    @Override
    public void onAppWidgetOptionsChanged(
        Context context,
        AppWidgetManager manager,
        int id,
        Bundle options
    ) {
        render(context, manager, id);
    }

    static void renderAll(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    /** ציור מוגן - ראו CalendarWidgetProvider. */
    private static void render(Context context, AppWidgetManager manager, int id) {
        try {
            draw(context, manager, id);
        } catch (Throwable error) {
            RemoteViews fallback = new RemoteViews(context.getPackageName(), R.layout.widget_shabbat);
            fallback.setTextViewText(R.id.sh_day, context.getString(R.string.widget_error_title));
            fallback.setTextViewText(R.id.sh_title, error.getClass().getSimpleName());
            fallback.setTextViewText(R.id.sh_candles, "--:--");
            fallback.setTextViewText(R.id.sh_havdalah, "--:--");
            fallback.setViewVisibility(R.id.sh_more, View.GONE);
            manager.updateAppWidget(id, fallback);
        }
    }

    private static void draw(Context context, AppWidgetManager manager, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_shabbat);
        JSONObject data = WidgetStore.readJson(context, WidgetStore.KEY_SHABBAT);
        JSONArray entries = data == null ? null : data.optJSONArray("entries");

        if (entries == null || entries.length() == 0) {
            views.setTextViewText(R.id.sh_title, context.getString(R.string.widget_empty_title));
            views.setTextViewText(R.id.sh_day, "");
            views.setTextViewText(R.id.sh_candles, "--:--");
            views.setTextViewText(R.id.sh_havdalah, "--:--");
            views.setViewVisibility(R.id.sh_more, View.GONE);
            views.setOnClickPendingIntent(R.id.sh_root, CalendarWidgetProvider.openTab(context, "shabbat"));
            manager.updateAppWidget(id, views);
            return;
        }

        JSONObject next = entries.optJSONObject(0);
        views.setTextViewText(R.id.sh_title, next.optString("title"));
        views.setTextViewText(R.id.sh_day, dayLine(next));
        views.setTextViewText(R.id.sh_candles, orDash(next.optString("candles")));
        views.setTextViewText(R.id.sh_havdalah, orDash(next.optString("havdalah")));
        /*
          התוויות מגיעות מהמטען, כי הן תלויות במועד: "כניסת השבת" מול
          "כניסת החג". קודם היו כאן שתי מחרוזות קבועות מהפריסה, והן
          נכתבו גם על יום כיפור. חבילה ישנה אינה שולחת אותן, ואז
          הפריסה נשארת עם מה שכתוב בה.
        */
        label(views, R.id.sh_candles_label, next.optString("entryLabel"));
        label(views, R.id.sh_havdalah_label, next.optString("exitLabel"));
        views.setTextViewText(R.id.sh_city, data.optString("city"));
        views.setOnClickPendingIntent(R.id.sh_root, CalendarWidgetProvider.openTab(context, "shabbat"));

        Bundle options = manager.getAppWidgetOptions(id);
        int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 120);

        // הכי קטן: רק השעות. העיר, שם הפרשה והתאריך יורדים בסדר הזה.
        views.setViewVisibility(
            R.id.sh_day,
            minHeight >= MIN_HEIGHT_FOR_DAY ? View.VISIBLE : View.GONE
        );
        views.setViewVisibility(
            R.id.sh_title,
            minHeight >= MIN_HEIGHT_FOR_TITLE ? View.VISIBLE : View.GONE
        );
        views.setViewVisibility(
            R.id.sh_city,
            minHeight >= MIN_HEIGHT_FOR_CITY ? View.VISIBLE : View.GONE
        );

        // כמה שורות נוספות נכנסות בגובה שהמשתמש נתן בפועל
        int room = (minHeight - MIN_HEIGHT_FOR_CITY - TIMES_HEIGHT / 2) / ROW_HEIGHT;
        int extra = Math.max(0, Math.min(room, entries.length() - 1));

        views.removeAllViews(R.id.sh_more);
        views.setViewVisibility(R.id.sh_more, extra > 0 ? View.VISIBLE : View.GONE);
        for (int i = 1; i <= extra; i++) {
            JSONObject entry = entries.optJSONObject(i);
            if (entry == null) continue;
            RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_shabbat_row);
            row.setTextViewText(R.id.row_title, entry.optString("title"));
            row.setTextViewText(R.id.row_day, subLine(entry));
            row.setTextViewText(R.id.row_candles, orDash(entry.optString("candles")));
            row.setTextViewText(R.id.row_havdalah, orDash(entry.optString("havdalah")));
            row.setOnClickPendingIntent(
                R.id.row_root,
                CalendarWidgetProvider.openTab(context, "shabbat")
            );
            views.addView(R.id.sh_more, row);
        }

        manager.updateAppWidget(id, views);
    }

    /**
     * שורת המשנה: לועזי ואחריו עברי, ערוך מראש ב-widgetData.ts.
     *
     * `hebrew` הוא נפילה לאחור לחבילת web ישנה שעוד לא שולחת `sub` -
     * החבילה מתחלפת בלי התקנה, ולכן מעטפת חדשה עשויה לפגוש נתונים
     * ישנים עד העדכון החי הבא.
     */
    private static String subLine(JSONObject entry) {
        String sub = entry.optString("sub");
        return sub.isEmpty() ? entry.optString("hebrew") : sub;
    }

    /** "היום · 18 בספטמבר · י״ז באלול" - בשורה אחת */
    private static String dayLine(JSONObject entry) {
        String day = entry.optString("day");
        String sub = subLine(entry);
        if (day.isEmpty()) return sub;
        if (sub.isEmpty()) return day;
        return day + " · " + sub;
    }

    /** תווית מהמטען, או מה שהפריסה קובעת כשהמטען ישן ואין בו שדה כזה. */
    private static void label(RemoteViews views, int id, String text) {
        if (text == null || text.isEmpty()) return;
        views.setTextViewText(id, text);
    }

    private static String orDash(String value) {
        return value == null || value.isEmpty() ? "--:--" : value;
    }
}
