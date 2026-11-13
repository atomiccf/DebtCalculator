import { CalculationError } from '../utils/calculationError';
import { Temporal } from '@js-temporal/polyfill';
import { DateInput, parseDate } from '../utils/dateUtils';

export interface EffectiveRecord {
  readonly dateFrom: string;
  readonly dateTo?: string;
  /** Last date covered by this snapshot, not the legal end of the record. */
  readonly supportedThrough?: string;
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
    const supportedThrough = record.supportedThrough === undefined ? undefined : parseDate(record.supportedThrough);
    if (to && Temporal.PlainDate.compare(from, to) > 0) throw new Error('Некорректный период действия записи');
    if (supportedThrough && Temporal.PlainDate.compare(from, supportedThrough) > 0) throw new Error('Некорректная граница поддержки записи');
    if (Temporal.PlainDate.compare(from, target) <= 0 && (!to || Temporal.PlainDate.compare(target, to) <= 0)
      && (!supportedThrough || Temporal.PlainDate.compare(target, supportedThrough) <= 0)) {
      if (!match || Temporal.PlainDate.compare(from, parseDate(match.dateFrom)) > 0) match = record;
    }
  }
  if (!match) throw new CalculationError(`Нет справочных данных на дату ${target.toString()}`);
  return match;
}

/** Close historical intervals at the day before the next change, without mutating input. */
export function withEffectiveDates<T extends EffectiveRecord>(records: readonly T[]): readonly Readonly<T>[] {
  const sorted = [...records].sort((a, b) => b.dateFrom.localeCompare(a.dateFrom));
  return Object.freeze(sorted.map((record, index) => Object.freeze({ ...record,
    ...(record.dateTo === undefined && index > 0
      ? { dateTo: parseDate(sorted[index - 1].dateFrom).subtract({ days: 1 }).toString() } : {}),
  })));
}
