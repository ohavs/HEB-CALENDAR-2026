package com.ohav.hebcal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * וידג׳ט הלוח: רשת החודש עם מועדים ואירועים, ורשימת הקרוב.
 *
 * הוידג׳ט אינו מחשב כלום. הוא מצייר את מה שהאפליקציה כתבה לקובץ המשותף,
 * ולכן גם כשהאפליקציה סגורה לגמרי הלוח נכון. מה שתלוי ביום עצמו - עיגול
 * "היום", "מחר" ברשימה, והמעבר לחודש הבא - נבחר בזמן הציור מתוך מה
 * שנכתב מראש (WidgetDays, `next`), ולא נשאר קפוא על יום הפרסום.
 *
 * ההתאמה לגודל נעשית בהסתרה ולא בפריסות נפרדות: אותה פריסה משרתת את כל
 * הגדלים, וכל מה שמשתנה הוא מה מוצג. פריסה לכל גודל הייתה מכפילה את
 * מקומות השינוי בלי להוסיף כלום.
 *
 * **הגובה מתוכנן, לא מנוחש.** קודם היו כאן שני ספים - "יש רשת", "יש גם
 * רשימה" - והרשימה קיבלה את מקומה ראשונה (wrap_content) בזמן שהרשת קיבלה
 * את מה שנשאר. בוידג׳ט של שלוש שורות זה דחס שש שורות של חודש לשמונים
 * נקודות, והמספרים נחתכו לפסים. עכשיו `plan` מחלק את הגובה: קודם כל
 * שורות החודש, ורק מה שנשאר הולך לרשימה - שורה שלמה או כלום.
 *
 * ומה נמדד: מאנדרואיד 12 המשגר מוסר את הגדלים שבהם הוידג׳ט באמת מוצג,
 * ולכל אחד נבנית תצוגה משלו (`RemoteViews(Map)`); המשגר בוחר. לפני כן -
 * רוחב ממצב לאורך וגובה ממצב לרוחב הם המינימום, ולכן לפי הכיוון הנוכחי.
 */
public class CalendarWidgetProvider extends AppWidgetProvider {

    /*
      גובהי הבנייה, ב-dp ולפי הפריסות. מה שתלוי בגודל הטקסט מוכפל
      בקנה המידה של הגופן. עדיף להעריך ביתר: הרשת היא שמתכווצת כשחסר,
      ותוספת קטנה נבלעת בשורות שלה.
    */
    private static final float PAD = 24;
    private static final float HEADER = 30;
    private static final float WEEKDAYS = 16;
    /** שורה עם התאריך העברי */
    private static final float ROW_FULL = 44;
    /** שורה בלי התאריך העברי */
    private static final float ROW_PLAIN = 32;
    /** תא מצומצם - ראו widget_calendar_cell_compact */
    private static final float ROW_COMPACT = 24;
    private static final float UPCOMING_ROW = 24;
    private static final float UPCOMING_PAD = 6;
    /** ברשימה קצרה יותר מזה כדאי קודם לתת לרשת את התאריך העברי */
    private static final int UPCOMING_BEFORE_HEBREW = 2;
    private static final int MAX_UPCOMING = 6;
    /** מתחת לרוחב הזה התאים צרים מדי לתאריך עברי */
    private static final int MIN_WIDTH_FOR_HEBREW = 260;

    private enum Style { FULL, PLAIN, COMPACT }

    /** מה נכנס בגודל אחד. */
    static final class Plan {
        boolean grid;
        Style style = Style.PLAIN;
        /** השורה הראשונה שמוצגת. אפס, חוץ מברצועת שבוע */
        int firstRow;
        int rowCount;
        int upcoming;
        boolean hebrew;
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        renderAll(context, manager, ids);
        WidgetDays.scheduleMidnight(context);
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
        JSONObject data = WidgetStore.readJson(context, WidgetStore.KEY_CALENDAR);
        Bundle options = manager.getAppWidgetOptions(id);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ArrayList<SizeF> sizes =
                options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if (sizes != null && !sizes.isEmpty()) {
                Map<SizeF, RemoteViews> bySize = new HashMap<>();
                for (SizeF size : sizes) {
                    bySize.put(size, build(context, data, size.getWidth(), size.getHeight()));
                }
                manager.updateAppWidget(id, new RemoteViews(bySize));
                return;
            }
        }

        boolean portrait = context.getResources().getConfiguration().orientation
            != Configuration.ORIENTATION_LANDSCAPE;
        int width = options.getInt(
            portrait ? AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH : AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH,
            250
        );
        int height = options.getInt(
            portrait ? AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT : AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,
            200
        );
        manager.updateAppWidget(id, build(context, data, width, height));
    }

    /** התצוגה לגודל אחד, ב-dp. */
    private static RemoteViews build(Context context, JSONObject data, float width, float height) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_calendar);
        views.setOnClickPendingIntent(R.id.cal_root, openApp(context, null));

        if (data == null) {
            views.setTextViewText(R.id.cal_month, context.getString(R.string.widget_empty_title));
            views.setTextViewText(R.id.cal_hebrew, "");
            views.setViewVisibility(R.id.cal_weekdays, View.GONE);
            views.setViewVisibility(R.id.cal_grid, View.GONE);
            views.setViewVisibility(R.id.cal_upcoming, View.GONE);
            return views;
        }

        String today = WidgetDays.todayKey();
        JSONObject month = monthFor(data, today);
        JSONArray cells = month.optJSONArray("cells");
        List<JSONObject> upcoming = upcoming(data);

        float scale = Math.max(1f, context.getResources().getConfiguration().fontScale);
        Plan plan = plan(
            width,
            height,
            scale,
            monthRows(cells),
            todayRow(cells, today),
            upcoming.size()
        );

        views.setTextViewText(R.id.cal_month, month.optString("month"));
        views.setTextViewText(R.id.cal_hebrew, month.optString("hebrewMonth"));
        views.setViewVisibility(R.id.cal_hebrew, plan.hebrew ? View.VISIBLE : View.GONE);

        views.setViewVisibility(R.id.cal_weekdays, plan.grid ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.cal_grid, plan.grid ? View.VISIBLE : View.GONE);
        if (plan.grid) buildGrid(context, views, data, cells, plan, today);

        views.setViewVisibility(R.id.cal_upcoming, plan.upcoming > 0 ? View.VISIBLE : View.GONE);
        if (plan.upcoming > 0) buildUpcoming(context, views, data, upcoming, plan.upcoming);

        return views;
    }

    /* ------------------------------ התכנון ------------------------------ */

    /**
     * מחלק את הגובה. כל מה שמוצג מוצג שלם.
     *
     * סדר העדיפויות: החודש כולו, אפילו מצומצם; תאים רגילים; שתי שורות
     * של הקרוב; התאריך העברי בתאים; ועוד שורות לקרוב. כשהחודש אינו נכנס
     * גם מצומצם, מוצגים השבועות שנכנסים - מהשבוע של היום - ורצועה של
     * שבוע אחד היא מה שנשאר בוידג׳ט בגובה שורה.
     */
    static Plan plan(
        float width,
        float height,
        float scale,
        int monthRows,
        int todayRow,
        int upcomingAvailable
    ) {
        Plan plan = new Plan();
        plan.hebrew = width >= MIN_WIDTH_FOR_HEBREW;

        float body = height - PAD - HEADER * scale;
        float gridRoom = body - WEEKDAYS * scale;
        float compact = ROW_COMPACT * scale;
        float plain = ROW_PLAIN * scale;
        float full = ROW_FULL * scale;

        if (monthRows > 0 && gridRoom >= monthRows * compact) {
            plan.grid = true;
            plan.rowCount = monthRows;
            plan.style = Style.COMPACT;
            float rest = gridRoom - monthRows * compact;

            if (rest >= monthRows * (plain - compact)) {
                plan.style = Style.PLAIN;
                rest -= monthRows * (plain - compact);
            }

            int few = Math.min(UPCOMING_BEFORE_HEBREW, Math.min(upcomingAvailable, listRows(rest, scale)));
            float listHeight = listHeight(few, scale);
            if (plan.style == Style.PLAIN
                && plan.hebrew
                && rest - listHeight >= monthRows * (full - plain)) {
                plan.style = Style.FULL;
                rest -= monthRows * (full - plain);
            }

            plan.upcoming = Math.min(MAX_UPCOMING, Math.min(upcomingAvailable, listRows(rest, scale)));
            return plan;
        }

        if (monthRows > 0 && gridRoom >= compact) {
            plan.grid = true;
            plan.style = Style.COMPACT;
            plan.rowCount = Math.min(monthRows, (int) (gridRoom / compact));
            plan.firstRow = Math.max(0, Math.min(todayRow, monthRows - plan.rowCount));
            return plan;
        }

        plan.upcoming = Math.min(MAX_UPCOMING, Math.min(upcomingAvailable, listRows(body, scale)));
        return plan;
    }

    private static int listRows(float room, float scale) {
        if (room < UPCOMING_PAD + UPCOMING_ROW * scale) return 0;
        return (int) ((room - UPCOMING_PAD) / (UPCOMING_ROW * scale));
    }

    private static float listHeight(int rows, float scale) {
        return rows == 0 ? 0 : UPCOMING_PAD + rows * UPCOMING_ROW * scale;
    }

    /**
     * החודש שהוידג׳ט מציג היום.
     *
     * הפרסום האחרון נושא גם את החודש הבא (`next`), כי האפליקציה אינה
     * נפתחת בחצות של הראשון לחודש. המפתח הראשון שבתוך החודש אומר איזה
     * חודש זה - השוואת מחרוזות, בלי לוח שנה.
     */
    private static JSONObject monthFor(JSONObject data, String today) {
        JSONObject next = data.optJSONObject("next");
        if (next == null) return data;
        String nextMonth = monthKey(next.optJSONArray("cells"));
        if (nextMonth != null && today.startsWith(nextMonth)) return next;
        return data;
    }

    /** "2026-10" לפי התא הראשון שבתוך החודש. */
    private static String monthKey(JSONArray cells) {
        for (int i = 0; cells != null && i < cells.length(); i++) {
            JSONObject cell = cells.optJSONObject(i);
            if (cell == null || cell.optBoolean("out", false)) continue;
            String key = cell.optString("k");
            return key.length() >= 7 ? key.substring(0, 7) : null;
        }
        return null;
    }

    /**
     * כמה שורות יש בחודש עצמו.
     *
     * הרשת היא תמיד שישה שבועות, אבל ברוב החודשים השורה האחרונה כולה
     * מהחודש הבא. ויתור עליה הוא שורה שלמה של גובה בחזרה.
     */
    private static int monthRows(JSONArray cells) {
        if (cells == null) return 0;
        int rows = 0;
        for (int i = 0; i < cells.length(); i++) {
            JSONObject cell = cells.optJSONObject(i);
            if (cell != null && !cell.optBoolean("out", false)) rows = i / 7 + 1;
        }
        return rows;
    }

    private static int todayRow(JSONArray cells, String today) {
        for (int i = 0; cells != null && i < cells.length(); i++) {
            JSONObject cell = cells.optJSONObject(i);
            if (cell != null && today.equals(cell.optString("k"))) return i / 7;
        }
        return 0;
    }

    /* ------------------------------ הרשת ------------------------------ */

    private static void buildGrid(
        Context context,
        RemoteViews views,
        JSONObject data,
        JSONArray cells,
        Plan plan,
        String today
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
        if (cells == null) return;

        int end = plan.firstRow + plan.rowCount;
        for (int row = plan.firstRow; row < end && row * 7 < cells.length(); row++) {
            RemoteViews rowViews = new RemoteViews(pkg, R.layout.widget_calendar_row);
            for (int col = 0; col < 7; col++) {
                int index = row * 7 + col;
                if (index >= cells.length()) break;
                rowViews.addView(
                    R.id.cal_row,
                    cell(context, cells.optJSONObject(index), plan.style, today)
                );
            }
            views.addView(R.id.cal_grid, rowViews);
        }
    }

    /*
      אין כאן PendingIntent לכל תא. ארבעים ושניים כאלה מנפחים את חבילת
      ה-RemoteViews שעוברת ל-launcher בקריאת Binder אחת, וזו הייתה הסיבה
      שהוידג׳ט לא נטען בכלל. הלחיצה יושבת על הרקע ופותחת את הלוח.
    */
    private static RemoteViews cell(Context context, JSONObject cell, Style style, String todayKey) {
        RemoteViews views = new RemoteViews(
            context.getPackageName(),
            style == Style.COMPACT
                ? R.layout.widget_calendar_cell_compact
                : R.layout.widget_calendar_cell
        );
        if (cell == null) return views;

        /*
          "היום" נקבע כאן ולא נלקח מהמסמך: המסמך נכתב כשהאפליקציה הייתה
          פתוחה, והעיגול נשאר על אותו יום עד הפתיחה הבאה.
        */
        String key = cell.optString("k");
        boolean today = key.isEmpty() ? cell.optBoolean("today", false) : key.equals(todayKey);
        boolean outside = cell.optBoolean("out", false);

        views.setTextViewText(R.id.cell_num, String.valueOf(cell.optInt("n")));
        views.setTextViewText(R.id.cell_heb, cell.optString("h"));
        views.setViewVisibility(
            R.id.cell_heb,
            style == Style.FULL && !outside ? View.VISIBLE : View.GONE
        );

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

    /** השורות שעוד לא עברו. מה שהיה אתמול "היום" כבר אינו קרוב. */
    private static List<JSONObject> upcoming(JSONObject data) {
        List<JSONObject> out = new ArrayList<>();
        JSONArray upcoming = data.optJSONArray("upcoming");
        for (int i = 0; upcoming != null && i < upcoming.length(); i++) {
            JSONObject item = upcoming.optJSONObject(i);
            if (item == null || WidgetDays.isPast(item.optString("k"))) continue;
            out.add(item);
        }
        return out;
    }

    private static void buildUpcoming(
        Context context,
        RemoteViews views,
        JSONObject data,
        List<JSONObject> upcoming,
        int max
    ) {
        views.removeAllViews(R.id.cal_upcoming);
        String pkg = context.getPackageName();
        for (int i = 0; i < upcoming.size() && i < max; i++) {
            JSONObject item = upcoming.get(i);
            String key = item.optString("k");
            RemoteViews row = new RemoteViews(pkg, R.layout.widget_calendar_upcoming);
            row.setTextViewText(
                R.id.up_day,
                WidgetDays.label(data, key, item.optString("far"), item.optString("day"))
            );
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
            row.setOnClickPendingIntent(R.id.up_root, openApp(context, key));
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

    /**
     * פותח את האפליקציה על הלשונית של הוידג׳ט שנלחץ.
     *
     * וידג׳ט מוביל למקום שהוא מייצג: זמני שבת ללשונית השבת, תזכורות
     * ללשונית התזכורות. קודם כל השלושה נכנסו ללוח, כי כולם השתמשו
     * ב-openApp - והמשתמש נחת במסך שלא ביקש.
     */
    static PendingIntent openTab(Context context, String tab) {
        String query = "tab=" + tab;
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
