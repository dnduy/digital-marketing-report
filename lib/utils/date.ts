/**
 * Date utilities using Asia/Ho_Chi_Minh timezone.
 * Uses Intl.DateTimeFormat for robust timezone handling (no DST issues).
 */

const TZ = 'Asia/Ho_Chi_Minh';

function getICTDateParts(d: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function shiftDays(d: Date, delta: number): string {
  const { year, month, day } = getICTDateParts(d);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + delta);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Returns YYYY-MM-DD of today in ICT */
export function getTodayDateICT(): string {
  return shiftDays(new Date(), 0);
}

/** Returns YYYY-MM-DD of yesterday in ICT */
export function getYesterdayDateICT(): string {
  return shiftDays(new Date(), -1);
}

/** Returns YYYY-MM-DD of 2 days ago in ICT (for GSC delay) */
export function getTwoDaysAgoDateICT(): string {
  return shiftDays(new Date(), -2);
}

/** Returns ISO string for start of yesterday in ICT (for WP/Meta filtering) */
export function getYesterdayISOStart(): string {
  return `${getYesterdayDateICT()}T00:00:00+07:00`;
}

/** Returns unix timestamp for start of yesterday in ICT */
export function getYesterdayUnixStart(): number {
  return Math.floor(new Date(`${getYesterdayDateICT()}T00:00:00+07:00`).getTime() / 1000);
}

/** Calculates % delta; returns null if yesterday was 0 */
export function calcDeltaPercent(
  today: number,
  yesterday: number
): number | null {
  if (yesterday === 0) return null;
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
}
