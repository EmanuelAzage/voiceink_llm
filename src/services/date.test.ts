import { isValidIsoDate, toLocalIsoDate } from './date';

describe('toLocalIsoDate', () => {
  it('formats using local calendar components, not UTC', () => {
    // A time deliberately close to a UTC day boundary — if this used
    // toISOString() instead of local getters, a negative-UTC-offset
    // timezone could see it roll to the next day.
    const date = new Date(2026, 6, 30, 23, 30, 0); // July 30 2026, 11:30pm local
    expect(toLocalIsoDate(date)).toBe('2026-07-30');
  });

  it('pads single-digit month and day', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('isValidIsoDate', () => {
  it('accepts a well-formed, real date', () => {
    expect(isValidIsoDate('2026-07-31')).toBe(true);
  });

  it('accepts a leap day on a leap year', () => {
    expect(isValidIsoDate('2028-02-29')).toBe(true);
  });

  it.each([
    ['garbage text', 'text:'],
    ['empty string', ''],
    ['wrong separator', '2026/07/31'],
    ['unpadded month', '2026-7-31'],
    ['unpadded day', '2026-07-1'],
    ['two-digit year', '26-07-31'],
    ['nonexistent day (Feb 30)', '2026-02-30'],
    ['nonexistent day (Apr 31)', '2026-04-31'],
    ['nonexistent month', '2026-13-01'],
    ['zero month', '2026-00-15'],
    ['zero day', '2026-07-00'],
    ['non-leap-year Feb 29', '2026-02-29'],
    ['trailing text', '2026-07-31 '],
  ])('rejects %s (%s)', (_label, value) => {
    expect(isValidIsoDate(value)).toBe(false);
  });
});
