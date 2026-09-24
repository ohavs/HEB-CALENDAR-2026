/**
 * גיבוי: ייצוא וייבוא של קובץ ICS.
 *
 * הייצוא הוא גם גיבוי שלא תלוי בחשבון, וגם דרך להוציא את הלוח למקום
 * אחר. הייבוא הוא הדרך להכניס לוח קיים מגוגל בלי להקליד מחדש.
 *
 * הייבוא לא דורס - הכלל נגד כפילויות ב-`store/importEvents.ts`.
 *
 * באנדרואיד יש מקור שלישי: היומן של המכשיר, כלומר מה שנכתב בסמסונג או
 * בגוגל. זו העתקה ולא סנכרון - ראו `src/lib/deviceImport.ts`.
 */
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Download, Upload } from 'lucide-react';
import { fromICS, icsFileName, toICS } from '@/lib/ics';
import {
  isNative,
  readDeviceCalendar,
  shareTextFile,
  systemCalendarPermission,
} from '@/lib/native';
import { deviceToDrafts } from '@/lib/deviceImport';
import { addDays, startOfDay } from '@/lib/dates';
import { announce } from '@/lib/announce';
import { useSettingsStore } from '@/store/settings';
import { toast } from './Toast';
import { useEventsStore } from '@/store/events';
import { importEvents } from '@/store/importEvents';
import { SettingRow } from './ui/controls';
import { ICON } from '@/lib/motion';

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function BackupRows() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  /** האם המעטפת מכירה את היומן של המכשיר. בדפדפן ובמעטפת ישנה - לא */
  const [deviceReady, setDeviceReady] = useState(false);
  useEffect(() => {
    if (!isNative()) return;
    void systemCalendarPermission().then((granted) => setDeviceReady(granted !== null));
  }, []);

  const importDevice = async () => {
    const granted = await systemCalendarPermission(true);
    if (!granted) {
      setStatus('צריך הרשאת יומן כדי לקרוא את האירועים');
      return;
    }
    setStatus('קורא את היומן…');
    const today = startOfDay(new Date());
    // חודש אחורה, כמו הלוח שאנחנו מפרסמים; קדימה - כל מה שיש
    const from = addDays(today, -30).getTime();
    const read = await readDeviceCalendar(from, addDays(today, 400).getTime());
    if (!read) {
      setStatus('לא הצלחנו לקרוא את היומן של המכשיר');
      return;
    }
    const color = useSettingsStore.getState().settings.defaultEventColor;
    const drafts = deviceToDrafts(read.rows, read.instances, { color, now: new Date(), from });
    if (!drafts.length) {
      setStatus('לא נמצאו אירועים ביומן של המכשיר');
      return;
    }
    const { ids, duplicates } = importEvents(drafts);
    const parts = [
      ids.length === 1 ? 'הועתק אירוע אחד' : `הועתקו ${ids.length} אירועים`,
    ];
    if (duplicates) parts.push(`${duplicates} כבר היו קיימים`);
    const message = parts.join(' · ');
    setStatus(message);
    announce(message);
    // העתקה של מאות אירועים בטעות צריכה דרך חזרה אחת, לא מאות מחיקות
    if (ids.length) {
      toast(message, {
        label: 'ביטול',
        run: () => {
          const remove = useEventsStore.getState().remove;
          for (const id of ids) remove(id);
          setStatus('ההעתקה בוטלה');
        },
      });
    }
  };

  const exportAll = async () => {
    const events = Object.values(useEventsStore.getState().byId).filter((e) => !e.deleted);
    if (!events.length) {
      setStatus('אין אירועים לייצוא');
      return;
    }
    const name = icsFileName();
    const text = toICS(events);
    const count = events.length === 1 ? 'אירוע אחד' : `${events.length} אירועים`;

    /*
      באנדרואיד הורדה של Blob לא עושה כלום: אין מי שיקלוט אותה ב-WebView.
      הקובץ נכתב בצד הנייטיבי ונמסר לגיליון השיתוף של המערכת.
    */
    if (isNative()) {
      const failure = await shareTextFile(name, text, 'text/calendar', 'ייצוא הלוח');
      setStatus(failure ? `הייצוא נכשל. ${failure}` : `${count} מוכנים לשיתוף`);
      return;
    }

    download(name, text);
    setStatus(events.length === 1 ? 'יוצא אירוע אחד' : `יוצאו ${events.length} אירועים`);
  };

  const importFile = async (file: File) => {
    setStatus('קורא את הקובץ…');
    try {
      const { events, skipped } = fromICS(await file.text());
      if (!events.length) {
        setStatus(skipped ? 'לא נמצאו אירועים תקינים בקובץ' : 'הקובץ ריק');
        return;
      }

      const { ids, duplicates } = importEvents(events);
      const added = ids.length;

      const parts = [added === 1 ? 'נוסף אירוע אחד' : `נוספו ${added} אירועים`];
      if (duplicates) parts.push(`${duplicates} כבר היו קיימים`);
      if (skipped) parts.push(`${skipped} דולגו`);
      setStatus(parts.join(' · '));
    } catch {
      setStatus('לא הצלחנו לקרוא את הקובץ');
    }
  };

  return (
    <>
      <SettingRow
        title="ייצוא לקובץ"
        hint="גיבוי של כל האירועים בפורמט ICS, שנפתח בכל לוח שנה"
        icon={<Download size={ICON.md} strokeWidth={2.1} />}
        onClick={exportAll}
      />

      <SettingRow
        title="ייבוא מקובץ"
        hint="הוספת אירועים מלוח קיים. אירוע שכבר קיים לא ייווצר פעמיים"
        icon={<Upload size={ICON.md} strokeWidth={2.1} />}
        onClick={() => fileInput.current?.click()}
      />

      {deviceReady && (
        <SettingRow
          title="העתקה מהיומן של המכשיר"
          hint="האירועים שכתבת בסמסונג או בגוגל. חגים וימי הולדת לא מועתקים, ואירוע שכבר הועתק לא יועתק שוב"
          icon={<CalendarDays size={ICON.md} strokeWidth={2.1} />}
          onClick={() => void importDevice()}
        />
      )}

      <input
        ref={fileInput}
        id="ics-import"
        type="file"
        accept=".ics,text/calendar"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
          e.target.value = '';
        }}
      />

      {status && (
        <p className="px-5 pb-4 text-caption text-muted" role="status">
          {status}
        </p>
      )}
    </>
  );
}
