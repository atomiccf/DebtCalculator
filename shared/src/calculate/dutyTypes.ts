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