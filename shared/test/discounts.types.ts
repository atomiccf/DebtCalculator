import {
  discounts, getDiscountsForCourt,
  type CourtType, type DutyCaseType, type PlaintiffType,
} from '../src';

declare const courtType: CourtType;
declare const caseType: DutyCaseType;

// The lookup accepts the calculation contract, including supreme_economic.
getDiscountsForCourt(courtType, caseType);
getDiscountsForCourt('supreme_economic', 'property_quality');

const entry = discounts[0];
const court: CourtType = entry.courtTypes[0];
const claim: DutyCaseType = entry.caseTypes[0];
const plaintiff: PlaintiffType = entry.appliesTo[0];
const kind: 'reference-only' = entry.kind;
void [court, claim, plaintiff, kind];

// @ts-expect-error The obsolete court identifier is not in the duty contract.
getDiscountsForCourt('supreme', 'bankruptcy');
// @ts-expect-error Reference topics must not be invented calculation claim types.
getDiscountsForCourt('economic', 'quality_dispute');
// @ts-expect-error Wildcards are not calculation claim types.
getDiscountsForCourt('common', 'all');
// @ts-expect-error Reference metadata cannot be changed by a typed consumer.
entry.caseTypes.push('property');
