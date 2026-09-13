/**
 * בחירת שעה בפורמט 24 שעות.
 * לא משתמשים ב-input[type=time] כי הפורמט שלו (AM/PM או 24 שעות) נקבע
 * לפי הגדרות הדפדפן, ורצינו מראה אחיד בעברית - וגם התנהגות זהה כשנעבור
 * לאפליקציית אנדרואיד.
 */
import { ChevronDown } from 'lucide-react';
import { timeToMinutes } from '@/lib/dates';
import { Field } from './fields';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const total = timeToMinutes(value);
  const hour = String(Math.floor(total / 60)).padStart(2, '0');
  const minute = String(total % 60).padStart(2, '0');
  // אם השעה שנשמרה אינה בכפולות של 5, מוסיפים אותה לרשימה כדי לא לאבד אותה
  const minuteOptions = MINUTES.includes(minute)
    ? MINUTES
    : [...MINUTES, minute].sort((a, b) => Number(a) - Number(b));

  const selectClass =
    'field-reset tnum w-auto cursor-pointer bg-transparent p-0 text-center text-title font-semibold text-ink';

  return (
    <Field label={label} className="flex-1">
      <span className="flex items-center gap-0.5" dir="ltr">
        <select
          aria-label={`${label} - שעה`}
          value={hour}
          onChange={(e) => onChange(`${e.target.value}:${minute}`)}
          className={selectClass}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="-mt-0.5 text-title font-semibold leading-none text-faint">:</span>
        <select
          aria-label={`${label} - דקות`}
          value={minute}
          onChange={(e) => onChange(`${hour}:${e.target.value}`)}
          className={selectClass}
        >
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          strokeWidth={2.4}
          aria-hidden="true"
          className="pointer-events-none ms-0.5 text-faint"
        />
      </span>
    </Field>
  );
}
