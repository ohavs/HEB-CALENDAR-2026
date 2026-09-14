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

    /** גובה שמספיק לכותרת ולשעות, בלי רשימה */
    private static final int ROW_HEIGHT = 44;
    /** הגובה שתופסת הכרטיסייה הראשית */
    private static final int HEAD_HEIGHT = 130;

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

    private static void render(Context context, AppWidgetManager manager, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_shabbat);
        JSONObject data = WidgetStore.readJson(context, WidgetStore.KEY_SHABBAT);
        JSONArray entries = data == null ? null : data.optJSONArray("entries");

        if (entries == null || entries.length() == 0) {
            views.setTextViewText(R.id.sh_title, context.getString(R.string.widget_empty_title));
            views.setTextViewText(R.id.sh_day, "");
            views.setTextViewText(R.id.sh_candles, "--:--");
            views.setTextViewText(R.id.sh_havdalah, "--:--");
            views.setViewVisibility(R.id.sh_more, View.GONE);
            views.setOnClickPendingIntent(R.id.sh_root, CalendarWidgetProvider.openApp(context, null));
            manager.updateAppWidget(id, views);
            return;
        }

        JSONObject next = entries.optJSONObject(0);
        views.setTextViewText(R.id.sh_title, next.optString("title"));
        views.setTextViewText(R.id.sh_day, dayLine(next));
        views.setTextViewText(R.id.sh_candles, orDash(next.optString("candles")));
        views.setTextViewText(R.id.sh_havdalah, orDash(next.optString("havdalah")));
        views.setTextViewText(R.id.sh_city, data.optString("city"));
        views.setOnClickPendingIntent(
            R.id.sh_root,
            CalendarWidgetProvider.openApp(context, next.optString("k", null))
        );

        // כמה שורות נוספות נכנסות בגובה שהמשתמש נתן בפועל
        Bundle options = manager.getAppWidgetOptions(id);
        int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 120);
        int room = (minHeight - HEAD_HEIGHT) / ROW_HEIGHT;
        int extra = Math.max(0, Math.min(room, entries.length() - 1));

        views.removeAllViews(R.id.sh_more);
        views.setViewVisibility(R.id.sh_more, extra > 0 ? View.VISIBLE : View.GONE);
        for (int i = 1; i <= extra; i++) {
            JSONObject entry = entries.optJSONObject(i);
            if (entry == null) continue;
            RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_shabbat_row);
            row.setTextViewText(R.id.row_title, entry.optString("title"));
            row.setTextViewText(R.id.row_day, entry.optString("hebrew"));
            row.setTextViewText(R.id.row_candles, orDash(entry.optString("candles")));
            row.setTextViewText(R.id.row_havdalah, orDash(entry.optString("havdalah")));
            row.setOnClickPendingIntent(
                R.id.row_root,
                CalendarWidgetProvider.openApp(context, entry.optString("k", null))
            );
            views.addView(R.id.sh_more, row);
        }

        manager.updateAppWidget(id, views);
    }

    /** "היום · י״ז באלול" - שתי העובדות שבאמת נדרשות בשורה אחת */
    private static String dayLine(JSONObject entry) {
        String day = entry.optString("day");
        String hebrew = entry.optString("hebrew");
        if (day.isEmpty()) return hebrew;
        if (hebrew.isEmpty()) return day;
        return day + " · " + hebrew;
    }

    private static String orDash(String value) {
        return value == null || value.isEmpty() ? "--:--" : value;
    }
}
