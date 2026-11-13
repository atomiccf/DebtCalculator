import { CalculationError } from '../utils/calculationError';
import { assertRecord } from '../utils/validation';
import { assertPositiveMoney, toDutyUnits, fromDutyUnits } from '../utils/money';
import { DUTY_EDITION_2026, DUTY_RULES_2026 } from './rules2026';
import { getDutyEditionByVersion } from './dutyEditions';
import type { DutyEdition, DutyRatesConfig, DutyRules } from './dutyEdition';
import { DUTY_COURTS, ECONOMIC_COURTS, validateDutyRequirements } from './dutyRequirements';

export { COMMON_CASES, ECONOMIC_CASES, COMPLAINT_CASES } from './dutyRequirements';

export function dutyUnits(config: DutyRatesConfig, baseValue: number, amount?: number, edition: DutyEdition = DUTY_EDITION_2026): bigint {
  assertRecord(config as unknown);
  assertPositiveMoney(baseValue, 'Базовая величина');
  const economic = 'courtLevel' in config;
  const input = { ...config, courtType: economic ? config.courtLevel : 'common', amount };
  const [issue] = validateDutyRequirements(input, economic ? ECONOMIC_COURTS : DUTY_COURTS);
  if (issue) throw new CalculationError(issue.message);
  const bv = toDutyUnits(baseValue);
  const price = amount === undefined ? undefined : toDutyUnits(amount);
  return edition.calculateUnits(config, bv, price);
}

/** Compatibility entry point pinned to the reviewed 2026 tariffs, with an explicit BV. */
export function calculateDutyWithBaseValue(config: DutyRatesConfig, baseValue: number, amount?: number): number {
  return calculateDutyWithRules(config, baseValue, DUTY_RULES_2026, amount);
}

/** Pure core: receives the selected value and edition; performs no reference lookup. */
export function calculateDutyWithRules(config: DutyRatesConfig, baseValue: number, rules: DutyRules, amount?: number): number {
  const edition = getDutyEditionByVersion(rules.version);
  return fromDutyUnits(dutyUnits(config, baseValue, amount, edition));
}
