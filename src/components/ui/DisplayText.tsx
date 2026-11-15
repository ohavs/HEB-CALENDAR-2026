/**
 * כותרת ב-Karantina שהספרות שבה נשארות ב-Heebo.
 *
 * ספרות Karantina נקראות כאותיות (08 כמו 0θ), ו"17 בנובמבר" או "נובמבר
 * 2026" הם בדיוק המקום שבו קוראים אותן במבט. לכן כל רצף ספרות עובר
 * ל-Heebo, מוקטן ביחס של הסקאלה (1.38, ראו `--fs-k-*`) כדי שישב באותו
 * גובה כמו המילים שלצידו ולא יקפוץ מעליהן.
 */
export function DisplayText({ text }: { text: string }) {
  const parts = text.split(/(\d+)/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="tnum font-sans text-[0.725em] font-semibold">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
