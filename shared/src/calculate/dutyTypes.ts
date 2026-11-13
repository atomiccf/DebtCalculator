import type { CaseType, CourtRatesConfig } from './commonCourts';
import type { EconomicCaseType, EconomicRatesConfig } from './economicCourts';

export type EconomicCourtLevel = 'economic' | 'appellate_economic' | 'supreme_economic';
export type CourtType = 'common' | EconomicCourtLevel;
export type PlaintiffType = 'individual' | 'organization' | 'ip';
export type AdministrativePenalty = 'fine' | 'other';
export type OriginalCaseType = Exclude<CaseType | EconomicCaseType, 'appeal' | 'cassation' | 'supervision'>;

export type DutyCalculationInput = { amount?: number; date: string } & (
  | ({ courtType: 'common' } & CourtRatesConfig)
  | ({ courtType: EconomicCourtLevel } & Omit<EconomicRatesConfig, 'courtLevel'>)
);

export interface DutyCalculationResult {
  amount: number;
  baseValue: number;
  discountApplied?: string;
  breakdown: string;
}
