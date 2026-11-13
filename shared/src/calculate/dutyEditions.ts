import { CalculationError } from '../utils/calculationError';
import { DateInput, parseDate } from '../utils/dateUtils';
import { getEffectiveRecord } from '../referenceData/effectiveRecord';
import { DUTY_EDITION_2026 } from './rules2026';
import type { DutyEdition, DutyRules } from './dutyEdition';

/** Add reviewed editions here; retain older implementations for replay. */
export const dutyEditions: readonly DutyEdition[] = Object.freeze([DUTY_EDITION_2026]);
export const dutyRulesHistory: readonly DutyRules[] = Object.freeze(dutyEditions.map(edition => edition.rules));

export function getDutyEdition(date: DateInput, editions: readonly DutyEdition[] = dutyEditions): DutyEdition {
  // Validate the calendar date before reporting an unsupported edition.
  const target = parseDate(date);
  const records = editions.map(edition => ({ ...edition.rules, edition }));
  try { return getEffectiveRecord(records, target).edition; }
  catch (error) {
    if (!(error instanceof CalculationError)) throw error;
    throw new CalculationError(`Нет проверенной редакции тарифов на дату ${target.toString()}`);
  }
}

export function getDutyEditionByVersion(version: string, editions: readonly DutyEdition[] = dutyEditions): DutyEdition {
  const edition = editions.find(entry => entry.rules.version === version);
  if (!edition) throw new CalculationError('Неподдерживаемая версия тарифов');
  return edition;
}

export function getDutyRulesInfo(date: DateInput): DutyRules {
  return getDutyEdition(date).rules;
}

export function assertDutyRulesDate(date: DateInput): void {
  getDutyRulesInfo(date);
}
