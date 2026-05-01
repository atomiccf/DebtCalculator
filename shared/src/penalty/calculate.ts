import { Temporal } from '@js-temporal/polyfill';
import { getRefinancingRate } from '../api/refinancingRate';
import { getDaysInYearForDate } from '../utils/dateUtils';

export interface PenaltyInput {
  debt: number;
  startDate: Temporal.PlainDate | Date | string;
  endDate: Temporal.PlainDate | Date | string;
  rate?: number;
}

export interface PenaltyResult {
  days: number;
  penalty: number;
  rate: number;
  breakdown: PenaltyPeriod[];
  yearDivisor: number;
}

export interface PenaltyPeriod {
  startDate: string;
  endDate: string;
  days: number;
  rate: number;
  amount: number;
}

const DEFAULT_RATE = 0.1;
const DEFAULT_YEAR_DIVISOR = 365;

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

export function calculatePenalty(input: PenaltyInput): PenaltyResult {
  const { debt, startDate, endDate, rate = DEFAULT_RATE } = input;

  if (debt <= 0) {
    throw new Error('Сумма долга должна быть больше 0');
  }

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const totalDays = start.until(end).days + 1;
  const penalty = (debt * rate * totalDays) / 100;

  return {
    days: totalDays,
    penalty: Math.round(penalty * 100) / 100,
    rate,
    yearDivisor: DEFAULT_YEAR_DIVISOR,
    breakdown: [{
      startDate: start.toString(),
      endDate: end.toString(),
      days: totalDays,
      rate,
      amount: Math.round(penalty * 100) / 100
    }]
  };
}

export function calculatePenaltyWithRateChange(
  debt: number,
  startDate: Temporal.PlainDate | Date | string,
  endDate: Temporal.PlainDate | Date | string,
  rates: { rate: number; dateFrom: string }[]
): PenaltyResult {
  if (debt <= 0) {
    throw new Error('Сумма долга должна быть больше 0');
  }

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const sortedRates = [...rates].sort((a, b) =>
    Temporal.PlainDate.from(a.dateFrom).since(start).days - Temporal.PlainDate.from(b.dateFrom).since(start).days
  );

  let currentDate = start;
  let totalPenalty = 0;
  const breakdown: PenaltyPeriod[] = [];

  for (const rateInfo of sortedRates) {
    const rateDate = Temporal.PlainDate.from(rateInfo.dateFrom);

    if (rateDate.since(end).days > 0) break;

    const periodStart = currentDate.since(start).days > 0 ? currentDate : start;
    const periodEnd = rateDate.since(end).days <= 0
      ? rateDate.subtract({ days: 1 })
      : end;

    if (periodEnd.since(periodStart).days < 0) continue;

    const days = periodStart.until(periodEnd).days + 1;
    const periodPenalty = (debt * rateInfo.rate * days) / 100;
    totalPenalty += periodPenalty;

    breakdown.push({
      startDate: periodStart.toString(),
      endDate: periodEnd.toString(),
      days,
      rate: rateInfo.rate,
      amount: Math.round(periodPenalty * 100) / 100
    });

    currentDate = rateDate;
  }

  if (currentDate.since(end).days <= 0) {
    const lastRate = sortedRates[sortedRates.length - 1].rate;
    const days = currentDate.until(end).days + 1;
    const periodPenalty = (debt * lastRate * days) / 100;
    totalPenalty += periodPenalty;

    breakdown.push({
      startDate: currentDate.toString(),
      endDate: end.toString(),
      days,
      rate: lastRate,
      amount: Math.round(periodPenalty * 100) / 100
    });
  }

  const totalDays = start.until(end).days + 1;

  return {
    days: totalDays,
    penalty: Math.round(totalPenalty * 100) / 100,
    rate: sortedRates[0].rate,
    yearDivisor: DEFAULT_YEAR_DIVISOR,
    breakdown
  };
}

export function calculateInterestOnDebt(
  debt: number,
  startDate: Temporal.PlainDate | Date | string,
  endDate: Temporal.PlainDate | Date | string,
  annualRate: number
): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const days = start.until(end).days + 1;

  // Простая проверка високосного года
  const year = start.year;
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const yearDivisor = isLeapYear ? 366 : 365;

  const interest = (debt * annualRate * days) / (100 * yearDivisor);

  return Math.round(interest * 100) / 100;
}

export interface Interest366Input {
  debt: number;
  startDate: Temporal.PlainDate | Date | string;
  endDate: Temporal.PlainDate | Date | string;
}

export interface Interest366Result {
  debt: number;
  startDate: string;
  endDate: string;
  days: number;
  refinancingRate: number;
  interest: number;
}

export function calculateInterest366(input: Interest366Input): Interest366Result {
  const { debt, startDate, endDate } = input;

  if (debt <= 0) {
    throw new Error('Сумма долга должна быть больше 0');
  }

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const days = start.until(end).days + 1;
  const refinancingRate = getRefinancingRate(end.toString());
  const yearDivisor = getDaysInYearForDate(end);
  const interest = (debt * refinancingRate * days) / (100 * yearDivisor);

  return {
    debt,
    startDate: start.toString(),
    endDate: end.toString(),
    days,
    refinancingRate,
    interest: Math.round(interest * 100) / 100
  };
}

export interface Interest366Document {
  name: string;
  debt: number;
  startDate: Temporal.PlainDate | Date | string;
  endDate: Temporal.PlainDate | Date | string;
}

export interface Interest366DocumentResult {
  name: string;
  debt: number;
  startDate: string;
  endDate: string;
  days: number;
  refinancingRate: number;
  interest: number;
}

export interface Interest366MultipleResult {
  results: Interest366DocumentResult[];
  total: number;
}

export function calculateInterest366Multiple(documents: Interest366Document[]): Interest366MultipleResult {
  if (!documents || documents.length === 0) {
    throw new Error('Список документов пуст');
  }

  const results: Interest366DocumentResult[] = [];
  let total = 0;

  for (const doc of documents) {
    if (!doc.name || !doc.name.trim()) {
      throw new Error('Укажите название для каждого документа');
    }
    if (doc.debt <= 0) {
      throw new Error('Сумма долга должна быть больше 0');
    }

    const start = parseDate(doc.startDate);
    const end = parseDate(doc.endDate);

    const days = start.until(end).days + 1;
    const refinancingRate = getRefinancingRate(end.toString());
    const yearDivisor = getDaysInYearForDate(end);
    const interest = (doc.debt * refinancingRate * days) / (100 * yearDivisor);

    results.push({
      name: doc.name,
      debt: doc.debt,
      startDate: start.toString(),
      endDate: end.toString(),
      days,
      refinancingRate,
      interest: Math.round(interest * 100) / 100
    });

    total += interest;
  }

  return {
    results,
    total: Math.round(total * 100) / 100
  };
}
