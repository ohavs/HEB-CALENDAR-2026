package com.ohav.hebcal;

import android.content.Context;
import android.os.Build;
import android.widget.RemoteViews;

/**
 * צבעים שנקבעים בקוד ולא בפריסה - ולכן צריכים להחליף יום ולילה בעצמם.
 *
 * צבע שנכתב בפריסה נפתר אצל המשגר, בתצורה שלו, וכשהמכשיר עובר ללילה
 * הוא מתחלף לבד. צבע שנפתר כאן (`context.getColor`) הוא מספר קבוע, והוא
 * היה נשאר בגוון של היום עד הציור הבא - דיו כהה על רקע לילה. מאנדרואיד
 * 12 עוברים את המזהה עצמו (`setColorStateList`), והמשגר פותר אותו. לפני
 * כן אין דרך כזו, והציור הבא מתקן.
 */
final class WidgetColors {

    private WidgetColors() {}

    static void text(Context context, RemoteViews views, int viewId, int colorRes) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            views.setColorStateList(viewId, "setTextColor", colorRes);
        } else {
            views.setTextColor(viewId, context.getColor(colorRes));
        }
    }

    /**
     * הרקע של שורת תזכורת: הפסטל של צבע האירוע, כמו ReminderRow במסך,
     * ומתאר בלבד למה שבוצע.
     *
     * השם מגיע מ-widgetData.ts כמו שהוא. שם שאינו מוכר כאן - צבע שנוסף
     * בעדכון חי, לפני שהמעטפת הזו הותקנה - נקרא כגרפיט, ברירת המחדל של
     * האפליקציה, ולא נופל.
     */
    static int rowBackground(String color, boolean done) {
        if (done) return R.drawable.widget_row_done;
        switch (color == null ? "" : color) {
            case "butter": return R.drawable.widget_row_butter;
            case "peach": return R.drawable.widget_row_peach;
            case "rose": return R.drawable.widget_row_rose;
            case "violet": return R.drawable.widget_row_violet;
            case "sky": return R.drawable.widget_row_sky;
            case "mint": return R.drawable.widget_row_mint;
            case "sage": return R.drawable.widget_row_sage;
            case "slate": return R.drawable.widget_row_slate;
            default: return R.drawable.widget_row_graphite;
        }
    }

    /** הדיו של אותו צבע - הטקסט שיושב על הפסטל. */
    static int rowInk(String color, boolean done) {
        if (done) return R.color.widget_faint;
        switch (color == null ? "" : color) {
            case "butter": return R.color.widget_ev_butter_ink;
            case "peach": return R.color.widget_ev_peach_ink;
            case "rose": return R.color.widget_ev_rose_ink;
            case "violet": return R.color.widget_ev_violet_ink;
            case "sky": return R.color.widget_ev_sky_ink;
            case "mint": return R.color.widget_ev_mint_ink;
            case "sage": return R.color.widget_ev_sage_ink;
            case "slate": return R.color.widget_ev_slate_ink;
            default: return R.color.widget_ev_graphite_ink;
        }
    }
}
