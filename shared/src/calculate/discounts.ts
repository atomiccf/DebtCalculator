import type { DutyCaseType } from './dutyRequirements';
import type { CourtType, OriginalCaseType, PlaintiffType } from './dutyTypes';

/** Reference information, not an eligibility decision or an executable duty rule. */
export interface Discount {
  readonly kind: 'reference-only';
  /** Stable catalog identifier; it is not a legal citation. */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly articleRef: string;
  readonly appliesTo: readonly PlaintiffType[];
  readonly courtTypes: readonly CourtType[];
  readonly caseTypes: readonly DutyCaseType[];
  /** Relevant original claims when caseTypes contains a complaint stage. */
  readonly originalCaseTypes?: readonly OriginalCaseType[];
}

/**
 * Incomplete reference subset from LEGAL_REVIEW.md for the reviewed 2026 edition.
 * Automatic exemptions are implemented in rules2026.ts and dutyRequirements.ts;
 * adding an entry here never changes the calculated duty.
 */
export const discounts: readonly Discount[] = [
  {
    kind: 'reference-only',
    id: '1.1',
    name: 'Истцы по алиментам',
    description: 'Освобождение истца по требованию о взыскании алиментов в суде общей юрисдикции',
    articleRef: 'подп. 1.1.2 ст. 285 НК',
    appliesTo: ['individual', 'organization'],
    courtTypes: ['common'],
    caseTypes: ['alimony'],
  },
  {
    kind: 'reference-only',
    id: '1.3.4',
    name: 'Апелляция по расторжению брака',
    description: 'Освобождение физического лица при подаче апелляционной жалобы по делу о расторжении брака без раздела имущества',
    articleRef: 'подп. 1.3.4 ст. 285 НК',
    appliesTo: ['individual'],
    courtTypes: ['common'],
    caseTypes: ['appeal'],
    originalCaseTypes: ['divorce', 'divorce_repeat', 'divorce_missing'],
  },
];

export function getDiscountById(id: string): Discount | undefined {
  return discounts.find(d => d.id === id);
}

/**
 * Filters references by court and claim only, without checking the applicant,
 * original claim, amount, date or other legal facts. A match grants no exemption.
 */
export function getDiscountsForCourt(courtType: CourtType, caseType: DutyCaseType): Discount[] {
  return discounts.filter(d => d.courtTypes.includes(courtType) && d.caseTypes.includes(caseType));
}
