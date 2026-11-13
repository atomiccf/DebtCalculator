export { calculateCommonCourtDuty, calculateCommonCourtDutyWithBaseValue, getCaseTypesList, type CaseType, type CourtRatesConfig } from './commonCourts';
export { calculateEconomicCourtDuty, calculateEconomicCourtDutyWithBaseValue, getEconomicCaseTypesList, type EconomicCaseType, type EconomicRatesConfig } from './economicCourts';
export { DUTY_RULES_2026 } from './rules2026';
export { discounts, getDiscountById, getDiscountsForCourt, type Discount } from './discounts';
export * from './dutyTypes';
export { getBaseValue, getBaseValueInfo, baseValueHistory, type BaseValueRecord } from '../api/baseValue';
