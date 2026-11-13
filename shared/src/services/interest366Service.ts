import { getRefinancingRateInfo } from '../api/refinancingRate';
import { calculateInterest366WithRate } from '../penalty/calculate';
import { CALCULATION_RULES_VERSION } from '../penalty/accrual';
import { parseDate } from '../utils/dateUtils';
import { sumMoney } from '../utils/money';
import type { Interest366Request, Interest366MultipleRequest, Interest366Response, Interest366MultipleResponse, CalculationMetadata } from '../contracts/types';
import { referenceWarning } from './referenceWarning';

export const INTEREST_366_RULES = Object.freeze({
  version: `by-gk-366-review-2026-10-20+accrual-${CALCULATION_RULES_VERSION}`,
  source: 'https://etalonline.by/document/?regnum=hk9800218',
  verifiedOn: '2026-10-20',
  provisions: 'ГК: статья 366; способ начисления и делитель указаны в methodology. Исторические редакции ГК не устанавливаются.',
});

export function calculateInterest366Service(input: Interest366Request): Interest366Response {
  const rateDate = parseDate(input.rateDate ?? input.endDate).toString();
  const explicit = input.refinancingRate !== undefined;
  const record = explicit ? undefined : getRefinancingRateInfo(rateDate);
  const refinancingRate = explicit ? input.refinancingRate! : record!.value;
  const result = calculateInterest366WithRate({ ...input, rateDate, refinancingRate });
  const referenceData: CalculationMetadata['referenceData'] = { refinancingRate: {
    selectedOn: result.rateDate, origin: explicit ? 'input' : 'reference', value: result.refinancingRate,
    dateFrom: record?.dateFrom ?? null, dateTo: record?.dateTo ?? null,
    source: record?.source ?? 'user-input', version: record?.version ?? 'user-input',
    ...(record ? { record } : {}),
  } };
  return { ...result, input, rulesVersion: INTEREST_366_RULES.version, rules: INTEREST_366_RULES,
    methodology: { kind: 'article-366', calculationBasis: result.calculationBasis,
    dayCount: result.dayCount, periodIncludes: 'both', rounding: 'half-up' }, referenceData,
    warnings: [...result.warnings, ...(explicit ? [] : [referenceWarning])] };
}

export function calculateInterest366MultipleService(input: Interest366MultipleRequest): Interest366MultipleResponse {
  const { documents, ...options } = input;
  const results = documents.map(doc => {
    const { name, ...period } = doc;
    return { ...calculateInterest366Service({ ...period, ...options }), name: name.trim() };
  });
  return { results, total: sumMoney(results.map(r => r.interest)), rulesVersion: INTEREST_366_RULES.version, rules: INTEREST_366_RULES,
    methodology: results[0].methodology,
    // Each row keeps its own rate snapshot (estimate dates can differ).
    referenceData: {}, warnings: [...new Set(results.flatMap(r => r.warnings))] };
}
