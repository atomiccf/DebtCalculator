import { getBaseValue } from '../api/baseValue';
import { DateInput, today } from '../utils/dateUtils';
import { getDutyRulesInfo } from './dutyEditions';
import { calculateDutyWithBaseValue, calculateDutyWithRules } from './dutyRules';
import { COMMON_CASES } from './dutyRequirements';
import type { AdministrativePenalty } from './dutyTypes';

export type CaseType = typeof COMMON_CASES[number];
export interface CourtRatesConfig {
  caseType: CaseType;
  isRepeated?: boolean;
  plaintiffType: 'individual' | 'organization';
  originalCaseType?: Exclude<CaseType, 'appeal' | 'cassation' | 'supervision'>;
  administrativePenalty?: AdministrativePenalty;
  fineAmount?: number;
}
export function calculateCommonCourtDutyWithBaseValue(config: CourtRatesConfig, baseValue: number, amount?: number): number {
  return calculateDutyWithBaseValue(config, baseValue, amount);
}
export function calculateCommonCourtDuty(config: CourtRatesConfig, amount?: number, date: DateInput = today()): number {
  const rules = getDutyRulesInfo(date);
  return calculateDutyWithRules(config, getBaseValue(date), rules, amount);
}

export function getCaseTypesList(): { id: CaseType; name: string }[] {
  return [
    { id: 'contract_dispute', name: 'Договорный спор' },
    { id: 'property', name: 'Исковое заявление имущественного характера' },
    { id: 'non_property', name: 'Исковое заявление неимущественного характера' },
    { id: 'divorce', name: 'Расторжение брака' },
    { id: 'divorce_repeat', name: 'Расторжение повторного брака' },
    { id: 'divorce_missing', name: 'Расторжение брака с безвестно отсутствующим/недееспособным' },
    { id: 'paternity', name: 'Установление отцовства' },
    { id: 'alimony', name: 'Взыскание алиментов' },
    { id: 'appeal', name: 'Апелляционная жалоба' },
    { id: 'cassation', name: 'Кассационная жалоба' },
    { id: 'supervision', name: 'Надзорная жалоба' },
    { id: 'court_order', name: 'Заявление о вынесении судебного приказа' },
    { id: 'administrative', name: 'Дело об административном правонарушении' },
    { id: 'challenge_act', name: 'Заявление об оспаривании решения' },
    { id: 'fact_establishment', name: 'Заявление об установлении факта' },
  ];
}
