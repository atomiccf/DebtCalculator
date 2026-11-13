import type { DutyCalculationInput, DutyCalculationResult } from '../calculate/dutyTypes';
import type { AnnualDayCount, AccrualResult } from '../penalty/accrual';
import type { Interest366Basis, Interest366Result } from '../penalty/calculate';
import type { BaseValueRecord } from '../api/baseValue';
import type { RefinancingRateHistory } from '../api/refinancingRate';
import type { CaseType } from '../calculate/commonCourts';
import type { EconomicCaseType } from '../calculate/economicCourts';

/** Calendar dates at the transport boundary are ISO YYYY-MM-DD strings, never timestamps. */
export type CalendarDate = string;
export type DutyRequest = DutyCalculationInput;
export interface PeriodRequest { debt: number; startDate: CalendarDate; endDate: CalendarDate }
export interface CalculationDocument extends PeriodRequest { name: string }
export type PenaltyOptions =
  | { rate: number; annualRate?: never; dayCount?: never }
  | { rate?: never; annualRate: number; dayCount: AnnualDayCount };
export type PenaltyRequest = PeriodRequest & PenaltyOptions;
export type PenaltyMultipleRequest = { documents: CalculationDocument[] } & PenaltyOptions;
export type Interest366RequestOptions = {
  calculationBasis: Interest366Basis;
  hasPenalty: boolean;
  statutoryException?: boolean;
  refinancingRate?: number;
} & (
  | { calculationBasis: 'estimate'; rateDate?: CalendarDate; dayCount?: AnnualDayCount }
  | { calculationBasis: Exclude<Interest366Basis, 'estimate'>; rateDate: CalendarDate; dayCount: AnnualDayCount }
);
export type Interest366Request = PeriodRequest & Interest366RequestOptions;
export type Interest366MultipleRequest = { documents: CalculationDocument[] } & Interest366RequestOptions;

export interface CalculationMetadata {
  rulesVersion: string;
  methodology: {
    kind: 'court-duty' | 'daily' | 'annual' | 'article-366';
    dayCount?: AnnualDayCount;
    periodIncludes?: 'both';
    rounding: 'half-up';
    calculationBasis?: Interest366Basis;
  };
  referenceData: {
    baseValue?: { selectedOn: CalendarDate; record: BaseValueRecord };
    refinancingRate?: { selectedOn: CalendarDate; origin: 'reference' | 'input'; value: number; record?: RefinancingRateHistory };
  };
  warnings: string[];
}
export type DutyResponse = DutyCalculationResult & CalculationMetadata & { input: DutyRequest };
export type PenaltyResponse = AccrualResult & CalculationMetadata & {
  type: 'penalty' | 'interest'; penalty: number; annualRate?: number;
};
export type PenaltyDocumentResponse = PenaltyResponse & { name: string };
export type PenaltyMultipleResponse = CalculationMetadata & {
  results: PenaltyDocumentResponse[]; total: number; type: 'penalty' | 'interest'; rate: number;
};
export type Interest366Response = Interest366Result & CalculationMetadata & { input: Interest366Request };
export type Interest366MultipleResponse = CalculationMetadata & { results: (Interest366Response & { name: string })[]; total: number };
export interface CaseTypesResponse {
  common: { id: CaseType; name: string }[];
  economic: { id: EconomicCaseType; name: string }[];
}
export interface ValidationIssue { path: string; message: string }
export interface ApiErrorResponse { error: string; issues?: ValidationIssue[] }
