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
 * וידג׳ט הרשימות המשותפות.
 *
 * ההבדל היחיד מוידג׳ט התזכורות הוא שיש כאן מה לבחור: אילו רשימה
 * וקטגוריה הוידג׳ט הזה מציג. הבחירה נעשית פעם אחת כשמניחים אותו
 * (SharedWidgetConfigActivity) ונשמרת לפי מזהה המופע - אפשר להניח שני
 * וידג׳טים על אותה רשימה ולכוון כל אחד לקטגוריה אחרת.
 *
 * הסינון כאן הוא השוואת מחרוזות בלבד: השם להצגה של הקטגוריה מגיע מוכן
 * מהאפליקציה ואינו נגזר מהמזהה. וידג׳ט אינו מריץ קוד שלנו.
 */
public class SharedWidgetProvider extends AppWidgetProvider {

    /** מתחת לרוחב הזה יורדת שורת הקטגוריה מהכותרת */
    static final int MIN_WIDTH_FOR_SUBTITLE = 180;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        renderAll(context, manager, ids);
    }

    @Override
    public void onAppWidgetOptionsChanged(
        Context context,
        AppWidgetManager manager,
        int id,
        android.os.Bundle options
    ) {
        render(context, manager, id);
        manager.notifyAppWidgetViewDataChanged(id, R.id.shared_list);
    }

    /** הגדרה של מופע שהוסר נשארת אחרת לנצח בקובץ ההעדפות. */
    @Override
    public void onDeleted(Context context, int[] ids) {
        for (int id : ids) WidgetStore.clearSharedConfig(context, id);
    }

    static void renderAll(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    /** ציור מוגן - ראו CalendarWidgetProvider. */
    private static void render(Context context, AppWidgetManager manager, int id) {
        try {
            draw(context, manager, id);
        } catch (Throwable error) {
            RemoteViews fallback = new RemoteViews(context.getPackageName(), R.layout.widget_shared);
            fallback.setTextViewText(R.id.shared_title, error.getClass().getSimpleName());
            manager.updateAppWidget(id, fallback);
        }
    }

    private static void draw(Context context, AppWidgetManager manager, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_shared);
        JSONObject data = WidgetStore.readJson(context, WidgetStore.KEY_SHARED);

        String listId = WidgetStore.sharedListId(context, id);
        String categoryId = WidgetStore.sharedCategoryId(context, id);
        JSONObject list = findList(data, listId);

        views.setTextViewText(R.id.shared_title, list == null ? "" : list.optString("name"));
        views.setTextViewText(R.id.shared_subtitle, categoryName(list, categoryId));

        int width = manager.getAppWidgetOptions(id)
            .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        boolean roomForSubtitle =
            width >= MIN_WIDTH_FOR_SUBTITLE && !categoryName(list, categoryId).isEmpty();
        views.setViewVisibility(
            R.id.shared_subtitle,
            roomForSubtitle ? View.VISIBLE : View.GONE
        );

        /*
          שלושה מצבים ריקים שונים, ולא אחד: "אין פריטים" למי שלא מחובר
          הוא שקר, ו"הרשימה נמחקה" למי שסתם סיים הכול הוא מפחיד.
        */
        boolean signedIn = data != null && data.optBoolean("signedIn", false);
        if (!signedIn) {
            views.setTextViewText(R.id.shared_empty, context.getString(R.string.widget_shared_signin));
        } else if (list == null) {
            views.setTextViewText(R.id.shared_empty, context.getString(R.string.widget_shared_gone));
        } else {
            views.setTextViewText(R.id.shared_empty, context.getString(R.string.widget_shared_empty));
        }

        Intent service = new Intent(context, SharedWidgetService.class);
        service.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        // הנתונים משתנים, ולכן הכתובת חייבת להיות ייחודית לכל מופע
        service.setData(android.net.Uri.parse(service.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.shared_list, service);
        views.setEmptyView(R.id.shared_list, R.id.shared_empty);

        views.setPendingIntentTemplate(R.id.shared_list, toggleTemplate(context));
        views.setOnClickPendingIntent(
            R.id.shared_root,
            CalendarWidgetProvider.openAppAt(context, "tab=reminders&view=shared", 40 + id)
        );

        manager.updateAppWidget(id, views);
    }

    /* ------------------------------ עזרה ------------------------------ */

    /** הרשימה שהוידג׳ט הזה מכוון אליה, או null אם היא נמחקה או שאין. */
    static JSONObject findList(JSONObject data, String listId) {
        if (data == null || listId == null || listId.isEmpty()) return null;
        JSONArray lists = data.optJSONArray("lists");
        if (lists == null) return null;
        for (int i = 0; i < lists.length(); i++) {
            JSONObject list = lists.optJSONObject(i);
            if (list != null && listId.equals(list.optString("id"))) return list;
        }
        return null;
    }

    /** השם להצגה של הקטגוריה שנבחרה. ריק פירושו "הכול". */
    private static String categoryName(JSONObject list, String categoryId) {
        if (list == null || categoryId == null || categoryId.isEmpty()) return "";
        JSONArray categories = list.optJSONArray("categories");
        if (categories == null) return "";
        for (int i = 0; i < categories.length(); i++) {
            JSONObject category = categories.optJSONObject(i);
            if (category != null && categoryId.equals(category.optString("id"))) {
                return category.optString("name");
            }
        }
        // הקטגוריה נמחקה מאז שהוגדר הוידג׳ט; SharedWidgetService יראה
        // רשימה ריקה, וזה המצב הנכון - הפריטים באמת כבר לא בה
        return "";
    }

    /**
     * תבנית הלחיצה לפריטי הרשימה.
     * חייבת להיות ניתנת לשינוי: כל שורה ממלאת אותה במזהה שלה.
     */
    private static PendingIntent toggleTemplate(Context context) {
        Intent intent = new Intent(context, WidgetActionReceiver.class);
        intent.setAction(WidgetActionReceiver.ACTION_TOGGLE_SHARED);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getBroadcast(context, 3, intent, flags);
    }
}
