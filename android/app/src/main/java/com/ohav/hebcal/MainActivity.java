package com.ohav.hebcal;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // רישום הפלאגינים המקומיים חייב לקרות לפני ש-BridgeActivity מרימה את הגשר
        registerPlugin(HebWidgetsPlugin.class);
        registerPlugin(HebUpdaterPlugin.class);
        registerPlugin(HebFilesPlugin.class);
        registerPlugin(HebGeofencePlugin.class);
        /*
          התרגום קודם ל-super: הגשר קורא את הכוונה כבר בבנייה, ומשם היא
          נמסרת לדף כ-appUrlOpen. בשחזור אחרי שהמערכת הרגה את התהליך
          הכוונה היא עדיין המקורית, ותרגום שני היה פותח את העורך שוב.
        */
        if (savedInstanceState == null) setIntent(ExternalIntents.translate(this, getIntent()));
        else if (ExternalIntents.isExternal(getIntent())) setIntent(new Intent(Intent.ACTION_MAIN));
        super.onCreate(savedInstanceState);

        goEdgeToEdge();
        publishInsets();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(ExternalIntents.translate(this, intent));
    }

    /**
     * ציור מקצה לקצה.
     *
     * מאנדרואיד 15 זה כפוי על כל אפליקציה שמכוונת ל-SDK 35 ומעלה: המערכת
     * מפסיקה לכווץ את החלון, והתוכן נמתח מתחת לשורת הסטטוס ולסרגל הניווט.
     * מבקשים את זה במפורש גם בגרסאות הקודמות, כדי שההתנהגות תהיה אחת בכל
     * מקום - ולא שתי פריסות שונות שצריך לבדוק בנפרד.
     */
    private void goEdgeToEdge() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
        }
    }

    /**
     * מוסר ל-CSS את המידות האמיתיות של סרגלי המערכת.
     *
     * `env(safe-area-inset-*)` הוא אפס ב-WebView: הוא מתאר חריץ במסך, לא
     * סרגלי מערכת. בלי המידות האלה הכותרת נחתכת מתחת לשעון וסרגל
     * הלשוניות יושב מתחת לפס הניווט.
     *
     * המאזין נשאר רשום: הסרגלים משתנים בסיבוב המסך, בפתיחת המקלדת
     * ובמעבר בין ניווט מחוות לכפתורים.
     */
    private void publishInsets() {
        View root = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            float density = getResources().getDisplayMetrics().density;
            String script = String.format(
                java.util.Locale.US,
                "document.documentElement.style.setProperty('--inset-top','%dpx');"
                    + "document.documentElement.style.setProperty('--inset-bottom','%dpx');"
                    + "document.documentElement.style.setProperty('--inset-start','%dpx');"
                    + "document.documentElement.style.setProperty('--inset-end','%dpx');",
                Math.round(bars.top / density),
                Math.round(bars.bottom / density),
                Math.round(bars.right / density),
                Math.round(bars.left / density)
            );
            getBridge().getWebView().evaluateJavascript(script, null);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(root);
    }
}
