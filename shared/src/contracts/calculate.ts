import { calculateCommonCourtDuty, calculateEconomicCourtDuty } from '../calculate';
import { DUTY_RULES_2026 } from '../calculate/rules2026';
import { getBaseValueInfo } from '../api/baseValue';
import { getRefinancingRateInfo } from '../api/refinancingRate';
import { calculateDailyAccrual, calculateAnnualAccrual, CALCULATION_RULES_VERSION } from '../penalty/accrual';
import { calculateInterest366 } from '../penalty/calculate';
import { sumMoney } from '../utils/money';
import { dutyRequestSchema, penaltyRequestSchema, penaltyMultipleRequestSchema, interest366RequestSchema, interest366MultipleRequestSchema } from './schemas';
import type { DutyResponse, PenaltyResponse, PenaltyMultipleResponse, Interest366Response, Interest366MultipleResponse, PenaltyRequest, CalculationMetadata } from './types';

const referenceWarning = 'Использован встроенный справочник; его актуальность для выбранной даты требует проверки.';

export function calculateDutyRequest(value: unknown): DutyResponse {
  const input = dutyRequestSchema.parse(value);
  const record = getBaseValueInfo(input.date);
  const amount = input.courtType === 'common'
    ? calculateCommonCourtDuty(input, input.amount, input.date)
    : calculateEconomicCourtDuty({ ...input, courtLevel: input.courtType }, input.amount, input.date);
  return { input, amount, baseValue: record.value,
    breakdown: input.courtType === 'common' ? 'Суд общей юрисдикции' : input.courtType === 'economic'
      ? 'Экономический суд' : input.courtType === 'appellate_economic' ? 'Апелляционный экономический суд' : 'Судебная коллегия по экономическим делам ВС РБ',
    rulesVersion: DUTY_RULES_2026.version, methodology: { kind: 'court-duty', rounding: 'half-up' },
    referenceData: { baseValue: { selectedOn: input.date, record } },
    warnings: [referenceWarning, 'Расчёт относится к одному самостоятельному требованию; специальные льготы требуют отдельной проверки.'] };
}

function penalty(input: PenaltyRequest): PenaltyResponse {
  const annual = input.annualRate !== undefined;
  const result = input.annualRate !== undefined
    ? calculateAnnualAccrual({ ...input, rate: input.annualRate, dayCount: input.dayCount })
    : calculateDailyAccrual(input);
  return { ...result, type: annual ? 'interest' : 'penalty', penalty: result.amount,
    ...(annual ? { annualRate: input.annualRate } : {}),
    methodology: { kind: annual ? 'annual' : 'daily', ...(annual ? { dayCount: input.dayCount } : {}), periodIncludes: 'both', rounding: 'half-up' },
    referenceData: {}, warnings: [] };
}
export function calculatePenaltyRequest(value: unknown): PenaltyResponse { return penalty(penaltyRequestSchema.parse(value)); }
export function calculatePenaltyMultipleRequest(value: unknown): PenaltyMultipleResponse {
  const input = penaltyMultipleRequestSchema.parse(value);
  const { documents, ...options } = input;
  const results = documents.map(doc => ({ ...penalty({ ...doc, ...options }), name: doc.name.trim() }));
  const { methodology, referenceData, warnings, type, rate } = results[0];
  return { results, total: sumMoney(results.map(r => r.amount)), type, rate,
    rulesVersion: CALCULATION_RULES_VERSION, methodology, referenceData, warnings };
}

export function calculateInterest366Request(value: unknown): Interest366Response {
  const input = interest366RequestSchema.parse(value);
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
export function calculateInterest366MultipleRequest(value: unknown): Interest366MultipleResponse {
  const input = interest366MultipleRequestSchema.parse(value);
  const { documents, ...options } = input;
  const results = documents.map(doc => {
    const { name, ...period } = doc;
    return { ...calculateInterest366Request({ ...period, ...options }), name: name.trim() };
  });
  return { results, total: sumMoney(results.map(r => r.interest)), rulesVersion: CALCULATION_RULES_VERSION,
    methodology: results[0].methodology,
    // Each row keeps its own rate snapshot (estimate dates can differ).
    referenceData: {}, warnings: [...new Set(results.flatMap(r => r.warnings))] };
}
