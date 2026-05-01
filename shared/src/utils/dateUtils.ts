import { Temporal } from '@js-temporal/polyfill';

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export function getDaysInYearForDate(date: Temporal.PlainDate | Date | string): number {
  const plainDate = parseDate(date);
  return getDaysInYear(plainDate.year);
}

export function calculateDaysInPeriod(
  startDate: Temporal.PlainDate | Date | string,
  endDate: Temporal.PlainDate | Date | string
): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return start.until(end).days + 1;
}

export function calculateExactYearDivisor(
  startDate: Temporal.PlainDate | Date | string,
  endDate: Temporal.PlainDate | Date | string
): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  if (start.year === end.year) {
    return getDaysInYear(start.year);
  }
  
  // Для периодов, затрагивающих несколько лет, используем средневзвешенное
  const totalDays = calculateDaysInPeriod(start, end);
  let weightedSum = 0;
  
  let current = start;
  while (current.year <= end.year) {
    const yearEnd = Temporal.PlainDate.from({ year: current.year, month: 12, day: 31 });
    const periodEnd = Temporal.PlainDate.compare(current, end) <= 0 ? current : end;
    const daysInThisYear = calculateDaysInPeriod(current, periodEnd);
    
    weightedSum += daysInThisYear * getDaysInYear(current.year);
    
    if (current.year >= end.year) break;
    current = Temporal.PlainDate.from({ year: current.year + 1, month: 1, day: 1 });
  }
  
  return weightedSum / totalDays;
}

function parseDate(date: Temporal.PlainDate | Date | string): Temporal.PlainDate {
  if (date instanceof Date) {
    return Temporal.PlainDate.from({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    });
  }
  if (typeof date === 'string') {
    return Temporal.PlainDate.from(date);
  }
  return date;
}