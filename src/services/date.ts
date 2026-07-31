/**
 * Local calendar date as YYYY-MM-DD — deliberately not `Date.toISOString()`,
 * which serializes in UTC and silently shifts to the wrong day for any
 * negative-UTC-offset user once local time crosses into UTC's next day
 * (e.g. any US timezone, every evening).
 */
export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * True only for a well-formed, real calendar date as YYYY-MM-DD — rejects
 * both wrong formats ("text:", "07/31/2026") and real-looking but
 * nonexistent dates ("2026-02-30"). JS's `Date` constructor silently rolls
 * an out-of-range day/month into the following month/year instead of
 * erroring, so validity is checked by round-tripping through it and
 * confirming the components didn't get rolled.
 */
export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
