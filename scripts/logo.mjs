/**
 * הלוגו של האפליקציה כ-SVG, במקום אחד.
 *
 * גם אייקוני ה-PWA וגם המשאבים של אנדרואיד נגזרים מכאן, כדי שלא יתפצלו
 * לשתי גרסאות שנראות כמעט אותו דבר.
 */

/** הדיו של האפליקציה (`inverse`), והנייר שעליו (`on-inverse`) */
export const LOGO_INK = '#1C1A17';
const PAPER = '#F6F2EA';
/** הסהר חם יותר מהמסגרת - הוא מה שאומר "עברי", והוא היחיד כאן שיש לו צבע */
const MOON = '#F0C987';

/**
 * הלוגו: ריבוע מעוגל בדיו, מסגרת לוח שנה בקו נייר, סהר ירח (לוח עברי) וכוכבים.
 * הציור תמיד ב-viewBox של 512, וההתאמה לגודל/ריפוד נעשית ב-transform.
 * הסהר נוצר ממסכה: עיגול לבן פחות עיגול שחור מוסט.
 *
 * `mono` מצייר הכול בלבן - לאייקון ההתראה, שאנדרואיד צובע בעצמו וקורא
 * ממנו רק את השקיפות.
 */
export const logo = ({ size = 512, padding = 0, bg = true, mono = false } = {}) => {
  const scale = (512 - padding * 2) / 512;
  const line = mono ? '#FFFFFF' : PAPER;
  const moon = mono ? '#FFFFFF' : MOON;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2A2723"/>
      <stop offset="1" stop-color="${LOGO_INK}"/>
    </linearGradient>
    <mask id="crescent" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
      <rect x="0" y="0" width="512" height="512" fill="#000"/>
      <circle cx="272" cy="314" r="62" fill="#FFF"/>
      <circle cx="243" cy="288" r="55" fill="#000"/>
    </mask>
  </defs>
  <g transform="translate(${padding} ${padding}) scale(${scale})">
    ${bg ? '<rect x="0" y="0" width="512" height="512" rx="116" fill="url(#g)"/>' : ''}
    <g fill="none" stroke="${line}" stroke-linecap="round" stroke-width="26">
      <rect x="98" y="150" width="316" height="264" rx="44"/>
      <path d="M172 150 V 106"/>
      <path d="M340 150 V 106"/>
      <path d="M111 213 H 401" stroke-width="18" opacity="0.55"/>
    </g>
    <rect x="0" y="0" width="512" height="512" fill="${moon}" mask="url(#crescent)"/>
    <circle cx="164" cy="274" r="13" fill="${line}" opacity="0.95"/>
    <circle cx="158" cy="345" r="9" fill="${line}" opacity="0.66"/>
    <circle cx="196" cy="371" r="6.5" fill="${line}" opacity="0.45"/>
  </g>
</svg>`;
};
