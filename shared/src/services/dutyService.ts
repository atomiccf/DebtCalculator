import { calculateCommonCourtDuty, calculateEconomicCourtDuty } from '../calculate';
import { DUTY_RULES_2026 } from '../calculate/rules2026';
import { getBaseValueInfo } from '../api/baseValue';
import type { DutyRequest, DutyResponse } from '../contracts/types';
import { referenceWarning } from './referenceWarning';

/** Application services accept validated inputs and own calculation orchestration. */
export function calculateDutyService(input: DutyRequest): DutyResponse {
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
