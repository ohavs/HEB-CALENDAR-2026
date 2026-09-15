/**
 * רצועת התבניות בראש חלונית היום.
 *
 * שתי דרכים לשבץ, ובכוונה:
 *
 * - **הקשה** משבצת ליום הפתוח. זו הדרך המהירה, והיא זו שמשרתת "לשבץ
 *   את החופש לכמה ימים": פותחים יום, מקישים, עוברים ליום הבא, מקישים.
 *   חמישה ימים הם חמש הקשות ולא חמש גרירות.
 * - **לחיצה ארוכה וגרירה** מפילה על כל יום אחר בלוח. זה אותו מנוע
 *   הגרירה של האירועים, על כל מה שכבר יש בו - רפאים, הדגשת יעד, רטט,
 *   והחלפת חודש בקצה.
 *
 * הגרירה עוברת דרך מופע סינתטי שה-`baseId` שלו נושא את הקידומת
 * `TEMPLATE_DRAG_PREFIX`. `onDrop` ב-App מזהה אותה ויוצר אירוע חדש
 * במקום להזיז קיים - וכך מנוע הגרירה לא צריך לדעת שתבניות קיימות.
 */
import { motion } from 'framer-motion';
import { LayoutTemplate } from 'lucide-react';
import type { DateKey, EventTemplate } from '@/types';
import type { Occurrence } from '@/lib/recurrence';
import { beginLongPress, useDragStore } from '@/lib/dragEngine';
import { templateHint } from '@/lib/templates';
import { haptic } from '@/lib/native';
import { ICON, STROKE, TAP } from '@/lib/motion';

/** מה שמסמן ל-onDrop שזו תבנית ולא אירוע קיים. */
export const TEMPLATE_DRAG_PREFIX = 'tpl:';

/** מופע סינתטי, רק כדי שמנוע הגרירה יידע מה לצייר ולאן להפיל. */
function dragOccurrence(template: EventTemplate, date: DateKey): Occurrence {
  return {
    id: TEMPLATE_DRAG_PREFIX + template.id,
    baseId: TEMPLATE_DRAG_PREFIX + template.id,
    occurrenceId: TEMPLATE_DRAG_PREFIX + template.id,
    title: template.title,
    date,
    sourceKey: date,
    spanStart: date,
    startTime: template.allDay ? null : template.startTime,
    endTime: template.allDay ? null : template.endTime,
    allDay: template.allDay,
    color: template.color,
    location: template.location,
    placeId: template.placeId,
    notes: template.notes,
    reminderMinutes: template.reminderMinutes,
    repeat: 'none',
    isRecurring: false,
    hasException: false,
    spanIndex: 0,
    spanLength: 1,
    done: false,
    createdAt: template.createdAt,
    updatedAt: template.createdAt,
  };
}

export function TemplateStrip({
  templates,
  date,
  onPlace,
}: {
  templates: EventTemplate[];
  /** היום הפתוח כרגע - היעד של הקשה */
  date: DateKey;
  onPlace: (template: EventTemplate, date: DateKey) => void;
}) {
  const pressing = useDragStore((s) => s.pressing);
  if (!templates.length) return null;

  return (
    <section className="mb-4 border-b border-hairline pb-4" aria-label="תבניות">
      <h3 className="mb-2 flex items-center gap-1.5 text-caption font-semibold text-muted">
        <LayoutTemplate size={ICON.xs} strokeWidth={STROKE} />
        תבניות
      </h3>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {templates.map((template) => (
          <motion.button
            key={template.id}
            type="button"
            // touch-none כדי שהדפדפן לא יפרש את הלחיצה הארוכה כגלילה
            className={`ev ev-${template.color} focus-ring flex shrink-0 touch-none select-none items-center gap-2 rounded-xl px-3 py-2 text-right ${
              pressing === TEMPLATE_DRAG_PREFIX + template.id ? 'opacity-50' : ''
            }`}
            whileTap={{ scale: 0.95 }}
            transition={TAP}
            onPointerDown={(e) => beginLongPress(e, dragOccurrence(template, date))}
            onClick={() => {
              void haptic('medium');
              onPlace(template, date);
            }}
          >
            <span className="min-w-0">
              <span className="block truncate text-label font-semibold leading-tight">
                {template.title}
              </span>
              <span className="mt-0.5 block text-tiny opacity-70">{templateHint(template)}</span>
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
