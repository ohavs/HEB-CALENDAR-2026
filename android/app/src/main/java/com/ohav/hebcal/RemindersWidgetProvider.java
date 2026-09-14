package com.ohav.hebcal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * וידג׳ט התזכורות: רשימה נגללת, מחולקת לימים, עם תיבת סימון לכל פריט
 * וכפתור הוספה.
 *
 * רשימה נגללת בוידג׳ט חייבת לעבור דרך RemoteViewsService - זו הדרך
 * היחידה שאנדרואיד מאפשר. הלחיצות בתוכה נשלחות דרך תבנית אחת עם כוונת
 * מילוי לכל שורה, כי אי אפשר ליצור PendingIntent נפרד לכל פריט ברשימה.
 */
public class RemindersWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        renderAll(context, manager, ids);
    }

    static void renderAll(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    /** ציור מוגן - ראו CalendarWidgetProvider. */
    private static void render(Context context, AppWidgetManager manager, int id) {
        try {
            draw(context, manager, id);
        } catch (Throwable error) {
            RemoteViews fallback = new RemoteViews(context.getPackageName(), R.layout.widget_reminders);
            fallback.setTextViewText(R.id.rem_count, error.getClass().getSimpleName());
            manager.updateAppWidget(id, fallback);
        }
    }

    private static void draw(Context context, AppWidgetManager manager, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_reminders);
        JSONObject data = WidgetStore.readJson(context, WidgetStore.KEY_REMINDERS);

        int open = data == null ? 0 : data.optInt("open", 0);
        views.setTextViewText(
            R.id.rem_count,
            open == 0 ? "" : context.getResources().getQuantityString(R.plurals.widget_open, open, open)
        );

        Intent service = new Intent(context, RemindersWidgetService.class);
        service.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        // הנתונים משתנים, ולכן הכתובת חייבת להיות ייחודית לכל מופע
        service.setData(android.net.Uri.parse(service.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.reminders_list, service);
        views.setEmptyView(R.id.reminders_list, R.id.rem_empty);

        views.setPendingIntentTemplate(R.id.reminders_list, toggleTemplate(context));
        views.setOnClickPendingIntent(R.id.rem_add, addIntent(context));
        views.setOnClickPendingIntent(R.id.rem_title, CalendarWidgetProvider.openApp(context, null));
        views.setViewVisibility(R.id.rem_add, View.VISIBLE);

        manager.updateAppWidget(id, views);
    }

    /**
     * תבנית הלחיצה לפריטי הרשימה.
     * חייבת להיות ניתנת לשינוי: כל שורה ממלאת אותה במזהה שלה.
     */
    private static PendingIntent toggleTemplate(Context context) {
        Intent intent = new Intent(context, WidgetActionReceiver.class);
        intent.setAction(WidgetActionReceiver.ACTION_TOGGLE);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getBroadcast(context, 1, intent, flags);
    }

    /** כפתור ההוספה: חלונית קטנה מעל מסך הבית, בלי לפתוח את האפליקציה. */
    private static PendingIntent addIntent(Context context) {
        Intent intent = new Intent(context, AddReminderActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context,
            2,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
