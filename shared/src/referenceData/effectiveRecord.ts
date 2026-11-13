import { CalculationError } from '../utils/calculationError';
import { Temporal } from '@js-temporal/polyfill';
import { DateInput, parseDate } from '../utils/dateUtils';

export interface EffectiveRecord {
  readonly dateFrom: string;
  readonly dateTo?: string;
}

/** Select from an explicitly supplied history; never substitute a future record. */
export function getEffectiveRecord<T extends EffectiveRecord>(records: readonly T[], date: DateInput): T {
  const target = parseDate(date);
  let match: T | undefined;
  const dates = new Set<string>();
  for (const record of records) {
    const from = parseDate(record.dateFrom);
    if (dates.has(from.toString())) throw new Error('Несколько справочных записей имеют одинаковую дату начала');
    dates.add(from.toString());
    const to = record.dateTo === undefined ? undefined : parseDate(record.dateTo);
    if (to && Temporal.PlainDate.compare(from, to) > 0) throw new Error('Некорректный период действия записи');
    if (Temporal.PlainDate.compare(from, target) <= 0 && (!to || Temporal.PlainDate.compare(target, to) <= 0)) {
      if (!match || Temporal.PlainDate.compare(from, parseDate(match.dateFrom)) > 0) match = record;
    }
  }
  if (!match) throw new CalculationError(`Нет справочных данных на дату ${target.toString()}`);
  return match;
}
