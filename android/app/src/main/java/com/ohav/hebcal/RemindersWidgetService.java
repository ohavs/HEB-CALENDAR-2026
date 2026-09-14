package com.ohav.hebcal;

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
        return new Factory(getApplicationContext());
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
        private final List<Row> rows = new ArrayList<>();

        Factory(Context context) {
            this.context = context;
        }

        @Override
        public void onCreate() {}

        @Override
        public void onDataSetChanged() {
            rows.clear();
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
                views.setViewVisibility(
                    R.id.header_hebrew,
                    row.secondary == null || row.secondary.isEmpty()
                        ? android.view.View.GONE
                        : android.view.View.VISIBLE
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
                row.secondary == null || row.secondary.isEmpty()
                    ? android.view.View.GONE
                    : android.view.View.VISIBLE
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
