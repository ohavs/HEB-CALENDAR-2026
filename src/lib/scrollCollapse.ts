/**
 * מתי סרגל הלשוניות מתכווץ בגלילה.
 *
 * גלילה למטה אומרת "אני קורא", ולמעלה "אני מחפש לאן ללכת". הסרגל מתכווץ
 * לגלולה של אייקונים בלבד כשגוללים למטה, וחוזר בגלילה למעלה או כשמגיעים
 * לראש. ההכרעה לפי מרחק שנצבר בכיוון אחד, ולא לפי כל אירוע: אצבע שנחה
 * על המסך מזיזה אותו בפיקסל לכאן ולשם, וסרגל שמהבהב בגללה גרוע מסרגל
 * שלא מתכווץ בכלל.
 */

/** כמה לגלול למטה, ברצף, לפני שהסרגל מתכווץ */
export const COLLAPSE_AFTER_PX = 28;
/** כמה לגלול למעלה כדי שיחזור - פחות, כי מי שחוזר מחפש אותו */
export const EXPAND_AFTER_PX = 14;
/** קרוב לראש הסרגל תמיד פתוח: שם אין מה שיסתתר מאחוריו */
export const TOP_ZONE_PX = 8;
/** רשימה שכמעט אינה נגללת אינה מקפלת את הסרגל - הוא לא הסתיר בה דבר */
export const MIN_ROOM_PX = 120;

/** מה שנזכר על כל אזור נגלל בנפרד */
export type FoldTrack = {
  top: number;
  /** המרחק שנצבר בכיוון הנוכחי: חיובי למטה, שלילי למעלה */
  travel: number;
};

export function foldStep(
  track: FoldTrack | undefined,
  top: number,
  /** scrollHeight פחות clientHeight */
  room: number,
  collapsed: boolean,
): { track: FoldTrack; collapsed: boolean } {
  // אזור חדש: אין ממה למדוד כיוון, ורק הראש מכריע
  if (!track) return { track: { top, travel: 0 }, collapsed: top > TOP_ZONE_PX && collapsed };
  const delta = top - track.top;
  if (delta === 0) return { track, collapsed };
  const travel = Math.sign(delta) === Math.sign(track.travel) ? track.travel + delta : delta;
  const next = { top, travel };

  if (top <= TOP_ZONE_PX || room < MIN_ROOM_PX) return { track: next, collapsed: false };
  if (travel >= COLLAPSE_AFTER_PX) return { track: next, collapsed: true };
  if (travel <= -EXPAND_AFTER_PX) return { track: next, collapsed: false };
  return { track: next, collapsed };
}
