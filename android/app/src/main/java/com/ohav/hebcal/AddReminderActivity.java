package com.ohav.hebcal;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.EditText;

/**
 * הוספת תזכורת מתוך מסך הבית.
 *
 * אנדרואיד אינו מאפשר שדה טקסט בתוך וידג׳ט - RemoteViews פשוט לא תומך
 * ב-EditText. לכן זו חלונית קטנה שנפתחת מעל מסך הבית ונסגרת מיד: היא לא
 * פותחת את האפליקציה, ולא מחליפה מסך.
 *
 * מה שנכתב כאן נרשם בתור ומופיע בוידג׳ט מיד, עוד לפני שהאפליקציה בכלל
 * עלתה.
 */
public class AddReminderActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_reminder);
        setFinishOnTouchOutside(true);

        EditText input = findViewById(R.id.add_input);
        input.requestFocus();
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE);

        findViewById(R.id.add_cancel).setOnClickListener(v -> finish());
        findViewById(R.id.add_save).setOnClickListener(v -> save(input));
        input.setOnEditorActionListener((v, actionId, event) -> {
            save(input);
            return true;
        });
    }

    private void save(EditText input) {
        String title = input.getText().toString().trim();
        if (title.isEmpty()) {
            finish();
            return;
        }
        Intent intent = new Intent(this, WidgetActionReceiver.class);
        intent.setAction(WidgetActionReceiver.ACTION_ADD);
        intent.putExtra(WidgetActionReceiver.EXTRA_TITLE, title);
        intent.putExtra(WidgetActionReceiver.EXTRA_DATE, WidgetActionReceiver.today());
        sendBroadcast(intent);
        finish();
    }
}
