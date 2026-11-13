import { assertPositiveMoney } from '../utils/money';
import type { ValidationIssue } from '../contracts/types';
import type { CourtType, EconomicCourtLevel, PlaintiffType } from './dutyTypes';

export const COMMON_CASES = ['property', 'non_property', 'divorce', 'divorce_repeat', 'divorce_missing', 'paternity', 'alimony', 'appeal', 'cassation', 'supervision', 'court_order', 'administrative', 'challenge_act', 'fact_establishment', 'contract_dispute'] as const;
export const ECONOMIC_CASES = ['property', 'property_quality', 'non_property_org', 'non_property_ip', 'non_property_person', 'subsidiary', 'appeal', 'cassation', 'supervision', 'court_order', 'bankruptcy', 'fact_establishment', 'challenge_act', 'other_complaint', 'contract_dispute'] as const;
export const COMPLAINT_CASES: readonly string[] = ['appeal', 'cassation', 'supervision'];
export const ECONOMIC_COURTS: readonly EconomicCourtLevel[] = ['economic', 'appellate_economic', 'supreme_economic'];
export const DUTY_COURTS: readonly CourtType[] = ['common', ...ECONOMIC_COURTS];
const COMMON_PLAINTIFFS: readonly PlaintiffType[] = ['individual', 'organization'];
const ECONOMIC_PLAINTIFFS: readonly PlaintiffType[] = [...COMMON_PLAINTIFFS, 'ip'];
const ADMINISTRATIVE_PENALTIES = ['fine', 'other'];

export type DutyCaseType = typeof COMMON_CASES[number] | typeof ECONOMIC_CASES[number];
interface CaseRequirements {
  amount?: boolean;
  plaintiff?: PlaintiffType;
  courtDependent?: boolean;
  excludedCourts?: readonly CourtType[];
  isRepeated?: boolean;
  administrativePenalty?: boolean;
  individualAppealExempt?: boolean;
}

// Applicability and required facts live here; tariff arithmetic stays in dutyRules.
const CASE_REQUIREMENTS: Partial<Record<DutyCaseType, CaseRequirements>> = {
  property: { amount: true },
  property_quality: { amount: true },
  court_order: { amount: true },
  non_property_org: { plaintiff: 'organization', courtDependent: true },
  non_property_ip: { plaintiff: 'ip', courtDependent: true },
  non_property_person: { plaintiff: 'individual', courtDependent: true },
  challenge_act: { courtDependent: true },
  fact_establishment: { courtDependent: true, excludedCourts: ['supreme_economic'] },
  divorce: { isRepeated: true, individualAppealExempt: true },
  divorce_repeat: { individualAppealExempt: true },
  divorce_missing: { individualAppealExempt: true },
  alimony: { individualAppealExempt: true },
  administrative: { administrativePenalty: true },
};

/** Also accepts untrusted values at the schema and calculation boundaries. */
export interface DutyRequirementInput {
  courtType: unknown;
  plaintiffType: unknown;
  caseType: unknown;
  amount?: unknown;
  originalCaseType?: unknown;
  originalCourtLevel?: unknown;
  isRepeated?: unknown;
  administrativePenalty?: unknown;
  fineAmount?: unknown;
}

function caseRequirements(caseType: unknown): CaseRequirements {
  return typeof caseType === 'string' && Object.prototype.hasOwnProperty.call(CASE_REQUIREMENTS, caseType)
    ? CASE_REQUIREMENTS[caseType as DutyCaseType]! : {};
}

export function getDutyCaseTypes(courtType: unknown): readonly string[] {
  return courtType === 'common' ? COMMON_CASES : ECONOMIC_CASES;
}

export function getDutyPlaintiffTypes(courtType: unknown): readonly PlaintiffType[] {
  return courtType === 'common' ? COMMON_PLAINTIFFS : ECONOMIC_PLAINTIFFS;
}

function caseIssue(input: DutyRequirementInput, path = 'caseType'): ValidationIssue | undefined {
  if (!getDutyCaseTypes(input.courtType).includes(input.caseType as string)) return { path, message: 'Неизвестный тип дела' };
  const rules = caseRequirements(input.caseType);
  if (rules.plaintiff && rules.plaintiff !== input.plaintiffType) return { path: 'plaintiffType', message: 'Тип требования не соответствует заявителю' };
  if (rules.excludedCourts?.includes(input.courtType as CourtType)) return { path, message: 'Для этого требования тариф Верховного Суда не поддержан' };
}

export function isDutyCaseAvailable(input: DutyRequirementInput): boolean {
  return DUTY_COURTS.includes(input.courtType as CourtType)
    && getDutyPlaintiffTypes(input.courtType).includes(input.plaintiffType as PlaintiffType) && !caseIssue(input);
}

export function getDutyOriginalCourtLevels(originalCaseType: unknown): readonly EconomicCourtLevel[] {
  return ECONOMIC_COURTS.filter(court => !caseRequirements(originalCaseType).excludedCourts?.includes(court));
}

export function isDutyOriginalCaseAvailable(input: DutyRequirementInput, originalCaseType: unknown): boolean {
  // The original claim can belong to a lower court, including fact establishment.
  return COMPLAINT_CASES.includes(input.caseType as string)
    && !COMPLAINT_CASES.includes(originalCaseType as string)
    && !caseRequirements(originalCaseType).amount
    && isDutyCaseAvailable({ ...input, courtType: input.courtType === 'common' ? 'common' : 'economic', caseType: originalCaseType })
    && (originalCaseType !== 'alimony' || isDutyIndividualAppealExempt(input, originalCaseType));
}

export function isDutyIndividualAppealExempt(input: DutyRequirementInput, originalCaseType = input.originalCaseType): boolean {
  return input.courtType === 'common' && input.caseType === 'appeal' && input.plaintiffType === 'individual'
    && caseRequirements(originalCaseType).individualAppealExempt === true;
}

export function getDutyRequirements(input: DutyRequirementInput) {
  const complaint = COMPLAINT_CASES.includes(input.caseType as string);
  const originalCaseType = complaint && input.amount === undefined;
  const rules = caseRequirements(originalCaseType ? input.originalCaseType : input.caseType);
  const administrativePenalty = input.courtType === 'common' && rules.administrativePenalty === true;
  return {
    complaint,
    amount: caseRequirements(input.caseType).amount === true || complaint && !originalCaseType,
    originalCaseType,
    showOriginalCourt: input.courtType !== 'common' && originalCaseType,
    originalCourtLevel: input.courtType !== 'common' && originalCaseType && rules.courtDependent === true,
    isRepeated: input.courtType === 'common' && rules.isRepeated === true,
    administrativePenalty,
    fineAmount: administrativePenalty && input.administrativePenalty === 'fine',
  };
}

/** Shared domain validation, independent of transport dates and unknown-key checks. */
export function validateDutyRequirements(input: DutyRequirementInput, courts: readonly CourtType[] = DUTY_COURTS): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const one = (value: unknown, choices: readonly unknown[], path: string) => {
    if (!choices.includes(value)) add(path, `Выберите значение: ${choices.join(', ')}`);
  };
  const money = (value: unknown, path: string) => {
    try { assertPositiveMoney(value); }
    catch { add(path, 'Укажите положительную сумму BYN с точностью до копеек'); }
  };
  const required = getDutyRequirements(input);
  one(input.courtType, courts, 'courtType');
  one(input.plaintiffType, getDutyPlaintiffTypes(input.courtType), 'plaintiffType');
  const issue = caseIssue(input);
  if (issue) issues.push(issue);
  if (input.amount !== undefined || required.amount) money(input.amount, 'amount');
  if (input.isRepeated !== undefined && typeof input.isRepeated !== 'boolean') add('isRepeated', 'Укажите логическое значение');
  if (input.originalCaseType !== undefined || required.originalCaseType) {
    const originals = getDutyCaseTypes(input.courtType).filter(ct => !COMPLAINT_CASES.includes(ct));
    one(input.originalCaseType, originals, 'originalCaseType');
    if (required.originalCaseType && originals.includes(input.originalCaseType as string)) {
      if (caseRequirements(input.originalCaseType).amount) money(input.amount, 'amount');
      const originalIssue = caseIssue({ ...input, caseType: input.originalCaseType,
        courtType: input.courtType === 'common' ? 'common' : input.originalCourtLevel ?? input.courtType }, 'originalCaseType');
      if (originalIssue) issues.push({ ...originalIssue,
        path: originalIssue.path === 'originalCaseType' && input.originalCourtLevel !== undefined ? 'originalCourtLevel' : originalIssue.path });
      if (input.originalCaseType === 'alimony' && !isDutyIndividualAppealExempt(input)) add('originalCaseType', 'Льгота для этой стадии требует отдельной проверки');
    }
  }
  if (input.originalCourtLevel !== undefined || required.originalCourtLevel) one(input.originalCourtLevel, ECONOMIC_COURTS, 'originalCourtLevel');
  if (input.administrativePenalty !== undefined || required.administrativePenalty) one(input.administrativePenalty, ADMINISTRATIVE_PENALTIES, 'administrativePenalty');
  if (input.fineAmount !== undefined || required.fineAmount) money(input.fineAmount, 'fineAmount');
  return issues;
}
