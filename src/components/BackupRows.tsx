/**
 * גיבוי: ייצוא וייבוא של קובץ ICS.
 *
 * הייצוא הוא גם גיבוי שלא תלוי בחשבון, וגם דרך להוציא את הלוח למקום
 * אחר. הייבוא הוא הדרך להכניס לוח קיים מגוגל בלי להקליד מחדש.
 *
 * הייבוא לא דורס: כל אירוע נוסף כחדש. אירוע שכבר קיים עם אותה כותרת
 * ואותו תאריך מדולג, כדי שייבוא חוזר של אותו קובץ לא ייצור כפילויות -
 * וזו טעות קלה מאוד לעשות.
 */
import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { fromICS, icsFileName, toICS } from '@/lib/ics';
import { isNative, shareTextFile } from '@/lib/native';
import { useEventsStore, type EventDraft } from '@/store/events';
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

      const store = useEventsStore.getState();
      // חתימה של כותרת ותאריך, כדי שייבוא חוזר לא ייצור כפילויות
      const existing = new Set(
        Object.values(store.byId)
          .filter((e) => !e.deleted)
          .map((e) => `${e.title}|${e.date}`),
      );

      let added = 0;
      let duplicates = 0;
      for (const draft of events) {
        const signature = `${draft.title}|${draft.date}`;
        if (existing.has(signature)) {
          duplicates += 1;
          continue;
        }
        existing.add(signature);
        const created = store.add(draft as EventDraft);
        // add אינה יודעת על חריגים; מצרפים אותם אחרי היצירה
        if (draft.exceptions) {
          for (const [key, exception] of Object.entries(draft.exceptions)) {
            store.updateOccurrence(created.id, key, exception);
          }
        }
        added += 1;
      }

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
