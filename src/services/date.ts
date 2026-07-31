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
