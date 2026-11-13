import { assertRecord } from '../utils/validation';
import { assertPositiveMoney, toDutyUnits, fromDutyUnits } from '../utils/money';
import { calculatePropertyDutyUnits } from './rules2026';
import type { CourtRatesConfig } from './commonCourts';
import type { EconomicRatesConfig } from './economicCourts';

export const COMMON_CASES = ['property', 'non_property', 'divorce', 'divorce_repeat', 'divorce_missing', 'paternity', 'alimony', 'appeal', 'cassation', 'supervision', 'court_order', 'administrative', 'challenge_act', 'fact_establishment', 'contract_dispute'] as const;
export const ECONOMIC_CASES = ['property', 'property_quality', 'non_property_org', 'non_property_ip', 'non_property_person', 'subsidiary', 'appeal', 'cassation', 'supervision', 'court_order', 'bankruptcy', 'fact_establishment', 'challenge_act', 'other_complaint', 'contract_dispute'] as const;
export const COMPLAINT_CASES: readonly string[] = ['appeal', 'cassation', 'supervision'];

export function dutyUnits(config: CourtRatesConfig | EconomicRatesConfig, baseValue: number, amount?: number): bigint {
  assertRecord(config as unknown);
  assertPositiveMoney(baseValue, 'Базовая величина');
  if (amount !== undefined) assertPositiveMoney(amount, 'Сумма требования');
  const economic = 'courtLevel' in config;
  const cases: readonly string[] = economic ? ECONOMIC_CASES : COMMON_CASES;
  if (!cases.includes(config.caseType)) throw new Error('Неизвестный тип дела');
  if (!['individual', 'organization', ...(economic ? ['ip'] : [])].includes(config.plaintiffType)) throw new Error('Недопустимый тип заявителя');
  if (economic && !['economic', 'appellate_economic', 'supreme_economic'].includes(config.courtLevel)) throw new Error('Недопустимый тип суда');
  if (config.caseType === 'non_property_ip' && config.plaintiffType !== 'ip'
    || config.caseType === 'non_property_org' && config.plaintiffType !== 'organization'
    || config.caseType === 'non_property_person' && config.plaintiffType !== 'individual') throw new Error('Тип требования не соответствует заявителю');
  if ('isRepeated' in config && config.isRepeated !== undefined && typeof config.isRepeated !== 'boolean') throw new Error('Повторность должна быть логическим значением');
  const bv = toDutyUnits(baseValue);
  const price = amount === undefined ? undefined : toDutyUnits(amount);
  const property = () => {
    if (price === undefined) throw new Error('Для имущественного требования необходима сумма');
    return calculatePropertyDutyUnits(price, bv, economic ? 'economic' : 'common');
  };
  if (COMPLAINT_CASES.includes(config.caseType)) {
    if (price !== undefined) return property() * 8n / 10n;
    if (!config.originalCaseType || COMPLAINT_CASES.includes(config.originalCaseType)) throw new Error('Укажите исходный вид требования');
    if (!economic && config.caseType === 'appeal' && config.plaintiffType === 'individual'
      && ['alimony', 'divorce', 'divorce_repeat', 'divorce_missing'].includes(config.originalCaseType)) return 0n;
    if (!economic && config.originalCaseType === 'alimony') throw new Error('Льгота для этой стадии требует отдельной проверки');
    if (economic) {
      const dependent = ['non_property_org', 'non_property_ip', 'non_property_person', 'challenge_act', 'fact_establishment'];
      if (dependent.includes(config.originalCaseType) && !config.originalCourtLevel) throw new Error('Укажите суд исходного требования');
      return dutyUnits({ ...config, caseType: config.originalCaseType, courtLevel: config.originalCourtLevel ?? config.courtLevel,
        originalCaseType: undefined, originalCourtLevel: undefined }, baseValue) * 8n / 10n;
    }
    return dutyUnits({ ...config, caseType: config.originalCaseType, originalCaseType: undefined }, baseValue) * 8n / 10n;
  }
  switch (config.caseType) {
    case 'property': return property();
    case 'property_quality': return property() * 8n / 10n;
    case 'court_order':
      if (price === undefined) throw new Error('Для приказного производства необходима сумма');
      if (price === 100n * bv || price === 300n * bv) throw new Error('Точный порог приказного производства требует подтверждения тарифа');
      return (price < 100n * bv ? 2n : price < 300n * bv ? 5n : 7n) * bv;
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
      if (economic && config.courtLevel === 'supreme_economic') throw new Error('Для этого требования тариф Верховного Суда не поддержан');
      return (economic ? config.courtLevel === 'appellate_economic' ? 15n : 10n : 2n) * bv;
    case 'administrative': {
      if (!('administrativePenalty' in config) || !['fine', 'other'].includes(config.administrativePenalty ?? '')) throw new Error('Укажите вид административного взыскания');
      if (config.administrativePenalty === 'other') return bv;
      assertPositiveMoney(config.fineAmount, 'Размер штрафа');
      const fine = toDutyUnits(config.fineAmount);
      return fine < 10n * bv ? bv / 2n : fine < 100n * bv ? 2n * bv : 3n * bv;
    }
    default: throw new Error('Неизвестный тип дела');
  }
}

export function calculateDutyWithBaseValue(config: CourtRatesConfig | EconomicRatesConfig, baseValue: number, amount?: number): number {
  return fromDutyUnits(dutyUnits(config, baseValue, amount));
}
