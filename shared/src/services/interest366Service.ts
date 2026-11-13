import { getRefinancingRateInfo } from '../api/refinancingRate';
import { calculateInterest366 } from '../penalty/calculate';
import { CALCULATION_RULES_VERSION } from '../penalty/accrual';
import { sumMoney } from '../utils/money';
import type { Interest366Request, Interest366MultipleRequest, Interest366Response, Interest366MultipleResponse, CalculationMetadata } from '../contracts/types';
import { referenceWarning } from './referenceWarning';

export function calculateInterest366Service(input: Interest366Request): Interest366Response {
  const result = calculateInterest366(input);
  const explicit = input.refinancingRate !== undefined;
  const referenceData: CalculationMetadata['referenceData'] = { refinancingRate: {
    selectedOn: result.rateDate, origin: explicit ? 'input' : 'reference', value: result.refinancingRate,
    ...(explicit ? {} : { record: getRefinancingRateInfo(result.rateDate) }),
  } };
  return { ...result, input, methodology: { kind: 'article-366', calculationBasis: result.calculationBasis,
    dayCount: result.dayCount, periodIncludes: 'both', rounding: 'half-up' }, referenceData,
    warnings: [...result.warnings, ...(explicit ? [] : [referenceWarning])] };
}

export function calculateInterest366MultipleService(input: Interest366MultipleRequest): Interest366MultipleResponse {
  const { documents, ...options } = input;
  const results = documents.map(doc => {
    const { name, ...period } = doc;
    return { ...calculateInterest366Service({ ...period, ...options }), name: name.trim() };
  });
  return { results, total: sumMoney(results.map(r => r.interest)), rulesVersion: CALCULATION_RULES_VERSION,
    methodology: results[0].methodology,
    // Each row keeps its own rate snapshot (estimate dates can differ).
    referenceData: {}, warnings: [...new Set(results.flatMap(r => r.warnings))] };
}
