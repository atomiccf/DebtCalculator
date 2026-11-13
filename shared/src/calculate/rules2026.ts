import { CalculationError } from '../utils/calculationError';
import { DateInput, parseDate } from '../utils/dateUtils';
import { getEffectiveRecord } from '../referenceData/effectiveRecord';

/** Reviewed current edition, not an implementation of historical tax legislation. */
export const DUTY_RULES_2026 = Object.freeze({
  version: 'by-nk-2026-review-2026-10-20-v2',
  verifiedOn: '2026-10-20',
  supportedYear: 2026,
  dateFrom: '2026-07-01',
  dateTo: '2026-12-31',
  source: 'https://etalonline.by/document/?old_version=1&regnum=hk0900071',
  provisions: 'НК: приложения 13, 15; статьи 285, 287, 288',
});

export const dutyRulesHistory = Object.freeze([DUTY_RULES_2026]);
export type DutyRules = typeof DUTY_RULES_2026;
export function getDutyRulesInfo(date: DateInput): DutyRules {
  try { return getEffectiveRecord(dutyRulesHistory, date); }
  catch (error) {
    // Retain strict calendar validation separately from unsupported-edition errors.
    parseDate(date);
    throw new CalculationError('Поддержана редакция тарифов для обращений с 2026-07-01 по 2026-12-31; для другой даты нужна отдельная проверенная редакция');
  }
}
export function assertDutyRulesDate(date: DateInput): void {
  getDutyRulesInfo(date);
}

/** All values use the exact internal duty units from money.ts. */
export function calculatePropertyDutyUnits(amount: bigint, baseValue: bigint, court: 'common' | 'economic'): bigint {
  if (court === 'economic' && amount <= 300n * baseValue) return 25n * baseValue;
  if (amount <= 1000n * baseValue) {
    const percentage = amount * 5n / 100n;
    const minimum = (court === 'economic' ? 25n : 3n) * baseValue;
    return percentage > minimum ? percentage : minimum;
  }
  if (amount <= 10000n * baseValue) {
    return 50n * baseValue + (amount - 1000n * baseValue) * 3n / 100n;
  }
  const percentage = amount / 100n;
  const minimum = 320n * baseValue;
  return percentage > minimum ? percentage : minimum;
}
