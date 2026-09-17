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
 * למה וידג׳ט התזכורות מכוון.
 *
 * הרשימות המשותפות הן תזכורות לכל דבר, ולכן מי שכל התזכורות שלו שם ראה
 * וידג׳ט ריק בלי להבין למה. המסך הזה נותן לבחור מקור אחד: התזכורות
 * האישיות, רשימה משותפת שלמה, או קטגוריה בתוכה.
 *
 * **הרשימה כאן אינה מחושבת.** היא בדיוק `sources` שהאפליקציה פרסמה -
 * כל מקור עם כיתוב מוכן ועם הקבוצות שלו כבר מקובצות. הצד הנייטיבי אינו
 * יודע מהי קטגוריה ואינו מסנן דבר, וזה מה שמאפשר לשנות את החיתוך או את
 * הניסוח בעדכון חי בלי התקנה.
 *
 * המסך נפתח משני כיוונים: כשמניחים וידג׳ט חדש, ובלחיצה ארוכה על וידג׳ט
 * מונח (`reconfigurable` ב-widget_reminders_info). לכן הוא חייב להיות
 * בטוח גם כשכבר יש בחירה - הוא פשוט מסמן אותה.
 */
public class RemindersWidgetConfigActivity extends Activity {

    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        /*
          ביטול משאיר את הוידג׳ט כפי שהיה. בהנחה ראשונה זה אומר שהוא לא
          יונח, ובהגדרה מחדש - שההגדרה הקודמת נשמרת.
        */
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
        showSources();
    }

    private void showSources() {
        setTitleText(getString(R.string.widget_config_pick_source));

        ViewGroup rows = findViewById(R.id.config_rows);
        rows.removeAllViews();

        JSONObject data = WidgetStore.readJson(this, WidgetStore.KEY_REMINDERS);
        JSONArray sources = data == null ? null : data.optJSONArray("sources");

        /*
          חבילת web ישנה עוד לא מפרסמת `sources`. אין מה לבחור, אבל יש
          בדיוק מקור אחד שתמיד עובד - ולכן שומרים אותו ויוצאים במקום
          להשאיר את המשתמש מול מסך ריק.
        */
        if (sources == null || sources.length() == 0) {
            save(WidgetStore.SOURCE_ME);
            return;
        }

        findViewById(R.id.config_notice).setVisibility(View.GONE);
        String current = WidgetStore.remindersSource(this, widgetId);

        for (int i = 0; i < sources.length(); i++) {
            JSONObject source = sources.optJSONObject(i);
            if (source == null) continue;
            final String id = source.optString("id");
            String label = source.optString("label");
            int open = source.optInt("open", 0);
            rows.addView(row(
                open > 0 ? label + "  ·  " + open : label,
                id.equals(current),
                v -> save(id)
            ));
        }
    }

    private void save(String sourceId) {
        WidgetStore.putRemindersSource(this, widgetId, sourceId);

        AppWidgetManager manager = AppWidgetManager.getInstance(this);
        RemindersWidgetProvider.renderAll(this, manager, new int[] { widgetId });
        manager.notifyAppWidgetViewDataChanged(widgetId, R.id.reminders_list);

        Intent result = new Intent();
        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        setResult(RESULT_OK, result);
        finish();
    }

    /* ------------------------------ תצוגה ------------------------------ */

    private void setTitleText(String text) {
        ((TextView) findViewById(R.id.config_title)).setText(text);
    }

    /** שורה נלחצת אחת. הנבחרת מסומנת, כי המסך נפתח גם על בחירה קיימת. */
    private View row(String label, boolean selected, View.OnClickListener onClick) {
        View view = getLayoutInflater().inflate(
            R.layout.config_row,
            findViewById(R.id.config_rows),
            false
        );
        TextView text = view.findViewById(R.id.config_row_label);
        text.setText(selected ? "✓  " + label : label);
        view.setOnClickListener(onClick);
        LinearLayout.LayoutParams params =
            (LinearLayout.LayoutParams) view.getLayoutParams();
        params.bottomMargin = Math.round(getResources().getDisplayMetrics().density * 8);
        view.setLayoutParams(params);
        return view;
    }
}
