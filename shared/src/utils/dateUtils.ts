import { Temporal } from '@js-temporal/polyfill';

export type DateInput = Temporal.PlainDate | Date | string;
export function parseDate(date: DateInput): Temporal.PlainDate {
  if (date instanceof Date) {
    if (!Number.isFinite(date.getTime())) throw new Error('Некорректная дата');
    return Temporal.PlainDate.from({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
  }
  if (date instanceof Temporal.PlainDate) {
    if (date.calendarId !== 'iso8601') throw new Error('Требуется календарь ISO');
    return date;
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Дата должна иметь формат YYYY-MM-DD');
  return Temporal.PlainDate.from(date, { overflow: 'reject' });
}
export function today(): string { return Temporal.Now.plainDateISO('Europe/Minsk').toString(); }
export function isLeapYear(year: number): boolean { return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0; }
export function getDaysInYear(year: number): number { return isLeapYear(year) ? 366 : 365; }
export function getDaysInYearForDate(date: DateInput): number { return getDaysInYear(parseDate(date).year); }
export function parsePeriod(startDate: DateInput, endDate: DateInput) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (Temporal.PlainDate.compare(start, end) > 0) throw new Error('Дата окончания не может быть раньше даты начала');
  return { start, end, days: start.until(end).days + 1 };
}
export function calculateDaysInPeriod(start: DateInput, end: DateInput): number { return parsePeriod(start, end).days; }
export function splitPeriodByYear(startDate: DateInput, endDate: DateInput) {
  const { start, end } = parsePeriod(startDate, endDate);
  const periods = [];
  let current = start;
  while (Temporal.PlainDate.compare(current, end) <= 0) {
    const yearEnd = Temporal.PlainDate.from({ year: current.year, month: 12, day: 31 });
    const last = Temporal.PlainDate.compare(yearEnd, end) < 0 ? yearEnd : end;
    periods.push({ startDate: current.toString(), endDate: last.toString(), days: current.until(last).days + 1, yearDivisor: getDaysInYear(current.year) });
    current = last.add({ days: 1 });
  }
  return periods;
}
export function calculateExactYearDivisor(start: DateInput, end: DateInput): number {
  const periods = splitPeriodByYear(start, end);
  return periods.reduce((sum, p) => sum + p.days, 0) / periods.reduce((sum, p) => sum + p.days / p.yearDivisor, 0);
}
