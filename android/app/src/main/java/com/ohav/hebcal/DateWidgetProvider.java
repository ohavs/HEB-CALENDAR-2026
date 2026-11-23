package com.ohav.hebcal;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * וידג׳ט התאריך: היום והחודש בספרות גדולות, לצד השעון של המשגר.
 *
 * היחיד שאינו קורא דבר מהאפליקציה. התאריך הלועזי הוא שעון המכשיר, ולכן
 * הוא נכון גם לפני שהאפליקציה נפתחה פעם אחת - ואין לו שום שדה בתמונת
 * המצב שצריך נפילה לאחור. מה שכן חשוב הוא מתי מציירים: בחצות
 * (WidgetDays.scheduleMidnight, דרך WidgetStore.refreshAll), וכשהשעה או
 * אזור הזמן משתנים.
 */
public class DateWidgetProvider extends AppWidgetProvider {

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

    static void renderAll(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    private static void render(Context context, AppWidgetManager manager, int id) {
        Calendar now = Calendar.getInstance();
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_date);

        // שתי ספרות לכל אחד, כמו "09" בשעון שלידו
        views.setTextViewText(
            R.id.date_text,
            String.format(
                Locale.ROOT,
                "%02d %02d",
                now.get(Calendar.DAY_OF_MONTH),
                now.get(Calendar.MONTH) + 1
            )
        );
        // "23 11" אינו משפט לקורא מסך
        views.setContentDescription(
            R.id.date_text,
            new SimpleDateFormat("EEEE, d בMMMM yyyy", new Locale("he")).format(now.getTime())
        );
        views.setOnClickPendingIntent(
            R.id.date_root,
            CalendarWidgetProvider.openApp(context, WidgetDays.todayKey())
        );
        manager.updateAppWidget(id, views);
    }
}
