import { DateInput, parseDate } from '../utils/dateUtils';

/** Reviewed current edition, not an implementation of historical tax legislation. */
export const DUTY_RULES_2026 = Object.freeze({
  version: 'by-nk-2026-review-2026-10-20',
  verifiedOn: '2026-10-20',
  supportedYear: 2026,
  source: 'https://etalonline.by/document/?old_version=1&regnum=hk0900071',
  provisions: 'НК: приложения 13, 15; статьи 285, 287, 288',
});

export function assertDutyRulesDate(date: DateInput): void {
  if (parseDate(date).year !== DUTY_RULES_2026.supportedYear) {
    throw new Error('Проверенная редакция тарифов поддерживает обращения в суд в 2026 году; для другого года нужна отдельная редакция');
  }
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
