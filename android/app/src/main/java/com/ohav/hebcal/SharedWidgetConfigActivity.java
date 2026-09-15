package com.ohav.hebcal;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * הבחירה שנעשית פעם אחת, כשמניחים את וידג׳ט הרשימות המשותפות: איזו
 * רשימה הוא מציג, ואיזו קטגוריה בתוכה.
 *
 * זו Activity רגילה ולא RemoteViews, ולכן כאן מותר הכול - אין את
 * המגבלות של וידג׳ט. היא פותחת פעמיים: פעם אחת כשמניחים את הוידג׳ט,
 * ושוב בלחיצה על "הגדרות" שלו במשגרים שתומכים בכך.
 *
 * הנתונים מגיעים מאותה תמונת מצב שהוידג׳ט מצייר - כלומר מה שהאפליקציה
 * פרסמה בפעם האחרונה. אם היא מעולם לא רצה, אין מה לבחור, וזה בדיוק מה
 * שהמסך אומר.
 */
public class SharedWidgetConfigActivity extends Activity {

    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private JSONObject chosenList;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        // ביטול (כפתור החזרה) חייב להשאיר את הוידג׳ט לא-מונח
        setResult(RESULT_CANCELED);

        Bundle extras = getIntent().getExtras();
        if (extras != null) {
            widgetId = extras.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            );
        }
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        setContentView(R.layout.activity_widget_config);
        showLists();
    }

    /* ------------------------------ רשימות ------------------------------ */

    private void showLists() {
        JSONObject data = WidgetStore.readJson(this, WidgetStore.KEY_SHARED);
        JSONArray lists = data == null ? null : data.optJSONArray("lists");

        setTitleText(getString(R.string.widget_config_pick_list));

        ViewGroup rows = findViewById(R.id.config_rows);
        rows.removeAllViews();

        if (lists == null || lists.length() == 0) {
            showNotice(
                data != null && data.optBoolean("signedIn", false)
                    ? R.string.widget_config_no_lists
                    : R.string.widget_config_signin
            );
            return;
        }

        findViewById(R.id.config_notice).setVisibility(View.GONE);
        for (int i = 0; i < lists.length(); i++) {
            JSONObject list = lists.optJSONObject(i);
            if (list == null) continue;
            final JSONObject chosen = list;
            rows.addView(row(list.optString("name"), v -> pickList(chosen)));
        }
    }

    /**
     * רשימה בלי קטגוריות נשמרת מיד.
     * מסך שני עם אפשרות אחת ("הכול") הוא שאלה שאין לה תשובה שנייה.
     */
    private void pickList(JSONObject list) {
        chosenList = list;
        JSONArray categories = list.optJSONArray("categories");
        if (categories == null || categories.length() == 0) {
            save("");
            return;
        }
        showCategories(categories);
    }

    /* ----------------------------- קטגוריות ----------------------------- */

    private void showCategories(JSONArray categories) {
        setTitleText(getString(R.string.widget_config_pick_category));

        ViewGroup rows = findViewById(R.id.config_rows);
        rows.removeAllViews();
        rows.addView(row(getString(R.string.widget_config_all), v -> save("")));

        for (int i = 0; i < categories.length(); i++) {
            JSONObject category = categories.optJSONObject(i);
            if (category == null) continue;
            final String id = category.optString("id");
            rows.addView(row(category.optString("name"), v -> save(id)));
        }
    }

    /* ------------------------------ שמירה ------------------------------ */

    private void save(String categoryId) {
        WidgetStore.putSharedConfig(this, widgetId, chosenList.optString("id"), categoryId);

        AppWidgetManager manager = AppWidgetManager.getInstance(this);
        SharedWidgetProvider.renderAll(this, manager, new int[] { widgetId });
        manager.notifyAppWidgetViewDataChanged(widgetId, R.id.shared_list);

        Intent result = new Intent();
        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        setResult(RESULT_OK, result);
        finish();
    }

    /* ------------------------------ תצוגה ------------------------------ */

    private void setTitleText(String text) {
        ((TextView) findViewById(R.id.config_title)).setText(text);
    }

    private void showNotice(int stringId) {
        TextView notice = findViewById(R.id.config_notice);
        notice.setText(stringId);
        notice.setVisibility(View.VISIBLE);
    }

    /** שורה נלחצת אחת. מנופחת מקובץ, כדי שהעיצוב יישאר במקום אחד. */
    private View row(String label, View.OnClickListener onClick) {
        View view = getLayoutInflater().inflate(
            R.layout.config_row,
            findViewById(R.id.config_rows),
            false
        );
        ((TextView) view.findViewById(R.id.config_row_label)).setText(label);
        view.setOnClickListener(onClick);
        LinearLayout.LayoutParams params =
            (LinearLayout.LayoutParams) view.getLayoutParams();
        params.bottomMargin = Math.round(getResources().getDisplayMetrics().density * 8);
        view.setLayoutParams(params);
        return view;
    }
}
