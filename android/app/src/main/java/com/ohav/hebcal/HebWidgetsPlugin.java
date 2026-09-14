package com.ohav.hebcal;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * הגשר בין האפליקציה לוידג׳טים.
 *
 * פלאגין מקומי ולא חבילה: כל מה שהוא עושה הוא לכתוב לקובץ המשותף, לקרוא
 * ממנו ולבקש מהמערכת לצייר מחדש - ולזה לא צריך תלות חיצונית.
 */
@CapacitorPlugin(name = "HebWidgets")
public class HebWidgetsPlugin extends Plugin {

    /** מקבל את שתי תמונות המצב ומרענן את מה שמוצג במסך הבית. */
    @PluginMethod
    public void publish(PluginCall call) {
        String calendar = call.getString("calendar");
        String reminders = call.getString("reminders");
        String shabbat = call.getString("shabbat");
        if (calendar == null || reminders == null || shabbat == null) {
            call.reject("missing-payload");
            return;
        }
        WidgetStore.write(getContext(), WidgetStore.KEY_CALENDAR, calendar);
        WidgetStore.write(getContext(), WidgetStore.KEY_REMINDERS, reminders);
        WidgetStore.write(getContext(), WidgetStore.KEY_SHABBAT, shabbat);
        WidgetStore.refreshAll(getContext());
        call.resolve();
    }

    /**
     * מחזיר את תור הפעולות שהוידג׳ט צבר, ומרוקן אותו.
     * הריקון הוא חלק מהקריאה: שתי קריאות נפרדות היו יוצרות חלון שבו
     * פעולה חדשה נמחקת בלי שיושמה.
     */
    @PluginMethod
    public void takeInbox(PluginCall call) {
        JSObject out = new JSObject();
        out.put("actions", WidgetStore.takeInbox(getContext()));
        call.resolve(out);
    }
}
