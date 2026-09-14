package com.ohav.hebcal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * וידג׳ט הלוח: רשת החודש עם מועדים ואירועים, ורשימת הקרוב.
 *
 * הוידג׳ט אינו מחשב כלום. הוא מצייר את מה שהאפליקציה כתבה לקובץ המשותף,
 * ולכן גם כשהאפליקציה סגורה לגמרי הלוח נכון - עד לחודש הבא, שאז הפרסום
 * הבא יעדכן אותו.
 *
 * ההתאמה לגודל נעשית בהסתרה ולא בפריסות נפרדות: אותה פריסה משרתת את כל
 * הגדלים, וכל מה שמשתנה הוא מה מוצג. פריסה לכל גודל הייתה מכפילה את
 * מקומות השינוי בלי להוסיף כלום.
 */
public class CalendarWidgetProvider extends AppWidgetProvider {

    /** מתחת לגובה הזה אין מקום לרשת, ומוצגת רק הרשימה */
    private static final int MIN_HEIGHT_FOR_GRID = 120;
    /** מעל לגובה הזה נשאר מקום גם לרשימת הקרוב מתחת לרשת */
    private static final int MIN_HEIGHT_FOR_BOTH = 220;
    /** מתחת לרוחב הזה התאים צרים מדי לתאריך עברי */
    private static final int MIN_WIDTH_FOR_HEBREW = 260;

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

    /**
     * ציור מוגן.
     *
     * חריגה בתוך ציור וידג׳ט מתורגמת על ידי המשגר ל"בעיה בטעינת הוידג׳ט" -
     * מלבן אפור בלי שום מידע, ובלי גישה ל-logcat אין דרך לדעת מה נפל.
     * לכן השגיאה נתפסת ומוצגת על הוידג׳ט עצמו.
     */
    private static void render(Context context, AppWidgetManager manager, int id) {
        try {
            draw(context, manager, id);
        } catch (Throwable error) {
            RemoteViews fallback = new RemoteViews(context.getPackageName(), R.layout.widget_calendar);
            fallback.setTextViewText(R.id.cal_month, context.getString(R.string.widget_error_title));
            fallback.setTextViewText(R.id.cal_hebrew, error.getClass().getSimpleName());
            fallback.setViewVisibility(R.id.cal_weekdays, View.GONE);
            fallback.setViewVisibility(R.id.cal_grid, View.GONE);
            fallback.setViewVisibility(R.id.cal_upcoming, View.GONE);
            fallback.setOnClickPendingIntent(R.id.cal_root, openApp(context, null));
            manager.updateAppWidget(id, fallback);
        }
    }

    private static void draw(Context context, AppWidgetManager manager, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_calendar);
        JSONObject data = WidgetStore.readJson(context, WidgetStore.KEY_CALENDAR);

        Bundle options = manager.getAppWidgetOptions(id);
        int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 200);
        int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        boolean showGrid = minHeight >= MIN_HEIGHT_FOR_GRID;
        boolean showUpcoming = !showGrid || minHeight >= MIN_HEIGHT_FOR_BOTH;
        boolean showHebrew = minWidth >= MIN_WIDTH_FOR_HEBREW;

        if (data == null) {
            views.setTextViewText(R.id.cal_month, context.getString(R.string.widget_empty_title));
            views.setTextViewText(R.id.cal_hebrew, "");
            views.setViewVisibility(R.id.cal_weekdays, View.GONE);
            views.setViewVisibility(R.id.cal_grid, View.GONE);
            views.setViewVisibility(R.id.cal_upcoming, View.GONE);
            views.setOnClickPendingIntent(R.id.cal_root, openApp(context, null));
            manager.updateAppWidget(id, views);
            return;
        }

        views.setTextViewText(R.id.cal_month, data.optString("month"));
        views.setTextViewText(R.id.cal_hebrew, data.optString("hebrewMonth"));
        views.setViewVisibility(R.id.cal_hebrew, showHebrew ? View.VISIBLE : View.GONE);
        views.setOnClickPendingIntent(R.id.cal_root, openApp(context, null));

        views.setViewVisibility(R.id.cal_weekdays, showGrid ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.cal_grid, showGrid ? View.VISIBLE : View.GONE);
        if (showGrid) buildGrid(context, views, data, showHebrew);

        views.setViewVisibility(R.id.cal_upcoming, showUpcoming ? View.VISIBLE : View.GONE);
        if (showUpcoming) buildUpcoming(context, views, data, showGrid ? 4 : 6);

        manager.updateAppWidget(id, views);
    }

    /* ------------------------------ הרשת ------------------------------ */

    private static void buildGrid(
        Context context,
        RemoteViews views,
        JSONObject data,
        boolean showHebrew
    ) {
        String pkg = context.getPackageName();

        views.removeAllViews(R.id.cal_weekdays);
        JSONArray weekdays = data.optJSONArray("weekdays");
        for (int i = 0; weekdays != null && i < weekdays.length(); i++) {
            RemoteViews cell = new RemoteViews(pkg, R.layout.widget_calendar_weekday);
            cell.setTextViewText(R.id.weekday_label, weekdays.optString(i));
            views.addView(R.id.cal_weekdays, cell);
        }

        views.removeAllViews(R.id.cal_grid);
        JSONArray cells = data.optJSONArray("cells");
        if (cells == null) return;

        for (int row = 0; row * 7 < cells.length(); row++) {
            RemoteViews rowViews = new RemoteViews(pkg, R.layout.widget_calendar_row);
            for (int col = 0; col < 7; col++) {
                int index = row * 7 + col;
                if (index >= cells.length()) break;
                rowViews.addView(R.id.cal_row, cell(context, cells.optJSONObject(index), showHebrew));
            }
            views.addView(R.id.cal_grid, rowViews);
        }
    }

    /*
      אין כאן PendingIntent לכל תא. ארבעים ושניים כאלה מנפחים את חבילת
      ה-RemoteViews שעוברת ל-launcher בקריאת Binder אחת, וזו הייתה הסיבה
      שהוידג׳ט לא נטען בכלל. הלחיצה יושבת על הרקע ופותחת את הלוח.
    */
    private static RemoteViews cell(Context context, JSONObject cell, boolean showHebrew) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_calendar_cell);
        if (cell == null) return views;

        boolean today = cell.optBoolean("today", false);
        boolean outside = cell.optBoolean("out", false);

        views.setTextViewText(R.id.cell_num, String.valueOf(cell.optInt("n")));
        views.setTextViewText(R.id.cell_heb, cell.optString("h"));
        views.setViewVisibility(R.id.cell_heb, showHebrew && !outside ? View.VISIBLE : View.GONE);

        int color;
        if (today) color = R.color.widget_on_accent;
        else if (outside) color = R.color.widget_faint;
        else if (cell.optBoolean("shabbat", false)) color = R.color.widget_accent;
        else color = R.color.widget_ink;
        views.setTextColor(R.id.cell_num, context.getColor(color));
        if (today) views.setTextColor(R.id.cell_heb, context.getColor(R.color.widget_on_accent));

        views.setViewVisibility(R.id.cell_today, today ? View.VISIBLE : View.GONE);

        String kind = cell.optString("kind", "");
        boolean hasEvents = cell.optInt("ev", 0) > 0;
        views.setViewVisibility(
            R.id.cell_holiday_dot,
            kind.isEmpty() || outside ? View.GONE : View.VISIBLE
        );
        if (!kind.isEmpty()) {
            views.setInt(R.id.cell_holiday_dot, "setBackgroundResource", dotFor(kind));
        }
        views.setViewVisibility(
            R.id.cell_event_dot,
            hasEvents && !outside ? View.VISIBLE : View.GONE
        );

        return views;
    }

    private static int dotFor(String kind) {
        switch (kind) {
            case "yomtov":
                return R.drawable.widget_dot_yomtov;
            case "fast":
                return R.drawable.widget_dot_fast;
            case "roshchodesh":
                return R.drawable.widget_dot_roshchodesh;
            default:
                return R.drawable.widget_dot_holiday;
        }
    }

    /* ---------------------------- רשימת הקרוב ---------------------------- */

    private static void buildUpcoming(Context context, RemoteViews views, JSONObject data, int max) {
        views.removeAllViews(R.id.cal_upcoming);
        JSONArray upcoming = data.optJSONArray("upcoming");
        if (upcoming == null || upcoming.length() == 0) {
            views.setViewVisibility(R.id.cal_upcoming, View.GONE);
            return;
        }
        String pkg = context.getPackageName();
        for (int i = 0; i < upcoming.length() && i < max; i++) {
            JSONObject item = upcoming.optJSONObject(i);
            if (item == null) continue;
            RemoteViews row = new RemoteViews(pkg, R.layout.widget_calendar_upcoming);
            row.setTextViewText(R.id.up_day, item.optString("day"));
            row.setTextViewText(R.id.up_title, item.optString("title"));
            row.setTextViewText(R.id.up_time, item.optString("time"));
            row.setViewVisibility(
                R.id.up_time,
                item.optString("time").isEmpty() ? View.GONE : View.VISIBLE
            );
            row.setInt(
                R.id.up_dot,
                "setBackgroundResource",
                item.optBoolean("holiday", false)
                    ? R.drawable.widget_dot_holiday
                    : R.drawable.widget_dot_event
            );
            row.setOnClickPendingIntent(R.id.up_root, openApp(context, item.optString("k", null)));
            views.addView(R.id.cal_upcoming, row);
        }
    }

    /* ------------------------------ פתיחה ------------------------------ */

    /**
     * פותח את האפליקציה, ואם נמסר תאריך - ישירות עליו.
     * הקישור הוא סכמה פנימית, שה-WebView קורא דרך אותו קוד שקורא קיצורי
     * דרך ממסך הבית.
     */
    static PendingIntent openApp(Context context, String dateKey) {
        String query = "tab=calendar";
        if (dateKey != null && !dateKey.isEmpty()) query += "&date=" + dateKey;
        return openAppAt(context, query, query.hashCode());
    }

    /** פותח את האפליקציה על שאילתה נתונה. requestCode מפריד בין הכוונות. */
    static PendingIntent openAppAt(Context context, String query, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.setData(Uri.parse("hebcal://open?" + query));
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    /** מרענן את כל המופעים של הוידג׳ט הזה. */
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        renderAll(
            context,
            manager,
            manager.getAppWidgetIds(new ComponentName(context, CalendarWidgetProvider.class))
        );
    }
}
