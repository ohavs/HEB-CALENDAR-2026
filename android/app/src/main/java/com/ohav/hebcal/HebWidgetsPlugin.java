package com.ohav.hebcal;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.ref.WeakReference;

/**
 * הגשר בין האפליקציה לוידג׳טים.
 *
 * פלאגין מקומי ולא חבילה: כל מה שהוא עושה הוא לכתוב לקובץ המשותף, לקרוא
 * ממנו ולבקש מהמערכת לצייר מחדש - ולזה לא צריך תלות חיצונית.
 */
@CapacitorPlugin(name = "HebWidgets")
public class HebWidgetsPlugin extends Plugin {

    /**
     * המופע החי, כשהאפליקציה רצה. המקלט של הוידג׳ט רץ באותו תהליך, וכך
     * הוא מודיע לדף מיד על סימון - ולא רק בחזרה לחזית. חלש, כדי לא
     * להחזיק Activity שנסגרה.
     */
    private static WeakReference<HebWidgetsPlugin> live = new WeakReference<>(null);

    @Override
    public void load() {
        live = new WeakReference<>(this);
    }

    /** הוידג׳ט הוסיף פעולה לתור. שקט כשהאפליקציה אינה רצה. */
    static void inboxChanged() {
        HebWidgetsPlugin plugin = live.get();
        if (plugin != null) plugin.notifyListeners("inbox", new JSObject());
    }

    /** מקבל את תמונות המצב ומרענן את מה שמוצג במסך הבית. */
    @PluginMethod
    public void publish(PluginCall call) {
        String calendar = call.getString("calendar");
        String reminders = call.getString("reminders");
        String shabbat = call.getString("shabbat");
        String shared = call.getString("shared");
        if (calendar == null || reminders == null || shabbat == null || shared == null) {
            call.reject("missing-payload");
            return;
        }
        WidgetStore.write(getContext(), WidgetStore.KEY_CALENDAR, calendar);
        WidgetStore.write(getContext(), WidgetStore.KEY_REMINDERS, reminders);
        WidgetStore.write(getContext(), WidgetStore.KEY_SHABBAT, shabbat);
        WidgetStore.write(getContext(), WidgetStore.KEY_SHARED, shared);
        // פרסום שנבנה לפני שהתור יושם אינו דורס את מה שנלחץ בוידג׳ט
        WidgetActionReceiver.overlayPending(getContext());
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
