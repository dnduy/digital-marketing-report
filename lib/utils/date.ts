/**
 * Date utilities using Asia/Ho_Chi_Minh timezone.
 */

const TZ = 'Asia/Ho_Chi_Minh';

/** Returns YYYY-MM-DD of yesterday in ICT */
export function getYesterdayDateICT(): string {
  const now = new Date();
  const ict = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  ict.setDate(ict.getDate() - 1);
  return formatDate(ict);
}

/** Returns YYYY-MM-DD of 2 days ago in ICT (for GSC delay) */
export function getTwoDaysAgoDateICT(): string {
  const now = new Date();
  const ict = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  ict.setDate(ict.getDate() - 2);
  return formatDate(ict);
}

/** Returns ISO string for start of yesterday in ICT (for WP/Meta filtering) */
export function getYesterdayISOStart(): string {
  const yesterday = getYesterdayDateICT();
  return `${yesterday}T00:00:00+07:00`;
}

/** Returns YYYY-MM-DD of today in ICT */
export function getTodayDateICT(): string {
  const now = new Date();
  const ict = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  return formatDate(ict);
}

/** Returns unix timestamp for start of yesterday in ICT */
export function getYesterdayUnixStart(): number {
  const yesterday = getYesterdayDateICT();
  return Math.floor(new Date(`${yesterday}T00:00:00+07:00`).getTime() / 1000);
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Calculates % delta; returns null if yesterday was 0 */
export function calcDeltaPercent(
  today: number,
  yesterday: number
): number | null {
  if (yesterday === 0) return null;
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
}
