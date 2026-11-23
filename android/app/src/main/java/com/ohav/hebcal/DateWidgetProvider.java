package com.ohav.hebcal;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.os.Bundle;
import android.widget.RemoteViews;

import androidx.core.content.res.ResourcesCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * וידג׳ט התאריך: "23/11" בספרות גדולות, לצד השעון של המשגר, ומעליו ומתחתיו
 * בקטן היום בשבוע והתאריך העברי.
 *
 * **הוא מצויר כתמונה, לא כטקסט.** בטקסט הגופן נפתר אצל המשגר, ובמכשיר
 * אמיתי Six Caps לא הגיע - הספרות יצאו בגופן רגיל ורחב, בלי שום שגיאה.
 * כאן הגופן נטען בתהליך שלנו ומצויר לביטמפ, כך שאין למשגר מה לפתור. הצבע
 * נשאר שלו: התמונה לבנה, וה-ImageView צובע אותה ב-`android:tint` מהפריסה -
 * צבע שהמשגר פותר, ולכן מתחלף בלילה ובטפט חדש. צבע שהיה נקבע כאן היה
 * מספר קבוע מרגע הציור (ראו WidgetColors). מה שמשני מצויר בשקיפות, והגוון
 * שומר עליה.
 *
 * הלועזי והיום בשבוע הם שעון המכשיר, ולכן נכונים גם לפני שהאפליקציה נפתחה.
 * העברי מגיע ערוך מתמונת המצב של וידג׳ט הלוח (`hd` בתא של היום), כי
 * וידג׳ט אינו מחשב תאריך עברי - וכשאין, השורה פשוט אינה מצוירת. מציירים
 * בחצות (WidgetDays.scheduleMidnight, דרך WidgetStore.refreshAll), בכל
 * פרסום, כשהשעה או אזור הזמן משתנים, וכשהגודל משתנה - התמונה נמדדת לגודל.
 */
public class DateWidgetProvider extends AppWidgetProvider {

    /** גודל כשהמשגר אינו מוסר אחד - שתיים על שתיים */
    private static final int DEFAULT_DP = 110;
    /** הריפוד של הפריסה, שהתמונה יושבת בתוכו */
    private static final int PAD_DP = 12;
    /** הצלע הארוכה של התמונה לכל היותר. מעבר לזה זה זיכרון בלי חדות */
    private static final int MAX_PX = 1200;
    /** השורות הקטנות, כחלק מהגובה */
    private static final float SMALL_RATIO = 0.105f;
    /** מתחת לזה השורות הקטנות לא נקראות, והספרות לבדן */
    private static final float MIN_SMALL_DP = 9f;
    /** שקיפות השורות המשניות, מתוך 255 */
    private static final int SECONDARY_ALPHA = 165;

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, DateWidgetProvider.class));
            renderAll(context, manager, ids);
            WidgetDays.scheduleMidnight(context);
            return;
        }
        super.onReceive(context, intent);
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
        if (ids.length == 0) return;
        String hebrew = hebrewToday(context);
        for (int id : ids) render(context, manager, id, hebrew);
    }

    private static void render(Context context, AppWidgetManager manager, int id) {
        render(context, manager, id, hebrewToday(context));
    }

    private static void render(Context context, AppWidgetManager manager, int id, String hebrew) {
        Calendar now = Calendar.getInstance();
        Locale he = new Locale("he");
        // שתי ספרות לכל אחד, כמו "09" בשעון שלידו
        String digits = String.format(
            Locale.ROOT,
            "%02d/%02d",
            now.get(Calendar.DAY_OF_MONTH),
            now.get(Calendar.MONTH) + 1
        );
        String weekday = new SimpleDateFormat("EEEE", he).format(now.getTime());

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_date);
        views.setImageViewBitmap(
            R.id.date_image,
            draw(context, manager.getAppWidgetOptions(id), digits, weekday, hebrew)
        );
        // תמונה אינה משפט לקורא מסך
        String spoken = new SimpleDateFormat("EEEE, d בMMMM yyyy", he).format(now.getTime());
        views.setContentDescription(
            R.id.date_image,
            hebrew.isEmpty() ? spoken : spoken + ", " + hebrew
        );
        views.setOnClickPendingIntent(
            R.id.date_root,
            CalendarWidgetProvider.openApp(context, WidgetDays.todayKey())
        );
        manager.updateAppWidget(id, views);
    }

    /**
     * "כ״ג בכסלו" מתמונת המצב של הלוח, או ריק.
     *
     * הפרסום נושא את החודש הנוכחי ואת הבא (`next`), ולכן מי שלא פתח את
     * האפליקציה עדיין רואה תאריך עברי שבועות קדימה. אחרי זה - ריק, לא ישן.
     */
    private static String hebrewToday(Context context) {
        JSONObject data = WidgetStore.readJson(context, WidgetStore.KEY_CALENDAR);
        if (data == null) return "";
        String today = WidgetDays.todayKey();
        String found = findHebrew(data.optJSONArray("cells"), today);
        if (found.isEmpty()) {
            JSONObject next = data.optJSONObject("next");
            if (next != null) found = findHebrew(next.optJSONArray("cells"), today);
        }
        return found;
    }

    private static String findHebrew(JSONArray cells, String key) {
        for (int i = 0; cells != null && i < cells.length(); i++) {
            JSONObject cell = cells.optJSONObject(i);
            if (cell != null && key.equals(cell.optString("k"))) return cell.optString("hd", "");
        }
        return "";
    }

    /* ------------------------------- ציור ------------------------------- */

    /**
     * הגודל שהמשגר נתן, פחות הריפוד. לאורך: רוחב מינימלי וגובה מרבי,
     * ולרוחב ההפך - זה מה שהמשגר מתכוון אליו בשני הזוגות.
     */
    private static Bitmap draw(
        Context context,
        Bundle options,
        String digits,
        String weekday,
        String hebrew
    ) {
        float density = context.getResources().getDisplayMetrics().density;
        boolean landscape = context.getResources().getConfiguration().orientation
            == Configuration.ORIENTATION_LANDSCAPE;
        int widthDp = dp(options, landscape
            ? AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH
            : AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        int heightDp = dp(options, landscape
            ? AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT
            : AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT);

        float w = Math.max(1, widthDp - 2 * PAD_DP) * density;
        float h = Math.max(1, heightDp - 2 * PAD_DP) * density;
        float shrink = Math.min(1f, MAX_PX / Math.max(w, h));
        int bw = Math.max(1, Math.round(w * shrink));
        int bh = Math.max(1, Math.round(h * shrink));

        Bitmap bitmap = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        float small = bh * SMALL_RATIO;
        boolean lines = small >= MIN_SMALL_DP * density * shrink;
        float top = 0;
        float bottom = bh;

        if (lines) {
            Paint text = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
            text.setTypeface(font(context, R.font.heebo_medium));
            text.setTextSize(small);
            text.setColor(0xFFFFFFFF);
            text.setAlpha(SECONDARY_ALPHA);
            Paint.FontMetrics m = text.getFontMetrics();
            float line = m.descent - m.ascent;
            float gap = small * 0.45f;

            drawCentered(canvas, text, fit(text, weekday, bw), bw / 2f, -m.ascent);
            top = line + gap;
            if (!hebrew.isEmpty()) {
                drawCentered(canvas, text, fit(text, hebrew, bw), bw / 2f, bh - m.descent);
                bottom = bh - line - gap;
            } else {
                // בלי שורה תחתונה הספרות יורדות, אבל לא עד הקצה - שיישארו באמצע
                bottom = bh - gap;
            }
        }

        Paint big = new Paint(Paint.ANTI_ALIAS_FLAG);
        big.setTypeface(font(context, R.font.six_caps));
        big.setColor(0xFFFFFFFF);
        big.setTextSize(100);
        Rect bounds = new Rect();
        big.getTextBounds(digits, 0, digits.length(), bounds);
        float areaW = bw * 0.96f;
        float areaH = Math.max(1, bottom - top);
        // לפי הדיו עצמו ולא לפי מדדי הגופן - כך הוא ממלא כמו השעון שלידו
        float scale = Math.min(areaW / Math.max(1, bounds.width()), areaH / Math.max(1, bounds.height()));
        big.setTextSize(100 * scale);
        big.getTextBounds(digits, 0, digits.length(), bounds);
        float x = bw / 2f - bounds.exactCenterX();
        float y = top + (areaH - bounds.height()) / 2f - bounds.top;
        canvas.drawText(digits, x, y, big);

        return bitmap;
    }

    private static int dp(Bundle options, String key) {
        int value = options == null ? 0 : options.getInt(key, 0);
        return value > 0 ? value : DEFAULT_DP;
    }

    private static Typeface font(Context context, int id) {
        try {
            Typeface typeface = ResourcesCompat.getFont(context, id);
            if (typeface != null) return typeface;
        } catch (RuntimeException ignored) {
            // גופן שלא נטען אינו סיבה לוידג׳ט ריק
        }
        return Typeface.DEFAULT;
    }

    /** שורה שאינה נכנסת מתקצרת בסוף, ולא בורחת מהקצוות */
    private static String fit(Paint paint, String value, float width) {
        if (paint.measureText(value) <= width) return value;
        String ellipsis = "…";
        for (int end = value.length() - 1; end > 0; end--) {
            String cut = value.substring(0, end).trim() + ellipsis;
            if (paint.measureText(cut) <= width) return cut;
        }
        return "";
    }

    private static void drawCentered(Canvas canvas, Paint paint, String value, float cx, float baseline) {
        if (value.isEmpty()) return;
        canvas.drawText(value, cx - paint.measureText(value) / 2f, baseline, paint);
    }
}
