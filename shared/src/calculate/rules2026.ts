import { CalculationError } from '../utils/calculationError';
import { toDutyUnits } from '../utils/money';
import { getDutyRequirements, isDutyIndividualAppealExempt } from './dutyRequirements';
import type { CourtRatesConfig } from './commonCourts';
import type { DutyEdition, DutyRatesConfig } from './dutyEdition';

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

export const DUTY_EDITION_2026: DutyEdition = Object.freeze({ rules: DUTY_RULES_2026, calculateUnits: calculateDuty2026Units });

/** Validated inputs, exact arithmetic, and no reference lookups or final rounding. */
function calculateDuty2026Units(config: DutyRatesConfig, bv: bigint, price?: bigint): bigint {
  const economic = 'courtLevel' in config;
  const input = { ...config, courtType: economic ? config.courtLevel : 'common', amount: price };
  const property = () => calculatePropertyDutyUnits(price!, bv, economic ? 'economic' : 'common');
  if (getDutyRequirements(input).complaint) {
    if (price !== undefined) return property() * 8n / 10n;
    if (isDutyIndividualAppealExempt(input)) return 0n;
    if (economic) {
      return calculateDuty2026Units({ ...config, caseType: config.originalCaseType!, courtLevel: config.originalCourtLevel ?? config.courtLevel,
        originalCaseType: undefined, originalCourtLevel: undefined }, bv) * 8n / 10n;
    }
    return calculateDuty2026Units({ ...config, caseType: config.originalCaseType!, originalCaseType: undefined }, bv) * 8n / 10n;
  }
  switch (config.caseType) {
    case 'property': return property();
    case 'property_quality': return property() * 8n / 10n;
    case 'court_order':
      // Lower bounds in pp. 3.2/3.3 of Appendix 13 and 5.2/5.3 of Appendix 15 are inclusive.
      return (price! < 100n * bv ? 2n : price! < 300n * bv ? 5n : 7n) * bv;
    case 'non_property': return 3n * bv;
    case 'non_property_org': case 'non_property_ip': case 'non_property_person':
      return (economic && config.courtLevel === 'supreme_economic' ? 50n : economic && config.courtLevel === 'appellate_economic' ? 40n : 20n) * bv;
    case 'contract_dispute': return (config.plaintiffType === 'organization' ? 20n : config.plaintiffType === 'ip' ? 10n : 5n) * bv;
    case 'divorce': return ('isRepeated' in config && config.isRepeated ? 8n : 4n) * bv;
    case 'divorce_repeat': return 8n * bv;
    case 'divorce_missing': return bv;
    case 'paternity': return 3n * bv;
    case 'alimony': return 0n;
    case 'subsidiary': return 25n * bv;
    case 'bankruptcy': return 10n * bv;
    case 'other_complaint': return bv / 2n;
    case 'challenge_act': return economic ? (config.courtLevel === 'supreme_economic' ? 50n : config.courtLevel === 'appellate_economic' ? 40n : 20n) * bv : bv;
    case 'fact_establishment':
      return (economic ? config.courtLevel === 'appellate_economic' ? 15n : 10n : 2n) * bv;
    case 'administrative': {
      const administrative = config as CourtRatesConfig;
      if (administrative.administrativePenalty === 'other') return bv;
      const fine = toDutyUnits(administrative.fineAmount!);
      return fine < 10n * bv ? bv / 2n : fine < 100n * bv ? 2n * bv : 3n * bv;
    }
    default: throw new CalculationError('Неизвестный тип дела');
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
