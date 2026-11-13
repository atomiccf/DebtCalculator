import { getBaseValue } from '../api/baseValue';
import { DateInput, today } from '../utils/dateUtils';
import { getDutyRulesInfo } from './dutyEditions';
import { calculateDutyWithBaseValue, calculateDutyWithRules } from './dutyRules';
import { ECONOMIC_CASES } from './dutyRequirements';
import type { EconomicCourtLevel, PlaintiffType } from './dutyTypes';

export type EconomicCaseType = typeof ECONOMIC_CASES[number];
export interface EconomicRatesConfig {
  caseType: EconomicCaseType;
  plaintiffType: PlaintiffType;
  courtLevel: EconomicCourtLevel;
  originalCaseType?: Exclude<EconomicCaseType, 'appeal' | 'cassation' | 'supervision'>;
  originalCourtLevel?: EconomicCourtLevel;
}
export function calculateEconomicCourtDutyWithBaseValue(config: EconomicRatesConfig, baseValue: number, amount?: number): number {
  return calculateDutyWithBaseValue(config, baseValue, amount);
}
export function calculateEconomicCourtDuty(config: EconomicRatesConfig, amount?: number, date: DateInput = today()): number {
  const rules = getDutyRulesInfo(date);
  return calculateDutyWithRules(config, getBaseValue(date), rules, amount);
}

export function getEconomicCaseTypesList(): { id: EconomicCaseType; name: string }[] {
  return [
    { id: 'contract_dispute', name: 'Договорный спор' },
    { id: 'property', name: 'Исковое заявление имущественного характера' },
    { id: 'property_quality', name: 'Исковое заявление по спору о качестве поставленного товара' },
    { id: 'non_property_org', name: 'Исковое заявление неимущественного характера (юрлицо)' },
    { id: 'non_property_ip', name: 'Исковое заявление неимущественного характера (ИП)' },
    { id: 'non_property_person', name: 'Исковое заявление неимущественного характера (гражданин)' },
    { id: 'subsidiary', name: 'Исковое заявление о привлечении к субсидиарной ответственности' },
    { id: 'appeal', name: 'Апелляционная жалоба' },
    { id: 'cassation', name: 'Кассационная жалоба' },
    { id: 'supervision', name: 'Надзорная жалоба' },
    { id: 'court_order', name: 'Заявление о возбуждении приказного производства' },
    { id: 'bankruptcy', name: 'Заявление о признании банкротом' },
    { id: 'fact_establishment', name: 'Заявление об установлении фактов' },
    { id: 'challenge_act', name: 'Заявление об оспаривании решений' },
    { id: 'other_complaint', name: 'Иная жалоба' },
  ];
}
