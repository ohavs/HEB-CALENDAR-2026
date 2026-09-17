package com.ohav.hebcal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
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

    /*
      שני ספי רוחב, כדי שאפשר יהיה לכווץ את הוידג׳ט לשתי עמודות.

      מתחת ל-200dp יורד המונה, ומתחת ל-150dp יורדת גם המילה "תזכורות"
      ונשאר כפתור ההוספה לבדו. הרשימה עצמה מוותרת על השעה - ראו
      RemindersWidgetService, שקורא את אותם ספים.
    */
    static final int MIN_WIDTH_FOR_COUNT = 200;
    static final int MIN_WIDTH_FOR_TITLE = 150;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        renderAll(context, manager, ids);
    }

    /**
     * שינוי גודל מחייב ציור מחדש.
     *
     * בלי זה הוידג׳ט נשאר עם ההחלטות של הרוחב הקודם, ולכן כיווץ הציג
     * כותרת חתוכה. גם הרשימה מקבלת הודעה, כי גם השורות שלה תלויות
     * ברוחב.
     */
    @Override
    public void onAppWidgetOptionsChanged(
        Context context,
        AppWidgetManager manager,
        int id,
        android.os.Bundle options
    ) {
        render(context, manager, id);
        manager.notifyAppWidgetViewDataChanged(id, R.id.reminders_list);
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

        /*
          הכותרת והמונה מגיעים מהמקור שהוידג׳ט מכוון אליו. וידג׳ט שמראה
          רשימה משותפת וכתוב עליו "תזכורות" משקר, ובמסך בית עם שניים
          שונים אי אפשר לדעת מי מי.
        */
        JSONObject source = sourceFor(context, data, id);
        if (source != null) {
            views.setTextViewText(R.id.rem_title, source.optString("label"));
        }

        int open = source != null
            ? source.optInt("open", 0)
            : (data == null ? 0 : data.optInt("open", 0));
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
        // לחיצה על הוידג׳ט מובילה למסך שהוא מייצג, לא ללוח
        views.setOnClickPendingIntent(
            R.id.rem_root,
            CalendarWidgetProvider.openTab(context, "reminders")
        );
        /*
          ההוספה יוצרת תזכורת אישית. על וידג׳ט שמכוון לרשימה משותפת היא
          הייתה הבטחה ריקה: מה שנוצר לא היה מופיע בו כלל. מוטב בלי.
        */
        boolean personal = source == null || source.optString("list").isEmpty();
        views.setViewVisibility(R.id.rem_add, personal ? View.VISIBLE : View.GONE);

        int width = manager.getAppWidgetOptions(id)
            .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        views.setViewVisibility(
            R.id.rem_count,
            width >= MIN_WIDTH_FOR_COUNT ? View.VISIBLE : View.GONE
        );
        views.setViewVisibility(
            R.id.rem_title,
            width >= MIN_WIDTH_FOR_TITLE ? View.VISIBLE : View.GONE
        );

        manager.updateAppWidget(id, views);
    }

    /**
     * המקור שהוידג׳ט הזה מכוון אליו, מתוך מה שהאפליקציה פרסמה.
     *
     * `null` פירושו שאין מה לבחור - חבילת web ישנה שעוד לא מפרסמת
     * `sources`, או מקור שנמחק מאז (רשימה שהוסרה, קטגוריה שנמחקה). בשני
     * המקרים נופלים בחזרה לכותרת ולמונה של המקור האישי, שתמיד קיים.
     */
    static JSONObject sourceFor(Context context, JSONObject data, int id) {
        if (data == null) return null;
        JSONArray sources = data.optJSONArray("sources");
        if (sources == null) return null;
        String wanted = WidgetStore.remindersSource(context, id);
        for (int i = 0; i < sources.length(); i++) {
            JSONObject source = sources.optJSONObject(i);
            if (source != null && wanted.equals(source.optString("id"))) return source;
        }
        return null;
    }

    /** הגדרה של מופע שהוסר נשארת אחרת לנצח. */
    @Override
    public void onDeleted(Context context, int[] ids) {
        for (int id : ids) WidgetStore.clearRemindersSource(context, id);
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

    /**
     * כפתור ההוספה פותח את מסך התזכורות עם שדה ההקלדה ממוקד.
     *
     * קודם הייתה כאן חלונית קטנה מעל מסך הבית, וזה היה פחות טוב: מה
     * שנכתב שם היה מנותק מהמסך שבו התזכורות באמת חיות, בלי תאריך, בלי
     * מיקום ובלי חזרה. עדיף מסך אחד שבו הכול.
     */
    private static PendingIntent addIntent(Context context) {
        return CalendarWidgetProvider.openAppAt(context, "tab=reminders&compose=1", 2);
    }
}
