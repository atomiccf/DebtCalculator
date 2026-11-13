import { calculateDutyWithRules } from '../calculate/dutyRules';
import { getDutyRulesInfo } from '../calculate/dutyEditions';
import { getBaseValueInfo } from '../api/baseValue';
import type { DutyRequest, DutyResponse } from '../contracts/types';
import { referenceWarning } from './referenceWarning';

/** Application services accept validated inputs and own calculation orchestration. */
export function calculateDutyService(input: DutyRequest): DutyResponse {
  const rules = getDutyRulesInfo(input.date);
  const record = getBaseValueInfo(input.date);
  const config = input.courtType === 'common' ? input : { ...input, courtLevel: input.courtType };
  const amount = calculateDutyWithRules(config, record.value, rules, input.amount);
  return { input, amount, baseValue: record.value,
    breakdown: input.courtType === 'common' ? 'Суд общей юрисдикции' : input.courtType === 'economic'
      ? 'Экономический суд' : input.courtType === 'appellate_economic' ? 'Апелляционный экономический суд' : 'Судебная коллегия по экономическим делам ВС РБ',
    rulesVersion: rules.version, rules, methodology: { kind: 'court-duty', rounding: 'half-up' },
    referenceData: { baseValue: { selectedOn: input.date, record } },
    warnings: [referenceWarning, 'Расчёт относится к одному самостоятельному требованию; специальные льготы требуют отдельной проверки.'] };
}
