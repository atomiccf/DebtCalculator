import { DateInput, parsePeriod, splitPeriodByYear, getDaysInYearForDate } from '../utils/dateUtils';
import { calculateMoneyAccrual } from '../utils/money';
import { assertRecord } from '../utils/validation';

export const CALCULATION_RULES_VERSION = '2.1.0';
export type AnnualDayCount = 'start-year' | 'end-year' | 'actual/actual' | 360 | 365 | 366;

export interface AccrualInput {
  debt: number;
  startDate: DateInput;
  endDate: DateInput;
  rate: number;
}

export interface AnnualAccrualInput extends AccrualInput {
  dayCount: AnnualDayCount;
}

export interface AccrualResult {
  debt: number;
  rate: number;
  startDate: string;
  endDate: string;
  amount: number;
  days: number;
  rulesVersion: string;
  rounding: 'half-up';
  periodIncludes: 'both';
}

export interface AnnualAccrualResult extends AccrualResult {
  dayCount: AnnualDayCount;
}

export function calculateDailyAccrual(input: AccrualInput): AccrualResult {
  assertRecord(input);
  const { start, end, days } = parsePeriod(input.startDate, input.endDate);
  return { debt: input.debt, rate: input.rate, startDate: start.toString(), endDate: end.toString(),
    amount: calculateMoneyAccrual(input.debt, input.rate, BigInt(days)), days,
    rulesVersion: CALCULATION_RULES_VERSION, rounding: 'half-up', periodIncludes: 'both' };
}

/** Pure calculation: the caller explicitly selects the day-count convention. */
export function calculateAnnualAccrual(input: AnnualAccrualInput): AnnualAccrualResult {
  assertRecord(input);
  const { start, end, days } = parsePeriod(input.startDate, input.endDate);
  let numerator: bigint;
  let denominator: bigint;
  if (input.dayCount === 'actual/actual') {
    denominator = 365n * 366n;
    numerator = splitPeriodByYear(start, end).reduce((sum, period) =>
      sum + BigInt(period.days) * (denominator / BigInt(period.yearDivisor)), 0n);
  } else {
    const divisor = input.dayCount === 'start-year' ? getDaysInYearForDate(start)
      : input.dayCount === 'end-year' ? getDaysInYearForDate(end) : input.dayCount;
    if (divisor !== 360 && divisor !== 365 && divisor !== 366) throw new Error('Неизвестное правило расчёта дней в году');
    numerator = BigInt(days);
    denominator = BigInt(divisor);
  }
  return { debt: input.debt, rate: input.rate, startDate: start.toString(), endDate: end.toString(),
    dayCount: input.dayCount, amount: calculateMoneyAccrual(input.debt, input.rate, numerator, denominator), days,
    rulesVersion: CALCULATION_RULES_VERSION, rounding: 'half-up', periodIncludes: 'both' };
}
