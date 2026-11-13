import { calculateDailyAccrual, CALCULATION_RULES_VERSION } from '../penalty/accrual';
import { sumMoney } from '../utils/money';
import type { PenaltyRequest, PenaltyMultipleRequest, PenaltyResponse, PenaltyMultipleResponse } from '../contracts/types';

export function calculatePenaltyService(input: PenaltyRequest): PenaltyResponse {
  const result = calculateDailyAccrual(input);
  return { ...result, type: 'penalty', penalty: result.amount,
    methodology: { kind: 'daily', periodIncludes: 'both', rounding: 'half-up' },
    referenceData: {}, warnings: [] };
}

export function calculatePenaltyMultipleService(input: PenaltyMultipleRequest): PenaltyMultipleResponse {
  const { documents, rate } = input;
  const results = documents.map(doc => ({ ...calculatePenaltyService({ ...doc, rate }), name: doc.name.trim() }));
  const { methodology, referenceData, warnings } = results[0];
  return { results, total: sumMoney(results.map(r => r.amount)), type: 'penalty', rate,
    rulesVersion: CALCULATION_RULES_VERSION, methodology, referenceData, warnings };
}
