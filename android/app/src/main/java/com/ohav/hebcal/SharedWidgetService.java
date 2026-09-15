package com.ohav.hebcal;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * הרשימה הנגללת של וידג׳ט הרשימות המשותפות.
 *
 * מבנה זהה ל-RemindersWidgetService - קבוצות שנפרשות לשורות משני סוגים,
 * כי ListView בוידג׳ט אינו יודע לקנן. שני הבדלים:
 *
 * 1. הרשימה מסוננת לפי מה שהוגדר למופע הזה (רשימה, וקטגוריה אופציונלית).
 * 2. לשורה יש שורת משנה: מי הוסיף אותה. ברשימה משותפת זו העובדה שחסרה,
 *    והיא תופסת את מקומה של השעה כשיש שתיהן - פריט משותף הוא כמעט תמיד
 *    בלי שעה.
 */
public class SharedWidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(
            getApplicationContext(),
            intent.getIntExtra(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
        );
    }

    private static final class Row {
        static final int HEADER = 0;
        static final int ITEM = 1;

        final int type;
        final String primary;
        final String secondary;
        final String id;
        final boolean done;

        Row(int type, String primary, String secondary, String id, boolean done) {
            this.type = type;
            this.primary = primary;
            this.secondary = secondary;
            this.id = id;
            this.done = done;
        }
    }

    private static final class Factory implements RemoteViewsFactory {

        private final Context context;
        private final int widgetId;
        private final List<Row> rows = new ArrayList<>();

        Factory(Context context, int widgetId) {
            this.context = context;
            this.widgetId = widgetId;
        }

        @Override
        public void onCreate() {}

        @Override
        public void onDataSetChanged() {
            rows.clear();
            if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;

            JSONObject data = WidgetStore.readJson(context, WidgetStore.KEY_SHARED);
            JSONObject list = SharedWidgetProvider.findList(
                data,
                WidgetStore.sharedListId(context, widgetId)
            );
            if (list == null) return;
            String category = WidgetStore.sharedCategoryId(context, widgetId);

            JSONArray groups = list.optJSONArray("groups");
            if (groups == null) return;

            for (int g = 0; g < groups.length(); g++) {
                JSONObject group = groups.optJSONObject(g);
                if (group == null) continue;
                JSONArray items = group.optJSONArray("items");
                if (items == null || items.length() == 0) continue;

                /*
                  הכותרת נוספת רק אחרי שנמצא פריט ששרד את הסינון, אחרת
                  קטגוריה שאין בה כלום הייתה נראית כרשימה של כותרות ימים
                  ריקות.
                */
                boolean headerAdded = false;
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.optJSONObject(i);
                    if (item == null) continue;
                    if (!matches(item, category)) continue;

                    if (!headerAdded) {
                        rows.add(new Row(
                            Row.HEADER,
                            group.optString("label"),
                            group.optString("hebrew"),
                            null,
                            false
                        ));
                        headerAdded = true;
                    }
                    String who = item.optString("who");
                    String time = item.optString("time");
                    rows.add(new Row(
                        Row.ITEM,
                        item.optString("title"),
                        who.isEmpty() ? time : who,
                        item.optString("id"),
                        item.optBoolean("done", false)
                    ));
                }
            }
        }

        /** מחרוזת ריקה בהגדרה פירושה "הכול"; אחרת השוואה מדויקת. */
        private boolean matches(JSONObject item, String category) {
            if (category == null || category.isEmpty()) return true;
            return category.equals(item.optString("cat"));
        }

        @Override
        public void onDestroy() {
            rows.clear();
        }

        @Override
        public int getCount() {
            return rows.size();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            if (position < 0 || position >= rows.size()) return null;
            Row row = rows.get(position);

            if (row.type == Row.HEADER) {
                RemoteViews views = new RemoteViews(
                    context.getPackageName(),
                    R.layout.widget_reminder_header
                );
                views.setTextViewText(R.id.header_label, row.primary);
                views.setTextViewText(R.id.header_hebrew, row.secondary);
                views.setViewVisibility(
                    R.id.header_hebrew,
                    row.secondary == null || row.secondary.isEmpty() ? View.GONE : View.VISIBLE
                );
                return views;
            }

            RemoteViews views = new RemoteViews(
                context.getPackageName(),
                R.layout.widget_reminder_item
            );
            views.setTextViewText(R.id.item_title, row.primary);
            views.setTextViewText(R.id.item_time, row.secondary);
            views.setViewVisibility(
                R.id.item_time,
                row.secondary == null || row.secondary.isEmpty() ? View.GONE : View.VISIBLE
            );
            views.setInt(
                R.id.item_check,
                "setBackgroundResource",
                row.done ? R.drawable.widget_check_on : R.drawable.widget_check_off
            );
            views.setViewVisibility(
                R.id.item_check_mark,
                row.done ? View.VISIBLE : View.GONE
            );
            // אין קו חוצה: setPaintFlags אינה מסומנת ל-RemoteViews
            views.setTextColor(
                R.id.item_title,
                context.getColor(row.done ? R.color.widget_faint : R.color.widget_ink)
            );

            Intent fill = new Intent();
            fill.putExtra(WidgetActionReceiver.EXTRA_REF, row.id);
            views.setOnClickFillInIntent(R.id.item_root, fill);
            return views;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 2;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
