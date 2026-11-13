import { calculateDailyAccrual, CALCULATION_RULES_VERSION, ACCRUAL_RULES } from '../penalty/accrual';
import { sumMoney } from '../utils/money';
import type { PenaltyRequest, PenaltyMultipleRequest, PenaltyResponse, PenaltyMultipleResponse } from '../contracts/types';

export function calculatePenaltyService(input: PenaltyRequest): PenaltyResponse {
  const result = calculateDailyAccrual(input);
  return { ...result, type: 'penalty', penalty: result.amount,
    rules: ACCRUAL_RULES,
    methodology: { kind: 'daily', periodIncludes: 'both', rounding: 'half-up' },
    referenceData: { dailyRate: { value: result.rate, dateFrom: result.startDate, dateTo: result.endDate, source: 'user-input' } }, warnings: [] };
}

export function calculatePenaltyMultipleService(input: PenaltyMultipleRequest): PenaltyMultipleResponse {
  const { documents, rate } = input;
  const results = documents.map(doc => ({ ...calculatePenaltyService({ ...doc, rate }), name: doc.name.trim() }));
  const { methodology, warnings } = results[0];
  return { results, total: sumMoney(results.map(r => r.amount)), type: 'penalty', rate,
    rulesVersion: CALCULATION_RULES_VERSION, rules: ACCRUAL_RULES, methodology, referenceData: {}, warnings };
}
