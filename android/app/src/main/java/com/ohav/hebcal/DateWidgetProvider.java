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
 * וידג׳ט התאריך: "23/11" בספרות גדולות, בגובה של השעון של המשגר שלצידו,
 * ומתחתן שורה קטנה אחת - היום בשבוע, ובקטן יותר התאריך העברי.
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
    /** הצלע הארוכה של התמונה לכל היותר. מעבר לזה זה זיכרון בלי חדות */
    private static final int MAX_PX = 1200;
    /**
     * המרווח מעל הספרות, כחלק מהגובה. זה המרווח של השעון שלידו, כדי שראשי
     * הספרות יעמדו בקו אחד ושני הוידג׳טים ייקראו כזוג.
     */
    private static final float TOP_RATIO = 0.105f;
    /** המרווח מתחת לשורה התחתונה, כחלק מהגובה */
    private static final float BOTTOM_RATIO = 0.045f;
    /**
     * המרווח בצדדים. צר בכוונה: "23/11" הוא חמישה סימנים מול ארבע ספרות
     * השעון, ובמרווח רגיל הרוחב נגמר לפני שהגובה מגיע לגובה שלו.
     */
    private static final int SIDE_DP = 8;
    /** ריווח הספרות, ב-em. Six Caps מרווח יותר מספרות השעון */
    private static final float DIGIT_SPACING = -0.02f;
    /** היום בשבוע, כחלק מהגובה */
    private static final float SMALL_RATIO = 0.07f;
    /** התאריך העברי קטן ממנו - הוא המשני מבין השניים */
    private static final float HEBREW_RATIO = 0.85f;
    /** מתחת לזה השורה התחתונה לא נקראת, והספרות לבדן */
    private static final float MIN_SMALL_DP = 9f;
    /** שקיפות היום בשבוע, מתוך 255 */
    private static final int SECONDARY_ALPHA = 165;
    /** והתאריך העברי שקוף ממנו */
    private static final int HEBREW_ALPHA = 125;

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
     * הגודל שהמשגר נתן. לאורך: רוחב מינימלי וגובה מרבי, ולרוחב ההפך - זה מה
     * שהמשגר מתכוון אליו בשני הזוגות. המרווחים מצוירים כאן ולא בפריסה, כי
     * הם יחסיים לגובה - כמו של השעון.
     *
     * הספרות ממלאות את הגובה, והשורה הקטנה יושבת מתחתן: היום בשבוע, ולידו
     * בקטן יותר התאריך העברי. כשאין מקום לשניהם נשאר היום בשבוע.
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

        float w = widthDp * density;
        float h = heightDp * density;
        float shrink = Math.min(1f, MAX_PX / Math.max(w, h));
        int bw = Math.max(1, Math.round(w * shrink));
        int bh = Math.max(1, Math.round(h * shrink));
        float px = density * shrink;

        Bitmap bitmap = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        float side = SIDE_DP * px;
        float avail = Math.max(1, bw - 2 * side);
        float top = bh * TOP_RATIO;
        float bottom = bh * (1 - BOTTOM_RATIO);

        float small = bh * SMALL_RATIO;
        if (small >= MIN_SMALL_DP * px) {
            Paint day = smallPaint(context, small, SECONDARY_ALPHA);
            Paint heb = smallPaint(context, small * HEBREW_RATIO, HEBREW_ALPHA);
            float baseline = bottom;
            String dot = "·";
            float gap = small * 0.35f;
            float dayW = day.measureText(weekday);
            float total = dayW + 2 * gap + heb.measureText(dot) + heb.measureText(hebrew);

            if (!hebrew.isEmpty() && total <= avail) {
                // מימין לשמאל: היום בשבוע בימין, נקרא ראשון
                float x = (bw + total) / 2f - dayW;
                canvas.drawText(weekday, x, baseline, day);
                x -= gap + heb.measureText(dot);
                canvas.drawText(dot, x, baseline, heb);
                x -= gap + heb.measureText(hebrew);
                canvas.drawText(hebrew, x, baseline, heb);
            } else {
                drawCentered(canvas, day, fit(day, weekday, avail), bw / 2f, baseline);
            }

            // לפי מחרוזת קבועה ולא לפי היום, אחרת הספרות היו משנות גובה
            // מיום ליום - "שלישי" נושא ל׳ שעולה מעל השורה
            Rect ink = new Rect();
            day.getTextBounds("של", 0, 2, ink);
            bottom = baseline + ink.top - small * 0.4f;
        }

        Paint big = new Paint(Paint.ANTI_ALIAS_FLAG);
        big.setTypeface(font(context, R.font.six_caps));
        big.setColor(0xFFFFFFFF);
        big.setLetterSpacing(DIGIT_SPACING);
        big.setTextSize(100);
        Rect bounds = new Rect();
        big.getTextBounds(digits, 0, digits.length(), bounds);
        float areaH = Math.max(1, bottom - top);
        // לפי הדיו עצמו ולא לפי מדדי הגופן - כך הוא ממלא כמו השעון שלידו
        float scale = Math.min(avail / Math.max(1, bounds.width()), areaH / Math.max(1, bounds.height()));
        big.setTextSize(100 * scale);
        big.getTextBounds(digits, 0, digits.length(), bounds);
        float x = bw / 2f - bounds.exactCenterX();
        float y = top + (areaH - bounds.height()) / 2f - bounds.top;
        canvas.drawText(digits, x, y, big);

        return bitmap;
    }

    private static Paint smallPaint(Context context, float size, int alpha) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        paint.setTypeface(font(context, R.font.heebo_medium));
        paint.setTextSize(size);
        paint.setColor(0xFFFFFFFF);
        paint.setAlpha(alpha);
        return paint;
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
