/**
 * שיבוץ תבנית על יום אחד או על כמה.
 *
 * למה לא בורר של תאריך יחיד: זו הנקודה שבה התבנית מצדיקה את עצמה.
 * "חופש מהעבודה" נלקח לשלושה ימים רצופים, לא לאחד, ובורר של תאריך יחיד
 * היה מחייב לפתוח אותו שלוש פעמים. כאן כל הקשה מוסיפה או מסירה יום,
 * והשיבוץ קורה פעם אחת על כל מה שנבחר.
 *
 * הבורר הוא אותה רצועת ימים של טופס האירוע (`DayStrip`), בבחירה מרובה:
 * הימים הקרובים מתחת לאצבע עם התאריך העברי שלהם, והחודש המלא נפרש
 * במקום בשביל מה שרחוק. קודם הייתה כאן רשת משלה, בלי תאריך עברי ובשפה
 * אחרת מהטופס - ומי שבחר יום בטופס היה צריך ללמוד בורר שני.
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from '@/components/ui/icons';
import type { DateKey, EventTemplate } from '@/types';
import { dateKey } from '@/lib/dates';
import { shortDateLabel } from '@/lib/whenSummary';
import { Sheet } from './ui/Sheet';
import { DayStrip } from './ui/DayStrip';
import { PrimaryButton } from './ui/controls';
import { haptic } from '@/lib/native';
import { announce } from '@/lib/announce';
import { ENTER, EXIT, ICON, SNAP } from '@/lib/motion';

export function TemplatePlaceSheet({
  open,
  onClose,
  template,
  onPlace,
}: {
  open: boolean;
  onClose: () => void;
  template: EventTemplate | null;
  onPlace: (template: EventTemplate, dates: DateKey[]) => void;
}) {
  const todayKey = useMemo(() => dateKey(new Date()), []);
  const [picked, setPicked] = useState<Set<DateKey>>(new Set());
  const [forId, setForId] = useState<string | null>(null);

  // כל תבנית נפתחת נקייה: ימים שנבחרו לתבנית שנזנחה אינם שייכים לבאה
  if (template && template.id !== forId) {
    setForId(template.id);
    setPicked(new Set());
  }

  const sorted = useMemo(() => [...picked].sort(), [picked]);

  const toggle = (key: DateKey) => {
    void haptic('light');
    const adding = !picked.has(key);
    setPicked((prev) => {
      const next = new Set(prev);
      if (adding) next.add(key);
      else next.delete(key);
      return next;
    });
    // הרצועה נשארת כמו שהיא, ולכן הספירה היא מה שמשתנה על המסך
    announce(`${shortDateLabel(key)} ${adding ? 'נבחר' : 'הוסר'}`);
  };

  const submit = () => {
    if (!template || !picked.size) return;
    void haptic('medium');
    // ממוין, כדי שההודעה והביטול יתייחסו לימים לפי הסדר שבו הם על הלוח
    onPlace(template, sorted);
    setPicked(new Set());
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="tall"
      title="שיבוץ לימים"
      subtitle={template?.title}
    >
      <div className="pb-2">
        <DayStrip
          value={todayKey}
          picked={picked}
          onChange={toggle}
          label="ימים לשיבוץ"
        />

        {/*
          מה שנבחר, גם מה שכבר גלל מחוץ לרצועה או נמצא בחודש אחר. הקשה
          על יום כאן מסירה אותו, בלי לחפש אותו בחזרה.
        */}
        <div className="mt-4 min-h-[44px]">
          {sorted.length === 0 ? (
            <p className="px-1 py-2.5 text-caption text-muted">
              הקישו על הימים. אפשר כמה, גם בחודשים שונים.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence initial={false}>
                {sorted.map((key) => (
                  <motion.button
                    key={key}
                    type="button"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1, transition: ENTER }}
                    exit={{ opacity: 0, scale: 0.85, transition: EXIT }}
                    transition={SNAP}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => toggle(key)}
                    aria-label={`הסרת ${shortDateLabel(key)}`}
                    className="focus-ring tnum flex h-10 items-center gap-1.5 rounded-full bg-inverse pe-2.5 ps-3.5 text-label font-semibold text-on-inverse"
                  >
                    {shortDateLabel(key)}
                    <X size={ICON.sm} weight="bold" className="opacity-70" />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="mt-5">
          {/* הכפתור אומר את התוצאה, כמו בטופס האירוע */}
          <PrimaryButton onClick={submit} disabled={!picked.size}>
            {picked.size === 0
              ? 'בחרו ימים'
              : picked.size === 1
                ? `שיבוץ ליום ${shortDateLabel(sorted[0])}`
                : `שיבוץ ל-${picked.size} ימים`}
          </PrimaryButton>
        </div>
      </div>
    </Sheet>
  );
}
