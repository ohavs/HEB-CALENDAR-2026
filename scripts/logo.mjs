/**
 * הלוגו של האפליקציה כ-SVG, במקום אחד.
 *
 * גם אייקוני ה-PWA וגם המשאבים של אנדרואיד נגזרים מכאן, כדי שלא יתפצלו
 * לשתי גרסאות שנראות כמעט אותו דבר.
 */
/**
 * הלוגו: ריבוע מעוגל בגרדיאנט אינדיגו, מסגרת לוח שנה, סהר ירח (לוח עברי) וכוכבים.
 * הציור תמיד ב-viewBox של 512, וההתאמה לגודל/ריפוד נעשית ב-transform.
 * הסהר נוצר ממסכה: עיגול לבן פחות עיגול שחור מוסט.
 */
export const logo = ({ size = 512, padding = 0, bg = true } = {}) => {
  const scale = (512 - padding * 2) / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7C7CF0"/>
      <stop offset="0.55" stop-color="#6366F1"/>
      <stop offset="1" stop-color="#4F46E5"/>
    </linearGradient>
    <mask id="crescent" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
      <rect x="0" y="0" width="512" height="512" fill="#000"/>
      <circle cx="272" cy="314" r="62" fill="#FFF"/>
      <circle cx="243" cy="288" r="55" fill="#000"/>
    </mask>
  </defs>
  <g transform="translate(${padding} ${padding}) scale(${scale})">
    ${bg ? '<rect x="0" y="0" width="512" height="512" rx="116" fill="url(#g)"/>' : ''}
    <g fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-width="26">
      <rect x="98" y="150" width="316" height="264" rx="44"/>
      <path d="M172 150 V 106"/>
      <path d="M340 150 V 106"/>
      <path d="M111 213 H 401" stroke-width="18" opacity="0.8"/>
    </g>
    <rect x="0" y="0" width="512" height="512" fill="#FFFFFF" mask="url(#crescent)"/>
    <circle cx="164" cy="274" r="13" fill="#FFFFFF" opacity="0.95"/>
    <circle cx="158" cy="345" r="9" fill="#FFFFFF" opacity="0.66"/>
    <circle cx="196" cy="371" r="6.5" fill="#FFFFFF" opacity="0.45"/>
  </g>
</svg>`;
};

