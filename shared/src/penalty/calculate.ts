import { DateInput, parsePeriod, parseDate, getDaysInYearForDate } from '../utils/dateUtils';
import { assertRecord, assertNonNegativeNumber } from '../utils/validation';
import { sumMoney } from '../utils/money';
import { getRefinancingRate } from '../api/refinancingRate';
import { calculateAnnualAccrual, calculateDailyAccrual, AnnualDayCount } from './accrual';

export interface PenaltyInput { debt: number; startDate: DateInput; endDate: DateInput; rate: number }
export interface PenaltyPeriod { startDate: string; endDate: string; days: number; rate: number; amount: number }
export interface PenaltyResult { days: number; penalty: number; rate: number; breakdown: PenaltyPeriod[]; yearDivisor: number }
export function calculatePenalty(input: PenaltyInput): PenaltyResult {
  const result = calculateDailyAccrual(input);
  return { days: result.days, penalty: result.amount, rate: result.rate, yearDivisor: 365,
    breakdown: [{ startDate: result.startDate, endDate: result.endDate, days: result.days, rate: result.rate, amount: result.amount }] };
}
export function calculatePenaltyWithRateChange(debt: number, startDate: DateInput, endDate: DateInput,
  rates: { rate: number; dateFrom: string }[]): PenaltyResult {
  const { start, end, days } = parsePeriod(startDate, endDate);
  if (!Array.isArray(rates) || !rates.length) throw new Error('Необходима история ставок');
  const sorted = rates.map(r => {
    assertRecord(r);
    assertNonNegativeNumber(r.rate, 'Ставка');
    return { rate: r.rate, dateFrom: parseDate(r.dateFrom).toString() };
  }).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
  if (new Set(sorted.map(r => r.dateFrom)).size !== sorted.length) throw new Error('Дубли дат ставок');
  const initial = sorted.filter(r => r.dateFrom <= start.toString()).pop();
  if (!initial) throw new Error('Нет ставки на начало периода');
  const periods = [initial, ...sorted.filter(r => r.dateFrom > start.toString() && r.dateFrom <= end.toString())];
  const breakdown = periods.map((r, index) => {
    const from = index === 0 ? start : parseDate(r.dateFrom);
    const to = periods[index + 1] ? parseDate(periods[index + 1].dateFrom).subtract({ days: 1 }) : end;
    const result = calculateDailyAccrual({ debt, startDate: from, endDate: to, rate: r.rate });
    return { startDate: result.startDate, endDate: result.endDate, days: result.days, rate: result.rate, amount: result.amount };
  });
  return { days, penalty: sumMoney(breakdown.map(p => p.amount)), rate: initial.rate, yearDivisor: 365, breakdown };
}
export function calculateInterestOnDebt(debt: number, startDate: DateInput, endDate: DateInput,
  annualRate: number, dayCount: AnnualDayCount = 'start-year'): number {
  return calculateAnnualAccrual({ debt, startDate, endDate, rate: annualRate, dayCount }).amount;
}

export type Interest366Basis = 'payment' | 'judgment' | 'executive-endorsement' | 'estimate';
export interface Interest366Options {
  calculationBasis?: Interest366Basis;
  rateDate?: DateInput;
  dayCount?: AnnualDayCount;
  hasPenalty?: boolean;
  statutoryException?: boolean;
  refinancingRate?: number;
}
export interface Interest366Input extends Interest366Options { debt: number; startDate: DateInput; endDate: DateInput }
export interface Interest366Result {
  debt: number; startDate: string; endDate: string; days: number; refinancingRate: number; interest: number;
  rateDate: string; calculationBasis: Interest366Basis; dayCount: AnnualDayCount; rulesVersion: string; warnings: string[];
}
export function calculateInterest366(input: Interest366Input): Interest366Result {
  assertRecord(input);
  const rateDate = input.rateDate === undefined ? parseDate(input.endDate).toString() : parseDate(input.rateDate).toString();
  return calculateInterest366WithRate({ ...input,
    refinancingRate: input.refinancingRate === undefined ? getRefinancingRate(rateDate) : input.refinancingRate });
}

/** Pure core: the application selects the reference record before calling this function. */
export function calculateInterest366WithRate(input: Interest366Input & { refinancingRate: number }): Interest366Result {
  assertRecord(input);
  const { start, end } = parsePeriod(input.startDate, input.endDate);
  const basis = input.calculationBasis ?? 'estimate';
  if (!['payment', 'judgment', 'executive-endorsement', 'estimate'].includes(basis)) throw new Error('Неизвестное основание расчёта');
  for (const flag of [input.hasPenalty, input.statutoryException]) {
    if (flag !== undefined && typeof flag !== 'boolean') throw new Error('Признаки неустойки и исключения должны быть логическими значениями');
  }
  if (input.hasPenalty && !input.statutoryException) throw new Error('При наличии неустойки необходимо законодательное исключение для ст. 366');
  if (basis !== 'estimate' && (input.rateDate === undefined || input.dayCount === undefined)) throw new Error('Укажите дату выбора ставки и методику расчёта');
  if (start.year !== end.year && input.dayCount === undefined) throw new Error('Для периода в нескольких годах укажите методику расчёта');
  const rateDate = input.rateDate === undefined ? end.toString() : parseDate(input.rateDate).toString();
  assertNonNegativeNumber(input.refinancingRate, 'Ставка рефинансирования');
  const rate = input.refinancingRate;
  const dayCount = input.dayCount ?? (getDaysInYearForDate(start) as 365 | 366);
  const result = calculateAnnualAccrual({ ...input, rate, dayCount });
  const warnings: string[] = [];
  if (basis === 'estimate') warnings.push('Предварительный расчёт: основание и дата юридически значимого события требуют проверки.');
  if (input.dayCount === undefined) warnings.push('Использован календарный делитель года периода; применимость методики требует проверки.');
  if (input.hasPenalty === undefined) warnings.push('Наличие неустойки не указано.');
  return { debt: result.debt, startDate: result.startDate, endDate: result.endDate, days: result.days,
    refinancingRate: rate, interest: result.amount, rateDate, calculationBasis: basis, dayCount, rulesVersion: result.rulesVersion, warnings };
}
export interface Interest366Document { name: string; debt: number; startDate: DateInput; endDate: DateInput }
export interface Interest366DocumentResult extends Interest366Result { name: string }
export interface Interest366MultipleResult { results: Interest366DocumentResult[]; total: number }
export function calculateInterest366Multiple(documents: Interest366Document[], options: Interest366Options = {}): Interest366MultipleResult {
  if (!Array.isArray(documents) || !documents.length) throw new Error('Список документов пуст');
  const results = documents.map(doc => {
    assertRecord(doc);
    if (typeof doc.name !== 'string' || !doc.name.trim()) throw new Error('Укажите название каждого документа');
    return { ...calculateInterest366({ ...doc, ...options }), name: doc.name.trim() };
  });
  return { results, total: sumMoney(results.map(r => r.interest)) };
}
