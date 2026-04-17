import { calculateCommonCourtDuty, getCaseTypesList, CaseType, CourtRatesConfig } from './rates/commonCourts';
import { calculateEconomicCourtDuty, getEconomicCaseTypesList, EconomicCaseType, EconomicRatesConfig } from './rates/economicCourts';
import { discounts, getDiscountById, getDiscountsForCourt, Discount } from './discounts';
import { getBaseValue, getBaseValueInfo, baseValueHistory, BaseValueRecord } from '../api/basicValues';

export { calculateCommonCourtDuty, getCaseTypesList, CaseType, CourtRatesConfig };
export { calculateEconomicCourtDuty, getEconomicCaseTypesList, EconomicCaseType, EconomicRatesConfig };
export { discounts, getDiscountById, getDiscountsForCourt, Discount };
export { getBaseValue, getBaseValueInfo, baseValueHistory, BaseValueRecord };

export type CourtType = 'common' | 'economic' | 'supreme' | 'supreme_economic' | 'ip';

export interface DutyCalculationInput {
  courtType: CourtType;
  caseType: string;
  plaintiffType: 'individual' | 'organization' | 'ip';
  amount?: number;
  date?: Date | string;
  discountId?: string;
}

export interface DutyCalculationResult {
  amount: number;
  baseValue: number;
  discountApplied?: string;
  breakdown: string;
}

export function calculateDuty(input: DutyCalculationInput): DutyCalculationResult {
  const baseValue = input.date ? getBaseValue(input.date) : getBaseValue(new Date());
  let dutyAmount = 0;
  let breakdown = '';
  
  const config = {
    caseType: input.caseType,
    plaintiffType: input.plaintiffType,
    isRepeated: false
  };

  switch (input.courtType) {
    case 'common':
      dutyAmount = calculateCommonCourtDuty(config as any, input.amount, input.date || new Date());
      breakdown = 'Суд общей юрисдикции';
      break;
    case 'economic':
      dutyAmount = calculateEconomicCourtDuty(
        { caseType: input.caseType as any, plaintiffType: input.plaintiffType as any, courtLevel: 'economic' },
        input.amount,
        input.date || new Date()
      );
      breakdown = 'Экономический суд';
      break;
    case 'supreme_economic':
      dutyAmount = calculateEconomicCourtDuty(
        { caseType: input.caseType as any, plaintiffType: input.plaintiffType as any, courtLevel: 'supreme_economic' },
        input.amount,
        input.date || new Date()
      );
      breakdown = 'Судебная коллегия по экономическим делам ВС РБ';
      break;
    default:
      throw new Error('Тип суда не поддерживается');
  }

  return {
    amount: Math.round(dutyAmount * 100) / 100,
    baseValue,
    breakdown
  };
}