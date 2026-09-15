package com.ohav.hebcal;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * הרשימה הנגללת של וידג׳ט התזכורות.
 *
 * הקבוצות נפרשות לרשימה שטוחה של שורות משני סוגים - כותרת יום ופריט -
 * כי ListView בוידג׳ט אינו יודע לקנן. סוג השורה נקבע ב-getViewTypeCount,
 * ובלעדיו אנדרואיד ממחזר שורת כותרת לפריט ולהפך.
 */
public class RemindersWidgetService extends RemoteViewsService {

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
        /**
         * הרוחב בפועל, כדי שהשורה תדע ממה לוותר.
         *
         * נקרא כאן ולא בכל שורה: onDataSetChanged רצה פעם אחת לכל רענון,
         * והספק מודיע לה גם אחרי שינוי גודל.
         */
        private int width = 250;

        Factory(Context context, int widgetId) {
            this.context = context;
            this.widgetId = widgetId;
        }

        @Override
        public void onCreate() {}

        @Override
        public void onDataSetChanged() {
            rows.clear();
            if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                width = AppWidgetManager.getInstance(context)
                    .getAppWidgetOptions(widgetId)
                    .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            }
            JSONObject data = WidgetStore.readJson(context, WidgetStore.KEY_REMINDERS);
            if (data == null) return;
            JSONArray groups = data.optJSONArray("groups");
            if (groups == null) return;

            for (int g = 0; g < groups.length(); g++) {
                JSONObject group = groups.optJSONObject(g);
                if (group == null) continue;
                JSONArray items = group.optJSONArray("items");
                if (items == null || items.length() == 0) continue;

                rows.add(new Row(
                    Row.HEADER,
                    group.optString("label"),
                    group.optString("hebrew"),
                    null,
                    false
                ));
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.optJSONObject(i);
                    if (item == null) continue;
                    rows.add(new Row(
                        Row.ITEM,
                        item.optString("title"),
                        item.optString("time"),
                        item.optString("id"),
                        item.optBoolean("done", false)
                    ));
                }
            }
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
                boolean roomForHebrew =
                    width >= RemindersWidgetProvider.MIN_WIDTH_FOR_COUNT
                        && row.secondary != null
                        && !row.secondary.isEmpty();
                views.setViewVisibility(
                    R.id.header_hebrew,
                    roomForHebrew ? android.view.View.VISIBLE : android.view.View.GONE
                );
                return views;
            }

            RemoteViews views = new RemoteViews(
                context.getPackageName(),
                R.layout.widget_reminder_item
            );
            views.setTextViewText(R.id.item_title, row.primary);
            views.setTextViewText(R.id.item_time, row.secondary);
            boolean roomForTime =
                width >= RemindersWidgetProvider.MIN_WIDTH_FOR_TITLE
                    && row.secondary != null
                    && !row.secondary.isEmpty();
            views.setViewVisibility(
                R.id.item_time,
                roomForTime ? android.view.View.VISIBLE : android.view.View.GONE
            );
            views.setInt(
                R.id.item_check,
                "setBackgroundResource",
                row.done ? R.drawable.widget_check_on : R.drawable.widget_check_off
            );
            views.setViewVisibility(
                R.id.item_check_mark,
                row.done ? android.view.View.VISIBLE : android.view.View.GONE
            );
            /*
              אין כאן קו חוצה: RemoteViews מרשה לקרוא רק למתודות מסומנות,
              ו-setPaintFlags אינו אחת מהן - קריאה לה הייתה זורקת בזמן
              ריצה. הסימון נישא על ידי התיבה והצבע.
            */
            views.setTextColor(
                R.id.item_title,
                context.getColor(row.done ? R.color.widget_faint : R.color.widget_ink)
            );

            // כוונת המילוי היא מה שהופך תבנית אחת לפעולה על שורה מסוימת
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
